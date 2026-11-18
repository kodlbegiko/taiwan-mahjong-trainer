import { TILE_COUNT, toCounts, knownTileCounts } from '../tiles.js';

/**
 * Exact standard-hand distance, not a heuristic count of incomplete groups.
 *
 * A winning concealed shape has (5 - fixedMelds) melds and one eye. For any
 * legal target T, the cards already owned that can be kept are
 *   overlap(hand, T) = Σ min(hand[t], T[t]).
 * Its physical tile inventory must obey T[t] <= 4, including the eye.
 * With 16 - 3*fixedMelds cards before a draw, the shanten is therefore
 *   16 - 3*fixedMelds - max_T overlap(hand, T).
 * A 17-card complete hand correctly scores -1.
 *
 * We enumerate legal per-suit target multisets ONCE, then maximize overlaps
 * independently for each suit and combine the suit scores by (melds, eye).
 * This explicitly prevents multiple pairs/taatsu cut from a four-of-a-kind
 * from claiming impossible fifth physical copies to complete their melds.
 * All helpers are synchronous, deterministic and do not mutate arguments.
 */
function targetShapes(length, sequencesAllowed) {
  const melds = Array.from({ length }, (_, tile) => [tile, tile, tile]);
  if (sequencesAllowed) {
    for (let i = 0; i < length - 2; i++) melds.push([i, i + 1, i + 2]);
  }
  // [eye * 6 + meldCount] -> distinct legal target tile-count vectors.
  const result = [];
  for (let eye = 0; eye <= 1; eye++) {
    let states = eye
      ? Array.from({ length }, (_, at) => Array.from({ length }, (_, i) => i === at ? 2 : 0))
      : [Array(length).fill(0)];
    for (let count = 0; count <= 5; count++) {
      result.push(states.map(state => Uint8Array.from(state)));
      if (count === 5) break;
      const next = new Map();
      for (const state of states) {
        for (const meld of melds) {
          const after = [...state];
          for (const tile of meld) after[tile]++;
          if (after.some(value => value > 4)) continue;
          next.set(after.join(''), after); // max count 4; fixed width per tile
        }
      }
      states = [...next.values()];
    }
  }
  return result;
}

const SUITED_TARGETS = targetShapes(9, true);
const HONOR_TARGETS = targetShapes(7, false);

/** Highest hand/target overlap for each local meld/eye allocation. */
function suitOverlaps(handCounts, offset, targets, length) {
  const best = new Int8Array(12).fill(-1);
  let handSize = 0;
  for (let tile = 0; tile < length; tile++) handSize += handCounts[offset + tile];

  for (let eye = 0; eye <= 1; eye++) {
    for (let melds = 0; melds <= 5; melds++) {
      const key = eye * 6 + melds;
      // No target of this size could retain more than this upper bound.
      // Safe early exit dramatically reduces the cost of exhaustive matching.
      const bound = Math.min(handSize, melds * 3 + eye * 2);
      for (const target of targets[key]) {
        let shared = 0;
        for (let i = 0; i < length; i++) {
          shared += Math.min(handCounts[offset + i], target[i]);
        }
        if (shared > best[key]) best[key] = shared;
        if (best[key] === bound) break;
      }
    }
  }
  return best;
}

function assertFixedMelds(fixedMelds) {
  if (!Number.isInteger(fixedMelds) || fixedMelds < 0 || fixedMelds > 5) {
    throw new RangeError('fixedMelds 必須是 0 到 5 的整數');
  }
}

function assertHandSize(tiles, fixedMelds, beforeDrawOnly) {
  if (!Array.isArray(tiles)) throw new TypeError('牌張必須是牌碼陣列');
  const before = 16 - fixedMelds * 3;
  if (beforeDrawOnly ? tiles.length !== before : (tiles.length !== before && tiles.length !== before + 1)) {
    if (fixedMelds === 0) {
      throw new RangeError(beforeDrawOnly ? '必須輸入 16 張手牌' : 'shanten() 需要 16 或 17 張非花手牌');
    }
    throw new RangeError(`fixedMelds=${fixedMelds} 時需 ${beforeDrawOnly ? before : `${before} 或 ${before + 1}`} 張暗牌`);
  }
}

/**
 * Numerical shanten for a legal 16/17-card concealed hand (5 melds + eye).
 * fixedMelds 0..5 represents complete melds not in concealed; only their
 * COUNT is modeled here. Open meld/kong cards must be separately supplied
 * through visible in draw analysis to deduct physical copies correctly.
 * This function does not validate open meld structure, flowers or house rules.
 */
export function calculateShanten(concealed, { fixedMelds = 0 } = {}) {
  assertFixedMelds(fixedMelds);
  assertHandSize(concealed, fixedMelds, false);
  const counts = toCounts(concealed);
  const blocks = [
    suitOverlaps(counts, 0, SUITED_TARGETS, 9),
    suitOverlaps(counts, 9, SUITED_TARGETS, 9),
    suitOverlaps(counts, 18, SUITED_TARGETS, 9),
    suitOverlaps(counts, 27, HONOR_TARGETS, 7),
  ];

  // Global DP: melds and the one eye may be distributed across four blocks.
  let combined = new Int8Array(12).fill(-1);
  combined[0] = 0;
  for (const block of blocks) {
    const next = new Int8Array(12).fill(-1);
    for (let eyes = 0; eyes <= 1; eyes++) {
      for (let melds = 0; melds <= 5; melds++) {
        const current = combined[eyes * 6 + melds];
        if (current < 0) continue;
        for (let moreEyes = 0; moreEyes <= 1 - eyes; moreEyes++) {
          for (let moreMelds = 0; moreMelds <= 5 - melds; moreMelds++) {
            const score = block[moreEyes * 6 + moreMelds];
            if (score < 0) continue;
            const key = (eyes + moreEyes) * 6 + melds + moreMelds;
            next[key] = Math.max(next[key], current + score);
          }
        }
      }
    }
    combined = next;
  }
  // Exactly the remaining meld count is required; using 5 here would
  // overstate overlap when fixedMelds > 0.
  const matched = combined[6 + (5 - fixedMelds)];
  return 16 - 3 * fixedMelds - matched;
}

/**
 * Effective draws after a 16-card hand: {shanten,draws:[{tile,count}],kinds,copies}.
 * visible is an additional, disjoint inventory of already-known physical tiles.
 * A draw is effective iff it strictly lowers the exact numerical shanten.
 */
export function analyzeDraws(concealed, { visible = [], fixedMelds = 0 } = {}) {
  assertFixedMelds(fixedMelds);
  assertHandSize(concealed, fixedMelds, true);
  const known = knownTileCounts(concealed, visible);
  const base = calculateShanten(concealed, { fixedMelds });
  const draws = [];
  let copies = 0;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const count = 4 - known[tile];
    if (count === 0) continue;
    if (calculateShanten([...concealed, tile], { fixedMelds }) < base) {
      draws.push({ tile, count });
      copies += count;
    }
  }
  return { shanten: base, draws, kinds: draws.length, copies };
}

/**
 * Winning draws only. Returns sorted [{tile, count}], NOT {tile, copies}.
 * count is the physically remaining number after subtracting visible.
 * Returns [] if not in tenpai, or if every winning tile is exhausted.
 */
export function winningTiles(concealed, options = {}) {
  const { shanten, draws } = analyzeDraws(concealed, options);
  return shanten === 0 ? draws : [];
}

/**
 * Canonical discard analysis. Every discarded tile is an additional known
 * physical tile (removed from the hand but still unavailable for draws).
 */
export function analyzeDiscards(concealed, { visible = [], fixedMelds = 0 } = {}) {
  assertFixedMelds(fixedMelds);
  if (!Array.isArray(concealed)) throw new TypeError('牌張必須是牌碼陣列');
  const expected = 17 - fixedMelds * 3;
  if (concealed.length !== expected) throw new RangeError(`捨牌分析需要 ${expected} 張暗牌`);
  knownTileCounts(concealed, visible);
  return [...new Set(concealed)].map(tile => {
    const after = [...concealed];
    after.splice(after.indexOf(tile), 1);
    return { tile, ...analyzeDraws(after, { visible: [...visible, tile], fixedMelds }) };
  }).sort((a, b) =>
    a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile
  );
}
