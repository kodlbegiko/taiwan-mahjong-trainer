/**
 * P0 correctness gates are deliberately NOT TODO/skip.
 * They are expected to fail on unrepaired V0.1 main / old staging.
 * AI 6 owns tests/integration-contract.test.js; this suite does not touch it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, improvingDraws } from '../src/shanten.js';
import { rankDiscards, gradeAnswer } from '../src/practice.js';
import { toCounts } from '../src/tiles.js';
import { referenceShanten, referenceImprovingDraws } from './fixtures/reference-oracle.js';
import { makeRng, dealLegalHand, dealVisible } from './fixtures/seeded-hands.js';
import { FOUR_QUAD_CASES } from './fixtures/adversarial-hands.js';

async function optionalApi(path, exportName) {
  try {
    const module = await import(path);
    return module[exportName] ?? null;
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw error;
  }
}

const analyzeDiscards = await optionalApi('../src/core/efficiency.js', 'analyzeDiscards');
const explainDiscard = await optionalApi('../src/analysis/explain.js', 'explainDiscard');
const hand17 = [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28];

function without(hand, tile) {
  const result = [...hand];
  const at = result.indexOf(tile);
  assert.ok(at >= 0);
  result.splice(at, 1);
  return result;
}

function canonical(hand, visible = []) {
  const ranking = [...new Set(hand)].map(tile => {
    const hand16 = without(hand, tile);
    return { tile, ...referenceImprovingDraws(hand16, [...visible, tile]) };
  });
  return ranking.sort((a, b) =>
    a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile);
}

test('P0 Q-001: four quads are physically legal, oracle=4 and production MUST=4', () => {
  for (const fixture of FOUR_QUAD_CASES) {
    assert.equal(fixture.hand.length, 16, fixture.id);
    assert.ok(toCounts(fixture.hand).every(count => count <= 4), fixture.id);
    assert.equal(referenceShanten(fixture.hand), fixture.shanten, fixture.id);
    assert.equal(shanten(fixture.hand), fixture.shanten, `Q-001 ${fixture.id} hand=${fixture.hand}`);
  }
});

test('P0 Q-001: adjacent four-copy distributions also match independent oracle', () => {
  const clustered = [
    [...Array(4).fill(0),...Array(4).fill(1),...Array(4).fill(2),...Array(4).fill(3)],
    [...Array(4).fill(9),...Array(4).fill(10),...Array(4).fill(11),...Array(4).fill(12)],
    [...Array(4).fill(18),...Array(4).fill(19),...Array(4).fill(20),...Array(4).fill(21)],
    [...Array(4).fill(0),...Array(4).fill(2),...Array(4).fill(4),...Array(4).fill(8)],
  ];
  for (const hand of clustered) {
    assert.ok(toCounts(hand).every(n => n <= 4));
    assert.equal(shanten(hand), referenceShanten(hand), `Q-001 adjacent hand=${hand}`);
  }
});

test('P0 Q-002: discard is publicly unavailable; exact six-copy golden cannot be seven', () => {
  const expected = canonical(hand17);
  const row = expected.find(candidate => candidate.tile === 0);
  assert.equal(row.copies, 6, 'independent canonical known-discard fixture');
  const actual = rankDiscards(hand17);
  assert.deepEqual(actual.find(candidate => candidate.tile === 0), row);
  assert.deepEqual(actual, expected, 'all discards must equal known-discard independent reference');
});

test('P0 Q-002: rankDiscards and core analyzeDiscards must match every physical draw', () => {
  assert.equal(typeof analyzeDiscards, 'function',
    'Q-002 gate blocked: analyzeDiscards is not on this ref; integrate the reviewed core first');
  const rng = makeRng(0x71ac2222);
  const cases = [
    { hand: hand17, visible: [] },
    { hand: hand17, visible: [2,10,10] },
    ...Array.from({ length: 5 }, () => {
      const hand = dealLegalHand(rng);
      return { hand, visible: dealVisible(hand, rng, 9) };
    }),
  ];
  for (const { hand, visible } of cases) {
    const beforeHand = [...hand], beforeVisible = [...visible];
    const expected = canonical(hand, visible);
    const practice = rankDiscards(hand, visible);
    const core = analyzeDiscards(hand, { visible });
    assert.deepEqual(practice, expected, `Q-002 practice hand=${hand} visible=${visible}`);
    assert.deepEqual(core, expected, `Q-002 core hand=${hand} visible=${visible}`);
    for (const { tile, draws, copies, kinds } of practice) {
      const remaining = without(hand, tile);
      const known = toCounts([...remaining, ...visible, tile]);
      assert.equal(kinds, draws.length);
      assert.equal(copies, draws.reduce((n, d) => n + d.count, 0));
      for (const draw of draws) {
        assert.equal(draw.count, 4 - known[draw.tile], `tile=${tile} draw=${draw.tile}`);
        assert.ok(draw.count > 0);
        assert.ok(known[draw.tile] + draw.count <= 4);
      }
      assert.deepEqual(improvingDraws(remaining, [...visible, tile]), {
        shanten: practice.find(row => row.tile === tile).shanten, draws, copies, kinds,
      });
    }
    assert.deepEqual(hand, beforeHand, 'hand input must be immutable');
    assert.deepEqual(visible, beforeVisible, 'public information must be immutable');
  }
});

test('P0 I-003: every candidate metric, grade and BEST claim use one canonical truth', () => {
  assert.equal(typeof explainDiscard, 'function',
    'I-003 gate blocked: explainDiscard is not on this ref; integrate the reviewed explainer first');
  const rng = makeRng(0x71003003);
  const cases = [
    { hand: hand17, visible: [] },
    { hand: hand17, visible: [2,10] },
    ...Array.from({ length: 3 }, () => {
      const hand = dealLegalHand(rng);
      return { hand, visible: dealVisible(hand, rng, 7) };
    }),
  ];
  for (const { hand, visible } of cases) {
    const ranking = canonical(hand, visible);
    assert.deepEqual(rankDiscards(hand, visible), ranking, 'I-003 prerequisite Q-002 canonical ranking');
    const perfectTiles = ranking.filter(row => row.shanten === ranking[0].shanten
      && row.copies === ranking[0].copies).map(row => row.tile).sort((a,b) => a-b);
    for (const tile of new Set(hand)) {
      const expected = ranking.find(row => row.tile === tile);
      const score = gradeAnswer(ranking, tile);
      const explanation = explainDiscard(hand, tile, { visibleTiles: visible });
      assert.deepEqual(
        {
          shanten: explanation.selected.metrics.shanten,
          kinds: explanation.selected.metrics.kinds,
          copies: explanation.selected.metrics.copies,
          draws: explanation.selected.metrics.draws.map(({ tile, count }) => ({ tile, count })),
        },
        { shanten: expected.shanten, kinds: expected.kinds, copies: expected.copies, draws: expected.draws },
        `I-003 hand=${hand} visible=${visible} discard=${tile}`,
      );
      assert.equal(score.grade, expected.shanten === ranking[0].shanten
        ? (expected.copies === ranking[0].copies ? 'perfect' : 'acceptable') : 'improve');
      const explanationGrade = score.grade === 'perfect' ? 'optimal'
        : score.grade === 'acceptable' ? 'same-shanten' : 'higher-shanten';
      assert.equal(explanation.decision.grade, explanationGrade,
        `I-003 grade mismatch hand=${hand} discard=${tile}`);
      assert.equal(explanation.decision.grade === 'optimal', score.grade === 'perfect');
      assert.equal(explanation.decision.reasons.some(reason => reason.code === 'MATCH_BEST'),
        score.grade === 'perfect', `I-003 misleading best reason, discard=${tile}`);
      assert.deepEqual(explanation.decision.equivalentDiscards
        .filter(entry => perfectTiles.includes(entry.tile)).map(entry => entry.tile).sort((a,b) => a-b),
        score.grade === 'perfect' ? perfectTiles : [],
        `I-003 best-tile explanation mismatch discard=${tile}`);
      for (const row of explanation.candidates) {
        const corresponding = ranking.find(item => item.tile === row.discard.tile);
        assert.ok(corresponding);
        assert.equal(row.metrics.shanten, corresponding.shanten);
        assert.equal(row.metrics.copies, corresponding.copies);
        assert.equal(row.metrics.kinds, corresponding.kinds);
        assert.deepEqual(row.metrics.draws.map(({tile,count}) => ({tile,count})), corresponding.draws);
      }
    }
  }
});
