/** xorshift32: deterministic across Node versions, seed 0 is remapped. */
export function makeRng(seed = 0x5eed1234) {
  if (!Number.isSafeInteger(seed)) throw new RangeError('seed must be a safe integer');
  let state = (seed >>> 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

/** Uniform draw without replacement from a canonical 136-tile deck. */
export function dealLegalHand(rng, size = 17) {
  if (![16, 17].includes(size)) throw new RangeError('size must be 16 or 17');
  const deck = Array.from({ length: 136 }, (_, index) => Math.floor(index / 4));
  const result = [];
  for (let i = 0; i < size; i++) {
    const pick = i + Math.floor(rng() * (136 - i));
    [deck[i], deck[pick]] = [deck[pick], deck[i]];
    result.push(deck[i]);
  }
  return result.sort((a, b) => a - b);
}

/** Public tiles sampled only from the physical deck left after the hand. */
export function dealVisible(hand, rng, size = 12) {
  if (!Number.isInteger(size) || size < 0 || size > 136 - hand.length) {
    throw new RangeError('invalid visible count');
  }
  const counts = new Uint8Array(34);
  for (const tile of hand) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= 34 || ++counts[tile] > 4) {
      throw new RangeError('invalid hand');
    }
  }
  const pool = [];
  for (let tile = 0; tile < 34; tile++) {
    for (let n = counts[tile]; n < 4; n++) pool.push(tile);
  }
  const visible = [];
  for (let i = 0; i < size; i++) {
    const pick = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[pick]] = [pool[pick], pool[i]];
    visible.push(pool[i]);
  }
  return visible.sort((a, b) => a - b);
}
