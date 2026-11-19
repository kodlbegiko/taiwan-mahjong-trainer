import { sortTiles, toCounts } from '../tiles.js';
import { shanten } from '../shanten.js';
import { randomInt } from './random.js';

const MELDS = [
  ...Array.from({ length: 34 }, (_, tile) => [tile, tile, tile]),
  ...[0, 9, 18].flatMap(start => Array.from({ length: 7 }, (_, i) => [start + i, start + i + 1, start + i + 2])),
];

/** Standalone 17-tile winning-hand predicate; does not delegate to shanten(). */
export function isWinningHand(hand17) {
  if (!Array.isArray(hand17) || hand17.length !== 17) return false;
  const counts = toCounts(hand17);
  function meldable(melds) {
    if (melds === 5) return counts.every(count => count === 0);
    const index = counts.findIndex(count => count > 0);
    if (index < 0) return false;
    if (counts[index] >= 3) {
      counts[index] -= 3;
      const found = meldable(melds + 1);
      counts[index] += 3;
      if (found) return true;
    }
    if (index < 27 && index % 9 <= 6 && counts[index + 1] && counts[index + 2]) {
      counts[index]--; counts[index + 1]--; counts[index + 2]--;
      const found = meldable(melds + 1);
      counts[index]++; counts[index + 1]++; counts[index + 2]++;
      if (found) return true;
    }
    return false;
  }
  for (let eye = 0; eye < 34; eye++) {
    if (counts[eye] < 2) continue;
    counts[eye] -= 2;
    const won = meldable(0);
    counts[eye] += 2;
    if (won) return true;
  }
  return false;
}

/** All physically available winning tiles of a 16-tile tenpai hand. */
export function winningTiles(hand16, visibleTiles = []) {
  if (!Array.isArray(hand16) || hand16.length !== 16) throw new RangeError('聽牌需要 16 張手牌');
  const owned = toCounts(hand16);
  const visible = toCounts(visibleTiles);
  for (let i = 0; i < 34; i++) if (owned[i] + visible[i] > 4) throw new RangeError('手牌與明牌不得超過四張');
  const wins = [];
  for (let tile = 0; tile < 34; tile++) {
    const copies = 4 - owned[tile] - visible[tile];
    if (copies && isWinningHand([...hand16, tile])) wins.push({ tile, copies });
  }
  return wins;
}

function constructedMelds(rng, count, initial = []) {
  const hand = [...initial];
  for (let i = 0; i < count; i++) {
    const counts = toCounts(hand);
    const options = MELDS.filter(meld => {
      const additions = new Map();
      for (const tile of meld) additions.set(tile, (additions.get(tile) || 0) + 1);
      return [...additions].every(([tile, amount]) => counts[tile] + amount <= 4);
    });
    if (!options.length) return null;
    hand.push(...options[randomInt(options.length, rng)]);
  }
  return hand;
}

/** Targeted pedagogical construction. NOT a uniform distribution of actual deals. */
export function generateTenpaiHand(rng = Math.random, { multiple = false } = {}) {
  for (let attempt = 0; attempt < 400; attempt++) {
    let hand;
    if (multiple) {
      const suit = randomInt(3, rng) * 9;
      const low = suit + randomInt(8, rng);
      const partial = [low, low + 1];
      const eyeCandidates = Array.from({ length: 34 }, (_, tile) => tile)
        .filter(tile => partial.filter(t => t === tile).length <= 2);
      const eye = eyeCandidates[randomInt(eyeCandidates.length, rng)];
      hand = constructedMelds(rng, 4, [...partial, eye, eye]);
    } else {
      const base = constructedMelds(rng, 5);
      if (!base) continue;
      const eye = Array.from({ length: 34 }, (_, tile) => tile)
        .filter(tile => toCounts(base)[tile] <= 2);
      const pick = eye[randomInt(eye.length, rng)];
      const complete = [...base, pick, pick];
      complete.splice(randomInt(complete.length, rng), 1);
      hand = complete;
    }
    if (!hand) continue;
    const sorted = sortTiles(hand);
    if (shanten(sorted) !== 0) continue;
    const wins = winningTiles(sorted);
    if (wins.length >= (multiple ? 2 : 1)) return sorted;
  }
  throw new Error(`無法產生${multiple ? '多面' : ''}聽牌題`);
}

/** Mixture component: a few constructed melds, remaining tiles sampled physically. */
export function generateMeldSeededHand(rng = Math.random, meldCount = 2) {
  if (![1, 2, 3].includes(meldCount)) throw new RangeError('meldCount 必須是 1、2 或 3');
  const hand = constructedMelds(rng, meldCount);
  if (!hand) throw new Error('無法產生初始面子');
  const counts = toCounts(hand);
  while (hand.length < 17) {
    const wall = 136 - hand.length;
    let position = randomInt(wall, rng);
    for (let tile = 0; tile < 34; tile++) {
      const remaining = 4 - counts[tile];
      if (position < remaining) {
        hand.push(tile); counts[tile]++; break;
      }
      position -= remaining;
    }
  }
  return sortTiles(hand);
}

/** Explicit aliases/adapters: training={tile,copies}; core={tile,count}. */
export { winningTiles as trainingWinningTiles };
export function trainingWaitsToCoreDraws(waits) {
  if (!Array.isArray(waits)) throw new TypeError('waits 必須為陣列');
  return waits.map(({ tile, copies }) => {
    if (!Number.isInteger(tile) || tile < 0 || tile > 33 || !Number.isInteger(copies) || copies < 0 || copies > 4) {
      throw new RangeError('無效的訓練聽張資料');
    }
    return { tile, count: copies };
  });
}
export function coreDrawsToTrainingWaits(draws) {
  if (!Array.isArray(draws)) throw new TypeError('draws 必須為陣列');
  return draws.map(({ tile, count }) => {
    if (!Number.isInteger(tile) || tile < 0 || tile > 33 || !Number.isInteger(count) || count < 0 || count > 4) {
      throw new RangeError('無效的核心聽張資料');
    }
    return { tile, copies: count };
  });
}
