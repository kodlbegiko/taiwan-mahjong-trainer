import { shanten, improvingDraws } from './shanten.js';
import { sortTiles, toCounts } from './tiles.js';
import { dealRandomHand, randomInt } from './training/random.js';
import { generateTenpaiHand, generateMeldSeededHand } from './training/waits.js';

/**
 * Legacy API preserved: generateHand(level = 'intermediate', rng = Math.random).
 * beginner: constructed 16-tile tenpai + random 17th tile (pedagogical).
 * intermediate: mixture of partial-meld + wall sampling; rejection by heuristic.
 * advanced: uniform physical-wall sampling, no fabricated "advanced" guarantee.
 * These are sampling strata, NOT empirically validated human difficulty.
 */
export function generateHand(level = 'intermediate', rng = Math.random) {
  if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
    throw new RangeError(`不支援的難度：${level}`);
  }
  if (level === 'beginner') {
    const hand = generateTenpaiHand(rng);
    const counts = toCounts(hand);
    let target = randomInt(136 - hand.length, rng);
    for (let tile = 0; tile < 34; tile++) {
      const available = 4 - counts[tile];
      if (target < available) return sortTiles([...hand, tile]);
      target -= available;
    }
    throw new Error('抽牌失敗');
  }
  if (level === 'advanced') return dealRandomHand(rng);

  let fallback = null;
  for (let i = 0; i < 12; i++) {
    const hand = generateMeldSeededHand(rng, i % 2 ? 1 : 2);
    fallback = hand;
    const best = Math.min(...[...new Set(hand)].map(tile => {
      const remaining = [...hand];
      remaining.splice(remaining.indexOf(tile), 1);
      return shanten(remaining);
    }));
    if (best >= 2 && best <= 3) return hand;
  }
  // No silent claim that the sampling label guarantees actual difficulty.
  return fallback;
}

export function rankDiscards(hand17, visible = []) {
  if (hand17.length !== 17) throw new RangeError('題目必須提供 17 張手牌');
  toCounts(hand17);
  const unique = [...new Set(hand17)];
  return unique.map(tile => {
    const hand16 = [...hand17];
    hand16.splice(hand16.indexOf(tile), 1);
    const analysis = improvingDraws(hand16, visible);
    return { tile, ...analysis };
  }).sort((a, b) =>
    a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile
  );
}

export function gradeAnswer(ranking, chosen) {
  const best = ranking[0];
  const answer = ranking.find(item => item.tile === chosen);
  if (!answer) throw new RangeError('所選牌不在題目中');
  if (answer.shanten === best.shanten && answer.copies === best.copies) {
    return { grade: 'perfect', title: '牌效率最佳', best, answer };
  }
  if (answer.shanten === best.shanten) {
    return { grade: 'acceptable', title: '向聽數相同，進張較少', best, answer };
  }
  return { grade: 'improve', title: '這次出牌會降低牌效率', best, answer };
}
