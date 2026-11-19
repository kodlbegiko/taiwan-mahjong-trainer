import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../../src/training/exercises.js';
import { createLocalTrainingStore } from '../../src/storage/local.js';
import {
  ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, importTrainingJSON,
  exportTrainingJSON, validateArchive, mergeArchives,
} from '../../src/storage/archive.js';

const legacyBytes = '[{"grade":"perfect","seconds":1.2,"difficulty":"beginner","date":"2026-01-01T00:00:00.000Z"}]';
const makeStorage = () => {
  const raw = new Map([[LEGACY_SESSION_KEY, legacyBytes]]);
  return {
    raw,
    storage: {
      getItem(key) { return raw.get(key) ?? null; },
      setItem(key, val) { raw.set(key, String(val)); },
    },
  };
};
const opts = { timestamp: '2026-11-19T03:00:00.000Z', durationMs: 1000 };

test('UI persistence gate: multiple v3 records, restart, v1 byte preservation, JSON roundtrip', () => {
  const { raw, storage } = makeStorage();
  const store = createLocalTrainingStore(storage);
  const exercise = createExercise({ seed: 'release-gate-v3', taskType: 'discard', level: 'beginner' });
  const first = store.addDecision(exercise, exercise.answer.optimalTiles[0], { ...opts, attemptId: 'release-1' });
  const second = store.addDecision(exercise, exercise.answer.ranking.at(-1).tile, {
    ...opts, durationMs: 2000, attemptId: 'release-2',
  });
  assert.notEqual(first.id, second.id);
  const before = store.load();
  assert.equal(before.schemaVersion, 3);
  assert.equal(before.exercises.length, 1);
  assert.equal(before.records.length, 2);
  assert.deepEqual(before.records.map(x => x.exerciseSnapshot), [exercise, exercise]);
  assert.equal(raw.get(LEGACY_SESSION_KEY), legacyBytes);
  const exported = store.exportJSON();
  const imported = importTrainingJSON(exported);
  assert.deepEqual(imported, before);
  assert.equal(validateArchive(imported), true);
  assert.deepEqual(createLocalTrainingStore(storage).load(), before);
  assert.deepEqual(importTrainingJSON(exportTrainingJSON(imported)), imported);
  assert.equal(raw.get(LEGACY_SESSION_KEY), legacyBytes);
  assert.ok(raw.has(ARCHIVE_STORAGE_KEY));
});

test('UI persistence gate: duplicate attempt/exercise, tampered score, unsupported schema rejected', () => {
  const { storage } = makeStorage();
  const store = createLocalTrainingStore(storage);
  const exercise = createExercise({ seed: 'release-duplicate-gate', taskType: 'multi_wait' });
  const choice = [...exercise.answer.expectedTiles];
  store.addDecision(exercise, choice, { ...opts, attemptId: 'duplicate-id' });
  assert.throws(() => store.addDecision(exercise, choice, { ...opts, attemptId: 'duplicate-id' }), /ID|重複/);
  const intact = store.load();
  const duplicateRecord = structuredClone(intact);
  duplicateRecord.records.push(structuredClone(duplicateRecord.records[0]));
  assert.throws(() => validateArchive(duplicateRecord), /重複/);
  const duplicateExercise = structuredClone(intact);
  duplicateExercise.exercises.push(structuredClone(duplicateExercise.exercises[0]));
  assert.throws(() => validateArchive(duplicateExercise), /重複/);
  const editedGrade = structuredClone(intact);
  editedGrade.records[0].score = 0.13;
  assert.throws(() => importTrainingJSON(JSON.stringify(editedGrade)), /不一致|評分/);
  const future = structuredClone(intact);
  future.schemaVersion = 9999;
  assert.throws(() => importTrainingJSON(JSON.stringify(future)), /schemaVersion|未知|不支援/);
  assert.throws(() => importTrainingJSON('{corrupt'), SyntaxError);
  assert.deepEqual(store.load(), intact, 'failed imports must not mutate persisted archive');
  assert.throws(() => mergeArchives(intact, duplicateRecord), /重複/);
});

test('UI persistence gate: quota denial remains in-memory and never overwrites corrupted storage', () => {
  const raw = new Map([[ARCHIVE_STORAGE_KEY, '{invalid'], [LEGACY_SESSION_KEY, legacyBytes]]);
  const storage = {
    getItem: key => raw.get(key) ?? null,
    setItem() { throw new Error('QuotaExceededError'); },
  };
  const store = createLocalTrainingStore(storage);
  const exercise = createExercise({ seed: 'release-quota-gate', taskType: 'tenpai' });
  store.addDecision(exercise, exercise.answer.expectedTiles, { ...opts, attemptId: 'quota-1' });
  assert.equal(store.load().records.length, 1);
  assert.equal(raw.get(ARCHIVE_STORAGE_KEY), '{invalid');
  assert.equal(raw.get(LEGACY_SESSION_KEY), legacyBytes);
});
