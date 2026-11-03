// 실사용판: 같은 사이트의 /api/polis 로 묻는다 (Cloudflare Pages Functions + D1)
const BASE = '/api/polis';

async function call(path, { method = 'GET', body, headers = {} } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('인터넷 연결을 확인해 주세요.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `오류 ${res.status}`), { status: res.status });
  return data;
}
const S = (token) => ({ 'x-polis-student': token });
const T = (pin) => ({ 'x-polis-pin': pin });

export const serverApi = {
  mode: 'server',
  status: () => call('/status'),
  setup: (b) => call('/setup', { method: 'POST', body: b }),
  login: (b) => call('/login', { method: 'POST', body: b }).then((r) => r.token),
  me: (token) => call('/me', { headers: S(token) }),
  act: (token, action) => call('/act', { method: 'POST', body: action, headers: S(token) }),
  logout: (token) => call('/logout', { method: 'POST', headers: S(token) }),
  teacherState: (pin) => call('/teacher/state', { headers: T(pin) }),
  teacherAct: (pin, action) => call('/teacher/act', { method: 'POST', body: action, headers: T(pin) }),
  changePin: (pin, next) => call('/teacher/pin', { method: 'POST', body: { pin: next }, headers: T(pin) }),
  history: (pin) => call('/teacher/history', { headers: T(pin) }),
  deleteHistory: (pin, hid) => call(`/teacher/history/${hid}`, { method: 'DELETE', headers: T(pin) }),
};
