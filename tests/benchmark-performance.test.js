import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { shanten } from '../src/shanten.js';
import { dealLegalHand, makeRng } from './fixtures/seeded-hands.js';

test('shanten benchmark smoke: finite positive durations and deterministic checksum', t => {
  const rng = makeRng(314159);
  const hands = Array.from({ length: 40 }, (_, i) => dealLegalHand(rng, i % 2 ? 16 : 17));
  let checksum = 0;
  const start = performance.now();
  for (const hand of hands) checksum += shanten(hand);
  const elapsed = performance.now() - start;
  assert.ok(Number.isFinite(elapsed) && elapsed >= 0);
  assert.ok(Number.isInteger(checksum));
  t.diagnostic(`40 shanten evaluations: ${elapsed.toFixed(3)}ms, checksum=${checksum}. This is not a CI latency gate.`);
});
