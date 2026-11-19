import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten } from '../src/shanten.js';
import { toCounts } from '../src/tiles.js';
import { referenceShanten } from './fixtures/reference-oracle.js';
import { regressionCase, FOUR_QUAD_CASES } from './fixtures/adversarial-hands.js';

test('required: 10,000 mixed-family independently-oracled physical 16/17-tile hands', { timeout: 300_000 }, () => {
  const seed = 20261119;
  const families = { 'uniform-136': 0, 'constructed-complete-and-perturbed': 0, 'adversarial-four-quads': 0 };
  let mismatches = 0;
  const firstFailures = [];
  for (let i = 0; i < 10000; i++) {
    const { hand, family, caseSeed } = regressionCase(seed, i);
    families[family]++;
    assert.ok(hand.length === 16 || hand.length === 17, `case ${i}: invalid tile count`);
    assert.ok(toCounts(hand).every(n => n <= 4), `case ${i}: exceeds four physical copies`);
    const expected = referenceShanten(hand);
    const actual = shanten(hand);
    if (actual !== expected) {
      mismatches++;
      if (firstFailures.length < 12) firstFailures.push({ i, caseSeed, family, hand, actual, expected });
    }
  }
  assert.deepEqual(families, {
    'uniform-136': 6000,
    'constructed-complete-and-perturbed': 2000,
    'adversarial-four-quads': 2000,
  });
  for (const { id, hand, shanten: expected } of FOUR_QUAD_CASES) {
    assert.equal(referenceShanten(hand), expected, `${id}: independent fixture`);
    assert.equal(shanten(hand), expected, `${id}: production fixture`);
  }
  assert.equal(mismatches, 0, `${mismatches} mismatches; first failures: ${JSON.stringify(firstFailures)}`);
});
