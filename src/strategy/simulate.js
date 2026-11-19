import { calculateShanten } from '../core/efficiency.js';
import { knownTileCounts } from '../tiles.js';

export const SIMULATOR_VERSION = 'public-unknown-draws/1.0.0';
const hash = input => {
  let h = 2166136261;
  for (const c of String(input)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
export function stableHash(input) { return hash(input).toString(16).padStart(8, '0'); }
function seeded(seed) {
  let state = hash(seed) || 0x9e3779b9;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function draw(pool, rng) {
  const total = pool.reduce((sum,n)=>sum+n,0);
  if (!total) return null;
  let target = Math.floor(rng() * total);
  for (let t=0;t<34;t++) {
    if (target < pool[t]) { pool[t]--; return t; }
    target -= pool[t];
  }
  throw new Error('unreachable draw');
}
function wilson(successes, n) {
  if (n === 0) return null;
  const z = 1.96, p = successes/n, z2=z*z, d=1+z2/n;
  const center=(p+z2/(2*n))/d;
  const half=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/d;
  return {low: Math.max(0,center-half),high:Math.min(1,center+half)};
}

/**
 * Reproducible Monte Carlo over ONLY unseen physical copies (NOT actual wall).
 * Each sample draws once, chooses a structural-only discard, then draws again.
 * Does not simulate opponent moves, claim priority, flowers, wins, or real time.
 */
export function simulateTwoDraws(hand16, { visible=[], fixedMelds=0, samples=8, seed='strategy-v1' } = {}) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 64) throw new RangeError('samples 必須介於 1 到 64');
  if (typeof seed !== 'string' || !seed) throw new TypeError('seed 必須為非空字串');
  const counts=knownTileCounts(hand16,visible);
  const start=calculateShanten(hand16,{fixedMelds});
  const originalPool=Uint8Array.from(counts,n=>4-n);
  const rng=seeded(seed);
  let improved=0, firstImproved=0, secondWins=0, run=0;
  for (let i=0;i<samples;i++) {
    const pool=Uint8Array.from(originalPool);
    const first=draw(pool,rng);
    if (first === null) break;
    const drawn=[...hand16,first];
    if (calculateShanten(drawn,{fixedMelds}) < start) firstImproved++;
    // Structural-only first-discard policy: min canonical shanten, tie lowest tile ID.
    // Explicitly avoids using actual hidden wall or future events.
    let best=null;
    for (const tile of [...new Set(drawn)].sort((a,b)=>a-b)) {
      const after=[...drawn]; after.splice(after.indexOf(tile),1);
      const shanten=calculateShanten(after,{fixedMelds});
      if (!best || shanten < best.shanten) best={tile,hand:after,shanten};
    }
    const second=draw(pool,rng);
    if (second===null) break;
    const finalShanten=calculateShanten([...best.hand,second],{fixedMelds});
    if (finalShanten < start) improved++;
    if (finalShanten === -1) secondWins++;
    run++;
  }
  return {
    samples:run, improved, firstImproved, secondWins,
    rate:run ? improved/run : null, interval:wilson(improved,run),
    seed, method:SIMULATOR_VERSION,
    objective:'shanten-decrease-after-up-to-two-hypothetical-self-draws',
    information:'only PlayerView own concealed, visible physical copies, no actual wall order',
    poolAssumption:'uniform random draw without replacement among all physically unseen standard tiles',
    firstDiscardPolicy:'minimal canonical 16-tile shanten, tie by tile code',
    pruning:'all unique first-discard tiles checked; Monte Carlo samples bound the first/second-draw branches',
    calibrated:false,
  };
}
