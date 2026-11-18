import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shanten, improvingDraws, calculateShanten, analyzeDraws, analyzeDiscards, winningTiles,
} from '../src/shanten.js';
import { toCounts } from '../src/tiles.js';
import { referenceShanten, referenceImprovingDraws } from './fixtures/reference-oracle.js';
import { makeRng, dealLegalHand, dealVisible } from './fixtures/seeded-hands.js';

const FOUR_HONOR_QUADS = [
  27, 27, 27, 27, 28, 28, 28, 28,
  29, 29, 29, 29, 30, 30, 30, 30,
];

function assertNumericalOracle(hand, label) {
  const expected = referenceShanten(hand);
  assert.equal(shanten(hand), expected, `${label}: shanten(${JSON.stringify(hand)})`);
  assert.equal(calculateShanten(hand), expected, `${label}: calculateShanten(${JSON.stringify(hand)})`);
}

test('Q-001: four honor quads must be 4-shanten, never 2', () => {
  assert.equal(referenceShanten(FOUR_HONOR_QUADS), 4, 'independent oracle remains unchanged');
  assert.equal(shanten(FOUR_HONOR_QUADS), 4);
  assert.equal(calculateShanten(FOUR_HONOR_QUADS), 4);
  assertNumericalOracle([...FOUR_HONOR_QUADS, 31], '17-tile follow-up');
});

test('10,000 seeded uniform legal hands: exact numeric shanten agrees with independent oracle', {
  timeout: 120_000,
}, () => {
  const seed = 20261119;
  const rng = makeRng(seed);
  for (let caseIndex = 0; caseIndex < 10_000; caseIndex++) {
    const hand = dealLegalHand(rng, caseIndex % 2 ? 17 : 16);
    assertNumericalOracle(hand, `seed=${seed} case=${caseIndex}`);
  }
});

test('1,000 adversarial legal hands: quads, suited/honor boundaries and extreme repetitions', {
  timeout: 120_000,
}, () => {
  const seed = 0x51414453;
  const rng = makeRng(seed);
  for (let i = 0; i < 1000; i++) {
    const size = i % 2 ? 17 : 16;
    const deck = Array.from({ length: 136 }, (_, x) => Math.floor(x / 4));
    // Force at least one full four-of-a-kind; do not exceed any tile's cap.
    const forced = i % 34;
    const hand = [forced, forced, forced, forced];
    const available = deck.filter(t => t !== forced);
    for (let j = 0; j < size - 4; j++) {
      const pick = j + Math.floor(rng() * (available.length - j));
      [available[j], available[pick]] = [available[pick], available[j]];
      hand.push(available[j]);
    }
    assertNumericalOracle(hand, `adversarial seed=${seed} case=${i}`);
    assert.ok(toCounts(hand).every(n => n <= 4));
  }
  // Four quads drawn from arbitrary suited/honor codes, not just four honors.
  for (let i = 0; i < 200; i++) {
    const types = [...Array(34).keys()];
    for (let j = 0; j < 4; j++) {
      const pick = j + Math.floor(rng() * (types.length - j));
      [types[j], types[pick]] = [types[pick], types[j]];
    }
    const hand = types.slice(0, 4).flatMap(tile => [tile, tile, tile, tile]);
    assertNumericalOracle(hand, `four-quads case=${i}`);
  }
});

test('effective draws: visible inventory, candidate discard and winningTiles shape', () => {
  const hand = [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28, 28];
  const before = [...hand];
  const ranking = analyzeDiscards(hand);
  const discarded = ranking.find(row => row.tile === 0);
  assert.equal(discarded.copies, 6);
  assert.deepEqual(discarded.draws, [{ tile: 3, count: 4 }, { tile: 28, count: 2 }]);
  assert.deepEqual(hand, before, 'core functions must not mutate caller hand');
  const after = [...hand]; after.splice(after.indexOf(0), 1);
  assert.deepEqual(discarded, { tile: 0, ...analyzeDraws(after, { visible: [0] }) });
  assert.deepEqual(discarded, { tile: 0, ...improvingDraws(after, [0]) });
  assert.deepEqual(winningTiles(hand.slice(0, -1)), [{ tile: 28, count: 3 }]);
  assert.deepEqual(winningTiles(hand.slice(0, -1), { visible: [28, 28, 28] }), []);
  assert.deepEqual(analyzeDraws(hand.slice(0, -1), { visible: [28, 28, 28] }).draws, []);
  assert.deepEqual(winningTiles(hand.slice(0, -1)).map(x => Object.keys(x).sort()), [['count', 'tile']]);
});

test('visible counts and effective draws match separate oracle on seeded cases', () => {
  const rng = makeRng(0x510999);
  for (let i = 0; i < 40; i++) {
    const hand = dealLegalHand(rng, 16);
    const visible = dealVisible(hand, rng, 22);
    const savedHand = [...hand], savedVisible = [...visible];
    assert.deepEqual(improvingDraws(hand, visible), referenceImprovingDraws(hand, visible), `case=${i}`);
    assert.deepEqual(analyzeDraws(hand, { visible }), referenceImprovingDraws(hand, visible));
    assert.deepEqual(hand, savedHand);
    assert.deepEqual(visible, savedVisible);
  }
});

test('fixed-meld options require exactly the remaining meld target; input bounds remain enforced', () => {
  assert.equal(calculateShanten([28, 28, 29, 30], { fixedMelds: 4 }), 1);
  assert.equal(calculateShanten([28, 28, 29, 29, 29], { fixedMelds: 4 }), -1);
  assert.equal(calculateShanten([28], { fixedMelds: 5 }), 0);
  assert.equal(calculateShanten([28, 28], { fixedMelds: 5 }), -1);
  assert.throws(() => shanten(Array(16).fill(0)), /超過四張/);
  assert.throws(() => calculateShanten([35, ...Array(15).fill(0)]), /無效牌碼|超過四張/);
  assert.throws(() => calculateShanten([0]), /16 或 17/);
  assert.throws(() => calculateShanten([28, 28], { fixedMelds: 6 }), /0 到 5/);
  assert.throws(() => analyzeDiscards([0]), /17 張暗牌/);
  assert.throws(() => analyzeDraws([0], { fixedMelds: 0 }), /16 張/);
  const ready = [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28];
  assert.throws(() => analyzeDraws(ready, { visible: [0] }), /相加不得超過四張/);
});
