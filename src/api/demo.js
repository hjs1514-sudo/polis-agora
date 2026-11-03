// 체험판: 서버 없이 이 브라우저 안에서만 돌아간다. 어디에도 보내거나 저장하지 않는다(이 브라우저의 localStorage만).
// 가상 학생 11명이 의견을 올리고 올리브 가지를 달고 투표한다.
import { emptyState, apply, checkLogin, studentView, teacherView, crowdOf, PolisError } from '../core/engine.js';

const KEY = 'polis-demo-v1';
export const DEMO = { grade: 2, klass: 1, code: '1234', pin: '0000', topic: '우리 반 청소 당번은 어떻게 정할까?' };
const ROSTER = ['김하늘', '이도윤', '박서연', '최지호', '정민준', '강예린', '조은우', '윤서아', '장도현', '임하린', '한지안', '오시우'];
const BOT_AVATARS = ['m1', 'f1', 'f3', 'm2', 'm3', 'f2', 'm4', 'f4', 'm5', 'f5', 'f3'];
export const ME_NO = 12; // 체험하는 선생님이 학생으로 들어갈 자리

const CLEANING = [
  '번호 순서대로 일주일씩 돌아가며 맡아요.',
  '구역을 나누고 모둠별로 맡으면 빨리 끝나요.',
  '청소를 잘한 모둠에게 칭찬 도장을 줘요.',
  '하고 싶은 구역을 먼저 고르고, 겹치면 가위바위보로 정해요.',
  '매일 두 명씩 짝을 지어 맡아요.',
  '한 달에 한 번 구역을 바꿔요.',
  '교실, 복도, 분리수거를 나눠서 순환해요.',
  '청소 시간에 음악을 틀어 주세요.',
];
const GENERIC = [
  '모두가 돌아가며 맡으면 공평할 것 같아요.',
  '먼저 반 전체 의견을 설문으로 모아 봐요.',
  '한 달 동안 해 보고 다시 회의해요.',
  '모둠별로 나눠서 맡으면 좋겠어요.',
  '규칙을 지키면 칭찬 도장을 주면 좋겠어요.',
  '하고 싶은 사람이 먼저 하고, 부족하면 순서대로 정해요.',
  '선생님과 학생 대표가 함께 정해요.',
  '작은 것부터 하나씩 바꿔 봐요.',
];

const sha = (s) => {
  // 체험판에서는 간단한 표시만 필요하다
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 'demo' + (h >>> 0).toString(16);
};
const err = (msg, status = 400) => {
  throw new PolisError(msg, status);
};

function fresh() {
  let state = emptyState();
  state = apply(state, { type: 'setup', grade: DEMO.grade, klass: DEMO.klass, code: DEMO.code }, { role: 'teacher' }).state;
  state = apply(state, { type: 'roster', text: ROSTER.map((n, i) => `${i + 1} ${n}`).join('\n') }, { role: 'teacher' }).state;
  BOT_AVATARS.forEach((a, i) => {
    state.students[i + 1].avatar = a;
    state.students[i + 1].tokenHash = 'bot';
  });
  return { state, history: [], plan: [], planned: {} };
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 저장 못 하는 브라우저면 새로 */
  }
  return fresh();
}
let mem = null;
function load() {
  if (!mem) mem = read();
  return mem;
}
function save(db) {
  mem = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* 저장이 안 되면 이 화면에서만 */
  }
}

const rand = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rand(arr.length)];

/** 단계가 바뀌면 가상 학생들이 할 일을 시간표로 짠다 */
function planBots(db, now) {
  const m = db.state.meeting;
  if (!m) return;
  const key = `${m.id}:${m.stage}:${m.round}`;
  if (db.planned[key]) return;
  db.planned[key] = true;
  const bots = Object.values(db.state.students).filter((s) => s.tokenHash === 'bot').map((s) => s.no);
  if (m.stage === 'agora') {
    const pool = [...(m.topic.includes('청소') ? CLEANING : GENERIC)].sort(() => Math.random() - 0.5);
    bots.slice(0, 8).forEach((no, i) => db.plan.push({ mid: m.id, at: now + 1500 + i * 1800 + rand(1500), no, a: { type: 'post', text: pool[i % pool.length] } }));
    bots.forEach((no) => db.plan.push({ mid: m.id, at: now + 9000 + rand(12000), no, a: { type: 'oliveRandom' } }));
    bots.slice(0, 6).forEach((no) => db.plan.push({ mid: m.id, at: now + 14000 + rand(12000), no, a: { type: 'oliveRandom' } }));
  }
  if (m.stage === 'vote') {
    bots.forEach((no) => db.plan.push({ mid: m.id, at: now + 1500 + rand(9000), no, a: { type: 'voteRandom' } }));
  }
}

function runDue(db, now) {
  const due = db.plan.filter((p) => p.at <= now);
  db.plan = db.plan.filter((p) => p.at > now);
  for (const p of due) {
    try {
      let a = p.a;
      const cur = db.state.meeting;
      if (!cur || cur.id !== p.mid) continue;
      if (a.type === 'oliveRandom') {
        const opts = cur.opinions.filter((o) => !o.hidden && o.no !== p.no && !o.olives.includes(p.no));
        if (!opts.length) continue;
        a = { type: 'olive', id: pick(opts).id };
      }
      if (a.type === 'voteRandom') {
        // 올리브 가지와 별표가 많은 의견에 조금 더 마음이 간다
        const w = cur.candidates.map((id) => {
          const o = cur.opinions.find((x) => x.id === id);
          return (1 + (o?.olives.length || 0) + (o?.starred ? 2 : 0)) ** 2;
        });
        let r = Math.random() * w.reduce((s, x) => s + x, 0);
        let id = cur.candidates[0];
        for (let i = 0; i < w.length; i++) if ((r -= w[i]) <= 0) { id = cur.candidates[i]; break; }
        a = { type: 'vote', id };
      }
      db.state = apply(db.state, a, { role: 'student', no: p.no }).state;
    } catch {
      /* 단계가 바뀌었으면 그냥 넘어간다 */
    }
  }
}

function tick() {
  const db = load();
  const now = Date.now();
  planBots(db, now);
  runDue(db, now);
  save(db);
  return db;
}

const PLACE_FOR = { notice: 'board', agora: 'agora', adopt: 'agora', vote: 'acropolis', oracle: 'oracle' };
/** 가상 학생들은 대부분 지금 단계의 건물에, 몇 명은 분수대 근처에 있다 */
const botSeen = (db, mePlace = {}) => {
  const now = Date.now();
  const m = db.state.meeting;
  return Object.fromEntries(
    Object.values(db.state.students).map((s) => {
      if (s.tokenHash !== 'bot') return [s.no, s.tokenHash ? { at: now, place: mePlace[s.no] || db.places?.[s.no] || '' } : 0];
      const place = m && s.no % 4 !== 0 ? PLACE_FOR[m.stage] : 'map';
      return [s.no, { at: now, place }];
    }),
  );
};
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120));
const teacherOk = (pin) => {
  if (String(pin) !== DEMO.pin) err('교사 PIN이 맞지 않아요. 체험판 PIN은 0000이에요.', 403);
};
function studentNo(db, token) {
  const no = Number(String(token).split('.')[0]);
  const s = db.state.students[no];
  if (!s || s.tokenHash !== sha(token)) err('다시 로그인해 주세요.', 401);
  return no;
}
function commit(db, res) {
  db.state = res.state;
  if (res.out?.archived) {
    db.history.unshift({ hid: Date.now(), ...res.out.archived });
    delete res.out.archived;
  }
  save(db);
  return res;
}
const guard = (fn) => (...args) => {
  try {
    return wait(fn(...args));
  } catch (e) {
    return new Promise((_, rej) => setTimeout(() => rej(e), 120));
  }
};

export const demoApi = {
  mode: 'demo',
  status: guard(() => {
    const db = tick();
    return { ready: true, room: db.state.setup, needCode: true };
  }),
  setup: guard(() => err('체험판은 이미 학급방이 있어요.')),
  login: guard((b) => {
    const db = tick();
    const s = checkLogin(db.state, b);
    if (s.tokenHash === 'bot') err(`${s.name}은(는) 가상 학생이 쓰고 있어요. 체험판에서는 ${ME_NO}번 ${ROSTER[ME_NO - 1]}(으)로 들어가 보세요.`, 409);
    if (s.tokenHash) err('이미 다른 화면에서 들어와 있어요. 교사 보기의 명단에서 "로그인 초기화"를 눌러 보세요.', 409);
    const token = `${s.no}.${Math.random().toString(36).slice(2)}`;
    db.state = apply(db.state, { type: 'token', no: s.no, tokenHash: sha(token) }, { role: 'system' }).state;
    save(db);
    return token;
  }),
  me: guard((token, place = '') => {
    const db = tick();
    const no = studentNo(db, token);
    db.places = { ...(db.places || {}), [no]: place };
    save(db);
    return studentView(db.state, no, place && place !== 'list' ? crowdOf(db.state, botSeen(db), no) : null);
  }),
  act: guard((token, action) => {
    const db = tick();
    const no = studentNo(db, token);
    const res = commit(db, apply(db.state, action, { role: 'student', no }));
    return { ok: true, ...res.out, view: studentView(res.state, no) };
  }),
  logout: guard((token) => {
    const db = tick();
    const no = studentNo(db, token);
    commit(db, apply(db.state, { type: 'token', no, tokenHash: '' }, { role: 'system' }));
    return { ok: true };
  }),
  teacherState: guard((pin) => {
    teacherOk(pin);
    const db = tick();
    return teacherView(db.state, botSeen(db));
  }),
  teacherAct: guard((pin, action) => {
    teacherOk(pin);
    const db = tick();
    if (action.type === 'wipe') return err('체험판에서는 "처음부터 다시"를 눌러 주세요.');
    const res = commit(db, apply(db.state, action, { role: 'teacher' }));
    planBots(db, Date.now());
    save(db);
    return { ok: true, ...res.out, view: teacherView(res.state, botSeen(db)) };
  }),
  changePin: guard(() => err('체험판의 PIN은 0000으로 고정이에요.')),
  history: guard((pin) => {
    teacherOk(pin);
    return load().history;
  }),
  deleteHistory: guard((pin, hid) => {
    teacherOk(pin);
    const db = load();
    db.history = db.history.filter((h) => h.hid !== hid);
    save(db);
    return { ok: true };
  }),
  reset() {
    mem = fresh();
    save(mem);
  },
};
