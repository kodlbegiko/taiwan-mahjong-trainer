import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise, EXERCISE_SCHEMA_VERSION, SCORING_VERSION } from '../src/training/exercises.js';
import { createDecisionRecord, RECORD_SCHEMA_VERSION, validateDecisionRecord } from '../src/training/records.js';
import { rankDiscards, gradeAnswer } from '../src/practice.js';
import { explainDiscard } from '../src/analysis/explain.js';
import { createLocalTrainingStore } from '../src/storage/local.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../src/storage/archive.js';

const exercise = (mode, seed) => createExercise({ seed, index: 0, level: 'beginner', taskType: mode });
function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: key => m.get(key) ?? null, setItem: (key, value) => m.set(key, value), raw: m };
}

test('V0.2 discard: same canonical values, tie grades, explanation and record', () => {
  const item = exercise('discard', 'front-ui-golden-discard');
  assert.equal(item.schemaVersion, EXERCISE_SCHEMA_VERSION);
  assert.equal(item.answerRules.version, SCORING_VERSION);
  assert.deepEqual(item.answer.ranking, rankDiscards(item.hand, item.visibleTiles));
  for (const option of item.answer.ranking) {
    const grade = gradeAnswer(item.answer.ranking, option.tile);
    const explained = explainDiscard(item.hand, option.tile, { visibleTiles: item.visibleTiles });
    assert.equal(explained.decision.trainingGrade, grade.grade);
    assert.equal(explained.selected.metrics.shanten, option.shanten);
    assert.equal(explained.selected.metrics.copies, option.copies);
    assert.equal(explained.selected.metrics.kinds, option.kinds);
    assert.deepEqual(explained.selected.metrics.draws.map(({ tile, count }) => ({ tile, count })), option.draws);
  }
  const bestOptions = item.answer.ranking.filter(x => gradeAnswer(item.answer.ranking, x.tile).grade === 'perfect').map(x => x.tile).sort((a,b)=>a-b);
  assert.deepEqual(bestOptions, item.answer.optimalTiles);
  const record = createDecisionRecord(item, bestOptions[0], { durationMs: 1300, timestamp: '2026-11-19T05:00:00.000Z', attemptId: 'ui-1' });
  assert.equal(record.grade, 'perfect');
  assert.equal(record.schemaVersion, RECORD_SCHEMA_VERSION);
  assert.equal(validateDecisionRecord(record), true);
});

test('V0.2 waits: tenpai & multi_wait use exact canonical answer set and v3 records', () => {
  for (const mode of ['tenpai', 'multi_wait']) {
    const item = exercise(mode, `front-ui-golden-${mode}`);
    assert.equal(item.hand.length, 16);
    assert.ok(item.answer.expectedTiles.length >= (mode === 'multi_wait' ? 2 : 1));
    const record = createDecisionRecord(item, item.answer.expectedTiles, { durationMs: 2500, timestamp: '2026-11-19T05:00:00.000Z', attemptId: `ui-${mode}` });
    assert.equal(record.grade, 'perfect');
    assert.equal(record.score, 1);
    assert.equal(validateDecisionRecord(record), true);
    const wrong = createDecisionRecord(item, [], { durationMs: 2400, timestamp: '2026-11-19T05:00:00.000Z', attemptId: `bad-${mode}` });
    assert.equal(wrong.grade, 'improve');
    assert.deepEqual(wrong.answerMetadata.missedTiles, item.answer.expectedTiles);
  }
});

test('v3 storage preserves old v1 bytes, keeps immutable snapshots after reload, rejects malformed content', () => {
  const old = JSON.stringify([{ grade: 'perfect', seconds: 4.2, date: '2026-11-01T00:00:00.000Z', difficulty: 'beginner' }]);
  const storage = memoryStorage({ [LEGACY_SESSION_KEY]: old });
  const item = exercise('discard', 'front-ui-persistent-discard');
  const store = createLocalTrainingStore(storage);
  store.addDecision(item, item.answer.optimalTiles[0], { durationMs: 800, timestamp: '2026-11-19T05:00:00.000Z', attemptId: 'ui-persist-1' });
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), old);
  const restored = createLocalTrainingStore(storage).load();
  assert.equal(restored.schemaVersion, 3);
  assert.equal(restored.records.length, 1);
  assert.equal(restored.legacySessions.length, 1);
  assert.deepEqual(restored.records[0].exerciseSnapshot, item);
  assert.equal(JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY)).records.length, 1);
  const corrupt = memoryStorage({ [ARCHIVE_STORAGE_KEY]: '{invalid' });
  const safe = createLocalTrainingStore(corrupt);
  assert.equal(safe.load().records.length, 0);
  assert.equal(corrupt.getItem(ARCHIVE_STORAGE_KEY), '{invalid');
});
