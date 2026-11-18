import { toCounts } from './tiles.js';

/**
 * 一般台灣十六張：5 面子 + 1 將眼的向聽數。
 * 不計特殊胡法、公開副露、花牌及家規。完成 17 張回傳 -1，16 張聽牌回傳 0。
 * 確定性的深度優先搜尋，枚舉面子、將眼、搭子與孤張，取最小缺數。
 */
export function shanten(tiles) {
  if (!Array.isArray(tiles) || (tiles.length !== 16 && tiles.length !== 17)) {
    throw new RangeError('shanten() 需要 16 或 17 張非花手牌');
  }
  const counts = toCounts(tiles);
  const memo = new Map();

  function visit(index, meld, taatsu, head) {
    while (index < 34 && counts[index] === 0) index++;
    if (index === 34) {
      return 10 - 2 * meld - Math.min(taatsu, 5 - meld) - head;
    }

    const key = `${index}:${meld}:${taatsu}:${head}:${counts.slice(index).join('')}`;
    if (memo.has(key)) return memo.get(key);

    let best = Number.POSITIVE_INFINITY;
    const use = (positions, m, t, h) => {
      for (const pos of positions) counts[pos]--;
      best = Math.min(best, visit(index, m, t, h));
      for (const pos of positions) counts[pos]++;
    };

    if (meld < 5) {
      if (counts[index] >= 3) {
        use([index, index, index], meld + 1, taatsu, head);
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 1] && counts[index + 2]) {
        use([index, index + 1, index + 2], meld + 1, taatsu, head);
      }
    }
    if (counts[index] >= 2 && !head) {
      use([index, index], meld, taatsu, 1);
    }
    if (taatsu < 5 - meld) {
      if (counts[index] >= 2) {
        use([index, index], meld, taatsu + 1, head);
      }
      if (index < 27 && index % 9 <= 7 && counts[index + 1]) {
        use([index, index + 1], meld, taatsu + 1, head);
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 2]) {
        use([index, index + 2], meld, taatsu + 1, head);
      }
    }
    // 不屬於最佳面子 / 搭子的孤張：跳過一張繼續計算。
    use([index], meld, taatsu, head);
    memo.set(key, best);
    return best;
  }

  return visit(0, 0, 0, 0);
}

/** 現有 16 張打完牌後，哪些牌可讓一般向聽數降低。 */
export function improvingDraws(hand16, visible = []) {
  if (hand16.length !== 16) throw new RangeError('必須輸入 16 張手牌');
  const owned = toCounts(hand16);
  const seen = toCounts(visible);
  const base = shanten(hand16);
  const draws = [];

  for (let tile = 0; tile < 34; tile++) {
    const remain = 4 - owned[tile] - seen[tile];
    if (remain < 0) throw new RangeError('手牌及明牌相加不得超過四張');
    if (!remain) continue;
    if (shanten([...hand16, tile]) < base) {
      draws.push({ tile, count: remain });
    }
  }
  return {
    shanten: base,
    draws,
    kinds: draws.length,
    copies: draws.reduce((sum, draw) => sum + draw.count, 0),
  };
}
