import { sortTiles, toCounts } from '../tiles.js';

export const GENERATOR_VERSION = '2.0.0';

/** Stable 32-bit FNV-1a seed canonicalization (not cryptographic). */
export function hashSeed(seed) {
  if (typeof seed !== 'string' && (!Number.isSafeInteger(seed))) {
    throw new TypeError('seed 必須為字串或安全整數');
  }
  const value = String(seed);
  if (!value.length) throw new RangeError('seed 不得為空');
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Mulberry32; output range [0, 1), deterministic within generator version. */
export function createSeededRandom(seed) {
  let state = hashSeed(seed);
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(max, rng = Math.random) {
  if (!Number.isSafeInteger(max) || max < 1) throw new RangeError('max 必須為正整數');
  const sample = rng();
  if (!(sample >= 0 && sample < 1)) throw new RangeError('rng 必須回傳 [0,1)');
  return Math.floor(sample * max);
}

/** A uniform sample from a physical 136-tile wall, without replacement. */
export function dealRandomHand(rng = Math.random, length = 17) {
  if (!Number.isInteger(length) || length < 1 || length > 136) throw new RangeError('牌數必須介於 1–136');
  const counts = new Uint8Array(34).fill(4);
  const hand = [];
  for (let i = 0; i < length; i++) {
    let target = randomInt(136 - i, rng);
    for (let tile = 0; tile < 34; tile++) {
      if (target < counts[tile]) {
        hand.push(tile);
        counts[tile]--;
        break;
      }
      target -= counts[tile];
    }
  }
  toCounts(hand);
  return sortTiles(hand);
}
