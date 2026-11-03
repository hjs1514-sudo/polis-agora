import { useEffect, useState } from 'react';
import { api, IS_DEMO } from './api/index.js';
import StudentApp from './screens/StudentApp.jsx';
import TeacherApp from './screens/TeacherApp.jsx';

const route = () => (location.hash.startsWith('#/teacher') ? 'teacher' : 'student');

export default function App() {
  const [r, setR] = useState(route);
  const [key, setKey] = useState(0);
  useEffect(() => {
    const on = () => setR(route());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <>
      {IS_DEMO && (
        <div className="demo-bar">
          <b>체험판</b>
          <span className="demo-info">이 브라우저에만 저장돼요 · 교사 PIN 0000 · 입장 코드 1234 · 학생은 12번 오시우</span>
          <span className="demo-switch">
            <a href="#/teacher" className={r === 'teacher' ? 'on' : ''}>
              교사 보기
            </a>
            <a href="#/" className={r === 'student' ? 'on' : ''}>
              학생 보기
            </a>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('체험 내용을 모두 지우고 처음부터 다시 할까요?')) return;
                api.reset();
                try {
                  localStorage.removeItem('polis-demo-student');
                } catch {
                  /* 없음 */
                }
                setKey((k) => k + 1);
              }}
            >
              처음부터 다시
            </button>
          </span>
        </div>
      )}
      <div key={`${r}-${key}`} className={IS_DEMO ? 'with-demo-bar' : ''}>
        {r === 'teacher' ? <TeacherApp /> : <StudentApp />}
      </div>
    </>
  );
}
