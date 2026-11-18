import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../src/training/exercises.js';
import { createDecisionRecord } from '../src/training/records.js';
import {
  emptyArchive, migrateArchive, exportTrainingJSON, importTrainingJSON, mergeArchives,
  ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY,
} from '../src/storage/archive.js';
import { createLocalTrainingStore } from '../src/storage/local.js';

const legacy = [{ grade: 'perfect', seconds: 2.5, difficulty: 'beginner', date: '2026-11-18T12:00:00Z' }];

test('保留 v1 會話資料而不捏造缺失的題目或捨牌', () => {
  const v2 = migrateArchive(legacy);
  assert.deepEqual(v2.legacySessions, legacy);
  assert.deepEqual(v2.records, []);
  assert.deepEqual(migrateArchive({ schemaVersion: 1, stats: legacy }), v2);
  assert.throws(() => migrateArchive({ schemaVersion: 3 }), /未知/);
});

test('JSON 封存可完整往返；拒絕竄改、未來版本與重複 ID', () => {
  const exercise = createExercise({ seed: 'storage', taskType: 'discard' });
  const record = createDecisionRecord(exercise, exercise.answer.optimalTiles[0], { timestamp: '2026-11-19T00:00:00Z', durationMs: 77 });
  const archive = { ...emptyArchive(), exercises: [exercise], records: [record] };
  assert.deepEqual(importTrainingJSON(exportTrainingJSON(archive)), archive);
  assert.throws(() => importTrainingJSON('{'), SyntaxError);
  const bad = structuredClone(archive);
  bad.records[0].score = -1;
  assert.throws(() => importTrainingJSON(JSON.stringify(bad)), /評分/);
  const conflict = structuredClone(archive);
  conflict.exercises[0].hand[0] = 33;
  assert.throws(() => mergeArchives(archive, conflict));
  const merged = mergeArchives(archive, archive);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.exercises.length, 1);
});

test('localStorage v1 自動讀取、v2 存取與無儲存權限的記憶體回退', () => {
  const data = new Map([[LEGACY_SESSION_KEY, JSON.stringify(legacy)]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createLocalTrainingStore(storage);
  assert.equal(store.load().legacySessions.length, 1);
  const exercise = createExercise({ seed: 'browser', taskType: 'tenpai' });
  const record = store.addDecision(exercise, exercise.answer.expectedTiles, { timestamp: '2026-11-19T01:00:00Z', durationMs: 900 });
  assert.equal(record.grade, 'perfect');
  assert.ok(data.has(ARCHIVE_STORAGE_KEY));
  assert.equal(createLocalTrainingStore(storage).load().records.length, 1);
  const disabled = { getItem() { throw Error('SecurityError'); }, setItem() { throw Error('QuotaExceededError'); } };
  const offline = createLocalTrainingStore(disabled);
  offline.addDecision(exercise, exercise.answer.expectedTiles, { timestamp: '2026-11-19T01:00:00Z', durationMs: 900 });
  assert.equal(offline.load().records.length, 1);
  assert.deepEqual(offline.importJSON(offline.exportJSON()).exercises[0], exercise);
});
