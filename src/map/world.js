// 폴리스 지도: 위에서 내려다본 레고 블록풍 마을. 좌표 단위는 픽셀(세계 좌표).
export const WORLD = { w: 1600, h: 1100 };
export const SPAWN = { x: 800, y: 1010 };

// 건물: rect는 막힌 곳, door는 들어가는 칸
export const BUILDINGS = [
  {
    id: 'board',
    name: '전령의 게시판',
    rect: { x: 930, y: 800, w: 120, h: 50 },
    door: { x: 930, y: 850, w: 120, h: 50 },
    color: '#b5733c',
  },
  {
    id: 'agora',
    name: '아고라 광장',
    rect: { x: 170, y: 420, w: 380, h: 170 },
    door: { x: 300, y: 590, w: 120, h: 60 },
    color: '#f2ede1',
  },
  {
    id: 'acropolis',
    name: '아크로폴리스',
    rect: { x: 600, y: 90, w: 400, h: 220 },
    door: { x: 740, y: 310, w: 120, h: 60 },
    color: '#f7f4ec',
  },
  {
    id: 'oracle',
    name: '델포이 신전',
    rect: { x: 1170, y: 170, w: 260, h: 190 },
    door: { x: 1240, y: 360, w: 120, h: 60 },
    color: '#ddd3f0',
  },
];
export const byId = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// 성벽, 바다, 나무: 지나갈 수 없는 곳
export const WALLS = [
  { x: 0, y: 1060, w: 740, h: 40 },
  { x: 860, y: 1060, w: 740, h: 40 },
  { x: 0, y: 0, w: 1600, h: 30 },
  { x: 0, y: 0, w: 30, h: 1100 },
  { x: 1480, y: 0, w: 120, h: 1100 }, // 에게해
  { x: 580, y: 60, w: 440, h: 30 }, // 아크로폴리스 언덕 뒤
];
export const TREES = [
  [90, 120], [170, 200], [100, 300], [420, 150], [480, 260], [1100, 520], [1200, 600], [1330, 520],
  [120, 760], [220, 860], [360, 940], [1180, 900], [1330, 980], [1400, 760], [620, 700], [1010, 640],
  [540, 860], [1300, 120], [1080, 80],
];
const FOUNTAIN = { x: 800, y: 640, r: 46 };
export const PLAZA = FOUNTAIN;

const ROADS = [
  { x: 760, y: 360, w: 80, h: 700 }, // 성문에서 아크로폴리스까지
  { x: 330, y: 610, w: 470, h: 70 }, // 분수에서 아고라로
  { x: 800, y: 600, w: 520, h: 70 }, // 분수에서 오른쪽
  { x: 1260, y: 400, w: 80, h: 270 }, // 델포이로
  { x: 840, y: 860, w: 110, h: 70 }, // 게시판으로
];

export function solids() {
  return [...BUILDINGS.map((b) => b.rect), ...WALLS, ...TREES.map(([x, y]) => ({ x: x - 16, y: y - 10, w: 32, h: 24 })), { x: FOUNTAIN.x - 40, y: FOUNTAIN.y - 34, w: 80, h: 60 }];
}

export const hit = (p, r, pad = 0) => p.x > r.x - pad && p.x < r.x + r.w + pad && p.y > r.y - pad && p.y < r.y + r.h + pad;

// ---------------- 그리기 ----------------

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 레고 블록 하나: 윗면 + 앞면 + 돌기 */
export function brick(ctx, x, y, w, h, color, depth = 14, studs = true) {
  ctx.fillStyle = shade(color, 0.72);
  ctx.fillRect(x, y + h - 2, w, depth);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = shade(color, 0.6);
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h + depth - 3);
  if (!studs) return;
  const step = 20;
  for (let sx = x + step / 2; sx < x + w; sx += step)
    for (let sy = y + step / 2; sy < y + h; sy += step) {
      ctx.beginPath();
      ctx.arc(sx, sy + 1.5, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = shade(color, 0.78);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = shade(color, 1.06);
      ctx.fill();
    }
}

function columns(ctx, x, y, w, n, color, colH = 34) {
  const gap = w / n;
  for (let i = 0; i < n; i++) {
    const cx = x + gap * i + gap / 2 - 6;
    ctx.fillStyle = shade(color, 0.82);
    ctx.fillRect(cx, y, 12, colH);
    ctx.fillStyle = shade(color, 1.05);
    ctx.fillRect(cx + 2, y, 4, colH);
  }
}

function tree(ctx, x, y) {
  ctx.fillStyle = 'rgba(0,0,0,.15)';
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a5530';
  ctx.fillRect(x - 4, y - 4, 8, 16);
  for (const [dx, dy, r] of [[-10, -14, 14], [10, -16, 14], [0, -26, 15]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#6f8a3a';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + dx - 3, y + dy - 3, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#90ab52';
    ctx.fill();
  }
}

function label(ctx, text, x, y, glow) {
  ctx.font = '700 18px "Gowun Dodum", sans-serif';
  const w = ctx.measureText(text).width + 24;
  ctx.fillStyle = glow ? '#ffd66b' : 'rgba(255,253,247,.92)';
  ctx.strokeStyle = glow ? '#b88a1b' : '#cbbd9c';
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - 16, w, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a2622';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 바닥(초록 판, 길, 바다, 성벽, 분수, 나무). 화면에 보이는 부분만 그린다 */
export function drawGround(ctx, view, t) {
  const { x: vx, y: vy, w: vw, h: vh } = view;
  ctx.fillStyle = '#8fc46a';
  ctx.fillRect(vx, vy, vw, vh);
  // 판 돌기
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  const s = 40;
  for (let x = Math.floor(vx / s) * s + s / 2; x < vx + vw; x += s)
    for (let y = Math.floor(vy / s) * s + s / 2; y < vy + vh; y += s) {
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  // 아크로폴리스 언덕
  ctx.fillStyle = '#c9b48a';
  roundRect(ctx, 560, 60, 480, 290, 40);
  ctx.fill();
  ctx.fillStyle = '#d8c69f';
  roundRect(ctx, 580, 70, 440, 260, 34);
  ctx.fill();
  // 길
  for (const r of ROADS) brick(ctx, r.x, r.y, r.w, r.h, '#e9dfc7', 0, false);
  ctx.fillStyle = 'rgba(160,140,100,.25)';
  for (const r of ROADS)
    for (let x = r.x + 10; x < r.x + r.w; x += 40) for (let y = r.y + 10; y < r.y + r.h; y += 30) ctx.fillRect(x, y, 22, 2);
  // 바다
  const sea = ctx.createLinearGradient(1480, 0, 1600, 0);
  sea.addColorStop(0, '#5aa7d6');
  sea.addColorStop(1, '#2f6aa3');
  ctx.fillStyle = sea;
  ctx.fillRect(1480, 0, 120, WORLD.h);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  for (let y = 30; y < WORLD.h; y += 60) {
    ctx.beginPath();
    const o = Math.sin(t / 700 + y) * 6;
    ctx.moveTo(1500 + o, y);
    ctx.quadraticCurveTo(1520 + o, y - 8, 1540 + o, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#efe0b0';
  ctx.fillRect(1466, 0, 16, WORLD.h);
  // 성벽과 성문
  brick(ctx, 0, 1060, 740, 30, '#c8b28a', 10);
  brick(ctx, 860, 1060, 740, 30, '#c8b28a', 10);
  brick(ctx, 700, 1030, 40, 60, '#b89d70', 12);
  brick(ctx, 860, 1030, 40, 60, '#b89d70', 12);
  // 분수
  ctx.fillStyle = '#bfb39a';
  ctx.beginPath();
  ctx.arc(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6fb6e0';
  ctx.beginPath();
  ctx.arc(FOUNTAIN.x, FOUNTAIN.y, FOUNTAIN.r - 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < 6; i++) {
    const a = t / 500 + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(FOUNTAIN.x + Math.cos(a) * 18, FOUNTAIN.y + Math.sin(a) * 12, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 건물 하나. open: 문이 열림, goal: 지금 가야 할 곳(반짝임) */
export function drawBuilding(ctx, b, { open, goal, t }) {
  const { x, y, w, h } = b.rect;
  ctx.fillStyle = 'rgba(0,0,0,.14)';
  ctx.fillRect(x + 8, y + h + 4, w, 18);
  if (goal) {
    ctx.save();
    ctx.shadowColor = '#ffd66b';
    ctx.shadowBlur = 24 + Math.sin(t / 250) * 10;
    ctx.fillStyle = 'rgba(255,214,107,.35)';
    roundRect(ctx, x - 14, y - 14, w + 28, h + 40, 18);
    ctx.fill();
    ctx.restore();
  }
  if (b.id === 'board') {
    ctx.fillStyle = '#6b4423';
    ctx.fillRect(x + 12, y + 20, 8, 40);
    ctx.fillRect(x + w - 20, y + 20, 8, 40);
    brick(ctx, x, y, w, h - 8, '#b5733c', 10, false);
    ctx.fillStyle = '#fbf3dc';
    ctx.fillRect(x + 16, y + 6, w - 32, h - 22);
    ctx.fillStyle = '#8a6420';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 24, y + 12 + i * 7, w - 48 - i * 14, 3);
  } else if (b.id === 'agora') {
    brick(ctx, x, y, w, h * 0.45, '#c0582f', 12); // 기와 지붕
    columns(ctx, x + 10, y + h * 0.45 + 10, w - 20, 9, '#f2ede1', h * 0.45);
    brick(ctx, x - 10, y + h - 16, w + 20, 18, '#e9dfc7', 10, false);
    // 가판대
    for (const [dx, c] of [[30, '#d94f3d'], [w - 90, '#2f6aa3']]) {
      brick(ctx, x + dx, y + h + 26, 60, 26, c, 8, false);
      ctx.fillStyle = '#b5733c';
      ctx.beginPath();
      ctx.ellipse(x + dx + 18, y + h + 60, 9, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.id === 'acropolis') {
    brick(ctx, x, y + h - 40, w, 40, '#e8e0cc', 12, false);
    brick(ctx, x + 20, y, w - 40, h * 0.42, '#f7f4ec', 12);
    // 박공
    ctx.fillStyle = '#e2d7bd';
    ctx.beginPath();
    ctx.moveTo(x + 20, y + h * 0.42);
    ctx.lineTo(x + w / 2, y + h * 0.42 - 26);
    ctx.lineTo(x + w - 20, y + h * 0.42);
    ctx.fill();
    columns(ctx, x + 26, y + h * 0.42 + 8, w - 52, 10, '#f7f4ec', h * 0.58 - 52);
    // 성문(프로필라이아)
    brick(ctx, b.door.x - 20, b.door.y - 30, 30, 34, '#d8cdb4', 8, false);
    brick(ctx, b.door.x + b.door.w - 10, b.door.y - 30, 30, 34, '#d8cdb4', 8, false);
  } else if (b.id === 'oracle') {
    brick(ctx, x, y, w, h * 0.45, '#5b3f8c', 12);
    columns(ctx, x + 12, y + h * 0.45 + 8, w - 24, 6, '#ddd3f0', h * 0.45);
    brick(ctx, x - 8, y + h - 16, w + 16, 18, '#cfc3e6', 10, false);
    // 삼발이와 연기
    const cx = x + w / 2;
    ctx.fillStyle = '#b88a1b';
    ctx.fillRect(cx - 12, y + h * 0.45 + 30, 24, 8);
    for (let i = 0; i < 3; i++) {
      const k = ((t / 1200 + i / 3) % 1);
      ctx.beginPath();
      ctx.arc(cx + Math.sin(t / 400 + i) * 6, y + h * 0.45 + 26 - k * 70, 8 + k * 16, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(190,150,255,${0.45 * (1 - k)})`;
      ctx.fill();
    }
  }
  // 문
  const d = b.door;
  ctx.fillStyle = open ? 'rgba(255,214,107,.45)' : 'rgba(80,70,60,.25)';
  roundRect(ctx, d.x + 20, d.y + 8, d.w - 40, d.h - 20, 10);
  ctx.fill();
  if (!open) {
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔒', d.x + d.w / 2, d.y + d.h / 2 - 4);
  }
  label(ctx, b.name, x + w / 2, b.id === 'board' ? y - 18 : y - 22, goal);
}

export function drawTrees(ctx, view) {
  for (const [x, y] of TREES) if (x > view.x - 40 && x < view.x + view.w + 40 && y > view.y - 60 && y < view.y + view.h + 40) tree(ctx, x, y);
}

/** 아바타 토큰: 그림자 + 동그란 그림 + (걷는 중이면) 통통 */
export function drawToken(ctx, img, x, y, size, bob = 0, ring = '#fff') {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.45, size * 0.38, size * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  const yy = y - size * 0.15 - bob;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, yy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#f5ead2';
  ctx.fill();
  ctx.clip();
  if (img?.complete && img.naturalWidth) ctx.drawImage(img, x - size / 2, yy - size / 2, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, yy, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.stroke();
}
