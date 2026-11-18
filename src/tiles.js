/**
 * 0–8 萬，9–17 筒，18–26 索，27–33 東南西北中發白。
 * 花牌只有一張，摸到會補花，不在此版的 17 張出牌題目中。
 */
export const TILE_LABELS = Object.freeze([
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}萬`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}筒`),
  ...Array.from({ length: 9 }, (_, i) => `${i + 1}索`),
  '東', '南', '西', '北', '中', '發', '白',
]);

export const TILE_COUNT = TILE_LABELS.length;

export function toCounts(tiles) {
  const counts = new Uint8Array(TILE_COUNT);
  for (const tile of tiles) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) {
      throw new RangeError(`無效牌碼：${tile}`);
    }
    if (++counts[tile] > 4) {
      throw new RangeError(`${TILE_LABELS[tile]} 超過四張`);
    }
  }
  return counts;
}

export function tileClass(tile) {
  if (tile < 9) return 'man';
  if (tile < 18) return 'pin';
  if (tile < 27) return 'sou';
  return 'honor';
}

export function sortTiles(tiles) {
  return [...tiles].sort((a, b) => a - b);
}

export function tileLabel(tile) {
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILE_COUNT) {
    throw new RangeError('無效牌碼');
  }
  return TILE_LABELS[tile];
}
