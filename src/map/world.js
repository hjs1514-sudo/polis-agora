// 폴리스 지도: Canva로 만든 레고 세상 그림(바닥 한 장 + 건물 그림 여러 장)을 세계 좌표 위에 놓는다.
// 새 건물을 지으려면 아래 PLACES에 한 줄을 더하고, public/img/map/에 그림을 넣으면 된다.
//   cx, base: 건물 그림의 아래 가운데가 놓일 자리(세계 좌표, 픽셀)
//   w: 그림을 그릴 너비, ar: 그림의 세로/가로 비율(그림을 읽기 전 충돌 계산용)
//   soon: 아직 짓는 중인 건물이면 그 안내 문구(문이 열리지 않는다)
export const WORLD = { w: 1800, h: 1200 };
export const SPAWN = { x: 873, y: 800 };
// 걸어 다닐 수 있는 땅(성벽 안쪽)
export const LAND = { x: 80, y: 110, w: 1640, h: 722 };

export const PLACES = [
  { id: 'board', name: '전령의 게시판', img: 'board', cx: 772, base: 790, w: 150, ar: 1.12 },
  { id: 'agora', name: '아고라 광장', img: 'agora', cx: 480, base: 790, w: 400, ar: 0.83 },
  { id: 'acropolis', name: '아크로폴리스', img: 'acropolis', cx: 1211, base: 418, w: 380, ar: 0.93 },
  { id: 'oracle', name: '델포이 신전', img: 'oracle', cx: 540, base: 420, w: 320, ar: 1.07 },
  {
    id: 'academy',
    name: '아테네 학당',
    img: 'academy',
    cx: 1264,
    base: 790,
    w: 370,
    ar: 0.97,
    soon: '아침 조회 시간에 짧은 시험 대비 퀴즈를 푸는 곳이에요. 지금 짓고 있어요!',
  },
  {
    id: 'hermes',
    name: '헤르메스의 우체통',
    img: 'hermes',
    cx: 990,
    base: 424,
    w: 120,
    ar: 1.52,
    soon: '선생님께 몰래 전하고 싶은 이야기를 넣는 곳이에요. 지금 짓고 있어요!',
  },
  { id: 'lot1', name: '새 건물 터', img: 'construction', cx: 1600, base: 770, w: 210, ar: 0.75, soon: '여기에는 어떤 건물이 생길까요? 선생님이 새 코너를 짓고 있어요.' },
];
export const BUILDINGS = PLACES;
export const byId = Object.fromEntries(PLACES.map((b) => [b.id, b]));

export const FOUNTAIN = { x: 872, y: 470, rx: 120, ry: 62 };
export const PLAZA = FOUNTAIN;

// ---------------- 그림 ----------------
const imgs = {};
export function mapImg(name) {
  if (!imgs[name]) {
    const im = new Image();
    im.src = `img/map/${name}.webp`;
    imgs[name] = im;
  }
  return imgs[name];
}
const ready = (im) => im && im.complete && im.naturalWidth > 0;

/** 그림 상자(세계 좌표). 그림을 읽은 뒤에는 실제 비율을 쓴다 */
export function boxOf(b) {
  const im = mapImg(b.img);
  const ar = ready(im) ? im.naturalHeight / im.naturalWidth : b.ar;
  const h = b.w * ar;
  return { x: b.cx - b.w / 2, y: b.base - h, w: b.w, h };
}
/** 막힌 곳: 그림 아래쪽 절반쯤(건물의 발밑) */
export function footOf(b) {
  const r = boxOf(b);
  const fw = r.w * 0.76;
  const top = r.y + r.h * 0.42;
  return { x: b.cx - fw / 2, y: top, w: fw, h: b.base - r.h * 0.07 - top };
}
/** 들어가는 칸: 건물 바로 앞 */
export function doorOf(b) {
  const r = boxOf(b);
  const dw = Math.max(90, Math.min(130, r.w * 0.45));
  return { x: b.cx - dw / 2, y: b.base - r.h * 0.07, w: dw, h: 58 };
}
export const doorPoint = (b) => {
  const d = doorOf(b);
  return { x: d.x + d.w / 2, y: d.y + d.h / 2 + 4 };
};

export function solids() {
  return [
    ...PLACES.map(footOf),
    { x: FOUNTAIN.x - 92, y: FOUNTAIN.y - 40, w: 184, h: 72 },
  ];
}

export const hit = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;
export const onLand = (x, y, r = 0) => x > LAND.x + r && x < LAND.x + LAND.w - r && y > LAND.y + r && y < LAND.y + LAND.h - r;

// ---------------- 그리기 ----------------

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawGround(ctx, view) {
  const g = mapImg('ground');
  ctx.fillStyle = '#4f9a3c';
  ctx.fillRect(view.x - 2, view.y - 2, view.w + 4, view.h + 4);
  if (ready(g)) ctx.drawImage(g, 0, 0, WORLD.w, WORLD.h);
}

function pill(ctx, text, x, y, { bg = 'rgba(255,253,247,.95)', fg = '#2a2622', line = '#c9a96a', size = 17 } = {}) {
  ctx.font = `700 ${size}px "Gowun Dodum", sans-serif`;
  const w = ctx.measureText(text).width + size * 1.3;
  const h = size + 14;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  roundRect(ctx, x - w / 2 + 2, y - h / 2 + 3, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = bg;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = line;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
}

/** 건물 하나: 그림자 → (목표면 빛) → 그림 → 이름표 → 문 */
export function drawPlace(ctx, b, { open, goal, t }) {
  const r = boxOf(b);
  const im = mapImg(b.img);
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  ctx.beginPath();
  ctx.ellipse(b.cx, b.base - r.h * 0.06, r.w * 0.5, r.h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  if (goal) {
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(t / 260) * 0.2;
    ctx.fillStyle = '#ffd66b';
    ctx.shadowColor = '#ffd66b';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.ellipse(b.cx, b.base - r.h * 0.12, r.w * 0.58, r.h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (ready(im)) {
    if (b.soon) ctx.filter = 'saturate(.7) brightness(1.02)';
    ctx.drawImage(im, r.x, r.y, r.w, r.h);
    ctx.filter = 'none';
  }
  // 신탁이 내려지면 연기가 피어오른다
  if (b.id === 'oracle' && open) {
    for (let i = 0; i < 4; i++) {
      const k = (t / 1600 + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(b.cx + Math.sin(t / 500 + i) * 10, r.y + r.h * 0.35 - k * 120, 12 + k * 26, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190,150,255,${0.4 * (1 - k)})`;
      ctx.fill();
    }
  }
  // 문
  if (!b.soon) {
    const d = doorOf(b);
    const cx = d.x + d.w / 2;
    const cy = d.y + d.h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, d.w / 2, d.h / 2.6, 0, 0, Math.PI * 2);
    if (open) {
      ctx.fillStyle = `rgba(255,214,107,${0.35 + Math.sin(t / 300) * 0.12})`;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t / 40;
      ctx.strokeStyle = '#c99a1e';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(60,50,40,.18)';
      ctx.fill();
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔒', cx, cy);
    }
    ctx.restore();
  }
}

/** 이름표는 모든 그림 위에 따로 그린다 */
export function drawPlaceLabel(ctx, b, { goal, t }) {
  const r = boxOf(b);
  const ly = r.y - 6;
  const bounce = goal ? Math.abs(Math.sin(t / 300)) * 6 : 0;
  pill(ctx, b.name, b.cx, ly - bounce, goal ? { bg: '#ffd66b', line: '#7a5a06' } : b.soon ? { bg: 'rgba(240,236,228,.95)', line: '#a8a29a', fg: '#5a544c' } : {});
  if (b.soon) pill(ctx, '🚧 공사 중', b.cx, ly + 30, { bg: '#f6b73c', line: '#8a5a06', size: 13 });
  if (goal) {
    ctx.fillStyle = '#ffd66b';
    ctx.strokeStyle = '#7a5a06';
    ctx.lineWidth = 2;
    const ay = ly - 38 - bounce;
    ctx.beginPath();
    ctx.moveTo(b.cx - 13, ay - 14);
    ctx.lineTo(b.cx + 13, ay - 14);
    ctx.lineTo(b.cx, ay + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** 레고 사람(아바타 그림을 오려 낸 것). (x, y)는 발밑 */
export function drawFigure(ctx, img, x, y, h, { bob = 0, ring = null } = {}) {
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath();
  ctx.ellipse(x, y, h * 0.24, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  if (ring) {
    ctx.strokeStyle = ring;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, h * 0.32, h * 0.11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (img?.complete && img.naturalWidth) {
    const w = (h * img.naturalWidth) / img.naturalHeight;
    ctx.drawImage(img, x - w / 2, y - h - bob + h * 0.04, w, h);
  } else {
    ctx.fillStyle = '#f2c94c';
    roundRect(ctx, x - h * 0.2, y - h - bob, h * 0.4, h, 8);
    ctx.fill();
  }
}
