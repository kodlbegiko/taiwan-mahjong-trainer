import { TILE_LABELS, tileClass } from './tiles.js';
import { generateHand, rankDiscards, gradeAnswer } from './practice.js';

const $ = selector => document.querySelector(selector);
const STORAGE_KEY = 'tw-mahjong-trainer:session:v1';
const stats = loadStats();
let difficulty = 'intermediate';
let hand = [];
let ranking = [];
let choice = null;
let startTime = 0;

function loadStats() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored)) return stored.slice(-500);
  } catch { /* 私密模式或內容損毀時回退到空紀錄 */ }
  return [];
}

function saveStats() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); }
  catch { /* 停用瀏覽器儲存時仍可進行練習 */ }
}

function tileMarkup(tile, opts = {}) {
  const { disabled = false, picked = false } = opts;
  const label = TILE_LABELS[tile];
  return `<button type="button" class="tile ${tileClass(tile)} ${picked ? 'picked' : ''}"
            data-tile="${tile}" aria-label="${label}" ${disabled ? 'disabled' : ''}>
            <span>${tile < 27 ? label.slice(0, 1) : label}</span>
            <small>${tile < 9 ? '萬' : tile < 18 ? '筒' : tile < 27 ? '索' : '字'}</small>
          </button>`;
}

function updateStats() {
  const total = stats.length;
  const perfect = stats.filter(item => item.grade === 'perfect').length;
  const same = stats.filter(item => item.grade !== 'improve').length;
  const avg = total ? (stats.reduce((sum, item) => sum + item.seconds, 0) / total).toFixed(1) : '—';
  $('#stat-total').textContent = `${total}`;
  $('#stat-perfect').textContent = total ? `${Math.round(perfect / total * 100)}%` : '—';
  $('#stat-same').textContent = total ? `${Math.round(same / total * 100)}%` : '—';
  $('#stat-seconds').textContent = total ? `${avg}s` : '—';
}

function drawNewHand() {
  choice = null;
  hand = generateHand(difficulty);
  ranking = rankDiscards(hand);
  startTime = performance.now();
  $('#hand').innerHTML = hand.map(tile => tileMarkup(tile)).join('');
  $('#exercise-status').textContent = '請選一張你認為最適合捨棄的牌';
  $('#exercise-status').className = 'status';
  $('#answer').hidden = true;
  $('#next').hidden = true;
  $('#hand').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => submitAnswer(Number(button.dataset.tile)));
  });
}

function drawList(draws) {
  if (!draws.length) return '—';
  return draws.map(draw => `${TILE_LABELS[draw.tile]}×${draw.count}`).join('、');
}

function submitAnswer(tile) {
  if (choice !== null) return;
  choice = tile;
  const seconds = Math.round((performance.now() - startTime) / 100) / 10;
  const result = gradeAnswer(ranking, tile);
  stats.push({ grade: result.grade, seconds, difficulty, date: new Date().toISOString() });
  if (stats.length > 500) stats.shift();
  saveStats();
  updateStats();

  $('#hand').innerHTML = hand.map(value => tileMarkup(value, { disabled: true, picked: value === tile })).join('');
  const status = $('#exercise-status');
  status.textContent = result.title;
  status.className = `status ${result.grade}`;
  $('#answer').hidden = false;
  $('#next').hidden = false;
  $('#chosen-tile').textContent = TILE_LABELS[tile];
  $('#best-tiles').textContent = ranking
    .filter(item => item.shanten === result.best.shanten && item.copies === result.best.copies)
    .map(item => TILE_LABELS[item.tile]).join('、');
  $('#feedback').textContent = result.grade === 'perfect'
    ? '以一般牌型、目前手牌的理論進張為標準，這是並列最佳的選擇。'
    : result.grade === 'acceptable'
      ? `你的打法與最佳選擇同為 ${result.answer.shanten} 向聽，但理論進張少 ${result.best.copies - result.answer.copies} 張。`
      : `你的打法是 ${result.answer.shanten} 向聽；最佳打法可保持 ${result.best.shanten} 向聽。`;

  $('#rankings').innerHTML = ranking.map((item, index) => {
    const chosen = item.tile === tile;
    const optimal = item.shanten === result.best.shanten && item.copies === result.best.copies;
    return `<tr class="${chosen ? 'chosen' : ''}">
      <td>${index + 1}</td><td>${TILE_LABELS[item.tile]} ${chosen ? '<span class="pill">你的選擇</span>' : ''} ${optimal ? '<span class="pill green">最佳</span>' : ''}</td>
      <td>${item.shanten}</td><td>${item.kinds}</td><td>${item.copies}</td>
    </tr>`;
  }).join('');
  const details = $('#draw-details');
  details.textContent = `你的打法之有效進張：${drawList(result.answer.draws)}。`;
}

$('#difficulty').addEventListener('change', event => {
  difficulty = event.target.value;
  drawNewHand();
});
$('#next').addEventListener('click', drawNewHand);
$('#skip').addEventListener('click', drawNewHand);
$('#clear-stats').addEventListener('click', () => {
  if (!confirm('確定清除這個瀏覽器的練習紀錄？')) return;
  stats.length = 0;
  saveStats();
  updateStats();
});
updateStats();
drawNewHand();
