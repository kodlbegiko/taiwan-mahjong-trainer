import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../src/training/exercises.js';
import { createDecisionRecord } from '../src/training/records.js';
import {
  emptyArchive, migrateArchive, exportTrainingJSON, importTrainingJSON, mergeArchives,
  ARCHIVE_STORAGE_KEY, V2_ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY,
} from '../src/storage/archive.js';
import { createLocalTrainingStore } from '../src/storage/local.js';

const legacy = [{ grade: 'perfect', seconds: 2.5, difficulty: 'beginner', date: '2026-11-18T12:00:00Z' }];

test('保留 v1 會話資料而不捏造缺失的題目或捨牌', () => {
  const v2 = migrateArchive(legacy);
  assert.deepEqual(v2.legacySessions, legacy);
  assert.deepEqual(v2.records, []);
  assert.deepEqual(migrateArchive({ schemaVersion: 1, stats: legacy }), v2);
  assert.throws(() => migrateArchive({ schemaVersion: 4 }), /未知/);
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

test('v2 封存與評分原樣遷移至 v3，拒絕悄悄重新評分', () => {
  const exercise = createExercise({ seed: 'legacy-scoring', taskType: 'discard', schemaVersion: 2 });
  const record = createDecisionRecord(exercise, exercise.answer.ranking[0].tile, {
    timestamp: '2026-11-18T10:00:00Z', durationMs: 444, attemptId: 'legacy-id',
  });
  const oldRecord = { ...record, schemaVersion: 2 };
  const v2 = { ...emptyArchive(), schemaVersion: 2, exercises: [exercise], records: [oldRecord] };
  const originalJSON = JSON.stringify(v2);
  const migrated = importTrainingJSON(originalJSON);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.exercises[0], exercise);
  assert.deepEqual(migrated.records[0], oldRecord);
  assert.equal(migrated.records[0].scoringVersion, 'efficiency-v1');
  assert.equal(migrated.records[0].exerciseSnapshot.answerRules.version, 'efficiency-v1');
  const current = createExercise({ seed: 'legacy-scoring', taskType: 'discard' });
  assert.notEqual(current.id, exercise.id);
  assert.equal(current.answerRules.version, 'efficiency-v2');
  assert.deepEqual(importTrainingJSON(exportTrainingJSON(migrated)), migrated);
  assert.equal(JSON.stringify(v2), originalJSON);
});

test('v3 儲存保留原本 v1/v2 key，讀取舊版紀錄不修改評分結果', () => {
  const exercise = createExercise({ seed: 'local-preserve', taskType: 'discard', schemaVersion: 2 });
  const record = createDecisionRecord(exercise, exercise.answer.ranking[0].tile, {
    timestamp: '2026-11-18T13:00:00Z', durationMs: 100, attemptId: 'local-v2',
  });
  record.schemaVersion = 2;
  const oldV2 = { ...emptyArchive(), schemaVersion: 2, exercises: [exercise], records: [record], legacySessions: [] };
  const data = new Map([
    [LEGACY_SESSION_KEY, JSON.stringify(legacy)],
    [V2_ARCHIVE_STORAGE_KEY, JSON.stringify(oldV2)],
  ]);
  const before = new Map(data);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const store = createLocalTrainingStore(storage);
  const loaded = store.load();
  assert.equal(loaded.records[0].score, record.score);
  assert.equal(loaded.records[0].scoringVersion, 'efficiency-v1');
  assert.deepEqual(loaded.legacySessions, legacy);
  const newer = createExercise({ seed: 'local-preserve', taskType: 'discard' });
  store.addDecision(newer, newer.answer.optimalTiles[0], {
    timestamp: '2026-11-19T14:00:00Z', durationMs: 22, attemptId: 'new-v3',
  });
  assert.equal(store.load().records.length, 2);
  assert.equal(data.get(LEGACY_SESSION_KEY), before.get(LEGACY_SESSION_KEY));
  assert.equal(data.get(V2_ARCHIVE_STORAGE_KEY), before.get(V2_ARCHIVE_STORAGE_KEY));
  assert.ok(data.has(ARCHIVE_STORAGE_KEY));
});
