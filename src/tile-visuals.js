import { TILE_COUNT, tileLabel } from './tiles.js';

const CHINESE_NUMERALS = Object.freeze(['一', '二', '三', '四', '五', '六', '七', '八', '九']);
const SUITS = Object.freeze(['萬', '筒', '索', '字']);

function checkTile(tile) {
  // Keep the shared 0–33 encoding and validation authoritative in tiles.js.
  tileLabel(tile);
  return tile;
}

/** Absolute URL derived from this module; works at localhost and Pages /repo/. */
export function tileImageUrl(tile) {
  checkTile(tile);
  return new URL(`../public/tiles/${tile}.svg`, import.meta.url).href;
}

/** Spoken name independent of the visual SVG; tile 0 is 一萬, 9 is 一筒. */
export function tileAccessibleName(tile) {
  checkTile(tile);
  if (tile >= 27) return tileLabel(tile);
  return `${CHINESE_NUMERALS[tile % 9]}${SUITS[Math.floor(tile / 9)]}`;
}

/** Visual content only. The enclosing button/span owns the accessible label. */
export function tileFaceMarkup(tile) {
  checkTile(tile);
  const label = tileLabel(tile);
  const glyph = tile >= 27 ? label : label.slice(0, -1);
  const suit = SUITS[Math.floor(tile / 9)];
  return [
    `<img class="tile-face-image" data-tile-face="true" src="${tileImageUrl(tile)}" width="44" height="60" alt="" aria-hidden="true" draggable="false" decoding="async">`,
    `<span class="tile-face-fallback" aria-hidden="true" hidden>${glyph}</span>`,
    `<small class="tile-face-fallback-suit" aria-hidden="true" hidden>${suit}</small>`,
  ].join('');
}

/** Called from a capturing error listener. A 404 never leaves a broken img glyph. */
export function handleTileFaceError(event) {
  const image = event?.target;
  if (image?.tagName !== 'IMG' || image.dataset?.tileFace !== 'true') return false;
  image.hidden = true;
  const glyph = image.nextElementSibling;
  const suit = glyph?.nextElementSibling;
  if (glyph?.classList?.contains('tile-face-fallback')) glyph.hidden = false;
  if (suit?.classList?.contains('tile-face-fallback-suit')) suit.hidden = false;
  return true;
}

/** Install before rendering children: error does not bubble, so capture it. */
export function installTileFaceFallback(container) {
  container.addEventListener('error', handleTileFaceError, true);
}

// Ensure artwork can be checked against a fixed 34-tile contract.
export const TILE_FACE_COUNT = TILE_COUNT;
