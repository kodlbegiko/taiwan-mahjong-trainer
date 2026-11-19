import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten } from '../src/shanten.js';
import { referenceShanten } from './fixtures/reference-oracle.js';
import { regressionCase, FOUR_QUAD_CASES } from './fixtures/adversarial-hands.js';

/**
 * Not run in fast CI. Every mismatch is counted, first failures are emitted
 * with a complete stand-alone reproduction, and test is FAILED (never TODO).
 */
const enabled = process.env.MAHJONG_STRESS === '1';
const requested = Number(process.env.MAHJONG_CASES ?? 10000);

test('opt-in 10,000+ seeded numerical oracle cross-check: 60% uniform, 20% constructed, 20% adversarial', {
  skip: !enabled && 'Run MAHJONG_STRESS=1 node --test tests/benchmark-cross.test.js',
  timeout: 300_000,
}, () => {
  assert.ok(Number.isSafeInteger(requested) && requested >= 10000,
    'stress suite requires at least 10,000 cases');
  const seed = Number(process.env.MAHJONG_SEED ?? 20261119);
  assert.ok(Number.isSafeInteger(seed), 'MAHJONG_SEED must be a safe integer');
  const counts = { 'uniform-136': 0, 'constructed-complete-and-perturbed': 0, 'adversarial-four-quads': 0 };
  let failures = 0;
  const samples = [];
  const compare = (label, hand, family, caseSeed) => {
    counts[family]++;
    let actual;
    let error;
    try { actual = shanten(hand); }
    catch (e) { error = `${e.name}: ${e.message}`; }
    const expected = referenceShanten(hand);
    if (error || actual !== expected) {
      failures++;
      const sample = { label, family, masterSeed: seed, caseSeed, hand,
        expected, actual: error ? null : actual, error: error ?? null };
      if (samples.length < 12) {
        samples.push(sample);
        process.stderr.write(`REGRESSION_MISMATCH ${JSON.stringify(sample)}\n`);
      }
    }
  };
  for (let index = 0; index < requested; index++) {
    const row = regressionCase(seed, index);
    compare(`index=${index}`, row.hand, row.family, row.caseSeed);
  }
  // Fixture proofs are always included, even if their combinatorial family
  // was randomly varied above. They are NOT used as exceptions.
  for (const fixture of FOUR_QUAD_CASES) {
    assert.equal(referenceShanten(fixture.hand), fixture.shanten,
      `independent oracle fixture must be correct: ${fixture.id}`);
    compare(`fixed=${fixture.id}`, fixture.hand, 'adversarial-four-quads', null);
  }
  const report = { seed, generated: requested, fixedFixtures: FOUR_QUAD_CASES.length,
    families: counts, mismatches: failures, firstFailures: samples };
  process.stdout.write(`CROSS_VALIDATION_RESULT ${JSON.stringify(report)}\n`);
  assert.equal(failures, 0,
    `${failures} oracle mismatches; first=${JSON.stringify(samples[0])}. Do not waive correctness failures.`);
});
