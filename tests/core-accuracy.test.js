import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, improvingDraws, calculateShanten, analyzeDraws, analyzeDiscards, winningTiles } from '../src/shanten.js';
import { knownTileCounts, toCounts } from '../src/tiles.js';

const complete = [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28, 28];
const ready = complete.slice(0, -1);

// 與向聽公式獨立的精確胡牌判定：選將眼後，遞迴只拆五組完整面子。
function independentWin(tiles) {
  if (tiles.length !== 17) return false;
  const counts = toCounts(tiles);
  function partition(groups) {
    const first = counts.findIndex(count => count > 0);
    if (first === -1) return groups === 5;
    if (groups === 5) return false;
    if (counts[first] >= 3) {
      counts[first] -= 3;
      if (partition(groups + 1)) { counts[first] += 3; return true; }
      counts[first] += 3;
    }
    if (first < 27 && first % 9 <= 6 && counts[first + 1] > 0 && counts[first + 2] > 0) {
      for (const tile of [first, first + 1, first + 2]) counts[tile]--;
      if (partition(groups + 1)) {
        for (const tile of [first, first + 1, first + 2]) counts[tile]++;
        return true;
      }
      for (const tile of [first, first + 1, first + 2]) counts[tile]++;
    }
    return false;
  }
  for (let eye = 0; eye < 34; eye++) {
    if (counts[eye] < 2) continue;
    counts[eye] -= 2;
    const found = partition(0);
    counts[eye] += 2;
    if (found) return true;
  }
  return false;
}

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomLegalHand(length, random) {
  const stock = Array.from({ length: 136 }, (_, i) => Math.floor(i / 4));
  for (let i = 0; i < length; i++) {
    const selected = i + Math.floor(random() * (136 - i));
    [stock[i], stock[selected]] = [stock[selected], stock[i]];
  }
  return stock.slice(0, length);
}

test('v0.1 exports 保持相容，16 張聽牌、17 張完成與勝張', () => {
  assert.equal(shanten(complete), -1);
  assert.equal(shanten(ready), 0);
  assert.deepEqual(improvingDraws(ready), {
    shanten: 0, draws: [{ tile: 28, count: 3 }], kinds: 1, copies: 3,
  });
  assert.deepEqual(winningTiles(ready), [{ tile: 28, count: 3 }]);
  assert.deepEqual(winningTiles(randomLegalHand(16, seeded(41))), []);
  assert.deepEqual(complete, [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28, 28]);
});

test('公開牌扣除、全牌一致性與非進張牌的四張上限', () => {
  assert.deepEqual(analyzeDraws(ready, { visible: [28, 28] }).draws, [{ tile: 28, count: 1 }]);
  assert.equal(analyzeDraws(ready, { visible: [28, 28, 28] }).copies, 0);
  assert.deepEqual(winningTiles(ready, { visible: [28, 28, 28] }), []);
  assert.throws(() => analyzeDraws(ready, { visible: [0] }), /相加不得超過四張/);
  assert.throws(() => analyzeDraws(ready, { visible: [28, 28, 28, 28] }), /相加不得超過四張/);
  assert.throws(() => knownTileCounts([28, 28, 28], [28, 28]), /相加不得超過四張/);
  assert.deepEqual(Array.from(knownTileCounts([1, 1], [1, 2])), [0, 3, 1, ...Array(31).fill(0)]);
});

test('何切時切出的牌應視為已公開，不得虛增可摸張數', () => {
  const choices = analyzeDiscards(complete);
  const cut28 = choices.find(item => item.tile === 28);
  assert.deepEqual(cut28, { tile: 28, shanten: 0, draws: [{ tile: 28, count: 2 }], kinds: 1, copies: 2 });
  assert.deepEqual(choices.map(item => item.tile).sort((a, b) => a - b), [...new Set(complete)].sort((a, b) => a - b));
  for (let i = 1; i < choices.length; i++) {
    const a = choices[i - 1]; const b = choices[i];
    assert.ok(a.shanten < b.shanten || (a.shanten === b.shanten &&
      (a.copies > b.copies || (a.copies === b.copies &&
      (a.kinds > b.kinds || (a.kinds === b.kinds && a.tile < b.tile))))));
  }
  assert.throws(() => analyzeDiscards(complete, { visible: [0] }), /相加不得超過四張/);
  const again = analyzeDiscards(complete);
  assert.deepEqual(choices, again);
});

test('固定完成面子數的純函式介面，明刻牌數由 visible 單獨計入', () => {
  assert.equal(calculateShanten([28, 28, 29, 30], { fixedMelds: 4 }), 1);
  assert.equal(calculateShanten([28, 28, 29, 29, 29], { fixedMelds: 4 }), -1);
  assert.equal(calculateShanten([28], { fixedMelds: 5 }), 0);
  assert.equal(calculateShanten([28, 28], { fixedMelds: 5 }), -1);
  assert.deepEqual(winningTiles([28], { fixedMelds: 5, visible: [28, 28] }), [{ tile: 28, count: 1 }]);
  assert.deepEqual(analyzeDiscards([28, 28], { fixedMelds: 5 })[0], {
    tile: 28, shanten: 0, draws: [{ tile: 28, count: 2 }], kinds: 1, copies: 2,
  });
});

test('非法狀態必須拒絕：牌數、五張、跨界、負碼、非整數、公開牌與面子數', () => {
  assert.throws(() => shanten([]), /16 或 17/);
  assert.throws(() => improvingDraws(complete), /16 張/);
  assert.throws(() => shanten([...ready.slice(0, -1), 0, 0]), /超過四張/);
  assert.throws(() => toCounts([34]), /無效牌碼/);
  assert.throws(() => toCounts([-1]), /無效牌碼/);
  assert.throws(() => toCounts([1.5]), /無效牌碼/);
  assert.throws(() => toCounts([NaN]), /無效牌碼/);
  assert.throws(() => shanten('0000000000000000'), /牌張必須是牌碼陣列/);
  assert.throws(() => calculateShanten(ready, { fixedMelds: 2 }), /需 10 或 11 張/);
  assert.throws(() => calculateShanten(ready, { fixedMelds: 1.5 }), /0 到 5/);
  assert.throws(() => calculateShanten(ready, { fixedMelds: 6 }), /0 到 5/);
  assert.throws(() => analyzeDraws(ready, { visible: [35] }), /無效牌碼/);
  assert.throws(() => analyzeDiscards(ready), /17 張暗牌/);
});

test('以固定亂數種子交叉檢驗 10,000 份 17 張手牌的獨立完整胡牌判定', () => {
  const random = seeded(20261119);
  for (let i = 0; i < 10000; i++) {
    const hand = randomLegalHand(17, random);
    assert.equal(shanten(hand) === -1, independentWin(hand), `seed=20261119, case=${i}, hand=${hand}`);
    if (i % 100 === 0) {
      const drawn = hand.slice(0, 16);
      const result = analyzeDraws(drawn);
      assert.ok(result.shanten >= 0 && Number.isInteger(result.shanten));
      assert.equal(result.kinds, result.draws.length);
      assert.equal(result.copies, result.draws.reduce((sum, d) => sum + d.count, 0));
      assert.ok(result.draws.every(({ tile, count }) => count >= 1 && count <= 4 - toCounts(drawn)[tile]));
    }
  }
});

test('邊界牌型：四張重複牌、萬筒交界不可組順與字牌不能組順', () => {
  const border = [0, 0, 0, 2, 2, 2, 11, 11, 11, 27, 27, 27, 28, 28, 8, 9];
  assert.equal(shanten(border), 1);
  assert.deepEqual(winningTiles(border), []);
  const honors = [27, 27, 27, 28, 28, 28, 29, 29, 29, 30, 30, 30, 31, 31, 32, 32, 32];
  assert.equal(shanten(honors), -1);
  assert.ok(independentWin(honors));
  const allFour = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 4, 4];
  assert.equal(shanten(allFour), -1);
  assert.ok(independentWin(allFour));
});

test('固定種子的已完成牌型：拆掉任一張後皆是零向聽，且勝張能由獨立胡牌判定確認', () => {
  const random = seeded(73);
  const melds = [
    ...Array.from({ length: 34 }, (_, tile) => [tile, tile, tile]),
    ...[0, 9, 18].flatMap(base => Array.from({ length: 7 }, (_, i) => [base + i, base + i + 1, base + i + 2])),
  ];
  for (let caseIndex = 0; caseIndex < 200; caseIndex++) {
    let hand;
    for (;;) {
      const tiles = [];
      const counts = new Uint8Array(34);
      for (let group = 0; group < 5; group++) {
        const valid = melds.filter(m => m.every((tile, index) =>
          counts[tile] + m.slice(0, index + 1).filter(t => t === tile).length <= 4));
        const choice = valid[Math.floor(random() * valid.length)];
        for (const tile of choice) { tiles.push(tile); counts[tile]++; }
      }
      const eyes = Array.from({length:34}, (_, i) => i).filter(tile => counts[tile] <= 2);
      const eye = eyes[Math.floor(random() * eyes.length)];
      hand = [...tiles, eye, eye];
      break;
    }
    assert.equal(independentWin(hand), true, `winning case ${caseIndex}`);
    assert.equal(shanten(hand), -1);
    const discarded = Math.floor(random() * 17);
    const readyHand = hand.filter((_, i) => i !== discarded);
    assert.equal(shanten(readyHand), 0);
    const draw = hand[discarded];
    assert.ok(winningTiles(readyHand).some(row => row.tile === draw));
    const copied = [...hand];
    if (caseIndex % 50 === 0) analyzeDiscards(hand);
    assert.deepEqual(hand, copied, '分析不能修改呼叫端手牌');
  }
});
