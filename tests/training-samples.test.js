import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTrainingJSON } from '../src/storage/archive.js';
import { createExercise, replayExercise } from '../src/training/exercises.js';

test('v2 原始範例及 v3 修正範例可匯入、重建，且內容完整一致', () => {
  for (const version of [2, 3]) {
    const archive = importTrainingJSON(readFileSync(new URL(`../data/exercises/samples-v${version}.json`, import.meta.url), 'utf8'));
    assert.equal(archive.schemaVersion, 3);
    assert.equal(archive.exercises.length, 3);
    for (const exercise of archive.exercises) {
      assert.equal(exercise.schemaVersion, version);
      assert.deepEqual(exercise, replayExercise(exercise));
      assert.deepEqual(exercise, createExercise({
        seed: exercise.seed, index: exercise.index, taskType: exercise.taskType,
        level: exercise.requestedLevel, visibleTiles: exercise.visibleTiles,
        schemaVersion: version,
      }));
    }
  }
});
