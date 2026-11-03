// 학급회의 규칙의 한 곳. 서버(Cloudflare 함수)와 체험판(브라우저)이 똑같이 이 파일을 씁니다.
// 상태(state)는 평범한 JSON 하나이고, apply()가 행동 하나를 반영한 새 상태를 돌려줍니다.

export const STAGES = ['notice', 'agora', 'adopt', 'vote', 'oracle'];
export const STAGE_NAMES = {
  notice: '주제 공지',
  agora: '아고라 광장',
  adopt: '교사 채택',
  vote: '아크로폴리스 투표',
  oracle: '신탁 판결',
};
export const LIMITS = { opinion: 200, topic: 100, perStudent: 5, adoptMax: 4, students: 45 };

export const AVATARS = [
  { id: 'm1', name: '철학자' },
  { id: 'm2', name: '호플리테스 전사' },
  { id: 'm3', name: '올림피아 선수' },
  { id: 'm4', name: '도공' },
  { id: 'm5', name: '상인' },
  { id: 'f1', name: '여사제' },
  { id: 'f2', name: '지혜의 전사' },
  { id: 'f3', name: '시인' },
  { id: 'f4', name: '직조공' },
  { id: 'f5', name: '올리브 농부' },
];

// 학급회의에 어울리지 않는 말. 필요하면 여기에 더 넣으세요.
export const BANNED = ['시발', '씨발', 'ㅅㅂ', '병신', 'ㅂㅅ', '존나', 'ㅈㄴ', '개새', '미친놈', '미친년', '닥쳐', '꺼져', '좆', '썅', '느금', '애미', '애비'];

export class PolisError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (msg, status) => {
  throw new PolisError(msg, status);
};

export function emptyState() {
  return { v: 1, setup: null, code: '', students: {}, meeting: null, nextId: 1, settings: { showNames: false } };
}

const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const normName = (v) => String(v ?? '').replace(/\s+/g, '').trim();
export const hasBanned = (text) => {
  const t = String(text).replace(/[\s.\-_*]/g, '');
  return BANNED.some((w) => t.includes(w));
};

/** "1 김하늘", "1,김하늘", "1번 김하늘", 탭 구분 모두 받는다 */
export function parseRoster(text) {
  const out = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,2})\s*번?\s*[,\t ]\s*(.+)$/);
    if (!m) continue;
    const no = Number(m[1]);
    const name = normName(m[2].split(/[,\t]/)[0]);
    if (no >= 1 && no <= 99 && name) out.push({ no, name: name.slice(0, 20) });
  }
  return out;
}

/** 로그인 확인: 학년/반/번호/이름이 명단과 맞고 입장 코드가 맞아야 한다 */
export function checkLogin(state, input) {
  if (!state.setup) fail('아직 선생님이 학급방을 만들지 않았어요.', 403);
  const { grade, klass } = state.setup;
  if (Number(input.grade) !== grade || Number(input.klass) !== klass)
    fail(`이 회의장은 ${grade}학년 ${klass}반 전용이에요.`, 403);
  if (state.code && String(input.code ?? '').trim() !== state.code) fail('입장 코드가 맞지 않아요.', 403);
  const s = state.students[Number(input.no)];
  if (!s || s.name !== normName(input.name)) fail('명단에 없는 시민입니다. 번호와 이름을 다시 확인하거나 선생님께 여쭤보세요.', 403);
  return s;
}

const opinionById = (m, id) => m?.opinions.find((o) => o.id === Number(id));

function tally(m) {
  const votes = m.votes[m.round] || {};
  const counts = Object.fromEntries(m.candidates.map((id) => [id, 0]));
  for (const id of Object.values(votes)) if (id in counts) counts[id] += 1;
  return { counts, voters: Object.keys(votes).length };
}

function makeResult(state, m) {
  const { counts, voters } = tally(m);
  const rows = m.candidates.map((id) => ({ id, text: opinionById(m, id)?.text || '', count: counts[id] }));
  const max = Math.max(0, ...rows.map((r) => r.count));
  const winners = max > 0 ? rows.filter((r) => r.count === max) : [];
  const g = state.setup ? `${state.setup.grade}학년 ${state.setup.klass}반` : '이 폴리스의';
  let verdict;
  if (!winners.length) verdict = '항아리가 비어 있도다. 아무도 도편을 넣지 않았으니, 신은 아무 말씀도 하지 않으시노라.';
  else if (winners.length > 1)
    verdict = `신들도 결정하지 못하였도다. ${winners.map((w) => `「${w.text}」`).join(', ')} 모두 똑같이 ${max}표를 얻었노라. 시민들이여, 다시 뜻을 모으라.`;
  else verdict = `델포이의 신이 이르노라. ${g} 시민들이 택한 뜻은 「${winners[0].text}」이니라. ${voters}명 가운데 ${max}표를 얻었노라.`;
  return { rows, voters, total: Object.keys(state.students).length, winners: winners.map((w) => w.id), tie: winners.length > 1, verdict, round: m.round };
}

function archiveOf(m) {
  if (!m) return null;
  return {
    id: m.id,
    topic: m.topic,
    startedAt: m.startedAt,
    endedAt: Date.now(),
    opinions: m.opinions.map(({ id, no, text, hidden, adopted, olives }) => ({ id, no, text, hidden, adopted, olives: olives.length })),
    result: m.result,
  };
}

/**
 * 행동 하나를 반영한다. actor = { role: 'teacher' } | { role: 'student', no } | { role: 'system' }
 * 돌려주는 값: { state, out } (out은 화면에 돌려줄 덤 정보, archived는 끝난 회의 기록)
 */
export function apply(prev, action, actor, now = Date.now()) {
  const state = JSON.parse(JSON.stringify(prev));
  const m = state.meeting;
  const t = action?.type;
  const out = {};

  if (actor.role === 'student') {
    const me = state.students[actor.no];
    if (!me) fail('명단에서 빠졌어요. 선생님께 여쭤보세요.', 403);
    if (t === 'avatar') {
      if (!AVATARS.some((a) => a.id === action.avatar)) fail('아바타를 다시 골라 주세요.');
      me.avatar = action.avatar;
      return { state, out };
    }
    if (!m) fail('아직 회의 주제가 없어요.');
    if (t === 'post') {
      if (m.stage !== 'agora' || !m.opinionsOpen) fail('지금은 의견을 받지 않아요.');
      if (me.muted) fail('선생님이 잠시 글쓰기를 멈춰 두었어요.');
      const text = clean(action.text, LIMITS.opinion);
      if (text.length < 2) fail('의견을 두 글자 이상 써 주세요.');
      if (hasBanned(text)) fail('아고라에 어울리지 않는 말이 들어 있어요. 고쳐서 다시 올려 주세요.');
      if (m.opinions.filter((o) => o.no === me.no).length >= LIMITS.perStudent) fail(`의견은 한 사람당 ${LIMITS.perStudent}개까지예요.`);
      const op = { id: state.nextId++, no: me.no, text, hidden: false, starred: false, adopted: false, at: now, olives: [] };
      m.opinions.push(op);
      out.id = op.id;
      return { state, out };
    }
    if (t === 'unpost') {
      const op = opinionById(m, action.id);
      if (!op || op.no !== me.no) fail('그 의견을 찾지 못했어요.');
      if (m.stage !== 'agora' || op.adopted) fail('이제는 지울 수 없어요.');
      m.opinions = m.opinions.filter((o) => o !== op);
      return { state, out };
    }
    if (t === 'olive') {
      const op = opinionById(m, action.id);
      if (!op || op.hidden) fail('그 의견을 찾지 못했어요.');
      if (!['agora', 'adopt'].includes(m.stage)) fail('지금은 올리브 가지를 달 수 없어요.');
      if (op.no === me.no) fail('자기 의견에는 올리브 가지를 달 수 없어요.');
      op.olives = op.olives.includes(me.no) ? op.olives.filter((n) => n !== me.no) : [...op.olives, me.no];
      return { state, out };
    }
    if (t === 'vote') {
      if (m.stage !== 'vote') fail('투표 시간이 아니에요.');
      if (!m.candidates.includes(Number(action.id))) fail('투표할 수 없는 의견이에요.');
      (m.votes[m.round] ||= {})[me.no] = Number(action.id);
      return { state, out };
    }
    fail('알 수 없는 행동이에요.');
  }

  if (actor.role === 'system') {
    if (t === 'token') {
      const s = state.students[action.no];
      if (!s) fail('명단에 없는 시민입니다.', 403);
      s.tokenHash = action.tokenHash;
      return { state, out };
    }
    fail('알 수 없는 행동이에요.');
  }

  if (actor.role !== 'teacher') fail('권한이 없어요.', 403);

  switch (t) {
    case 'setup': {
      const grade = Number.parseInt(action.grade, 10);
      const klass = Number.parseInt(action.klass, 10);
      if (!(grade >= 1 && grade <= 6) || !(klass >= 0 && klass <= 30)) fail('학년과 반을 숫자로 넣어 주세요.');
      state.setup = { grade, klass };
      if (action.code !== undefined) state.code = cleanCode(action.code);
      break;
    }
    case 'roster': {
      const list = parseRoster(action.text);
      if (!list.length) fail('명단을 읽지 못했어요. 한 줄에 "번호 이름"으로 넣어 주세요.');
      const next = action.mode === 'add' ? { ...state.students } : {};
      for (const { no, name } of list) {
        const old = state.students[no];
        next[no] = old && old.name === name ? old : { no, name, avatar: '', muted: false, tokenHash: '' };
      }
      if (Object.keys(next).length > LIMITS.students) fail(`명단은 ${LIMITS.students}명까지예요.`);
      state.students = next;
      out.count = Object.keys(next).length;
      break;
    }
    case 'removeStudent':
      delete state.students[Number(action.no)];
      break;
    case 'resetLogin': {
      const s = state.students[Number(action.no)];
      if (s) s.tokenHash = '';
      break;
    }
    case 'mute': {
      const s = state.students[Number(action.no)];
      if (s) s.muted = !!action.muted;
      break;
    }
    case 'settings':
      if (action.code !== undefined) state.code = cleanCode(action.code);
      if (action.showNames !== undefined) state.settings.showNames = !!action.showNames;
      break;
    case 'topic': {
      const topic = clean(action.topic, LIMITS.topic);
      if (topic.length < 2) fail('회의 주제를 써 주세요.');
      if (m && m.stage === 'notice' && !m.opinions.length) {
        m.topic = topic; // 공지만 하고 시작 전이면 고치기만
        break;
      }
      if (m && (m.opinions.length || m.result)) out.archived = archiveOf(m);
      state.meeting = { id: state.nextId++, topic, stage: 'notice', round: 1, opinionsOpen: true, opinions: [], votes: {}, candidates: [], result: null, startedAt: now };
      break;
    }
    case 'endMeeting':
      if (m && (m.opinions.length || m.result)) out.archived = archiveOf(m);
      state.meeting = null;
      break;
    case 'stage': {
      if (!m) fail('먼저 회의 주제를 공지해 주세요.');
      const to = action.stage;
      if (!STAGES.includes(to)) fail('알 수 없는 단계예요.');
      if (to === 'vote' || to === 'oracle') {
        const adopted = m.opinions.filter((o) => o.adopted && !o.hidden).map((o) => o.id);
        if (m.stage !== 'vote' && m.stage !== 'oracle') {
          if (adopted.length < 2) fail('투표하려면 의견을 2개 이상 채택해 주세요.');
          m.candidates = adopted;
          m.round = 1;
          m.votes = {};
        }
      }
      if (to === 'oracle') {
        if (m.stage !== 'vote' && m.stage !== 'oracle') fail('투표를 먼저 진행해 주세요.');
        m.result = makeResult(state, m);
      } else {
        m.result = null;
      }
      m.stage = to;
      break;
    }
    case 'revote': {
      if (!m?.result?.tie) fail('동점일 때만 다시 투표할 수 있어요.');
      m.candidates = m.result.winners;
      m.round += 1;
      m.result = null;
      m.stage = 'vote';
      break;
    }
    case 'opinionsOpen':
      if (!m) fail('회의가 없어요.');
      m.opinionsOpen = !!action.open;
      break;
    case 'opinion': {
      const op = opinionById(m, action.id);
      if (!op) fail('그 의견을 찾지 못했어요.');
      const p = action.patch || {};
      if (p.hidden !== undefined) {
        op.hidden = !!p.hidden;
        if (op.hidden) op.adopted = false;
      }
      if (p.starred !== undefined) op.starred = !!p.starred;
      if (p.text !== undefined) {
        const text = clean(p.text, LIMITS.opinion);
        if (text.length < 2) fail('의견이 너무 짧아요.');
        op.text = text;
      }
      if (p.adopted !== undefined) {
        if (m.stage === 'vote' || m.stage === 'oracle') fail('투표가 시작된 뒤에는 채택을 바꿀 수 없어요.');
        if (p.adopted && !op.adopted && m.opinions.filter((o) => o.adopted).length >= LIMITS.adoptMax)
          fail(`채택은 ${LIMITS.adoptMax}개까지예요.`);
        op.adopted = !!p.adopted && !op.hidden;
      }
      break;
    }
    case 'teacherPost': {
      if (!m) fail('회의가 없어요.');
      const text = clean(action.text, LIMITS.opinion);
      if (text.length < 2) fail('의견을 써 주세요.');
      m.opinions.push({ id: state.nextId++, no: 0, text, hidden: false, starred: false, adopted: false, at: now, olives: [] });
      break;
    }
    case 'wipe': {
      const keep = { setup: state.setup, code: state.code };
      return { state: { ...emptyState(), ...keep }, out };
    }
    default:
      fail('알 수 없는 행동이에요.');
  }
  return { state, out };
}

function cleanCode(v) {
  const s = String(v ?? '').trim();
  if (s && !/^\d{4}$/.test(s)) fail('입장 코드는 숫자 4자리예요.');
  return s;
}

// ---------- 화면에 보낼 모양 ----------

const avatarOf = (state, no) => (no === 0 ? 'teacher' : state.students[no]?.avatar || '');
const nameOf = (state, no) => (no === 0 ? '선생님' : state.students[no]?.name || '');

/** 학생에게 보낼 것: 다른 학생의 이름은 숨기고(설정에 따라), 숨긴 글은 빼고, 투표 중 득표는 숨긴다 */
export function studentView(state, no, crowd = null) {
  const me = state.students[no];
  const m = state.meeting;
  const view = {
    room: state.setup,
    me: me ? { no: me.no, name: me.name, avatar: me.avatar, muted: !!me.muted } : null,
    meeting: null,
    crowd: crowd || {},
  };
  if (!m) return view;
  const opinions = m.opinions
    .filter((o) => !o.hidden || o.no === no)
    .map((o) => ({
      id: o.id,
      text: o.text,
      avatar: avatarOf(state, o.no),
      name: o.no === no || o.no === 0 || state.settings.showNames ? nameOf(state, o.no) : '',
      mine: o.no === no,
      hidden: o.hidden,
      adopted: o.adopted,
      olives: o.olives.length,
      myOlive: o.olives.includes(no),
      at: o.at,
    }));
  view.meeting = {
    id: m.id,
    topic: m.topic,
    stage: m.stage,
    round: m.round,
    opinionsOpen: m.opinionsOpen,
    opinions,
    myCount: m.opinions.filter((o) => o.no === no).length,
    candidates: m.stage === 'vote' || m.stage === 'oracle' ? m.candidates.map((id) => ({ id, text: opinionById(m, id)?.text || '' })) : [],
    myVote: (m.votes[m.round] || {})[no] ?? null,
    result: m.stage === 'oracle' ? m.result : null,
  };
  return view;
}

const seenAt = (x) => (typeof x === 'number' ? x : x?.at || 0);

/** 지도에서 친구들이 있는 곳: { agora: [아바타...], ... } (나는 빼고, 이름 없이) */
export function crowdOf(state, seen, no, now = Date.now()) {
  const out = {};
  for (const [k, x] of Object.entries(seen)) {
    const n = Number(k);
    if (n === no || !x?.place || x.place === 'list' || now - seenAt(x) > 30000) continue;
    const s = state.students[n];
    if (!s?.avatar) continue;
    (out[x.place] ||= []).push(s.avatar);
  }
  return out;
}

/** 교사에게 보낼 것: 모두 */
export function teacherView(state, seen = {}, now = Date.now()) {
  const m = state.meeting;
  const votes = m ? m.votes[m.round] || {} : {};
  const roster = Object.values(state.students)
    .sort((a, b) => a.no - b.no)
    .map((s) => ({
      no: s.no,
      name: s.name,
      avatar: s.avatar,
      muted: !!s.muted,
      loggedIn: !!s.tokenHash,
      online: !!seen[s.no] && now - seenAt(seen[s.no]) < 20000,
      place: seen[s.no]?.place || '',
      posts: m ? m.opinions.filter((o) => o.no === s.no).length : 0,
      voted: votes[s.no] !== undefined,
    }));
  return {
    setup: state.setup,
    code: state.code,
    settings: state.settings,
    roster,
    meeting: m && {
      ...m,
      opinions: m.opinions.map((o) => ({ ...o, olives: o.olives.length, name: nameOf(state, o.no), avatar: avatarOf(state, o.no) })),
      votes: undefined,
      turnout: Object.keys(votes).length,
      tally: m.stage === 'oracle' ? tally(m).counts : null, // 투표 중에는 선생님도 투표율만 본다
    },
  };
}
