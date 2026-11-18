import { shanten } from '../shanten.js';
import { rankDiscards } from '../practice.js';
import { sortTiles, tileLabel, toCounts } from '../tiles.js';

export const EXPLANATION_SCHEMA_VERSION = '0.2.0';

/**
 * Enumerate optimal five-meld/one-eye interpretations using the same legal
 * groups and shanten objective as the currently published shanten() API.
 * A decomposition is a witness, NOT a unique or probabilistic interpretation.
 */
export function analyzeStructure(hand, { maxDecompositions = 4 } = {}) {
  if (!Array.isArray(hand) || (hand.length !== 16 && hand.length !== 17)) {
    throw new RangeError('牌型拆解需要 16 或 17 張手牌');
  }
  if (!Number.isInteger(maxDecompositions) || maxDecompositions < 1 || maxDecompositions > 12) {
    throw new RangeError('maxDecompositions 必須為 1–12 的整數');
  }
  const counts = toCounts(hand);
  const memo = new Map();
  const makeGroup = (kind, role, tiles) => ({
    kind, role, tiles: [...tiles], labels: tiles.map(tileLabel),
  });
  const nextIndex = index => {
    while (index < 34 && counts[index] === 0) index++;
    return index;
  };
  const moves = (index, meld, taatsu, head) => {
    const result = [];
    if (meld < 5) {
      if (counts[index] >= 3) result.push(makeGroup('triplet', 'meld', [index, index, index]));
      if (index < 27 && index % 9 <= 6 && counts[index + 1] && counts[index + 2]) {
        result.push(makeGroup('sequence', 'meld', [index, index + 1, index + 2]));
      }
    }
    if (!head && counts[index] >= 2) result.push(makeGroup('pair', 'head', [index, index]));
    if (taatsu < 5 - meld) {
      if (counts[index] >= 2) result.push(makeGroup('pair', 'taatsu', [index, index]));
      if (index < 27 && index % 9 <= 7 && counts[index + 1]) {
        result.push(makeGroup('consecutive', 'taatsu', [index, index + 1]));
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 2]) {
        result.push(makeGroup('gap', 'taatsu', [index, index + 2]));
      }
    }
    result.push(makeGroup('isolated', 'isolated', [index]));
    return result;
  };
  const withGroup = (group, callback) => {
    for (const tile of group.tiles) counts[tile]--;
    const result = callback();
    for (const tile of group.tiles) counts[tile]++;
    return result;
  };
  const score = (index, meld, taatsu, head) => {
    index = nextIndex(index);
    if (index === 34) return 10 - 2 * meld - Math.min(taatsu, 5 - meld) - head;
    const key = `${index}:${meld}:${taatsu}:${head}:${counts.slice(index).join('')}`;
    if (memo.has(key)) return memo.get(key);
    let value = Number.POSITIVE_INFINITY;
    for (const group of moves(index, meld, taatsu, head)) {
      value = Math.min(value, withGroup(group, () => score(index, meld + (group.role === 'meld'),
        taatsu + (group.role === 'taatsu'), head + (group.role === 'head'))));
    }
    memo.set(key, value);
    return value;
  };

  const minimum = score(0, 0, 0, 0);
  const official = shanten(hand);
  if (minimum !== official) throw new Error('拆解分數與核心向聽數不一致');

  const results = [];
  const signatures = new Set();
  const signatureOf = groups => groups.map(g => `${g.role}/${g.kind}/${g.tiles.join('-')}`).sort().join('|');
  const save = (groups, meld, taatsu, head) => {
    const signature = signatureOf(groups);
    if (signatures.has(signature)) return;
    signatures.add(signature);
    results.push({
      signature,
      melds: groups.filter(g => g.role === 'meld'),
      head: groups.find(g => g.role === 'head') ?? null,
      taatsu: groups.filter(g => g.role === 'taatsu'),
      isolated: groups.filter(g => g.role === 'isolated'),
      counts: { meld, head, taatsu, isolated: groups.filter(g => g.role === 'isolated').length },
      scoreBasis: { base: 10, meldCredit: 2 * meld, taatsuCredit: Math.min(taatsu, 5 - meld), headCredit: head },
    });
  };
  const collect = (index, meld, taatsu, head, groups) => {
    if (results.length > maxDecompositions) return;
    index = nextIndex(index);
    if (index === 34) {
      save(groups, meld, taatsu, head);
      return;
    }
    const here = score(index, meld, taatsu, head);
    for (const group of moves(index, meld, taatsu, head)) {
      if (results.length > maxDecompositions) break;
      withGroup(group, () => {
        const m = meld + (group.role === 'meld');
        const t = taatsu + (group.role === 'taatsu');
        const h = head + (group.role === 'head');
        if (score(index, m, t, h) === here) collect(index, m, t, h, [...groups, group]);
      });
    }
  };
  collect(0, 0, 0, 0, []);
  return {
    shanten: minimum,
    decompositions: results.slice(0, maxDecompositions),
    truncated: results.length > maxDecompositions,
    /** A false truncated flag is conclusive only within this exhaustive search. */
  };
}

function withoutOne(hand, tile) {
  const next = [...hand];
  const index = next.indexOf(tile);
  if (index < 0) throw new RangeError(`手牌中沒有 ${tileLabel(tile)}`);
  next.splice(index, 1);
  return sortTiles(next);
}

function participation(structures, tile) {
  const roles = new Set();
  for (const d of structures.decompositions) {
    for (const group of [...d.melds, ...(d.head ? [d.head] : []), ...d.taatsu, ...d.isolated]) {
      if (group.tiles.includes(tile)) roles.add(`${group.role}:${group.kind}`);
    }
  }
  return [...roles].sort();
}

/**
 * Explain the structural efficiency of discarding one tile from a legal
 * concealed 17-tile Taiwanese hand. The function never modifies its inputs.
 * options: {visibleTiles?: number[], maxDecompositions?: 1..12}.
 */
export function explainDiscard(hand17, discard, options = {}) {
  if (!Array.isArray(hand17) || hand17.length !== 17) {
    throw new RangeError('explainDiscard() 需要 17 張手牌');
  }
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options 必須為物件');
  }
  const visibleTiles = options.visibleTiles ?? [];
  const maxDecompositions = options.maxDecompositions ?? 4;
  if (!Array.isArray(visibleTiles)) throw new TypeError('visibleTiles 必須為牌碼陣列');
  if (!Number.isInteger(maxDecompositions) || maxDecompositions < 1 || maxDecompositions > 12) {
    throw new RangeError('maxDecompositions 必須為 1–12 的整數');
  }
  toCounts([...hand17, ...visibleTiles]); // validate physical copies including the selected discard
  if (!Number.isInteger(discard) || !hand17.includes(discard)) {
    throw new RangeError('捨牌必須是手牌中存在的牌碼');
  }
  const before = sortTiles(hand17);
  // Current practice.rankDiscards() excludes the just-discarded tile from
  // visible counts. Correct its draw counts without changing that public API.
  // This is equivalent to improvingDraws(hand16, [...visibleTiles, discard]).
  const corrected = rankDiscards(before, visibleTiles).map((raw, index) => {
    const draws = raw.draws.map(draw => ({
      tile: draw.tile,
      count: draw.count - (draw.tile === raw.tile ? 1 : 0),
    })).filter(draw => draw.count > 0);
    return {
      ...raw,
      coreRank: index + 1,
      rawCoreMetrics: { shanten: raw.shanten, kinds: raw.kinds, copies: raw.copies },
      draws,
      kinds: draws.length,
      copies: draws.reduce((sum, draw) => sum + draw.count, 0),
    };
  }).sort((a, b) => a.shanten - b.shanten || b.copies - a.copies ||
    b.kinds - a.kinds || a.tile - b.tile);
  const candidates = corrected.map((rank, index) => {
    const after = withoutOne(before, rank.tile);
    const structure = analyzeStructure(after, { maxDecompositions });
    if (structure.shanten !== rank.shanten) throw new Error('牌型與進張計算不一致');
    return {
      rank: index + 1,
      coreRank: rank.coreRank,
      rawCoreMetrics: rank.rawCoreMetrics,
      discard: { tile: rank.tile, label: tileLabel(rank.tile) },
      hand16: after,
      metrics: {
        shanten: rank.shanten,
        kinds: rank.kinds,
        copies: rank.copies,
        draws: rank.draws.map(({ tile, count }) => ({ tile, label: tileLabel(tile), count })),
        drawMeaning: rank.shanten === 0 ? 'winning' : 'shanten-reducing',
      },
      structure,
    };
  });

  const selected = candidates.find(c => c.discard.tile === discard);
  const best = candidates[0];
  const comparison = {
    referenceDiscard: best.discard,
    referenceRank: best.rank,
    shantenDelta: selected.metrics.shanten - best.metrics.shanten,
    copiesDelta: selected.metrics.copies - best.metrics.copies,
    kindsDelta: selected.metrics.kinds - best.metrics.kinds,
  };
  const equivalent = candidates.filter(c => c.metrics.shanten === selected.metrics.shanten &&
    c.metrics.copies === selected.metrics.copies && c.metrics.kinds === selected.metrics.kinds)
    .map(c => c.discard);
  const optimal = comparison.shantenDelta === 0 && comparison.copiesDelta === 0 && comparison.kindsDelta === 0;
  const grade = optimal ? 'optimal' : comparison.shantenDelta === 0 ? 'same-shanten' : 'higher-shanten';
  const reasons = [
    { code: 'SHANTEN', message: `打出${selected.discard.label}後為${selected.metrics.shanten}向聽。`,
      evidence: { shanten: selected.metrics.shanten } },
    { code: 'EFFECTIVE_DRAWS',
      message: selected.metrics.shanten === 0
        ? `可直接胡牌的摸牌有${selected.metrics.kinds}種，理論剩餘${selected.metrics.copies}張。`
        : `可降低向聽數的摸牌有${selected.metrics.kinds}種，理論剩餘${selected.metrics.copies}張。`,
      evidence: { kinds: selected.metrics.kinds, copies: selected.metrics.copies, draws: selected.metrics.draws } },
  ];
  if (comparison.shantenDelta > 0) {
    reasons.push({ code: 'SHANTEN_TRADEOFF',
      message: `比捨${best.discard.label}多${comparison.shantenDelta}向聽；依目前結構牌效率排序較差。`,
      evidence: comparison });
  } else if (comparison.copiesDelta < 0) {
    reasons.push({ code: 'COPY_TRADEOFF',
      message: `與捨${best.discard.label}同向聽，但少${-comparison.copiesDelta}張有效進張。`,
      evidence: comparison });
  } else if (comparison.kindsDelta < 0) {
    reasons.push({ code: 'KIND_TRADEOFF',
      message: `向聽數及有效進張張數相同，但比捨${best.discard.label}少${-comparison.kindsDelta}種進張。`,
      evidence: comparison });
  } else {
    reasons.push({ code: 'MATCH_BEST',
      message: `依向聽數、有效進張張數與種類，與最高排名方案同等。`,
      evidence: { equivalentDiscards: equivalent } });
  }

  const retainedReference = selected.discard.tile === best.discard.tile ? null : {
    tile: best.discard.tile,
    label: best.discard.label,
    possibleRoles: participation(selected.structure, best.discard.tile),
    basis: '僅限回傳的最優拆解樣本，其他同分拆解可能存在',
  };
  const discardedInstead = selected.discard.tile === best.discard.tile ? null : {
    tile: selected.discard.tile,
    label: selected.discard.label,
    possibleRoles: participation(best.structure, selected.discard.tile),
    basis: '僅限回傳的最優拆解樣本，其他同分拆解可能存在',
  };
  const beginner = [
    `捨${selected.discard.label}後：${selected.metrics.shanten === 0 ? '已聽牌' : `${selected.metrics.shanten}向聽`}。`,
    reasons[1].message,
    reasons[2].message,
  ];
  const advanced = [
    `比較基準：低向聽數 → 高有效進張張數 → 多有效進張種類（同分依牌碼排序）；僅評估一般五面子一將的結構效率。`,
    ...reasons.map(reason => `${reason.code}：${reason.message}`),
    `最佳拆解列出${selected.structure.decompositions.length}種${selected.structure.truncated ? '（尚有未列出的同分拆解）' : '（已列出所有同分拆解）'}；任何一種都不是唯一解的主張。`,
  ];
  if (retainedReference) {
    advanced.push(`在已列出的選擇方案最優拆解中，保留${retainedReference.label}的角色：${retainedReference.possibleRoles.join('、') || '未分類'}；不代表實戰中必須保留。`);
  }
  return {
    schemaVersion: EXPLANATION_SCHEMA_VERSION,
    scope: { rules: 'taiwan-16-standard-five-meld-one-eye', concealed: true, flowerTiles: false,
      openMeldsSupported: false, model: 'structural-efficiency',
      remainingCopies: '四張減去16張手牌、額外公開牌及本次捨出的牌；不等於摸牌機率',
      rankingNote: '修正現行 rankDiscards 尚未扣除本次捨牌的進張；coreRank 保留原排名供整合對照' },
    input: { hand17: before, discard: selected.discard, visibleTiles: sortTiles(visibleTiles) },
    originalStructure: analyzeStructure(before, { maxDecompositions }),
    selected,
    candidates,
    decision: {
      grade,
      rank: selected.rank,
      equivalentDiscards: equivalent,
      comparison,
      structuralTradeoff: { retainedReference, discardedInstead },
      reasons,
      explanations: { beginner, advanced },
    },
  };
}
