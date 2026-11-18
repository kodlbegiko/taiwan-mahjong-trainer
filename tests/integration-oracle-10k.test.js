import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten } from '../src/shanten.js';
import { referenceShanten } from './fixtures/reference-oracle.js';
import { makeRng, dealLegalHand } from './fixtures/seeded-hands.js';

// Always-on independent numerical oracle gate for the V0.2 integration SHA.
// The existing opt-in stress suite remains independently available.
test('integration: 10,000 legal 16/17-tile seeded shanten numerical oracle comparisons', { timeout: 180_000 }, () => {
  const seed = 20261119;
  const rng = makeRng(seed);
  for (let caseNumber = 0; caseNumber < 10000; caseNumber++) {
    const hand = dealLegalHand(rng, caseNumber % 2 ? 16 : 17);
    assert.equal(shanten(hand), referenceShanten(hand),
      `seed=${seed} case=${caseNumber} hand=${hand.join(',')}`);
  }
});
