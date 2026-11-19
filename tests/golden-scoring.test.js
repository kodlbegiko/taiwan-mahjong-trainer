import test from 'node:test';
import assert from 'node:assert/strict';
import { rankDiscards, gradeAnswer, generateHand } from '../src/practice.js';
import { improvingDraws } from '../src/shanten.js';
import { makeRng, dealLegalHand, dealVisible } from './fixtures/seeded-hands.js';
import { GOLDEN_HANDS } from './fixtures/golden-cases.js';

const complete = GOLDEN_HANDS.find(({ id }) => id === 'five-melds-complete').hand;
const removeOnce = (hand, discard) => {
  const result = [...hand];
  result.splice(result.indexOf(discard), 1);
  return result;
};

test('ranking covers distinct discards and gradeAnswer uses exact public scoring contract', () => {
  const rng = makeRng(0x12345678);
  for (let n = 0; n < 15; n++) {
    const hand = dealLegalHand(rng);
    const visible = dealVisible(hand, rng, 8);
    const ranking = rankDiscards(hand, visible);
    assert.deepEqual(new Set(ranking.map(r => r.tile)), new Set(hand));
    const sorted = [...ranking].sort((a, b) => a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile);
    assert.deepEqual(ranking, sorted);
    for (const item of ranking) {
      const after = removeOnce(hand, item.tile);
      assert.deepEqual(item, { tile: item.tile, ...improvingDraws(after, [...visible, item.tile]) });
      assert.equal(item.draws.reduce((sum, draw) => sum + draw.count, 0), item.copies);
      assert.equal(item.draws.length, item.kinds);
      const graded = gradeAnswer(ranking, item.tile);
      const best = ranking[0];
      const expected = item.shanten === best.shanten && item.copies === best.copies
        ? 'perfect' : item.shanten === best.shanten ? 'acceptable' : 'improve';
      assert.equal(graded.grade, expected);
      assert.equal(graded.answer, item);
      assert.equal(graded.best, best);
    }
    assert.throws(() => gradeAnswer(ranking, 99), RangeError);
  }
});

test('existing generator accepts a seeded RNG and returns legal exercises', () => {
  for (const level of ['beginner', 'intermediate', 'advanced']) {
    const first = generateHand(level, makeRng(101));
    const second = generateHand(level, makeRng(101));
    assert.deepEqual(first, second);
    assert.equal(first.length, 17);
    assert.ok(first.every(t => Number.isInteger(t) && t >= 0 && t < 34));
    assert.ok(Math.max(...Array.from({ length: 34 }, (_, t) => first.filter(x => x === t).length)) <= 4);
  }
});

test('a known discarded tile must not reappear as a hypothetical wall copy', () => {
  const ranked = rankDiscards(complete);
  const discarded = ranked.find(({ tile }) => tile === 0);
  const remaining = removeOnce(complete, 0);
  const correct = improvingDraws(remaining, [0]);
  assert.equal(correct.copies, 6);
  assert.equal(discarded.copies, correct.copies);
  assert.deepEqual(discarded.draws, correct.draws);
});
