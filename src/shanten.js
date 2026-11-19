import { calculateShanten, analyzeDraws } from './core/efficiency.js';

/** 相容 v0.1：一般台麻 16/17 張五面子一將眼向聽；胡牌為 -1。 */
export function shanten(tiles) {
  return calculateShanten(tiles);
}

/** 相容 v0.1：16 張有效進張種類及已知牌扣除後的理論張數。 */
export function improvingDraws(hand16, visible = []) {
  return analyzeDraws(hand16, { visible });
}

// 新版純函式介面。fixedMelds 僅是已完成的面子數；不代表完整副露規則。
export { calculateShanten, analyzeDraws, analyzeDiscards, winningTiles } from './core/efficiency.js';
