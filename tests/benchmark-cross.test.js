import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten } from '../src/shanten.js';
import { referenceShanten } from './fixtures/reference-oracle.js';
import { dealLegalHand, makeRng } from './fixtures/seeded-hands.js';

const enabled = process.env.MAHJONG_STRESS === '1';
const requested = Number(process.env.MAHJONG_CASES ?? 10000);

test('opt-in seeded 10,000+ legal-deal oracle cross-check', {
  skip: !enabled && 'Run with MAHJONG_STRESS=1 node --test tests/benchmark-cross.test.js',
  timeout: 180_000,
}, () => {
  assert.ok(Number.isSafeInteger(requested) && requested >= 10000, 'stress suite requires >=10000 cases');
  const seed = Number(process.env.MAHJONG_SEED ?? 20261119);
  const rng = makeRng(seed);
  for (let i = 0; i < requested; i++) {
    const hand = dealLegalHand(rng, i % 2 ? 16 : 17);
    assert.equal(shanten(hand), referenceShanten(hand), `seed=${seed} case=${i} hand=${hand}`);
  }
});
