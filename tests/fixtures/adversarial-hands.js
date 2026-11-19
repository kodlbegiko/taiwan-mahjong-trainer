import { dealLegalHand, makeRng } from './seeded-hands.js';

/** Physical four-copy 16-tile fixtures. A suit quad can retain one extra tile via an incomplete sequence. */
export const FOUR_QUAD_CASES = Object.freeze([
  { id: 'quad-honors', hand: [27,27,27,27,28,28,28,28,29,29,29,29,30,30,30,30], shanten: 4 },
  { id: 'quad-four-suits', hand: [0,0,0,0,9,9,9,9,18,18,18,18,27,27,27,27], shanten: 3 },
  { id: 'quad-four-terminals', hand: [8,8,8,8,17,17,17,17,26,26,26,26,33,33,33,33], shanten: 3 },
  { id: 'quad-four-centers', hand: [4,4,4,4,13,13,13,13,22,22,22,22,31,31,31,31], shanten: 3 },
]);
const MELDS = [
  ...Array.from({ length: 34 }, (_, t) => [t, t, t]),
  ...[0,9,18].flatMap(offset => Array.from({ length: 7 }, (_, r) => [offset+r, offset+r+1, offset+r+2])),
];
const drawInt = (rng, n) => Math.floor(rng() * n);

function completed(rng) {
  for (let tries = 0; tries < 1000; tries++) {
    const counts = new Uint8Array(34);
    const hand = [];
    for (let i = 0; i < 5; i++) {
      const options = MELDS.filter(meld => meld.every(tile =>
        counts[tile] + meld.filter(t => t === tile).length <= 4
      ));
      if (!options.length) break;
      const pick = options[drawInt(rng, options.length)];
      for (const t of pick) { counts[t]++; hand.push(t); }
    }
    if (hand.length !== 15) continue;
    const eyes = Array.from({ length: 34 }, (_, t) => t).filter(t => counts[t] <= 2);
    const eye = eyes[drawInt(rng, eyes.length)];
    hand.push(eye, eye);
    return hand;
  }
  throw new Error('could not construct a legal complete hand');
}

/**
 * Independent case seed per index. Every failing case can be reconstructed from
 * (masterSeed,index), without replaying earlier random calls.
 */
export function regressionCase(masterSeed, index) {
  if (!Number.isSafeInteger(masterSeed) || !Number.isSafeInteger(index) || index < 0) {
    throw new RangeError('masterSeed and index must be nonnegative safe integers (seed may be negative)');
  }
  const caseSeed = (masterSeed + Math.imul(index, 0x9e3779b9)) >>> 0;
  const rng = makeRng(caseSeed);
  const slot = index % 10;
  let hand;
  let family;
  if (slot < 6) {
    family = 'uniform-136';
    hand = dealLegalHand(rng, index % 2 === 0 ? 16 : 17);
  } else if (slot < 8) {
    family = 'constructed-complete-and-perturbed';
    hand = completed(rng);
    if (index % 2 === 0) hand.splice(drawInt(rng, hand.length), 1);
    else {
      const replacements = 1 + drawInt(rng, 4);
      for (let i = 0; i < replacements; i++) {
        const position = drawInt(rng, hand.length);
        const previous = hand[position];
        const counts = new Uint8Array(34);
        for (const t of hand) counts[t]++;
        const options = Array.from({ length: 34 }, (_, t) => t)
          .filter(t => t !== previous && counts[t] < 4);
        hand[position] = options[drawInt(rng, options.length)];
      }
    }
  } else {
    family = 'adversarial-four-quads';
    hand = [...FOUR_QUAD_CASES[drawInt(rng, FOUR_QUAD_CASES.length)].hand];
    if (index % 2 === 1) {
      const counts = new Uint8Array(34);
      for (const t of hand) counts[t]++;
      const extras = Array.from({ length: 34 }, (_, t) => t).filter(t => counts[t] < 4);
      hand.push(extras[drawInt(rng, extras.length)]);
    }
  }
  return { hand: hand.sort((a, b) => a - b), family, masterSeed, caseSeed, index };
}
