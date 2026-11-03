import { useEffect, useState } from 'react';
import { api, IS_DEMO } from '../api/index.js';
import { DEMO_INFO } from '../api/index.js';
import { LIMITS, STAGES, STAGE_NAMES } from '../core/engine.js';
import { Avatar, Backdrop, Stepper, store, usePoll, useToast } from '../ui.jsx';
import Oracle from './Oracle.jsx';
import { Qr } from '../Qr.jsx';

const PIN = IS_DEMO ? 'polis-demo-pin' : 'polis-pin';

export default function TeacherApp() {
  const [status, setStatus] = useState(null);
  const [pin, setPin] = useState(() => store.get(PIN) || (IS_DEMO ? DEMO_INFO.pin : ''));
  const [ok, setOk] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => {
    api.status().then(setStatus, (e) => setStatus({ error: e.message }));
  }, []);
  useEffect(() => {
    if (!pin || !status?.ready) return;
    api.teacherState(pin).then(
      () => setOk(true),
      () => {
        store.set(PIN, null);
        setOk(false);
      },
    );
    // 처음 한 번만 확인
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!status)
    return (
      <Shell>
        <p className="muted">불러오는 중…</p>
      </Shell>
    );
  if (status.error)
    return (
      <Shell>
        <p className="alert">{status.error}</p>
      </Shell>
    );
  if (!status.ready) return <Setup onDone={(p) => { store.set(PIN, p); setPin(p); setStatus({ ...status, ready: true }); setOk(true); }} />;
  if (!ok)
    return (
      <Shell>
        <p className="eyebrow">선생님 화면</p>
        <h1 className="title">교사 PIN</h1>
        {IS_DEMO && <p className="hint">체험판 PIN은 <b>0000</b>이에요.</p>}
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.teacherState(pin);
              store.set(PIN, pin);
              setOk(true);
            } catch (err) {
              show(err.message, 'error');
            }
          }}
        >
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="숫자 PIN" autoFocus />
          <button className="btn btn-primary btn-lg">들어가기</button>
        </form>
        <a className="small-link" href="#/">학생 화면으로</a>
        {toast}
      </Shell>
    );
  return (
    <Dashboard
      pin={pin}
      onLock={() => {
        store.set(PIN, null);
        setPin('');
        setOk(false);
      }}
    />
  );
}

function Shell({ children }) {
  return (
    <div className="page">
      <Backdrop stage="login" />
      <main className="center-card">
        <div className="card">{children}</div>
      </main>
    </div>
  );
}

function Setup({ onDone }) {
  const [f, setF] = useState({ grade: '2', klass: '', code: '', pin: '', pin2: '' });
  const [toast, show] = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Shell>
      <p className="eyebrow">처음 한 번만</p>
      <h1 className="title">학급방 만들기</h1>
      <p className="muted">이 회의장은 담임 학급 하나만 씁니다. 교사 PIN은 선생님만 아시도록 정해 주세요.</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (f.pin !== f.pin2) return show('PIN 두 칸이 서로 달라요.', 'error');
          try {
            await api.setup(f);
            onDone(f.pin);
          } catch (err) {
            show(err.message, 'error');
          }
        }}
      >
        <div className="row4">
          <label>
            학년
            <input inputMode="numeric" value={f.grade} onChange={set('grade')} required />
          </label>
          <label>
            반
            <input inputMode="numeric" value={f.klass} onChange={set('klass')} required />
          </label>
          <label className="grow">
            학생 입장 코드 (숫자 4자리)
            <input inputMode="numeric" value={f.code} onChange={set('code')} maxLength={4} required pattern="\d{4}" />
          </label>
        </div>
        <div className="row4">
          <label className="grow">
            교사 PIN (숫자 4~8자리)
            <input type="password" inputMode="numeric" value={f.pin} onChange={set('pin')} required pattern="\d{4,8}" />
          </label>
          <label className="grow">
            PIN 한 번 더
            <input type="password" inputMode="numeric" value={f.pin2} onChange={set('pin2')} required />
          </label>
        </div>
        <button className="btn btn-primary btn-lg">학급방 만들기</button>
      </form>
      {toast}
    </Shell>
  );
}

const TABS = [
  ['meeting', '회의 진행'],
  ['roster', '명단'],
  ['history', '회의 기록'],
  ['settings', '설정'],
];

function Dashboard({ pin, onLock }) {
  const [tab, setTab] = useState('meeting');
  const [tv, setTv] = useState(false);
  const [toast, show] = useToast();
  const { data: v, error, setData, refresh } = usePoll(() => api.teacherState(pin), IS_DEMO ? 1500 : 2500, [pin]);
  useEffect(() => {
    if (error?.status === 403) onLock();
  }, [error, onLock]);

  const act = async (action, okMsg) => {
    try {
      const r = await api.teacherAct(pin, action);
      setData(r.view);
      if (okMsg) show(okMsg, 'ok');
      return r;
    } catch (e) {
      show(e.message, 'error');
      refresh();
      return null;
    }
  };

  if (!v)
    return (
      <Shell>
        <p className="muted">{error ? error.message : '불러오는 중…'}</p>
      </Shell>
    );
  const m = v.meeting;
  if (tv) return <TvView v={v} onClose={() => setTv(false)} />;
  return (
    <div className="page teacher">
      <Backdrop stage={m?.stage || 'login'} />
      <header className="topbar">
        <span className="room">
          🏛️ {v.setup?.grade}학년 {v.setup?.klass}반 폴리스 · 선생님
        </span>
        <nav className="tabs">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <button type="button" className="btn btn-gold btn-sm" onClick={() => setTv(true)}>
            📺 TV 화면
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onLock}>
            잠그기
          </button>
        </div>
      </header>
      <div className="qr-strip">
        <Qr size={64} code={v.code} />
        <span className="muted small">학생들은 이 QR을 찍고 학년·반·번호·이름과 입장 코드로 들어와요. QR을 누르면 크게 보여요.</span>
      </div>
      {error && <p className="net-warn">연결이 잠시 끊겼어요. 다시 잇는 중…</p>}
      <main className="teacher-main">
        {tab === 'meeting' && <MeetingTab v={v} act={act} show={show} />}
        {tab === 'roster' && <RosterTab v={v} act={act} />}
        {tab === 'history' && <HistoryTab pin={pin} show={show} />}
        {tab === 'settings' && <SettingsTab v={v} act={act} pin={pin} show={show} onLock={onLock} />}
      </main>
      {toast}
    </div>
  );
}

// ---------------- 회의 진행 ----------------

function MeetingTab({ v, act }) {
  const m = v.meeting;
  const [topic, setTopic] = useState(m?.topic || (IS_DEMO ? DEMO_INFO.topic : ''));
  const idx = m ? STAGES.indexOf(m.stage) : -1;
  const go = (stage) => act({ type: 'stage', stage });
  const announce = async (e) => {
    e.preventDefault();
    if (m && m.opinions.length && !window.confirm('새 주제를 공지하면 지금 회의는 기록으로 넘어가요. 공지할까요?')) return;
    await act({ type: 'topic', topic }, '학생 화면에 주제를 공지했어요.');
  };
  const nextLabel = { notice: '아고라 광장 열기', agora: '의견 받기 마치고 채택하기', adopt: '아크로폴리스로 올라가기', vote: '투표 마감하고 신탁 받기' };

  return (
    <div className="grid-2">
      <div className="col">
        <form className="card" onSubmit={announce}>
          <h2 className="h2">회의 주제 공지</h2>
          <div className="row">
            <input className="grow" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={LIMITS.topic} placeholder="예: 체육대회 반 티셔츠 색은?" />
            <button className="btn btn-primary" disabled={topic.trim().length < 2}>
              {m ? '새 주제로 공지' : '공지하기'}
            </button>
          </div>
          <p className="muted small">언제든 바꿀 수 있어요. 바꾸면 학생 화면에 바로 새 주제가 뜹니다.</p>
        </form>

        {m && (
          <div className="card">
            <div className="row between">
              <h2 className="h2">지금 단계: {STAGE_NAMES[m.stage]}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => window.confirm('회의를 마치고 기록으로 넘길까요?') && act({ type: 'endMeeting' }, '회의를 기록에 저장했어요.')}
              >
                회의 마치기
              </button>
            </div>
            <Stepper stage={m.stage} onPick={(s) => window.confirm(`"${STAGE_NAMES[s]}" 단계로 바꿀까요?`) && go(s)} />
            <div className="row between">
              <button type="button" className="btn btn-ghost" disabled={idx <= 0} onClick={() => go(STAGES[idx - 1])}>
                ← 이전 단계
              </button>
              {m.stage !== 'oracle' && (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => go(STAGES[idx + 1])}>
                  {nextLabel[m.stage]} →
                </button>
              )}
            </div>
          </div>
        )}

        {m && (m.stage === 'notice' || m.stage === 'agora' || m.stage === 'adopt') && <OpinionsPanel m={m} act={act} />}
        {m?.stage === 'vote' && <VotePanel m={m} total={v.roster.length} />}
        {m?.stage === 'oracle' && (
          <div className="card oracle-card">
            <Oracle topic={m.topic} result={m.result} voice />
            {m.result?.tie && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => act({ type: 'revote' }, '동점인 의견으로 다시 투표를 열었어요.')}>
                동점 의견으로 다시 투표하기
              </button>
            )}
          </div>
        )}
      </div>
      <aside className="col">
        <Participation v={v} />
      </aside>
    </div>
  );
}

function OpinionsPanel({ m, act }) {
  const [sort, setSort] = useState('new');
  const [mine, setMine] = useState('');
  const adopted = m.opinions.filter((o) => o.adopted).length;
  const list = m.opinions.slice().sort((a, b) => (sort === 'olive' ? b.olives - a.olives || b.at - a.at : sort === 'star' ? b.starred - a.starred || b.at - a.at : b.at - a.at));
  return (
    <div className="card">
      <div className="row between wrap">
        <h2 className="h2">
          아고라 의견 <span className="count">{m.opinions.length}</span>
          <span className="count gold">채택 {adopted}/{LIMITS.adoptMax}</span>
        </h2>
        <div className="row">
          {m.stage === 'agora' && (
            <button type="button" className={`btn btn-sm ${m.opinionsOpen ? 'btn-ghost' : 'btn-primary'}`} onClick={() => act({ type: 'opinionsOpen', open: !m.opinionsOpen })}>
              {m.opinionsOpen ? '의견 받기 닫기' : '의견 받기 열기'}
            </button>
          )}
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">최신순</option>
            <option value="olive">올리브순</option>
            <option value="star">별표 먼저</option>
          </select>
        </div>
      </div>
      {m.stage === 'notice' && <p className="muted">아고라를 열면 학생 의견이 여기에 실시간으로 쌓여요.</p>}
      <ul className="t-opinions">
        {list.map((o) => (
          <li key={o.id} className={`${o.hidden ? 'is-hidden' : ''} ${o.adopted ? 'is-adopted' : ''}`}>
            <Avatar id={o.avatar} size={36} />
            <div className="op-body">
              <p className="op-text">{o.text}</p>
              <p className="op-meta">
                <span>{o.no ? `${o.no}번 ${o.name}` : '선생님'}</span>
                <span>🫒 {o.olives}</span>
                {o.hidden && <span className="tag tag-warn">숨김</span>}
              </p>
            </div>
            <div className="op-tools">
              <button type="button" title="별표" className={`icon ${o.starred ? 'on' : ''}`} onClick={() => act({ type: 'opinion', id: o.id, patch: { starred: !o.starred } })}>
                {o.starred ? '★' : '☆'}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${o.adopted ? 'btn-gold' : 'btn-ghost'}`}
                disabled={o.hidden}
                onClick={() => act({ type: 'opinion', id: o.id, patch: { adopted: !o.adopted } })}
              >
                {o.adopted ? '🌿 채택됨' : '채택'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const t = window.prompt('의견 문구 다듬기 (투표에 이 문구로 나가요)', o.text);
                  if (t && t.trim() !== o.text) act({ type: 'opinion', id: o.id, patch: { text: t } });
                }}
              >
                다듬기
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => act({ type: 'opinion', id: o.id, patch: { hidden: !o.hidden } })}>
                {o.hidden ? '보이기' : '숨기기'}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act({ type: 'teacherPost', text: mine })) setMine('');
        }}
      >
        <input className="grow" value={mine} onChange={(e) => setMine(e.target.value)} placeholder="선생님 의견 추가 (학생들에게 '선생님'으로 보여요)" maxLength={LIMITS.opinion} />
        <button className="btn btn-ghost" disabled={mine.trim().length < 2}>
          추가
        </button>
      </form>
    </div>
  );
}

function VotePanel({ m, total }) {
  const pct = total ? Math.round((m.turnout / total) * 100) : 0;
  return (
    <div className="card">
      <h2 className="h2">아크로폴리스 투표{m.round > 1 ? ` (${m.round}차)` : ''}</h2>
      <div className="turnout">
        <div className="turnout-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <b>
          {m.turnout} / {total}명 투표 ({pct}%)
        </b>
      </div>
      <p className="muted small">득표는 신탁 전까지 선생님에게도 보이지 않아요. 다 투표하면 "투표 마감하고 신탁 받기"를 누르세요.</p>
      <ol className="cands">
        {m.candidates.map((id, i) => (
          <li key={id}>
            <b>{String.fromCharCode(0x391 + i)}</b> {m.opinions.find((o) => o.id === id)?.text}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Participation({ v }) {
  const m = v.meeting;
  const voting = m?.stage === 'vote';
  const online = v.roster.filter((s) => s.online).length;
  return (
    <div className="card">
      <h2 className="h2">
        시민 참여 <span className="count">접속 {online}/{v.roster.length}</span>
      </h2>
      {!v.roster.length && <p className="muted">명단 탭에서 학생 명단을 먼저 넣어 주세요.</p>}
      <ul className="people">
        {v.roster.map((s) => {
          const done = voting ? s.voted : s.posts > 0;
          return (
            <li key={s.no} className={`${s.online ? 'online' : ''} ${done ? 'done' : ''}`} title={`${s.no}번 ${s.name}`}>
              <Avatar id={s.avatar} size={40} />
              <span className="pname">
                {s.no} {s.name}
              </span>
              <span className="pstate">{voting ? (s.voted ? '🏺' : '…') : s.posts ? `✎${s.posts}` : ''}</span>
            </li>
          );
        })}
      </ul>
      <p className="muted small">초록 테두리: 지금 접속 중 · {voting ? '🏺 투표함' : '✎ 의견 수'} · 흐린 칸: 아직 {voting ? '투표 안 함' : '의견 없음'}</p>
    </div>
  );
}

// ---------------- TV 화면 ----------------

function TvView({ v, onClose }) {
  const m = v.meeting;
  const stage = m?.stage || 'login';
  return (
    <div className="page tv">
      <Backdrop stage={stage} />
      <button type="button" className="btn btn-ghost btn-sm tv-close" onClick={onClose}>
        ✕ 닫기
      </button>
      {(!m || m.stage === 'notice' || m.stage === 'agora') && (
        <div className="tv-qr">
          <Qr size={120} code={v.code} big />
        </div>
      )}
      <main className="tv-main">
        {!m && <h1 className="tv-title">회의 주제를 기다리는 중</h1>}
        {m && m.stage !== 'oracle' && (
          <div className="scroll tv-scroll">
            <span className="scroll-label">{STAGE_NAMES[m.stage]}</span>
            <h1 className="scroll-text">{m.topic}</h1>
          </div>
        )}
        {m && (m.stage === 'agora' || m.stage === 'adopt') && (
          <div className="tv-wall">
            {m.opinions
              .filter((o) => !o.hidden && (m.stage === 'agora' || o.adopted))
              .sort((a, b) => b.olives - a.olives)
              .map((o) => (
                <div key={o.id} className={`tv-note ${o.adopted ? 'adopted' : ''}`}>
                  <Avatar id={o.avatar} size={48} />
                  <p>{o.text}</p>
                  <span>🫒 {o.olives}</span>
                </div>
              ))}
          </div>
        )}
        {m?.stage === 'notice' && <p className="tv-sub">생각을 정리하세요. 곧 아고라 광장이 열립니다.</p>}
        {m?.stage === 'vote' && (
          <div className="tv-vote">
            {m.candidates.map((id, i) => (
              <div key={id} className="tv-cand">
                <b>{String.fromCharCode(0x391 + i)}</b>
                <p>{m.opinions.find((o) => o.id === id)?.text}</p>
              </div>
            ))}
            <p className="tv-sub">
              🏺 {m.turnout} / {v.roster.length}명이 도편을 넣었습니다
            </p>
          </div>
        )}
        {m?.stage === 'oracle' && <Oracle topic={m.topic} result={m.result} voice big autoSpeak />}
      </main>
    </div>
  );
}

// ---------------- 명단 ----------------

function RosterTab({ v, act }) {
  const [text, setText] = useState('');
  return (
    <div className="grid-2 roster-grid">
      <div className="card">
        <h2 className="h2">명단 넣기</h2>
        <p className="muted small">엑셀이나 나이스에서 번호와 이름 두 칸을 복사해 붙여넣으세요. 한 줄에 한 명, "1 김하늘" 모양이면 됩니다.</p>
        <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1 김하늘\n2 이도윤\n3 박서연'} />
        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!text.trim()}
            onClick={async () => {
              if (v.roster.length && !window.confirm('지금 명단을 이 내용으로 바꿀까요? 같은 번호·이름인 학생은 아바타가 그대로 남아요.')) return;
              if (await act({ type: 'roster', text, mode: 'replace' }, '명단을 바꿨어요.')) setText('');
            }}
          >
            이 명단으로 바꾸기
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!text.trim()}
            onClick={async () => {
              if (await act({ type: 'roster', text, mode: 'add' }, '명단에 더했어요.')) setText('');
            }}
          >
            지금 명단에 더하기 (전입생)
          </button>
        </div>
      </div>
      <div className="card">
        <h2 className="h2">
          시민 명부 <span className="count">{v.roster.length}명</span>
        </h2>
        <table className="table">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>로그인</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {v.roster.map((s) => (
              <tr key={s.no}>
                <td>{s.no}</td>
                <td>
                  <span className="row tight">
                    <Avatar id={s.avatar} size={28} /> {s.name}
                  </span>
                </td>
                <td>{s.loggedIn ? (s.online ? '접속 중' : '로그인됨') : '—'}</td>
                <td className="row tight wrap">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!s.loggedIn}
                    title="다른 기기에서 다시 들어오게 해 줍니다"
                    onClick={() => act({ type: 'resetLogin', no: s.no }, `${s.name} 로그인을 초기화했어요.`)}
                  >
                    로그인 초기화
                  </button>
                  <button type="button" className={`btn btn-sm ${s.muted ? 'btn-gold' : 'btn-ghost'}`} onClick={() => act({ type: 'mute', no: s.no, muted: !s.muted })}>
                    {s.muted ? '글쓰기 풀기' : '글쓰기 멈춤'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => window.confirm(`${s.no}번 ${s.name}을(를) 명단에서 뺄까요?`) && act({ type: 'removeStudent', no: s.no })}
                  >
                    빼기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------- 기록 ----------------

function csvCell(s) {
  const t = String(s ?? '');
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function downloadCsv(list) {
  const rows = [['날짜', '주제', '채택 의견', '득표', '판결']];
  for (const h of list) {
    const date = new Date(h.endedAt || h.startedAt).toLocaleDateString('ko-KR');
    const res = h.result;
    if (res?.rows?.length) for (const r of res.rows) rows.push([date, h.topic, r.text, r.count, res.winners.includes(r.id) ? (res.tie ? '동점' : '채택') : '']);
    else rows.push([date, h.topic, '', '', '판결 없음']);
  }
  const blob = new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `학급회의록_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function HistoryTab({ pin, show }) {
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => api.history(pin).then(setList, (e) => show(e.message, 'error'));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!list) return <p className="muted">불러오는 중…</p>;
  return (
    <div className="card">
      <div className="row between">
        <h2 className="h2">
          지난 회의 <span className="count">{list.length}</span>
        </h2>
        <button type="button" className="btn btn-primary btn-sm" disabled={!list.length} onClick={() => downloadCsv(list)}>
          엑셀(CSV)로 내려받기
        </button>
      </div>
      {!list.length && <p className="muted">새 주제를 공지하거나 "회의 마치기"를 누르면 이전 회의가 여기에 저장돼요.</p>}
      <ul className="history">
        {list.map((h) => (
          <li key={h.hid}>
            <button type="button" className="history-head" onClick={() => setOpen(open === h.hid ? null : h.hid)}>
              <span className="muted small">{new Date(h.endedAt || h.startedAt).toLocaleString('ko-KR')}</span>
              <b>{h.topic}</b>
              <span className="muted small">{h.result ? (h.result.tie ? '동점' : h.result.winners.length ? '판결 있음' : '투표 없음') : '판결 전 종료'}</span>
            </button>
            {open === h.hid && (
              <div className="history-body">
                {h.result && <p className="verdict">{h.result.verdict}</p>}
                <ul>
                  {h.opinions.map((o) => (
                    <li key={o.id} className={o.hidden ? 'is-hidden' : ''}>
                      {o.adopted ? '🌿 ' : ''}
                      {o.text} <span className="muted small">(🫒 {o.olives}{o.no ? ` · ${o.no}번` : ' · 선생님'})</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    if (!window.confirm('이 기록을 지울까요?')) return;
                    await api.deleteHistory(pin, h.hid);
                    load();
                  }}
                >
                  이 기록 지우기
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------- 설정 ----------------

function SettingsTab({ v, act, pin, show, onLock }) {
  const [code, setCode] = useState(v.code);
  const [newPin, setNewPin] = useState('');
  return (
    <div className="grid-2">
      <div className="card">
        <h2 className="h2">학생 입장</h2>
        <label>
          입장 코드 (숫자 4자리)
          <div className="row">
            <input inputMode="numeric" maxLength={4} value={code} onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => act({ type: 'settings', code }, '입장 코드를 바꿨어요. 이미 들어온 학생은 그대로예요.')}>
              바꾸기
            </button>
          </div>
        </label>
        <label className="check">
          <input type="checkbox" checked={!!v.settings?.showNames} onChange={(e) => act({ type: 'settings', showNames: e.target.checked })} />
          아고라에서 학생끼리도 작성자 이름 보이기 (기본: 꺼짐, 아바타만)
        </label>
        <p className="muted small">
          학생 주소: <code>{location.origin + location.pathname}</code>
        </p>
      </div>
      <div className="card">
        <h2 className="h2">교사 PIN</h2>
        <div className="row">
          <input type="password" inputMode="numeric" placeholder="새 PIN (숫자 4~8자리)" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
          <button
            type="button"
            className="btn btn-primary"
            disabled={!/^\d{4,8}$/.test(newPin)}
            onClick={async () => {
              try {
                await api.changePin(pin, newPin);
                store.set(PIN, null);
                show('PIN을 바꿨어요. 새 PIN으로 다시 들어와 주세요.', 'ok');
                setTimeout(onLock, 1200);
              } catch (e) {
                show(e.message, 'error');
              }
            }}
          >
            바꾸기
          </button>
        </div>
        <h2 className="h2 danger-title">학년말 정리</h2>
        <p className="muted small">명단, 진행 중인 회의, 지난 기록을 모두 지웁니다. 학년·반과 입장 코드, PIN은 남아요. 되돌릴 수 없어요.</p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.prompt('모두 지우려면 "지우기"라고 써 주세요.') === '지우기') act({ type: 'wipe' }, '모두 지웠어요.');
          }}
        >
          학급방 비우기
        </button>
      </div>
    </div>
  );
}
