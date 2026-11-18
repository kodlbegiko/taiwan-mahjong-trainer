import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, improvingDraws } from '../src/shanten.js';
import { toCounts } from '../src/tiles.js';
import { GOLDEN_HANDS } from './fixtures/golden-cases.js';
import { referenceShanten, referenceImprovingDraws } from './fixtures/reference-oracle.js';
import { makeRng, dealLegalHand, dealVisible } from './fixtures/seeded-hands.js';

const quadCase = GOLDEN_HANDS.find(({ id }) => id === 'four-quad-honors');

for (const fixture of GOLDEN_HANDS) {
  test(`golden independent oracle: ${fixture.id}`, () => {
    assert.equal(referenceShanten(fixture.hand), fixture.shanten, fixture.note);
    if (fixture.draws) {
      assert.deepEqual(referenceImprovingDraws(fixture.hand).draws, fixture.draws);
    }
  });
  test(`golden production: ${fixture.id}`, () => {
    assert.equal(shanten(fixture.hand), fixture.shanten, fixture.note);
    if (fixture.draws) assert.deepEqual(improvingDraws(fixture.hand).draws, fixture.draws);
  });
}

test('four-quads regression is verified independently and remains explicitly tracked', () => {
  assert.equal(quadCase.hand.length, 16);
  assert.equal(referenceShanten(quadCase.hand), 4);
  // Production assertion stays in the TODO test so future repairs do not fail this independent fixture.
});

test('reference oracle rejects illegal tiles, five copies and wrong lengths', () => {
  for (const hand of [[0], Array(16).fill(0), [...Array(15).fill(0), -1], [...Array(15).fill(0), 34]]) {
    assert.throws(() => referenceShanten(hand), RangeError);
  }
  assert.throws(() => referenceImprovingDraws(GOLDEN_HANDS[1].hand, [28, 28, 28, 28]), RangeError);
  assert.throws(() => shanten(Array(16).fill(0)), RangeError);
});

test('uniform-deck generator is reproducible and every card has at most four copies', () => {
  const a = makeRng(20261119), b = makeRng(20261119);
  for (let n = 0; n < 100; n++) {
    const hand = dealLegalHand(a, n % 2 ? 16 : 17);
    assert.deepEqual(hand, dealLegalHand(b, n % 2 ? 16 : 17));
    const visible = dealVisible(hand, a, 24);
    assert.deepEqual(visible, dealVisible(hand, b, 24));
    assert.equal(toCounts(hand).length, 34);
    const counts = toCounts([...hand, ...visible]);
    assert.ok(counts.every(c => c <= 4));
    assert.equal(visible.length, 24);
  }
});

test('known public draws only change counts, never the reference shanten', () => {
  const hand = GOLDEN_HANDS.find(({ id }) => id === 'two-sided-wait-23').hand;
  const before = referenceImprovingDraws(hand);
  const after = referenceImprovingDraws(hand, [0, 0, 3]);
  assert.equal(after.shanten, before.shanten);
  assert.equal(after.copies, before.copies - 3);
  assert.deepEqual(after.draws, [{ tile: 0, count: 2 }, { tile: 3, count: 3 }]);
  assert.deepEqual(improvingDraws(hand, [0, 0, 3]), after);
});

test('independent shanten oracle agrees on 200 reproducible uniformly dealt hands', () => {
  const rng = makeRng(0x6d61684a);
  for (let i = 0; i < 200; i++) {
    const hand = dealLegalHand(rng, i % 2 === 0 ? 16 : 17);
    assert.equal(shanten(hand), referenceShanten(hand), `seed=0x6d61684a case=${i} hand=${hand}`);
  }
});

test('improving draws cross-check with a separate constructed-goal oracle', () => {
  const rng = makeRng(0x52323911);
  for (let i = 0; i < 8; i++) {
    const hand = dealLegalHand(rng, 16);
    const visible = dealVisible(hand, rng, 14);
    assert.deepEqual(improvingDraws(hand, visible), referenceImprovingDraws(hand, visible), `case=${i} hand=${hand}`);
  }
});
