/**
 * Independent shape-construction oracle, not a port of src/shanten.js.
 * Builds a target multiset containing exactly five melds plus one pair.
 * A suit is scanned left-to-right with pending sequence obligations;
 * score = maximal count of tiles shared with the input multiset.
 * Shanten = 16 - maximal overlap (0 for 16-tile tenpai, -1 for 17-tile wins).
 */
const SIZE = 6 * 2 * 5 * 5;
const NEGATIVE = -1000;
const key = (melds, eyes, old, newer) => ((melds * 2 + eyes) * 5 + old) * 5 + newer;

function inputCounts(hand) {
  if (!Array.isArray(hand) || ![16, 17].includes(hand.length)) {
    throw new RangeError('referenceShanten expects 16 or 17 tiles');
  }
  const counts = new Uint8Array(34);
  for (const tile of hand) {
    if (!Number.isInteger(tile) || tile < 0 || tile > 33 || ++counts[tile] > 4) {
      throw new RangeError('invalid reference hand');
    }
  }
  return counts;
}

export function referenceShanten(hand) {
  const counts = inputCounts(hand);
  let current = new Int16Array(SIZE).fill(NEGATIVE);
  current[key(0, 0, 0, 0)] = 0;
  for (let tile = 0; tile < 34; tile++) {
    const next = new Int16Array(SIZE).fill(NEGATIVE);
    const rank = tile % 9;
    const canStart = tile < 27 && rank <= 6;
    for (let melds = 0; melds <= 5; melds++) {
      for (let eyes = 0; eyes <= 1; eyes++) {
        for (let old = 0; old <= 4; old++) {
          for (let newer = 0; newer <= 4; newer++) {
            const score = current[key(melds, eyes, old, newer)];
            if (score === NEGATIVE) continue;
            const openings = canStart ? Math.min(4, 5 - melds, 4 - old - newer) : 0;
            if (openings < 0) continue;
            for (let start = 0; start <= openings; start++) {
              for (let triplet = 0; triplet <= Math.min(1, 5 - melds - start); triplet++) {
                for (let pair = 0; pair <= 1 - eyes; pair++) {
                  const needed = old + newer + start + 3 * triplet + 2 * pair;
                  if (needed > 4) continue;
                  const nextMelds = melds + start + triplet;
                  const nextEyes = eyes + pair;
                  const atBoundary = tile >= 27 || rank === 8;
                  const nextOld = atBoundary ? 0 : newer;
                  const nextNewer = atBoundary ? 0 : start;
                  const destination = key(nextMelds, nextEyes, nextOld, nextNewer);
                  const overlap = score + Math.min(needed, counts[tile]);
                  if (overlap > next[destination]) next[destination] = overlap;
                }
              }
            }
          }
        }
      }
    }
    current = next;
  }
  const overlap = current[key(5, 1, 0, 0)];
  if (overlap < 0) throw new Error('reference search failed to construct a complete hand');
  return 16 - overlap;
}

export function referenceImprovingDraws(hand16, visible = []) {
  const owned = inputCounts(hand16);
  if (hand16.length !== 16) throw new RangeError('expected 16 tiles');
  if (!Array.isArray(visible)) throw new RangeError('visible must be an array');
  const seen = new Uint8Array(34);
  for (const tile of visible) {
    if (!Number.isInteger(tile) || tile < 0 || tile > 33 || ++seen[tile] > 4) {
      throw new RangeError('invalid visible tiles');
    }
  }
  const base = referenceShanten(hand16);
  const draws = [];
  for (let tile = 0; tile < 34; tile++) {
    const remaining = 4 - owned[tile] - seen[tile];
    if (remaining < 0) throw new RangeError('more than four total copies');
    if (remaining > 0 && referenceShanten([...hand16, tile]) < base) {
      draws.push({ tile, count: remaining });
    }
  }
  return {
    shanten: base,
    draws,
    kinds: draws.length,
    copies: draws.reduce((sum, { count }) => sum + count, 0),
  };
}
