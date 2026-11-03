import { useEffect, useRef, useState } from 'react';
import { AVATARS } from '../core/engine.js';
import { BUILDINGS, PLAZA, SPAWN, WORLD, byId, drawBuilding, drawGround, drawToken, drawTrees, hit, roundRect, solids } from '../map/world.js';

const SPEED = 230; // 초당 픽셀
const R = 14; // 몸 반지름

export function goalOf(m) {
  if (!m) return null;
  return { notice: 'board', agora: 'agora', adopt: 'agora', vote: 'acropolis', oracle: 'oracle' }[m.stage] || null;
}
export function isOpen(id, m) {
  if (!m) return false;
  if (id === 'board') return true;
  if (id === 'agora') return m.stage === 'agora' || m.stage === 'adopt';
  if (id === 'acropolis') return m.stage === 'vote';
  if (id === 'oracle') return m.stage === 'oracle';
  return false;
}
const QUEST = {
  none: '폴리스를 둘러보세요. 선생님이 주제를 정하면 전령의 게시판에 붙어요.',
  notice: '📜 전령의 게시판에서 오늘의 회의 주제를 읽어 보세요.',
  agora: '🗣️ 아고라 광장으로 가서 의견을 남기고, 친구 의견에 올리브 가지를 달아 보세요.',
  adopt: '🌿 아고라 광장에서 선생님이 의견을 고르는 중이에요.',
  vote: '🏺 아크로폴리스 성문이 열렸어요! 언덕 위로 올라가 투표하세요.',
  oracle: '🔮 델포이 신전에 신탁이 내려졌어요. 들어가 판결을 들어 보세요.',
};

const imgCache = {};
function avatarImg(id) {
  if (!id || !AVATARS.some((a) => a.id === id)) return null;
  if (!imgCache[id]) {
    const im = new Image();
    im.src = `img/avatars/${id}.png`;
    imgCache[id] = im;
  }
  return imgCache[id];
}

const POS_KEY = 'polis-map-pos';

export default function PolisMap({ v, renderPanel, onPlace }) {
  const m = v.meeting;
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [inside, setInside] = useState(null);
  const [bubble, setBubble] = useState(null);
  const live = useRef({});
  live.current.m = m;
  live.current.crowd = v.crowd || {};
  live.current.me = v.me;
  live.current.inside = inside;

  const st = useRef(null);
  if (!st.current) {
    let pos = SPAWN;
    try {
      const p = JSON.parse(sessionStorage.getItem(POS_KEY) || 'null');
      if (p && p.x > 0 && p.x < WORLD.w && p.y > 0 && p.y < WORLD.h) pos = p;
    } catch {
      /* 처음 */
    }
    st.current = { p: { ...pos }, target: null, keys: new Set(), lastDoor: BUILDINGS.find((b) => hit(pos, b.door))?.id ?? null, walking: 0, scale: 1, view: { x: 0, y: 0, w: 0, h: 0 } };
  }

  useEffect(() => {
    onPlace?.(inside || 'map');
  }, [inside, onPlace]);

  // 단계가 바뀌어 지금 건물이 닫히면 알려 주기만 한다(패널이 안내)
  const goal = goalOf(m);

  useEffect(() => {
    const s = st.current;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const blocks = solids();
    let raf;
    let last = performance.now();
    let bubbleTimer;
    const say = (text) => {
      clearTimeout(bubbleTimer);
      setBubble(text);
      bubbleTimer = setTimeout(() => setBubble(null), 2600);
    };

    const resize = () => {
      const r = wrap.current.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      cv.style.width = `${r.width}px`;
      cv.style.height = `${r.height}px`;
      s.dpr = dpr;
      s.scale = Math.max(0.55, Math.min(1.15, r.width / 900));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap.current);

    const free = (x, y) => x > R && x < WORLD.w - R && y > R && y < WORLD.h - R && !blocks.some((b) => hit({ x, y }, b, R - 4));

    const step = (dt) => {
      if (live.current.inside) return;
      let dx = 0;
      let dy = 0;
      const k = s.keys;
      if (k.has('left')) dx -= 1;
      if (k.has('right')) dx += 1;
      if (k.has('up')) dy -= 1;
      if (k.has('down')) dy += 1;
      if (dx || dy) s.target = null;
      else if (s.target) {
        const tx = s.target.x - s.p.x;
        const ty = s.target.y - s.p.y;
        const d = Math.hypot(tx, ty);
        if (d < 4) s.target = null;
        else {
          dx = tx / d;
          dy = ty / d;
        }
      }
      const len = Math.hypot(dx, dy);
      if (len) {
        const mv = (SPEED * dt) / len;
        const nx = s.p.x + dx * mv;
        const ny = s.p.y + dy * mv;
        let moved = false;
        if (free(nx, s.p.y)) {
          s.p.x = nx;
          moved = true;
        }
        if (free(s.p.x, ny)) {
          s.p.y = ny;
          moved = true;
        }
        if (!moved) s.target = null;
        s.walking += dt;
      } else s.walking = 0;

      // 문 앞에 섰는지
      const mm = live.current.m;
      const at = BUILDINGS.find((b) => hit(s.p, b.door));
      if (at && s.lastDoor !== at.id) {
        s.lastDoor = at.id;
        if (isOpen(at.id, mm)) {
          s.target = null;
          s.keys.clear();
          setInside(at.id);
        } else if (!mm) say(`${at.name}은 아직 조용해요. 선생님이 회의 주제를 정하면 열려요.`);
        else say(`${at.name}의 문이 아직 닫혀 있어요. ${QUEST[mm.stage] ? '위의 안내를 따라가 보세요.' : ''}`);
      } else if (!at) s.lastDoor = null;
    };

    const draw = (t) => {
      const W = cv.width / s.dpr;
      const H = cv.height / s.dpr;
      const sc = s.scale;
      const vw = W / sc;
      const vh = H / sc;
      const vx = Math.max(0, Math.min(WORLD.w - vw, s.p.x - vw / 2));
      const vy = Math.max(0, Math.min(WORLD.h - vh, s.p.y - vh / 2));
      s.view = { x: vx, y: vy, w: vw, h: vh };
      ctx.setTransform(s.dpr * sc, 0, 0, s.dpr * sc, -vx * s.dpr * sc, -vy * s.dpr * sc);
      ctx.fillStyle = '#7fb35c';
      ctx.fillRect(vx - 2, vy - 2, vw + 4, vh + 4);
      drawGround(ctx, s.view, t);
      const mm = live.current.m;
      const g = goalOf(mm);
      const items = [
        ...BUILDINGS.map((b) => ({ y: b.rect.y + b.rect.h, draw: () => drawBuilding(ctx, b, { open: isOpen(b.id, mm), goal: g === b.id, t }) })),
      ];
      items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
      drawTrees(ctx, s.view);

      // 친구들: 들어간 건물 문 앞에 모여 서 있다
      const crowd = live.current.crowd;
      for (const [place, list] of Object.entries(crowd)) {
        const b = byId[place];
        const cx = b ? b.door.x + b.door.w / 2 : PLAZA.x;
        const cy = b ? b.door.y + b.door.h + 26 : PLAZA.y;
        list.slice(0, 24).forEach((av, i) => {
          let x;
          let y;
          if (b) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            x = cx + (col - 3.5) * 30 + (row % 2) * 15;
            y = cy + row * 26;
          } else {
            const a = (i / Math.max(6, list.length)) * Math.PI * 2;
            x = cx + Math.cos(a) * 78;
            y = cy + Math.sin(a) * 62;
          }
          drawToken(ctx, avatarImg(av), x, y, 30, Math.sin(t / 300 + i) * 1.5, '#e8dcc0');
        });
        if (list.length > 24 && b) {
          ctx.font = '700 14px sans-serif';
          ctx.fillStyle = '#2a2622';
          ctx.fillText(`+${list.length - 24}`, cx + 140, cy + 70);
        }
      }

      // 나
      const me = live.current.me;
      const bob = s.walking ? Math.abs(Math.sin(s.walking * 12)) * 5 : 0;
      drawToken(ctx, avatarImg(me?.avatar), s.p.x, s.p.y, 46, bob, '#ffd66b');
      ctx.font = '700 13px "Gowun Dodum", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(42,38,34,.85)';
      roundRect(ctx, s.p.x - 18, s.p.y - 54 - bob, 36, 18, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText('나', s.p.x, s.p.y - 45 - bob);

      // 걸어갈 곳 표시
      if (s.target) {
        ctx.strokeStyle = 'rgba(255,214,107,.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.target.x, s.target.y, 10 + Math.sin(t / 150) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 목표 건물이 화면 밖이면 가장자리에 화살표
      if (g) {
        const b = byId[g];
        const gx = b.door.x + b.door.w / 2;
        const gy = b.door.y + b.door.h / 2;
        const inView = gx > vx && gx < vx + vw && gy > vy && gy < vy + vh;
        if (!inView) {
          const ang = Math.atan2(gy - s.p.y, gx - s.p.x);
          const ex = Math.max(vx + 40, Math.min(vx + vw - 40, s.p.x + Math.cos(ang) * vw));
          const ey = Math.max(vy + 40, Math.min(vy + vh - 40, s.p.y + Math.sin(ang) * vh));
          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(ang);
          ctx.fillStyle = '#ffd66b';
          ctx.strokeStyle = '#7a5a06';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(22, 0);
          ctx.lineTo(-12, -16);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-12, 16);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    };

    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      step(dt);
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const KEYMAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', a: 'left', d: 'right', w: 'up', s: 'down', A: 'left', D: 'right', W: 'up', S: 'down' };
    const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName);
    const kd = (e) => {
      if (typing(e) || live.current.inside) return;
      const k = KEYMAP[e.key];
      if (k) {
        s.keys.add(k);
        e.preventDefault();
      }
    };
    const ku = (e) => {
      const k = KEYMAP[e.key];
      if (k) s.keys.delete(k);
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => s.keys.clear();
    window.addEventListener('blur', blur);
    const save = setInterval(() => {
      try {
        sessionStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(s.p.x), y: Math.round(s.p.y) }));
      } catch {
        /* 없음 */
      }
    }, 1500);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearInterval(save);
      clearTimeout(bubbleTimer);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // 화면을 누르면 그곳으로 걸어간다. 건물을 누르면 그 건물 문으로
  const onPointer = (e) => {
    const s = st.current;
    const r = canvas.current.getBoundingClientRect();
    const wx = s.view.x + (e.clientX - r.left) / s.scale;
    const wy = s.view.y + (e.clientY - r.top) / s.scale;
    const b = BUILDINGS.find((x) => hit({ x: wx, y: wy }, x.rect, 10) || hit({ x: wx, y: wy }, x.door));
    s.target = b ? { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h / 2 } : { x: wx, y: wy };
  };

  const pad = (dir) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      st.current.keys.add(dir);
    },
    onPointerUp: () => st.current.keys.delete(dir),
    onPointerLeave: () => st.current.keys.delete(dir),
    onPointerCancel: () => st.current.keys.delete(dir),
  });

  const leave = () => {
    const s = st.current;
    const b = byId[inside];
    if (b) {
      s.p = { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h + 34 };
      s.lastDoor = b.id;
      try {
        sessionStorage.setItem(POS_KEY, JSON.stringify(s.p));
      } catch {
        /* 저장 못 해도 괜찮다 */
      }
    }
    setInside(null);
  };

  const questKey = !m ? 'none' : m.stage;
  return (
    <div className="map-wrap" ref={wrap}>
      <canvas ref={canvas} className="map-canvas" onPointerDown={onPointer} />
      <div className="quest">
        <span>{QUEST[questKey]}</span>
        {goal && !inside && (
          <button
            type="button"
            className="btn btn-gold btn-sm"
            onClick={() => {
              const b = byId[goal];
              st.current.target = { x: b.door.x + b.door.w / 2, y: b.door.y + b.door.h / 2 };
            }}
          >
            길 안내
          </button>
        )}
      </div>
      {bubble && <div className="map-bubble">{bubble}</div>}
      <div className="dpad" aria-label="방향 버튼">
        <button type="button" className="up" {...pad('up')} aria-label="위">▲</button>
        <button type="button" className="left" {...pad('left')} aria-label="왼쪽">◀</button>
        <button type="button" className="right" {...pad('right')} aria-label="오른쪽">▶</button>
        <button type="button" className="down" {...pad('down')} aria-label="아래">▼</button>
      </div>
      {inside && (
        <div className="building-sheet" role="dialog" aria-label={byId[inside].name}>
          <div className="sheet-head">
            <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
              ← 밖으로 나가기
            </button>
            <b>{byId[inside].name}</b>
          </div>
          <div className="sheet-body">{renderPanel(inside, isOpen(inside, m), leave)}</div>
        </div>
      )}
    </div>
  );
}
