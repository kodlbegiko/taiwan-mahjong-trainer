import { TILE_COUNT, toCounts, knownTileCounts } from '../tiles.js';

/**
 * 一般台灣 16 張麻將，僅計 5 面子（順／刻）＋1 將眼。
 * fixedMelds 是已完成、且不在 concealed 中的面子個數（0..5）。
 * 需提供 16-3*fixedMelds 張，或摸牌後 17-3*fixedMelds 張暗牌。
 * 若有槓子，其第四張及其他已知牌須另外放在 visible；本函式不判斷副露合法性。
 * 不修改輸入；回傳完成 17 張時 -1、聽牌 0。
 */
export function calculateShanten(concealed, { fixedMelds = 0 } = {}) {
  checkMeldCount(fixedMelds);
  checkHandSize(concealed, fixedMelds, false);
  const counts = toCounts(concealed);
  const memo = new Map();

  function visit(index, melds, pairs, eye) {
    while (index < TILE_COUNT && counts[index] === 0) index++;
    if (index === TILE_COUNT) {
      return 10 - 2 * melds - Math.min(pairs, 5 - melds) - eye;
    }
    const key = `${index}:${melds}:${pairs}:${eye}:${counts.slice(index).join('')}`;
    if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    function tryUse(tiles, nextMelds, nextPairs, nextEye) {
      for (const tile of tiles) counts[tile]--;
      best = Math.min(best, visit(index, nextMelds, nextPairs, nextEye));
      for (const tile of tiles) counts[tile]++;
    }
    if (melds < 5) {
      if (counts[index] >= 3) tryUse([index, index, index], melds + 1, pairs, eye);
      if (index < 27 && index % 9 <= 6 && counts[index + 1] && counts[index + 2]) {
        tryUse([index, index + 1, index + 2], melds + 1, pairs, eye);
      }
    }
    if (!eye && counts[index] >= 2) tryUse([index, index], melds, pairs, 1);
    if (pairs < 5 - melds) {
      if (counts[index] >= 2) tryUse([index, index], melds, pairs + 1, eye);
      if (index < 27 && index % 9 <= 7 && counts[index + 1]) {
        tryUse([index, index + 1], melds, pairs + 1, eye);
      }
      if (index < 27 && index % 9 <= 6 && counts[index + 2]) {
        tryUse([index, index + 2], melds, pairs + 1, eye);
      }
    }
    tryUse([index], melds, pairs, eye); // 孤張
    memo.set(key, best);
    return best;
  }
  return visit(0, fixedMelds, 0, 0);
}

function checkMeldCount(fixedMelds) {
  if (!Number.isInteger(fixedMelds) || fixedMelds < 0 || fixedMelds > 5) {
    throw new RangeError('fixedMelds 必須是 0 到 5 的整數');
  }
}

function checkHandSize(tiles, fixedMelds, drawOnly) {
  if (!Array.isArray(tiles)) throw new TypeError('牌張必須是牌碼陣列');
  const before = 16 - fixedMelds * 3;
  const after = before + 1;
  if (drawOnly ? tiles.length !== before : (tiles.length !== before && tiles.length !== after)) {
    if (fixedMelds === 0) {
      throw new RangeError(drawOnly ? '必須輸入 16 張手牌' : 'shanten() 需要 16 或 17 張非花手牌');
    }
    throw new RangeError(`fixedMelds=${fixedMelds} 時需 ${drawOnly ? before : `${before} 或 ${after}`} 張暗牌`);
  }
}

/**
 * 摸牌後向聽降低的「有效進張」，不是勝率。
 * visible 是手牌以外額外已知、且不可能再摸到的牌；呼叫端需避免重複計算。
 * 回傳 {shanten, draws:[{tile,count}], kinds, copies}，與 v0.1 相容。
 */
export function analyzeDraws(concealed, { visible = [], fixedMelds = 0 } = {}) {
  checkMeldCount(fixedMelds);
  checkHandSize(concealed, fixedMelds, true);
  const known = knownTileCounts(concealed, visible);
  const base = calculateShanten(concealed, { fixedMelds });
  const draws = [];
  let copies = 0;
  for (let tile = 0; tile < TILE_COUNT; tile++) {
    const count = 4 - known[tile];
    if (count === 0) continue;
    if (calculateShanten([...concealed, tile], { fixedMelds }) < base) {
      draws.push({ tile, count });
      copies += count;
    }
  }
  return { shanten: base, draws, kinds: draws.length, copies };
}

/** 聽牌時所有能使一般胡牌成立的牌，否則回傳空陣列。 */
export function winningTiles(concealed, options = {}) {
  const result = analyzeDraws(concealed, options);
  return result.shanten === 0 ? result.draws : [];
}

/**
 * 摸牌後的何切：捨出的那一張牌也已公開，必須從進張剩餘張數扣除。
 * 輸出按向聽、進張張數、進張種類、牌碼排序；與既有 rankDiscards 相同欄位。
 * 不更動 practice.js 的 v0.1 排序器。
 */
export function analyzeDiscards(concealed, { visible = [], fixedMelds = 0 } = {}) {
  checkMeldCount(fixedMelds);
  if (!Array.isArray(concealed)) throw new TypeError('牌張必須是牌碼陣列');
  const expected = 17 - fixedMelds * 3;
  if (concealed.length !== expected) {
    throw new RangeError(`捨牌分析需要 ${expected} 張暗牌`);
  }
  knownTileCounts(concealed, visible);
  return [...new Set(concealed)].map(tile => {
    const hand = [...concealed];
    hand.splice(hand.indexOf(tile), 1);
    return { tile, ...analyzeDraws(hand, { fixedMelds, visible: [...visible, tile] }) };
  }).sort((a, b) =>
    a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile
  );
}
