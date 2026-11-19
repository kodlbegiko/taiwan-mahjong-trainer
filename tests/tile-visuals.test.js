import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TILE_LABELS, TILE_COUNT } from '../src/tiles.js';
import {
  TILE_FACE_COUNT, tileImageUrl, tileAccessibleName, tileFaceMarkup,
  handleTileFaceError, installTileFaceFallback,
} from '../src/tile-visuals.js';

test('34 張牌面是一對一的同源本地 SVG URL，正確處理萬筒索字牌碼', () => {
  assert.equal(TILE_COUNT, 34);
  assert.equal(TILE_FACE_COUNT, 34);
  const urls = Array.from({ length: 34 }, (_, tile) => tileImageUrl(tile));
  assert.equal(new Set(urls).size, 34);
  for (let tile = 0; tile < 34; tile++) {
    const url = new URL(urls[tile]);
    assert.ok(url.pathname.endsWith(`/public/tiles/${tile}.svg`), `${tile}: ${url.pathname}`);
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.ok(['file:', 'https:', 'http:'].includes(url.protocol));
    assert.equal(tileImageUrl(tile), urls[tile]);
  }
  assert.deepEqual([0, 8, 9, 17, 18, 26, 27, 33].map(tileAccessibleName),
    ['一萬', '九萬', '一筒', '九筒', '一索', '九索', '東', '白']);
  assert.equal(TILE_LABELS[0], '1萬'); // Do not alter authoritative tile names.
});

test('所有牌面圖片是裝飾性元素，並保留不含額外朗讀內容的文字 fallback', () => {
  for (let tile = 0; tile < 34; tile++) {
    const html = tileFaceMarkup(tile);
    assert.match(html, /<img class="tile-face-image" data-tile-face="true"/);
    assert.ok(html.includes(`src="${tileImageUrl(tile)}"`));
    assert.match(html, /alt="" aria-hidden="true" draggable="false"/);
    assert.match(html, /class="tile-face-fallback" aria-hidden="true" hidden/);
    assert.match(html, /class="tile-face-fallback-suit" aria-hidden="true" hidden/);
    assert.equal((html.match(/<img /g) ?? []).length, 1);
    assert.equal((html.match(/<small /g) ?? []).length, 1);
    assert.ok(tileAccessibleName(tile).length > 0);
  }
});

test('無效牌碼不會生成壞掉的資源 URL 或誤導螢幕閱讀器', () => {
  for (const tile of [-1, 34, 1.5, NaN, undefined, null, '9']) {
    assert.throws(() => tileImageUrl(tile), RangeError);
    assert.throws(() => tileAccessibleName(tile), RangeError);
    assert.throws(() => tileFaceMarkup(tile), RangeError);
  }
});

test('SVG 載入失敗時移除破圖圖示並顯示可讀文字，不更動父按鈕狀態', () => {
  const small = { hidden: true, classList: { contains: name => name === 'tile-face-fallback-suit' } };
  const glyph = { hidden: true, nextElementSibling: small, classList: { contains: name => name === 'tile-face-fallback' } };
  const image = { tagName: 'IMG', dataset: { tileFace: 'true' }, hidden: false, nextElementSibling: glyph };
  assert.equal(handleTileFaceError({ target: image }), true);
  assert.equal(image.hidden, true);
  assert.equal(glyph.hidden, false);
  assert.equal(small.hidden, false);
  assert.equal(handleTileFaceError({ target: { tagName: 'IMG', dataset: { tileFace: 'other' } } }), false);
  assert.equal(handleTileFaceError({ target: { tagName: 'BUTTON' } }), false);
  assert.equal(handleTileFaceError(null), false);
});

test('圖片 error listener 以捕獲階段裝設，支援動態重新產生題目', () => {
  const registered = [];
  const container = { addEventListener: (...params) => registered.push(params) };
  installTileFaceFallback(container);
  assert.equal(registered.length, 1);
  assert.equal(registered[0][0], 'error');
  assert.equal(registered[0][1], handleTileFaceError);
  assert.equal(registered[0][2], true);
});

test('三模式的手牌／聽張皆走同一渲染函式，不改鍵盤、選取及儲存邏輯', () => {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(app, /function tileMarkup\(/);
  assert.match(app, /const contents = tileFaceMarkup\(tile\);/);
  assert.match(app, /function renderWaitPicker\(/);
  assert.match(app, /\$\('#hand'\)\.innerHTML = exercise\.hand\.map\(\(tile, index\) => tileMarkup\(tile, index, \{ interactive: isDiscard \}\)\)/);
  assert.match(app, /data-wait="\$\{tile\}" aria-pressed="false"/);
  assert.match(app, /data-index="\$\{index\}" aria-label=/);
  assert.match(app, /tileFaceMarkup\(tile\)\}/);
  assert.match(app, /button\.setAttribute\('aria-pressed', String\(selectedWaits\.has\(tile\)\)\)/);
  assert.match(app, /function finishRecord\(chosen, expectedGrade\)/);
  assert.match(app, /installTileFaceFallback\(\$\('#hand'\)\)/);
  assert.match(app, /installTileFaceFallback\(\$\('#wait-options'\)\)/);
});
