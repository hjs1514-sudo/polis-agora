import { useEffect, useState } from 'react';
import { speak } from '../ui.jsx';

/** 신탁 판결: 연기가 피어오르고 판결문이 한 글자씩 나타난다. voice가 true면 낭독 버튼을 보인다 */
export default function Oracle({ topic, result, voice = false, big = false, autoSpeak = false }) {
  const text = result?.verdict || '';
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
    if (!text) return undefined;
    let i = 0;
    const start = setTimeout(function step() {
      i += 1;
      setShown(i);
      if (i < text.length) timer = setTimeout(step, 70);
    }, 1800);
    let timer = start;
    if (autoSpeak) setTimeout(() => speak(text), 1800);
    return () => clearTimeout(timer);
  }, [text, autoSpeak]);
  if (!result) return null;
  const max = Math.max(1, ...result.rows.map((r) => r.count));
  const done = shown >= text.length;
  return (
    <section className={`oracle ${big ? 'oracle-big' : ''}`}>
      <div className="smoke" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <p className="oracle-topic">{topic}</p>
      <h2 className="oracle-title">신탁이 내려졌도다</h2>
      <p className="oracle-text" aria-live="polite">
        {text.slice(0, shown)}
        {!done && <span className="caret">▍</span>}
      </p>
      {done && (
        <div className="oracle-tally">
          {result.rows
            .slice()
            .sort((a, b) => b.count - a.count)
            .map((r) => (
              <div key={r.id} className={`tally-row ${result.winners.includes(r.id) ? 'win' : ''}`}>
                <span className="tally-label">{r.text}</span>
                <span className="tally-bar">
                  <span style={{ width: `${(r.count / max) * 100}%` }} />
                </span>
                <b>{r.count}표</b>
              </div>
            ))}
          <p className="tally-foot">
            투표한 시민 {result.voters}명 / 전체 {result.total}명{result.round > 1 ? ` · ${result.round}차 투표` : ''}
          </p>
        </div>
      )}
      {voice && (
        <button type="button" className="btn btn-gold" onClick={() => speak(text)}>
          🔊 신탁의 목소리 듣기
        </button>
      )}
    </section>
  );
}
