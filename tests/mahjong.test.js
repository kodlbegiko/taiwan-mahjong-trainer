import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, improvingDraws } from '../src/shanten.js';
import { generateHand, rankDiscards, gradeAnswer } from '../src/practice.js';
import { toCounts } from '../src/tiles.js';

// 111萬 123萬 123筒 123索 東東東 南南：5 面子 + 一對將。
const complete = [0, 0, 0, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 27, 28, 28];

test('完成牌型的向聽為 -1，移除其中一張將眼則為聽牌 0', () => {
  assert.equal(shanten(complete), -1);
  const ready = complete.slice(0, -1);
  assert.equal(shanten(ready), 0);
  const improving = improvingDraws(ready);
  assert.deepEqual(improving.draws, [{ tile: 28, count: 3 }]);
});

test('序列不跨花色，四張上限受到驗證', () => {
  assert.throws(() => toCounts([1, 1, 1, 1, 1]), /超過四張/);
  assert.throws(() => shanten([0]), /16 或 17 張/);
  assert.throws(() => improvingDraws(complete), /16 張/);
});

test('不同難度都產生合法的 17 張非花牌題目', () => {
  for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
    for (let i = 0; i < 5; i++) {
      const hand = generateHand(difficulty);
      assert.equal(hand.length, 17);
      assert.ok(toCounts(hand).every(count => count <= 4));
      assert.deepEqual(hand, [...hand].sort((a, b) => a - b));
    }
  }
});

test('每個不同捨牌都有分析，排序按向聽數與進張', () => {
  const ranked = rankDiscards(complete);
  assert.equal(ranked.length, new Set(complete).size);
  for (const item of ranked) {
    assert.ok(Number.isInteger(item.shanten));
    assert.ok(item.copies >= 0 && item.copies <= 136);
  }
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].shanten <= ranked[i].shanten);
  }
  const graded = gradeAnswer(ranked, ranked[0].tile);
  assert.equal(graded.grade, 'perfect');
});

test('可見明牌必須從進張中扣除', () => {
  const ready = complete.slice(0, -1);
  assert.equal(improvingDraws(ready, [28, 28]).copies, 1);
  assert.throws(() => improvingDraws(ready, [28, 28, 28, 28]), /相加不得超過四張/);
});

// 與向聽 DFS 不同的「完整胡牌判定」用於交叉確認 -1 的回傳值。
function isComplete(hand) {
  if (hand.length !== 17) return false;
  const base = toCounts(hand);
  function fiveMelds(counts, meld) {
    if (meld === 5) return counts.every(c => c === 0);
    const start = counts.findIndex(c => c > 0);
    if (start === -1) return false;
    if (counts[start] >= 3) {
      counts[start] -= 3;
      if (fiveMelds(counts, meld + 1)) return true;
      counts[start] += 3;
    }
    if (start < 27 && start % 9 < 7 && counts[start + 1] && counts[start + 2]) {
      for (const i of [start, start + 1, start + 2]) counts[i]--;
      if (fiveMelds(counts, meld + 1)) return true;
      for (const i of [start, start + 1, start + 2]) counts[i]++;
    }
    return false;
  }
  for (let eye = 0; eye < 34; eye++) {
    if (base[eye] < 2) continue;
    base[eye] -= 2;
    const won = fiveMelds(base, 0);
    base[eye] += 2;
    if (won) return true;
  }
  return false;
}

test('胡牌判定與一般向聽 -1 交叉驗證 100 份隨機手牌', () => {
  for (let i = 0; i < 100; i++) {
    const hand = generateHand('beginner');
    assert.equal(shanten(hand) === -1, isComplete(hand));
    if (i % 10 === 0) {
      const ranked = rankDiscards(hand);
      assert.ok(ranked.every(({shanten: s}) => s >= 0));
    }
  }
});
