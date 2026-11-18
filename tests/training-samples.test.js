import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTrainingJSON } from '../src/storage/archive.js';
import { createExercise } from '../src/training/exercises.js';

test('公開 JSON 範例可匯入並逐題重現', () => {
  const archive = importTrainingJSON(readFileSync(new URL('../data/exercises/samples-v2.json', import.meta.url), 'utf8'));
  assert.equal(archive.exercises.length, 3);
  for (const exercise of archive.exercises) {
    assert.deepEqual(exercise, createExercise({
      seed: exercise.seed,
      index: exercise.index,
      taskType: exercise.taskType,
      level: exercise.requestedLevel,
      visibleTiles: exercise.visibleTiles,
    }));
  }
});
