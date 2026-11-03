// 폴리스 학급회의 서버 (Cloudflare Pages Functions + D1, 바인딩 이름 DB)
// 주소: /api/polis/...  학급 하나만 담는다. 회의 규칙은 src/core/engine.js 에 있다.
import { emptyState, apply, checkLogin, studentView, teacherView, PolisError } from '../../../src/core/engine.js';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS polis_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, pin_hash TEXT NOT NULL DEFAULT '', fails INTEGER NOT NULL DEFAULT 0, fail_at INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS polis_seen (no INTEGER PRIMARY KEY, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS polis_history (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL)`,
];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const enc = new TextEncoder();
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const pinHash = (pin) => sha('polis-pin:' + String(pin));
const newToken = () => {
  const a = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ready = false;
async function db(env) {
  if (!env.DB) throw new PolisError('데이터베이스(D1)가 연결되지 않았어요. README의 "D1 연결" 단계를 확인해 주세요.', 503);
  if (!ready) {
    await env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)));
    await env.DB.prepare('INSERT OR IGNORE INTO polis_state (id, data) VALUES (1, ?)').bind(JSON.stringify(emptyState())).run();
    ready = true;
  }
  return env.DB;
}
const load = (d) => d.prepare('SELECT * FROM polis_state WHERE id = 1').first();

/** 읽고-바꾸고-쓰기. 동시에 여러 학생이 써도 잃어버리지 않도록 version으로 확인하고 다시 시도한다 */
async function mutate(d, fn) {
  for (let i = 0; i < 30; i++) {
    const row = await load(d);
    const res = fn(JSON.parse(row.data), row);
    const r = await d.prepare('UPDATE polis_state SET data = ?, version = version + 1 WHERE id = 1 AND version = ?')
      .bind(JSON.stringify(res.state), row.version).run();
    if (r.meta.changes) {
      if (res.out?.archived) {
        const a = res.out.archived;
        await d.prepare('INSERT INTO polis_history (topic, data, created_at) VALUES (?, ?, ?)').bind(a.topic, JSON.stringify(a), Date.now()).run();
        delete res.out.archived;
      }
      return res;
    }
    await sleep(5 + Math.random() * 25 * (i + 1));
  }
  throw new PolisError('사람이 몰려서 저장하지 못했어요. 다시 눌러 주세요.', 503);
}

async function requireTeacher(d, request) {
  const row = await load(d);
  if (!row.pin_hash) throw new PolisError('아직 학급방을 만들지 않았어요.', 409);
  const now = Date.now();
  if (row.fails >= 8 && now - row.fail_at < 10 * 60e3) throw new PolisError('PIN을 여러 번 틀려서 10분 동안 잠겼어요.', 429);
  const pin = request.headers.get('x-polis-pin') || '';
  if ((await pinHash(pin)) !== row.pin_hash) {
    const fails = now - row.fail_at < 10 * 60e3 ? row.fails + 1 : 1;
    await d.prepare('UPDATE polis_state SET fails = ?, fail_at = ? WHERE id = 1').bind(fails, now).run();
    throw new PolisError('교사 PIN이 맞지 않아요.', 403);
  }
  if (row.fails) await d.prepare('UPDATE polis_state SET fails = 0 WHERE id = 1').run();
  return row;
}

async function requireStudent(d, request) {
  const token = request.headers.get('x-polis-student') || '';
  const no = Number(token.split('.')[0]);
  const row = await load(d);
  const state = JSON.parse(row.data);
  const s = state.students[no];
  if (!s || !s.tokenHash || s.tokenHash !== (await sha(token))) throw new PolisError('다시 로그인해 주세요.', 401);
  return { no, state };
}

async function seenMap(d) {
  const { results } = await d.prepare('SELECT no, at FROM polis_seen').all();
  return Object.fromEntries(results.map((r) => [r.no, r.at]));
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function route(ctx) {
  const { request, env, params } = ctx;
  const path = [].concat(params.path || []).join('/');
  const method = request.method;
  const d = await db(env);

  // ---- 누구나 ----
  if (path === 'status' && method === 'GET') {
    const row = await load(d);
    const st = JSON.parse(row.data);
    return { ready: !!row.pin_hash, room: st.setup, needCode: !!st.code };
  }
  if (path === 'setup' && method === 'POST') {
    const b = await body(request);
    if (!/^\d{4,8}$/.test(String(b.pin ?? ''))) throw new PolisError('교사 PIN은 숫자 4~8자리로 정해 주세요.');
    const row = await load(d);
    if (row.pin_hash) throw new PolisError('이미 학급방이 있어요. 교사 PIN으로 들어가 주세요.', 409);
    const { state } = apply(JSON.parse(row.data), { type: 'setup', grade: b.grade, klass: b.klass, code: b.code }, { role: 'teacher' });
    const r = await d.prepare("UPDATE polis_state SET data = ?, pin_hash = ?, version = version + 1 WHERE id = 1 AND pin_hash = ''")
      .bind(JSON.stringify(state), await pinHash(b.pin)).run();
    if (!r.meta.changes) throw new PolisError('이미 학급방이 있어요.', 409);
    return { ok: true };
  }
  if (path === 'login' && method === 'POST') {
    const b = await body(request);
    const first = checkLogin(JSON.parse((await load(d)).data), b);
    const token = `${first.no}.${newToken()}`;
    const tokenHash = await sha(token);
    await mutate(d, (state) => {
      const s = checkLogin(state, b);
      if (s.tokenHash) throw new PolisError('이미 다른 기기에서 들어와 있어요. 선생님께 "로그인 초기화"를 부탁하세요.', 409);
      return apply(state, { type: 'token', no: s.no, tokenHash }, { role: 'system' });
    });
    return { token };
  }

  // ---- 학생 ----
  if (path === 'me' && method === 'GET') {
    const { no, state } = await requireStudent(d, request);
    const now = Date.now();
    await d.prepare('INSERT INTO polis_seen (no, at) VALUES (?, ?) ON CONFLICT (no) DO UPDATE SET at = excluded.at WHERE excluded.at - polis_seen.at > 10000')
      .bind(no, now).run();
    return studentView(state, no);
  }
  if (path === 'act' && method === 'POST') {
    const { no } = await requireStudent(d, request);
    const b = await body(request);
    const res = await mutate(d, (state) => apply(state, b, { role: 'student', no }));
    return { ok: true, ...res.out, view: studentView(res.state, no) };
  }
  if (path === 'logout' && method === 'POST') {
    const { no } = await requireStudent(d, request);
    await mutate(d, (state) => apply(state, { type: 'token', no, tokenHash: '' }, { role: 'system' }));
    return { ok: true };
  }

  // ---- 교사 ----
  if (path.startsWith('teacher/')) {
    await requireTeacher(d, request);
    const sub = path.slice(8);
    if (sub === 'state' && method === 'GET') {
      const row = await load(d);
      return teacherView(JSON.parse(row.data), await seenMap(d));
    }
    if (sub === 'act' && method === 'POST') {
      const b = await body(request);
      if (b.type === 'wipe') {
        await d.batch([d.prepare('DELETE FROM polis_history'), d.prepare('DELETE FROM polis_seen')]);
      }
      const res = await mutate(d, (state) => apply(state, b, { role: 'teacher' }));
      return { ok: true, ...res.out, view: teacherView(res.state, await seenMap(d)) };
    }
    if (sub === 'pin' && method === 'POST') {
      const b = await body(request);
      if (!/^\d{4,8}$/.test(String(b.pin ?? ''))) throw new PolisError('새 PIN은 숫자 4~8자리예요.');
      await d.prepare('UPDATE polis_state SET pin_hash = ? WHERE id = 1').bind(await pinHash(b.pin)).run();
      return { ok: true };
    }
    if (sub === 'history' && method === 'GET') {
      const { results } = await d.prepare('SELECT id, data FROM polis_history ORDER BY id DESC LIMIT 200').all();
      return results.map((r) => ({ hid: r.id, ...JSON.parse(r.data) }));
    }
    if (sub.startsWith('history/') && method === 'DELETE') {
      await d.prepare('DELETE FROM polis_history WHERE id = ?').bind(Number(sub.slice(8))).run();
      return { ok: true };
    }
  }
  throw new PolisError('없는 주소예요.', 404);
}

export async function onRequest(ctx) {
  try {
    return json(await route(ctx));
  } catch (e) {
    if (e instanceof PolisError || e?.status) return json({ error: e.message }, e.status || 400);
    console.error(e);
    return json({ error: '서버 오류가 났어요: ' + (e?.message || e) }, 500);
  }
}
