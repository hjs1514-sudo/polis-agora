import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, apply, checkLogin, studentView, teacherView, parseRoster } from '../src/core/engine.js';

const T = { role: 'teacher' };
const S = (no) => ({ role: 'student', no });
const run = (state, ...actions) => actions.reduce((s, [a, who]) => apply(s, a, who).state, state);

function room() {
  return run(
    emptyState(),
    [{ type: 'setup', grade: 2, klass: 3, code: '5678' }, T],
    [{ type: 'roster', text: '1 김하늘\n2번 이도윤\n3,박서연\n4\t최지호' }, T],
  );
}

test('명단 읽기', () => {
  assert.deepEqual(parseRoster('1 김 하늘\n\n2번, 이도윤\n잘못된 줄'), [
    { no: 1, name: '김하늘' },
    { no: 2, name: '이도윤' },
  ]);
});

test('명단과 입장 코드가 맞아야 로그인', () => {
  const s = room();
  assert.equal(checkLogin(s, { grade: 2, klass: 3, no: 1, name: '김하늘', code: '5678' }).no, 1);
  assert.throws(() => checkLogin(s, { grade: 2, klass: 3, no: 1, name: '김하나', code: '5678' }), /명단에 없는/);
  assert.throws(() => checkLogin(s, { grade: 2, klass: 4, no: 1, name: '김하늘', code: '5678' }), /전용/);
  assert.throws(() => checkLogin(s, { grade: 2, klass: 3, no: 1, name: '김하늘', code: '0000' }), /입장 코드/);
});

test('회의 한 번: 의견 → 채택 → 투표 → 신탁', () => {
  let s = run(room(), [{ type: 'topic', topic: '청소 당번' }, T], [{ type: 'stage', stage: 'agora' }, T]);
  s = run(s, [{ type: 'post', text: '번호 순서대로' }, S(1)], [{ type: 'post', text: '모둠별로' }, S(2)], [{ type: 'post', text: '가위바위보' }, S(3)]);
  assert.throws(() => apply(s, { type: 'post', text: '씨 발' }, S(4)), /어울리지 않는/);
  const [a, b] = s.meeting.opinions;
  s = run(s, [{ type: 'olive', id: a.id }, S(2)]);
  assert.throws(() => apply(s, { type: 'olive', id: a.id }, S(1)), /자기 의견/);
  // 학생끼리는 이름이 보이지 않는다
  const v2 = studentView(s, 2);
  assert.equal(v2.meeting.opinions.find((o) => o.id === a.id).name, '');
  assert.equal(v2.meeting.opinions.find((o) => o.id === b.id).name, '이도윤');
  assert.throws(() => apply(s, { type: 'stage', stage: 'vote' }, T), /2개 이상/);
  s = run(s, [{ type: 'opinion', id: a.id, patch: { adopted: true } }, T], [{ type: 'opinion', id: b.id, patch: { adopted: true } }, T], [{ type: 'stage', stage: 'vote' }, T]);
  s = run(s, [{ type: 'vote', id: a.id }, S(1)], [{ type: 'vote', id: b.id }, S(2)], [{ type: 'vote', id: a.id }, S(3)], [{ type: 'vote', id: b.id }, S(3)]);
  // 투표 중에는 득표가 보이지 않는다
  assert.equal(studentView(s, 1).meeting.result, null);
  assert.equal(teacherView(s).meeting.tally, null);
  assert.equal(teacherView(s).meeting.turnout, 3);
  s = run(s, [{ type: 'stage', stage: 'oracle' }, T]);
  // 3번이 마음을 바꿔 b에 2표, a에 1표
  assert.deepEqual(s.meeting.result.winners, [b.id]);
  assert.match(s.meeting.result.verdict, /모둠별로/);
});

test('동점이면 동점 의견만으로 다시 투표', () => {
  let s = run(room(), [{ type: 'topic', topic: '동점 시험' }, T], [{ type: 'stage', stage: 'agora' }, T]);
  s = run(s, [{ type: 'post', text: '가가' }, S(1)], [{ type: 'post', text: '나나' }, S(2)], [{ type: 'post', text: '다다' }, S(3)]);
  const ids = s.meeting.opinions.map((o) => o.id);
  for (const id of ids) s = run(s, [{ type: 'opinion', id, patch: { adopted: true } }, T]);
  s = run(s, [{ type: 'stage', stage: 'vote' }, T], [{ type: 'vote', id: ids[0] }, S(1)], [{ type: 'vote', id: ids[1] }, S(2)], [{ type: 'stage', stage: 'oracle' }, T]);
  assert.equal(s.meeting.result.tie, true);
  s = run(s, [{ type: 'revote' }, T]);
  assert.deepEqual(s.meeting.candidates, [ids[0], ids[1]]);
  assert.equal(s.meeting.round, 2);
  assert.equal(studentView(s, 1).meeting.myVote, null);
});

test('새 주제를 공지하면 이전 회의는 기록으로', () => {
  let s = run(room(), [{ type: 'topic', topic: '첫 주제' }, T], [{ type: 'stage', stage: 'agora' }, T], [{ type: 'post', text: '의견입니다' }, S(1)]);
  const r = apply(s, { type: 'topic', topic: '둘째 주제' }, T);
  assert.equal(r.out.archived.topic, '첫 주제');
  assert.equal(r.state.meeting.topic, '둘째 주제');
  assert.equal(r.state.meeting.stage, 'notice');
});
