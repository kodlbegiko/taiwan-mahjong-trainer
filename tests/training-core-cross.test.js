import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { rankDiscards, gradeAnswer, generateHand } from '../src/practice.js';
import { createSeededRandom } from '../src/training/random.js';

const corePath = new URL('../src/core/efficiency.js', import.meta.url);

// The feature branch owns no src/core/ file. On PR #10 staging and subsequent
// integration runs, this test automatically becomes a mandatory cross-module gate.
test('Q-002: every discard candidate matches core analyzeDiscards (including visible)', {
  skip: !existsSync(corePath) && 'core is owned by PR #1; enabled on staging / integration',
}, async () => {
  const { analyzeDiscards } = await import('../src/core/efficiency.js');
  const sample = [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28];
  const hands = [sample, ...Array.from({ length: 12 }, (_, i) =>
    generateHand(['beginner', 'intermediate', 'advanced'][i % 3], createSeededRandom('core-cross-' + i)))];
  for (const hand of hands) {
    const visibleTile = Array.from({ length: 34 }, (_, tile) => tile)
      .find(tile => hand.filter(t => t === tile).length < 4);
    for (const visible of [[], [visibleTile]]) {
      const ranking = rankDiscards(hand, visible);
      const canonical = analyzeDiscards(hand, { visible });
      assert.deepEqual(ranking, canonical);
      for (const candidate of canonical) {
        const actual = ranking.find(item => item.tile === candidate.tile);
        assert.deepEqual(actual, candidate);
        const result = gradeAnswer(ranking, candidate.tile);
        assert.equal(result.grade === 'perfect',
          candidate.shanten === canonical[0].shanten && candidate.copies === canonical[0].copies);
      }
    }
  }
});
