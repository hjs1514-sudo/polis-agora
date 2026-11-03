import { useEffect, useState } from 'react';
import { api, IS_DEMO } from '../api/index.js';
import { AVATARS, LIMITS, STAGE_NAMES } from '../core/engine.js';
import { Avatar, Backdrop, Stepper, store, usePoll, useToast } from '../ui.jsx';
import Oracle from './Oracle.jsx';

const TOKEN = IS_DEMO ? 'polis-demo-student' : 'polis-student';

export default function StudentApp() {
  const [token, setToken] = useState(() => store.get(TOKEN));
  const save = (t) => {
    store.set(TOKEN, t);
    setToken(t);
  };
  if (!token) return <Login onToken={save} />;
  return <Citizen token={token} onLogout={() => save(null)} />;
}

function Login({ onToken }) {
  const [status, setStatus] = useState(null);
  const [f, setF] = useState(() => {
    const last = JSON.parse(store.get('polis-last') || '{}');
    return { grade: last.grade || '', klass: last.klass || '', no: '', name: '', code: '' };
  });
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => {
    api.status().then(
      (s) => {
        setStatus(s);
        if (s.room) setF((x) => ({ ...x, grade: x.grade || String(s.room.grade), klass: x.klass || String(s.room.klass) }));
      },
      (e) => setStatus({ error: e.message }),
    );
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const token = await api.login(f);
      store.set('polis-last', JSON.stringify({ grade: f.grade, klass: f.klass }));
      onToken(token);
    } catch (err) {
      show(err.message, 'error');
    }
    setBusy(false);
  };
  return (
    <div className="page">
      <Backdrop stage="login" />
      <main className="center-card">
        <div className="card login-card">
          <p className="eyebrow">폴리스 학급회의</p>
          <h1 className="title">시민 명부 확인</h1>
          <p className="muted">성문 앞입니다. 학년, 반, 번호, 이름을 대면 성문이 열립니다.</p>
          {status?.error && <p className="alert">{status.error}</p>}
          {status && !status.error && !status.ready && <p className="alert">아직 선생님이 학급방을 만들지 않았어요.</p>}
          {IS_DEMO && (
            <p className="hint">
              체험판: 2학년 1반 <b>12번 오시우</b>, 입장 코드 <b>1234</b>로 들어가 보세요.
            </p>
          )}
          <form onSubmit={submit} className="form">
            <div className="row4">
              <label>
                학년
                <input inputMode="numeric" value={f.grade} onChange={set('grade')} required maxLength={1} />
              </label>
              <label>
                반
                <input inputMode="numeric" value={f.klass} onChange={set('klass')} required maxLength={2} />
              </label>
              <label>
                번호
                <input inputMode="numeric" value={f.no} onChange={set('no')} required maxLength={2} autoFocus />
              </label>
              <label className="grow">
                이름
                <input value={f.name} onChange={set('name')} required maxLength={20} />
              </label>
            </div>
            {status?.needCode && (
              <label>
                입장 코드 (숫자 4자리)
                <input inputMode="numeric" value={f.code} onChange={set('code')} required maxLength={4} />
              </label>
            )}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? '명부 확인 중…' : '성문 열기'}
            </button>
          </form>
          <a className="small-link" href="#/teacher">
            선생님 화면으로
          </a>
        </div>
      </main>
      {toast}
    </div>
  );
}

function AvatarPick({ current, onPick }) {
  const [sel, setSel] = useState(current || '');
  return (
    <div className="card">
      <p className="eyebrow">처음 오셨군요</p>
      <h1 className="title">나의 시민 모습 고르기</h1>
      <p className="muted">아고라에서 친구들에게는 이름 대신 이 모습으로 보여요. 나중에 바꿀 수 있어요.</p>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button type="button" key={a.id} className={`avatar-choice ${sel === a.id ? 'on' : ''}`} onClick={() => setSel(a.id)}>
            <Avatar id={a.id} size={96} />
            <span>{a.name}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary btn-lg" disabled={!sel} onClick={() => onPick(sel)}>
        이 모습으로 폴리스에 들어가기
      </button>
    </div>
  );
}

function Citizen({ token, onLogout }) {
  const [toast, show] = useToast();
  const [changing, setChanging] = useState(false);
  const { data: v, error, setData, refresh } = usePoll(() => api.me(token), IS_DEMO ? 1500 : 3000, [token]);
  useEffect(() => {
    if (error?.status === 401) onLogout();
  }, [error, onLogout]);

  const act = async (action, okMsg) => {
    try {
      const r = await api.act(token, action);
      setData(r.view);
      if (okMsg) show(okMsg, 'ok');
      return true;
    } catch (e) {
      show(e.message, 'error');
      refresh();
      return false;
    }
  };

  if (!v)
    return (
      <div className="page">
        <Backdrop stage="login" />
        <main className="center-card">
          <div className="card">{error ? <p className="alert">{error.message}</p> : <p className="muted">폴리스로 가는 길…</p>}</div>
        </main>
      </div>
    );

  if (!v.me?.avatar || changing)
    return (
      <div className="page">
        <Backdrop stage="login" />
        <main className="center-card wide">
          <AvatarPick
            current={v.me?.avatar}
            onPick={async (avatar) => {
              if (await act({ type: 'avatar', avatar })) setChanging(false);
            }}
          />
        </main>
        {toast}
      </div>
    );

  const m = v.meeting;
  const stage = m?.stage || 'login';
  return (
    <div className="page">
      <Backdrop stage={stage} />
      <header className="topbar">
        <button type="button" className="me" onClick={() => setChanging(true)} title="모습 바꾸기">
          <Avatar id={v.me.avatar} size={40} />
          <span>
            {v.me.no}번 {v.me.name}
          </span>
        </button>
        <span className="room">
          {v.room?.grade}학년 {v.room?.klass}반 폴리스
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            if (!window.confirm('나가면 선생님 확인 없이 다시 들어올 수 있어요. 나갈까요?')) return;
            await api.logout(token).catch(() => {});
            onLogout();
          }}
        >
          나가기
        </button>
      </header>
      {error && <p className="net-warn">연결이 잠시 끊겼어요. 다시 잇는 중…</p>}
      <main className="stage-main">
        {!m ? (
          <div className="card center">
            <h1 className="title">폴리스가 고요합니다</h1>
            <p className="muted">선생님이 회의 주제를 준비하고 있어요. 이 화면을 켜 두면 주제가 오면 바로 보여요.</p>
          </div>
        ) : (
          <>
            <Stepper stage={m.stage} />
            {m.stage !== 'oracle' && <Topic topic={m.topic} />}
            {m.stage === 'notice' && <Notice />}
            {(m.stage === 'agora' || m.stage === 'adopt') && <Agora m={m} me={v.me} act={act} />}
            {m.stage === 'vote' && <Vote m={m} act={act} />}
            {m.stage === 'oracle' && <Oracle topic={m.topic} result={m.result} voice />}
          </>
        )}
      </main>
      {toast}
    </div>
  );
}

function Topic({ topic }) {
  return (
    <div className="scroll">
      <span className="scroll-label">전령의 공지</span>
      <h1 className="scroll-text">{topic}</h1>
    </div>
  );
}

function Notice() {
  return (
    <div className="card center">
      <p className="muted">주제를 읽고 생각을 정리해 두세요. 선생님이 아고라 광장을 열면 의견을 쓸 수 있어요.</p>
    </div>
  );
}

function Agora({ m, me, act }) {
  const [text, setText] = useState('');
  const canWrite = m.stage === 'agora' && m.opinionsOpen && !me.muted && m.myCount < LIMITS.perStudent;
  const post = async (e) => {
    e.preventDefault();
    if (await act({ type: 'post', text }, '아고라에 의견을 올렸어요.')) setText('');
  };
  const list = m.opinions.slice().sort((a, b) => b.at - a.at);
  return (
    <>
      {m.stage === 'adopt' ? (
        <div className="card center">
          <h2 className="h2">{STAGE_NAMES.adopt}</h2>
          <p className="muted">선생님이 아크로폴리스에 올릴 의견을 고르고 있어요. 채택된 의견에는 월계관이 붙어요.</p>
        </div>
      ) : (
        <form className="card compose" onSubmit={post}>
          {me.muted ? (
            <p className="alert">선생님이 잠시 글쓰기를 멈춰 두었어요.</p>
          ) : !m.opinionsOpen ? (
            <p className="alert">지금은 의견 받기가 닫혀 있어요.</p>
          ) : m.myCount >= LIMITS.perStudent ? (
            <p className="muted">의견을 {LIMITS.perStudent}개 모두 올렸어요. 친구 의견에 올리브 가지를 달아 보세요.</p>
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="이 주제에 대한 나의 생각을 써 주세요. 친구들에게는 이름 없이 아바타로만 보여요."
            maxLength={LIMITS.opinion}
            rows={3}
            disabled={!canWrite}
          />
          <div className="compose-foot">
            <span className="muted small">
              {text.length}/{LIMITS.opinion} · 내 의견 {m.myCount}/{LIMITS.perStudent}
            </span>
            <button className="btn btn-primary" disabled={!canWrite || text.trim().length < 2}>
              아고라에 올리기
            </button>
          </div>
        </form>
      )}
      <section className="opinions">
        <h2 className="h2">
          아고라의 목소리 <span className="count">{list.length}</span>
        </h2>
        {!list.length && <p className="muted center">아직 아무도 말하지 않았어요. 첫 목소리가 되어 보세요.</p>}
        {list.map((o) => (
          <article key={o.id} className={`opinion ${o.adopted ? 'adopted' : ''} ${o.mine ? 'mine' : ''} ${o.hidden ? 'hidden-op' : ''}`}>
            <Avatar id={o.avatar} size={44} />
            <div className="op-body">
              <p className="op-text">{o.text}</p>
              <p className="op-meta">
                {o.name && <span>{o.name}</span>}
                {o.mine && <span className="tag">내 의견</span>}
                {o.hidden && <span className="tag tag-warn">선생님이 숨김</span>}
                {o.adopted && <span className="tag tag-gold">🌿 채택</span>}
              </p>
            </div>
            <div className="op-side">
              <button
                type="button"
                className={`olive ${o.myOlive ? 'on' : ''}`}
                disabled={o.mine || o.hidden}
                onClick={() => act({ type: 'olive', id: o.id })}
                title={o.mine ? '내 의견' : '공감해요'}
              >
                🫒 {o.olives}
              </button>
              {o.mine && m.stage === 'agora' && !o.adopted && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.confirm('이 의견을 지울까요?') && act({ type: 'unpost', id: o.id })}
                >
                  지우기
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function Vote({ m, act }) {
  return (
    <section className="vote">
      <div className="card center">
        <h2 className="h2">아크로폴리스 투표{m.round > 1 ? ` (${m.round}차)` : ''}</h2>
        <p className="muted">마음에 드는 의견 하나에 도편(오스트라콘)을 넣으세요. 마감 전까지는 바꿀 수 있어요. 결과는 신탁이 알려 줍니다.</p>
      </div>
      <div className="ballots">
        {m.candidates.map((c, i) => (
          <button key={c.id} type="button" className={`ballot ${m.myVote === c.id ? 'on' : ''}`} onClick={() => act({ type: 'vote', id: c.id }, '도편을 항아리에 넣었어요.')}>
            <span className="ballot-no">{String.fromCharCode(0x391 + i)}</span>
            <span className="ballot-text">{c.text}</span>
            <span className="ballot-mark">{m.myVote === c.id ? '🏺 내 도편' : '여기에 투표'}</span>
          </button>
        ))}
      </div>
      {m.myVote && <p className="center muted">투표했어요. 선생님이 마감하면 신탁이 내려집니다.</p>}
    </section>
  );
}
