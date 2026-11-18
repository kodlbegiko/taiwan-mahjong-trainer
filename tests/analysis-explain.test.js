import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeStructure, explainDiscard, EXPLANATION_SCHEMA_VERSION } from '../src/analysis/explain.js';
import { shanten, improvingDraws } from '../src/shanten.js';
import { rankDiscards, generateHand, gradeAnswer } from '../src/practice.js';
import { toCounts, tileLabel } from '../src/tiles.js';

const COMPLETE = [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28, 28];
const AMBIGUOUS = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5];

function verifyPartition(hand, structure) {
  assert.equal(structure.shanten, shanten(hand));
  assert.equal(structure.matchesCanonical, structure.structuralShanten === structure.shanten);
  assert.ok(structure.decompositions.length >= 1);
  for (const d of structure.decompositions) {
    const groups = [...d.melds, ...(d.head ? [d.head] : []), ...d.taatsu, ...d.isolated];
    assert.deepEqual([...groups.flatMap(g => g.tiles)].sort((a,b) => a-b), [...hand].sort((a,b) => a-b));
    assert.equal(d.scoreBasis.base - d.scoreBasis.meldCredit -
      d.scoreBasis.taatsuCredit - d.scoreBasis.headCredit, structure.structuralShanten);
    assert.equal(d.melds.length, d.counts.meld);
    assert.equal(d.taatsu.length, d.counts.taatsu);
    assert.equal(d.head ? 1 : 0, d.counts.head);
    assert.equal(d.isolated.length, d.counts.isolated);
    assert.ok(d.melds.length <= 5);
    for (const g of groups) {
      assert.deepEqual(g.labels, g.tiles.map(tileLabel));
      if (g.kind === 'sequence' || g.kind === 'consecutive' || g.kind === 'gap') {
        assert.ok(g.tiles.every(t => t < 27 && Math.floor(t / 9) === Math.floor(g.tiles[0] / 9)));
        const step = g.kind === 'gap' ? 2 : 1;
        for (let i = 1; i < g.tiles.length; i++) assert.equal(g.tiles[i] - g.tiles[i - 1], step);
      }
      if (g.kind === 'pair' || g.kind === 'triplet') {
        assert.ok(g.tiles.every(tile => tile === g.tiles[0]));
      }
      if (g.kind === 'isolated') assert.equal(g.tiles.length, 1);
    }
  }
}

test('完整胡牌與16張聽牌：拆解包含五面子、將眼或孤張，分數可重算', () => {
  const completed = analyzeStructure(COMPLETE);
  assert.equal(completed.shanten, -1);
  assert.equal(completed.decompositions[0].counts.meld, 5);
  assert.equal(completed.decompositions[0].counts.head, 1);
  verifyPartition(COMPLETE, completed);
  const ready = COMPLETE.slice(0, -1);
  const result = analyzeStructure(ready);
  assert.equal(result.shanten, 0);
  verifyPartition(ready, result);
});

test('同分多種拆解可保留，截斷標記準確且結果具確定性', () => {
  const many = analyzeStructure(AMBIGUOUS, { maxDecompositions: 12 });
  const short = analyzeStructure(AMBIGUOUS, { maxDecompositions: 2 });
  assert.ok(many.decompositions.length > 2);
  assert.equal(short.decompositions.length, 2);
  assert.equal(short.truncated, true);
  assert.deepEqual(short.decompositions, many.decompositions.slice(0, 2));
  assert.equal(new Set(many.decompositions.map(x => x.signature)).size, many.decompositions.length);
  verifyPartition(AMBIGUOUS, many);
});

test('I-003：每種合法捨牌的數值、順序、勝張、評分完整追隨 canonical ranking', () => {
  const visibleTiles = [28];
  const ranking = rankDiscards(COMPLETE, visibleTiles);
  const expectedGrades = { perfect: 'optimal', acceptable: 'same-shanten', improve: 'higher-shanten' };
  for (const tile of new Set(COMPLETE)) {
    const out = explainDiscard(COMPLETE, tile, { visibleTiles });
    const picked = ranking.find(row => row.tile === tile);
    const scored = gradeAnswer(ranking, tile);
    assert.equal(out.schemaVersion, EXPLANATION_SCHEMA_VERSION);
    assert.equal(out.selected.rank, ranking.indexOf(picked) + 1);
    assert.equal(out.selected.coreRank, out.selected.rank);
    assert.equal(out.selected.metrics.shanten, picked.shanten);
    assert.equal(out.selected.metrics.kinds, picked.kinds);
    assert.equal(out.selected.metrics.copies, picked.copies);
    assert.deepEqual(out.selected.metrics.draws.map(({ tile, count }) => ({ tile, count })), picked.draws);
    assert.deepEqual(out.selected.rawCoreMetrics, {
      shanten: picked.shanten, kinds: picked.kinds, copies: picked.copies,
    });
    assert.equal(out.decision.grade, expectedGrades[scored.grade]);
    assert.equal(out.decision.trainingGrade, scored.grade);
    assert.equal(out.decision.trainingTitle, scored.title);
    assert.equal(out.decision.grade === 'optimal', scored.grade === 'perfect');
    assert.equal(out.candidates.length, ranking.length);
    assert.deepEqual(out.candidates.map(c => c.discard.tile), ranking.map(r => r.tile));
    for (const c of out.candidates) verifyPartition(c.hand16, c.structure);
    verifyPartition(COMPLETE, out.originalStructure);
  }
});

test('Q-002 相容階段：僅採用 canonical 值，且明確揭露棄牌扣除仍屬上游責任', () => {
  const ranked = rankDiscards(COMPLETE, [28, 28]);
  const selected = ranked.find(row => row.tile === 28);
  const result = explainDiscard(COMPLETE, 28, { visibleTiles: [28, 28] });
  assert.equal(result.selected.metrics.copies, selected.copies);
  assert.equal(result.selected.metrics.kinds, selected.kinds);
  assert.deepEqual(result.selected.metrics.draws.map(({ tile, count }) => ({ tile, count })),
    selected.draws);
  assert.match(result.scope.remainingCopies, /Q-002/);
  assert.equal(result.scope.rankingSource, 'practice.rankDiscards');
  assert.equal(result.scope.gradingSource, 'practice.gradeAnswer');
  // Before Q-002, the canonical ranking may still count a discarded tile.
  // Enforce the physical count on the integrated Q-002 gate, NOT by
  // implementing a second correction in the explanation layer.
});

test('初學者／進階中文解說及結構取捨有可回查的數值和來源', () => {
  const result = explainDiscard(COMPLETE, 28);
  const { decision, selected } = result;
  assert.ok(decision.reasons.some(x => x.code === 'EFFECTIVE_DRAWS'));
  assert.ok(decision.reasons.every(x => x.evidence && typeof x.evidence === 'object'));
  assert.ok(decision.explanations.beginner.every(x => /[\u3400-\u9fff]/u.test(x)));
  assert.ok(decision.explanations.advanced.some(x => x.includes('最佳結構拆解') || x.includes('候選拆解')));
  assert.equal(decision.comparison.shantenDelta, selected.metrics.shanten - result.candidates[0].metrics.shanten);
  assert.equal(decision.comparison.copiesDelta, selected.metrics.copies - result.candidates[0].metrics.copies);
  assert.equal(decision.grade === 'optimal', decision.trainingGrade === 'perfect');
  assert.ok(decision.reasons.some(x => x.code === 'TRAINING_GRADE'));
  assert.ok(decision.structuralTradeoff.retainedReference?.possibleRoles.length > 0);
  assert.ok(decision.structuralTradeoff.discardedInstead?.possibleRoles.length > 0);
});

test('最佳捨牌的教學評語與訓練評分一致', () => {
  const tile = rankDiscards(COMPLETE)[0].tile;
  const best = explainDiscard(COMPLETE, tile);
  assert.equal(best.decision.grade, 'optimal');
  assert.equal(best.decision.trainingGrade, 'perfect');
  assert.equal(best.decision.comparison.shantenDelta, 0);
  assert.equal(best.decision.comparison.copiesDelta, 0);
  assert.equal(best.decision.comparison.kindsDelta, 0);
  assert.ok(best.decision.equivalentDiscards.some(x => x.tile === tile));
  assert.equal(best.decision.structuralTradeoff.retainedReference, null);
});

test('牌型見證與 canonical shanten 不符時不拋出錯誤或宣稱正式演算法有錯', () => {
  const fourHonorsQuads = [
    27,27,27,27,28,28,28,28,29,29,29,29,30,30,30,30,
  ];
  const structure = analyzeStructure(fourHonorsQuads);
  verifyPartition(fourHonorsQuads, structure);
  assert.equal(structure.shanten, shanten(fourHonorsQuads));
  if (!structure.matchesCanonical) {
    assert.notEqual(structure.shanten, structure.structuralShanten);
  }
});

test('函式純度：未修改手牌、可見牌與 options，相同輸入產生相同結果', () => {
  const hand = [...COMPLETE].reverse();
  const visibleTiles = [33, 30];
  const options = { visibleTiles, maxDecompositions: 3 };
  const handBackup = [...hand];
  const visibleBackup = [...visibleTiles];
  const first = explainDiscard(hand, 28, options);
  assert.deepEqual(explainDiscard(hand, 28, options), first);
  assert.deepEqual(hand, handBackup);
  assert.deepEqual(visibleTiles, visibleBackup);
  assert.deepEqual(options, { visibleTiles: visibleBackup, maxDecompositions: 3 });
});

test('非法牌碼、張數與公開牌總數、不可用捨牌皆拒絕', () => {
  assert.throws(() => explainDiscard([0], 0), /17 張/);
  assert.throws(() => explainDiscard(COMPLETE, 33), /捨牌/);
  assert.throws(() => explainDiscard(COMPLETE, -1), /捨牌/);
  assert.throws(() => explainDiscard(COMPLETE, 28, { visibleTiles: [28, 28, 28] }), /超過四張/);
  assert.throws(() => explainDiscard(COMPLETE, 28, { visibleTiles: '東' }), /陣列/);
  assert.throws(() => explainDiscard(COMPLETE, 28, null), /物件/);
  assert.throws(() => explainDiscard(COMPLETE, 28, { maxDecompositions: 0 }), /1–12/);
  assert.throws(() => analyzeStructure(COMPLETE, { maxDecompositions: 13 }), /1–12/);
  assert.throws(() => analyzeStructure(COMPLETE.slice(0, 15)), /16 或 17 張/);
  assert.throws(() => explainDiscard([...COMPLETE.slice(0, -1), 0], 0), /超過四張/);
});

test('兩種 grade enum 的邊界與 kinds tie-break 只依 gradeAnswer 結果', () => {
  // The scoring contract uses (shanten, copies), but ordering additionally
  // uses kinds. The teaching layer must not downgrade a perfect score because
  // of a lower kinds tie-break.
  const canonical = rankDiscards(COMPLETE);
  for (const row of canonical) {
    const score = gradeAnswer(canonical, row.tile);
    const explained = explainDiscard(COMPLETE, row.tile);
    const gradeMap = { perfect: 'optimal', acceptable: 'same-shanten', improve: 'higher-shanten' };
    assert.equal(explained.decision.grade, gradeMap[score.grade]);
    const equivalents = canonical.filter(c => c.shanten === row.shanten && c.copies === row.copies);
    assert.deepEqual(explained.decision.equivalentDiscards.map(x => x.tile),
      equivalents.map(x => x.tile));
  }
});

test('多個固定可重現隨機案例：所有拆解、進張資料跨 API 一致', () => {
  let seed = 0xdeadbeef;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let iteration = 0; iteration < 8; iteration++) {
    const hand = generateHand('intermediate', random);
    assert.ok(toCounts(hand).every(c => c <= 4));
    const out = explainDiscard(hand, hand[iteration % 17], { maxDecompositions: 2 });
    const ranking = rankDiscards(hand);
    for (const candidate of out.candidates) {
      verifyPartition(candidate.hand16, candidate.structure);
      const row = ranking.find(r => r.tile === candidate.discard.tile);
      assert.equal(candidate.metrics.shanten, row.shanten);
      assert.equal(candidate.metrics.copies, row.copies);
      assert.equal(candidate.metrics.kinds, row.kinds);
      assert.deepEqual(candidate.metrics.draws.map(({ tile, count }) => ({ tile, count })), row.draws);
      assert.equal(out.decision.grade === 'optimal',
        gradeAnswer(ranking, out.selected.discard.tile).grade === 'perfect');
    }
  }
});
