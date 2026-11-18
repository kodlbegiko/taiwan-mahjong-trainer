import test from 'node:test';
import assert from 'node:assert/strict';
import { toCounts } from '../src/tiles.js';
import { shanten, improvingDraws } from '../src/shanten.js';
import { generateHand, gradeAnswer, rankDiscards } from '../src/practice.js';
import { createSeededRandom, dealRandomHand, randomInt } from '../src/training/random.js';
import { createExercise, validateExercise, generateExerciseBank } from '../src/training/exercises.js';
import { winningTiles, isWinningHand, generateTenpaiHand } from '../src/training/waits.js';

test('固定種子、均勻牌牆抽樣與邊界驗證', () => {
  assert.deepEqual(dealRandomHand(createSeededRandom('wall-test')), dealRandomHand(createSeededRandom('wall-test')));
  const full = dealRandomHand(createSeededRandom(42), 136);
  assert.equal(full.length, 136);
  assert.ok(toCounts(full).every(count => count === 4));
  assert.throws(() => createSeededRandom(undefined), /seed/);
  assert.throws(() => randomInt(4, () => 1), /rng/);
  assert.throws(() => dealRandomHand(() => 0, 137), /牌數/);
});

test('舊版 API 保持相容，且三種抽樣層都合法', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    const hand = generateHand(level, createSeededRandom('stable-' + level));
    assert.deepEqual(hand, generateHand(level, createSeededRandom('stable-' + level)));
    assert.equal(hand.length, 17);
    assert.deepEqual(hand, [...hand].sort((a, b) => a - b));
    assert.ok(toCounts(hand).every(c => c <= 4));
    const ranked = rankDiscards(hand);
    assert.ok(ranked.length > 0);
    assert.equal(gradeAnswer(ranked, ranked[0].tile).grade, 'perfect');
  }
  assert.throws(() => generateHand('unknown'), /不支援/);
});

test('聽牌與多面聽由獨立胡牌判定驗證，並考慮公開牌', () => {
  for (const multiple of [false, true]) {
    const hand = generateTenpaiHand(createSeededRandom('wins-' + multiple), { multiple });
    assert.equal(shanten(hand), 0);
    const wins = winningTiles(hand);
    assert.ok(wins.length >= (multiple ? 2 : 1));
    for (const win of wins) {
      assert.ok(isWinningHand([...hand, win.tile]));
      assert.equal(shanten([...hand, win.tile]), -1);
    }
    const visible = [wins[0].tile];
    const later = winningTiles(hand, visible);
    const first = later.find(x => x.tile === wins[0].tile);
    assert.equal(first?.copies ?? 0, wins[0].copies - 1);
    assert.equal(improvingDraws(hand).copies, wins.reduce((sum, entry) => sum + entry.copies, 0));
  }
});

test('三種 Exercise 資料契約均可用 seed 重建並核對完整答案', () => {
  for (const taskType of ['discard', 'tenpai', 'multi_wait']) {
    const options = { seed: 'seed-2026', index: 13, taskType, level: 'intermediate' };
    const exercise = createExercise(options);
    assert.deepEqual(exercise, createExercise(options));
    assert.equal(exercise.schemaVersion, 2);
    assert.equal(exercise.estimatedDifficulty.humanValidated, false);
    assert.ok(validateExercise(exercise));
    if (taskType === 'multi_wait') assert.ok(exercise.answer.winningTiles.length >= 2);
    const corrupted = structuredClone(exercise);
    if (taskType === 'discard') corrupted.answer.optimalTiles = [33];
    else corrupted.answer.expectedTiles = [];
    assert.throws(() => validateExercise(corrupted), /不一致/);
  }
});

test('明牌列入 seed 識別，牌數上限與題目 ID 不可互相冒用', () => {
  const base = createExercise({ seed: 'visible', taskType: 'multi_wait' });
  const withVisible = createExercise({ seed: 'visible', taskType: 'multi_wait', visibleTiles: [33] });
  assert.notEqual(base.id, withVisible.id);
  assert.ok(validateExercise(withVisible));
  const tampered = structuredClone(base);
  tampered.seed = 'other';
  assert.throws(() => validateExercise(tampered), /種子/);
  assert.throws(() => createExercise({ seed: 'v', visibleTiles: [0, 0, 0, 0, 0] }), /超過四張/);
});

test('可重現至少 200 題，所有題目具有有效答案且不重複', { timeout: 120_000 }, () => {
  const bank = generateExerciseBank({ seed: 'tmt-v02-public-bank', count: 200 });
  assert.equal(bank.length, 200);
  assert.equal(new Set(bank.map(x => x.id)).size, 200);
  assert.deepEqual(bank[0], createExercise({ seed: 'tmt-v02-public-bank', index: 0, taskType: 'discard', level: 'beginner' }));
  for (const exercise of bank) assert.ok(validateExercise(exercise));
});
