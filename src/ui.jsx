import { useEffect, useRef, useState } from 'react';
import { AVATARS, STAGES, STAGE_NAMES } from './core/engine.js';

export const BG = { login: 'img/bg/gate.jpg', notice: 'img/bg/gate.jpg', agora: 'img/bg/agora.jpg', adopt: 'img/bg/agora.jpg', vote: 'img/bg/acropolis.jpg', oracle: 'img/bg/oracle.jpg' };

export function Backdrop({ stage }) {
  const src = BG[stage] || BG.login;
  return (
    <div className={`backdrop ${stage === 'oracle' ? 'dark' : ''}`} aria-hidden="true">
      <div className="backdrop-img" style={{ backgroundImage: `url(${src})` }} />
      <div className="backdrop-veil" />
    </div>
  );
}

export function Avatar({ id, size = 48, title }) {
  if (id === 'teacher')
    return (
      <span className="avatar avatar-teacher" style={{ width: size, height: size, fontSize: size * 0.42 }} title={title || '선생님'}>
        師
      </span>
    );
  const a = AVATARS.find((x) => x.id === id);
  if (!a)
    return (
      <span className="avatar avatar-empty" style={{ width: size, height: size }} title={title || '아바타 없음'}>
        ?
      </span>
    );
  return <img className="avatar" src={`img/avatars/${a.id}.png`} alt={title || a.name} title={title || a.name} width={size} height={size} />;
}

export function Stepper({ stage, onPick }) {
  const idx = STAGES.indexOf(stage);
  return (
    <ol className="stepper">
      {STAGES.map((s, i) => (
        <li key={s} className={i < idx ? 'done' : i === idx ? 'now' : ''}>
          {onPick ? (
            <button type="button" onClick={() => onPick(s)}>
              <b>{i + 1}</b> {STAGE_NAMES[s]}
            </button>
          ) : (
            <span>
              <b>{i + 1}</b> {STAGE_NAMES[s]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** ms마다 fn을 부르고 결과를 돌려준다. 화면이 숨겨지면 쉬었다가 돌아오면 바로 부른다 */
export function usePoll(fn, ms, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const tickRef = useRef(() => {});
  useEffect(() => {
    let alive = true;
    let timer;
    const tick = async () => {
      clearTimeout(timer);
      try {
        const d = await fnRef.current();
        if (alive) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e);
      }
      if (alive) timer = setTimeout(tick, document.hidden ? ms * 4 : ms);
    };
    tickRef.current = tick;
    tick();
    const onVis = () => !document.hidden && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, setData, refresh: () => tickRef.current() };
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef();
  const show = (text, kind = 'info') => {
    clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = setTimeout(() => setMsg(null), 3200);
  };
  const node = msg ? (
    <div className={`toast toast-${msg.kind}`} role="status">
      {msg.text}
    </div>
  ) : null;
  return [node, show];
}

export const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      if (v === null || v === undefined) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* 저장 못 해도 이 화면은 계속 */
    }
  },
};

/** 신탁 목소리: 브라우저 음성 읽기(한국어). 없으면 조용히 넘어간다 */
export function speak(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR';
    u.rate = 0.82;
    u.pitch = 0.55;
    const ko = synth.getVoices().find((v) => v.lang?.startsWith('ko'));
    if (ko) u.voice = ko;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}
