import { shanten, improvingDraws } from './shanten.js';
import { sortTiles, toCounts } from './tiles.js';

const RANDOM_MELDS = [
  ...Array.from({ length: 34 }, (_, tile) => [tile, tile, tile]),
  ...[0, 9, 18].flatMap(start =>
    Array.from({ length: 7 }, (_, offset) => [start + offset, start + offset + 1, start + offset + 2])
  ),
];

function randomInt(max, rng) {
  return Math.floor(rng() * max);
}

function completedHand(rng = Math.random) {
  for (let tryCount = 0; tryCount < 200; tryCount++) {
    const hand = [];
    const counts = new Uint8Array(34);
    for (let group = 0; group < 5; group++) {
      const choices = RANDOM_MELDS.filter(meld => {
        const next = [...counts];
        for (const tile of meld) next[tile]++;
        return next.every(count => count <= 4);
      });
      const pick = choices[randomInt(choices.length, rng)];
      for (const tile of pick) {
        counts[tile]++;
        hand.push(tile);
      }
    }
    const eyes = Array.from({ length: 34 }, (_, tile) => tile)
      .filter(tile => counts[tile] <= 2);
    if (!eyes.length) continue;
    const eye = eyes[randomInt(eyes.length, rng)];
    hand.push(eye, eye);
    if (shanten(hand) === -1) return hand;
  }
  throw new Error('無法產生合法胡牌手牌');
}

export function generateHand(level = 'intermediate', rng = Math.random) {
  const changes = {
    beginner: [2, 4],
    intermediate: [5, 7],
    advanced: [8, 10],
  }[level];
  if (!changes) throw new RangeError(`不支援的難度：${level}`);

  let fallback = null;
  for (let attempts = 0; attempts < 40; attempts++) {
    const hand = completedHand(rng);
    const amount = changes[0] + randomInt(changes[1] - changes[0] + 1, rng);
    for (let i = 0; i < amount; i++) {
      const position = randomInt(hand.length, rng);
      const counts = toCounts(hand);
      counts[hand[position]]--;
      const available = Array.from({ length: 34 }, (_, tile) => tile)
        .filter(tile => counts[tile] < 4 && tile !== hand[position]);
      hand[position] = available[randomInt(available.length, rng)];
    }
    const sorted = sortTiles(hand);
    fallback = sorted;
    // 各難度以最佳捨牌後的向聽數分層；隨機題庫不足時採安全回退。
    const best = Math.min(...[...new Set(sorted)].map(tile => {
      const afterDiscard = [...sorted];
      afterDiscard.splice(afterDiscard.indexOf(tile), 1);
      return shanten(afterDiscard);
    }));
    const match = level === 'beginner' ? best <= 1 : level === 'intermediate' ? best >= 2 && best <= 3 : best >= 3;
    if (match) return sorted;
  }
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
