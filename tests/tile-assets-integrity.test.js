import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { TILE_COUNT, tileLabel } from '../src/tiles.js';
import { TILE_FACE_COUNT, tileImageUrl, tileAccessibleName, tileFaceMarkup } from '../src/tile-visuals.js';

const root = new URL('../public/tiles/', import.meta.url);
const names = '一二三四五六七八九';
const EXPECTED = [
  ...Array.from({ length: 9 }, (_, i) => names[i] + '萬'),
  ...Array.from({ length: 9 }, (_, i) => names[i] + '筒'),
  ...Array.from({ length: 9 }, (_, i) => names[i] + '索'),
  '東', '南', '西', '北', '中', '發', '白',
];
const count = (svg, tag) => (svg.match(new RegExp('<' + tag + '\\b', 'g')) ?? []).length;

test('34 standalone SVG files map bijectively to 0–33 and the canonical tile encoding', () => {
  const files = readdirSync(root).sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
  assert.deepEqual(files, Array.from({ length: 34 }, (_, i) => i + '.svg'));
  assert.equal(TILE_COUNT, 34);
  assert.equal(TILE_FACE_COUNT, 34);
  const urls = new Set();
  for (let tile = 0; tile < 34; tile++) {
    const u = new URL(tileImageUrl(tile));
    assert.ok(u.pathname.endsWith('/public/tiles/' + tile + '.svg'));
    assert.equal(u.search + u.hash, '');
    urls.add(u.href);
    assert.equal(tileAccessibleName(tile), EXPECTED[tile]);
    assert.equal(tileLabel(tile), tile < 27 ? ((tile % 9) + 1) + ['萬', '筒', '索'][Math.floor(tile / 9)] : EXPECTED[tile]);
    assert.match(tileFaceMarkup(tile), new RegExp('src="[^"]+/public/tiles/' + tile + '\\.svg"'));
  }
  assert.equal(urls.size, 34);
});

test('34 SVGs have a fixed viewBox, accurate spoken titles, valid-looking self-contained safe markup', () => {
  const allowed = new Set(['svg', 'title', 'g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline']);
  for (let tile = 0; tile < 34; tile++) {
    const svg = readFileSync(new URL(tile + '.svg', root), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]+>/, 'namespace ' + tile);
    assert.match(svg, /width="72" height="100" viewBox="0 0 72 100"/, 'viewBox ' + tile);
    assert.ok(svg.includes('<title id="tile-title">' + EXPECTED[tile] + '</title>'), 'title ' + tile);
    assert.ok(svg.endsWith('</svg>\n') || svg.endsWith('</svg>'), 'truncated ' + tile);
    assert.ok(svg.length < 20000, 'SVG unexpectedly large ' + tile);
    assert.doesNotMatch(svg, /<\s*\/?\s*(script|foreignObject|image|iframe|object|embed|style|text|use|filter|animate|set|feImage|a)\b|<!DOCTYPE|<!ENTITY|<\?|<!--|on[a-z]+\s*=|xlink:|(?:href|src)\s*=|@import|@font-face|font-family\s*=|url\(|data:|javascript:/i,
      'active, externally referenced or font-dependent SVG: ' + tile);
    for (const match of svg.matchAll(/<\s*([A-Za-z][\w:-]*)\b/g)) {
      assert.ok(allowed.has(match[1]), 'unexpected element ' + match[1] + ' in ' + tile);
    }
    assert.match(svg, /(?:fill|stroke)="#[0-9a-f]{6}"/i, 'no visible artwork ' + tile);
  }
});

test('筒子與索子幾何數量、兩索不重疊且全部保留中文字與三元牌', () => {
  for (let rank = 2; rank <= 9; rank++) {
    const pipSvg = readFileSync(new URL((rank + 8) + '.svg', root), 'utf8');
    assert.equal(count(pipSvg, 'g'), rank, '筒子 should have ' + rank + ' pips');
    assert.equal(count(pipSvg, 'circle'), rank * 4, 'each pip uses four circles');
    const souSvg = readFileSync(new URL((rank + 17) + '.svg', root), 'utf8');
    assert.equal(count(souSvg, 'g'), rank, '索子 should have ' + rank + ' bamboo stalks');
    assert.equal(count(souSvg, 'rect'), rank * 3, 'each stalk should have three segments');
  }
  const two = readFileSync(new URL('19.svg', root), 'utf8');
  assert.ok(two.includes('translate(22 50)') && two.includes('translate(50 50)'),
    'two bamboo stalks must be side by side, not overlap vertically');
  const bird = readFileSync(new URL('18.svg', root), 'utf8');
  assert.ok(count(bird, 'path') >= 4, '一索 bird illustration missing');
  const white = readFileSync(new URL('33.svg', root), 'utf8');
  assert.equal(count(white, 'rect'), 2, '白板 should be a hollow frame');
  const center = readFileSync(new URL('31.svg', root), 'utf8');
  const green = readFileSync(new URL('32.svg', root), 'utf8');
  assert.match(center, /fill="#b6333b"/, '紅中 must be red');
  assert.match(green, /fill="#198151"/, '青發 must be green');
});

test('renderer, CSS and project-scoped SW version/precache include all 34 tiles', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(css, /\.tile \.tile-face-image\s*\{/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(sw, /CACHE_VERSION\s*=\s*'tmt-v02-realistic-tiles-/);
  assert.match(sw, /new URL\('\.\/', self\.location\.href\)/, 'SW must use scope-relative base');
  assert.ok(sw.includes("'./src/tile-visuals.js'"), 'renderer module must be offline');
  for (let i = 0; i < 34; i++) {
    assert.ok(sw.includes("'./public/tiles/" + i + ".svg'"), 'uncached face ' + i);
  }
  assert.match(sw, /fetch\(url,\s*\{\s*cache:\s*'reload'\s*\}\)/, 'precaching must bypass old HTTP cache');
  assert.match(sw, /if\s*\(!response\.ok\)\s*throw/, 'a missing asset must fail install atomically');
  assert.match(sw, /key\.startsWith\('tmt-shell-'\)/, 'older shell versions must be cleaned');
});
