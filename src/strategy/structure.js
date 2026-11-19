import { readPlayerView } from './view.js';
import { TILE_COUNT, toCounts } from '../tiles.js';

/**
 * Overlapping candidate patterns, NOT a second shanten scorer or unique decomposition.
 * Physical availability is exact relative to the visible inventory; strategic usefulness is heuristic.
 */
export function structuralCandidates(hand, knownCounts) {
  const count = toCounts(hand);
  const taatsu = [];
  const eyes = [];
  const involved = new Set();
  for (let t = 0; t < TILE_COUNT; t++) {
    if (count[t] >= 2) {
      eyes.push({ tile: t, copies: count[t], remainingForTriplet: 4-knownCounts[t], interpretation: 'possible-eye-or-triplet' });
      involved.add(t);
    }
    if (t >= 27 || count[t] === 0) continue;
    const rank = t % 9;
    if (rank <= 7 && count[t+1]) {
      const waits = rank === 0 ? [t+2] : rank === 7 ? [t-1] : [t-1,t+2];
      taatsu.push({ tiles:[t,t+1], shape:waits.length === 2 ? 'ryanmen' : 'penchan',
        waits:waits.map(tile=>({tile,copies:4-knownCounts[tile]})), shapeQuality:waits.length === 2 ? 2 : 1 });
      involved.add(t); involved.add(t+1);
    }
    if (rank <= 6 && count[t+2]) {
      taatsu.push({tiles:[t,t+2], shape:'kanchan', waits:[{tile:t+1,copies:4-knownCounts[t+1]}], shapeQuality:1});
      involved.add(t); involved.add(t+2);
    }
  }
  return {
    taatsu, eyes,
    isolated: Array.from({length:TILE_COUNT},(_,t)=>t).filter(t=>count[t] > 0 && !involved.has(t)),
    interpretation:'overlapping-candidate-patterns-not-a-disjoint-decomposition',
    exactKnownCopies:true,
    shapeQualityEpistemic:'heuristic',
  };
}
export function analyzeTaatsuCandidates(playerView) {
  const parsed = readPlayerView(playerView);
  return structuralCandidates(parsed.hand, parsed.counts);
}
