import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../src/training/exercises.js';
import { createDecisionRecord, validateDecisionRecord } from '../src/training/records.js';
import { advanceReview, buildReviewQueue, summarizeWeaknesses } from '../src/training/progress.js';

const timestamp = '2026-11-19T00:00:00+08:00';
const options = { timestamp, durationMs: 1200 };

test('保存單題快照、作答與耗時；最佳捨牌給滿分', () => {
  const exercise = createExercise({ seed: 'records', taskType: 'discard', level: 'intermediate' });
  const selected = exercise.answer.optimalTiles[0];
  const record = createDecisionRecord(exercise, selected, options);
  assert.equal(record.grade, 'perfect');
  assert.equal(record.score, 1);
  assert.equal(record.durationMs, 1200);
  assert.equal(record.exerciseId, exercise.id);
  assert.deepEqual(record.exerciseSnapshot, exercise);
  assert.ok(validateDecisionRecord(record));
  const other = exercise.answer.ranking.find(x => !exercise.answer.optimalTiles.includes(x.tile));
  if (other) {
    const error = createDecisionRecord(exercise, other.tile, { ...options, attemptId: 'other-attempt' });
    assert.ok(error.errorTypes.length > 0);
    assert.ok(error.score < 1);
    assert.ok(validateDecisionRecord(error));
  }
  assert.throws(() => createDecisionRecord(exercise, selected, { durationMs: -1, timestamp }), /duration/);
});

test('聽張少選或多選時分類不同錯誤', () => {
  const exercise = createExercise({ seed: 'wait-records', taskType: 'multi_wait' });
  const expected = exercise.answer.expectedTiles;
  const perfect = createDecisionRecord(exercise, expected, options);
  assert.equal(perfect.grade, 'perfect');
  const missed = createDecisionRecord(exercise, expected.slice(0, -1), options);
  assert.ok(missed.errorTypes.includes('missed-winning-tile'));
  const extraTile = Array.from({ length: 34 }, (_, i) => i).find(x => !expected.includes(x));
  const extra = createDecisionRecord(exercise, [...expected, extraTile], options);
  assert.ok(extra.errorTypes.includes('false-winning-tile'));
  assert.ok(validateDecisionRecord(missed));
  assert.ok(validateDecisionRecord(extra));
});

test('錯誤率、耗時與間隔複習狀態由純資料重建', () => {
  const exercise = createExercise({ seed: 'review', taskType: 'multi_wait' });
  const full = createDecisionRecord(exercise, exercise.answer.expectedTiles, { ...options, attemptId: 'a' });
  const missed = createDecisionRecord(exercise, [], { timestamp: '2026-11-20T00:00:00+08:00', durationMs: 1800, attemptId: 'b' });
  const summary = summarizeWeaknesses([full, missed]);
  assert.equal(summary.attempts, 2);
  assert.equal(summary.byError['missed-winning-tile'], 1);
  assert.equal(summary.meanDurationMs, 1500);
  const due = buildReviewQueue([missed, full], { asOf: '2026-11-21T00:00:00+08:00' });
  assert.equal(due.length, 1);
  assert.equal(due[0].lapses, 1);
  assert.equal(due[0].repetitions, 0);
  assert.deepEqual(due, buildReviewQueue([full, missed], { asOf: '2026-11-21T00:00:00+08:00' }));
  assert.equal(buildReviewQueue([full, missed], { asOf: timestamp }).length, 0);
  assert.equal(advanceReview(null, full).intervalDays, 1);
});
