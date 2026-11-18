import { TILE_LABELS, tileClass } from './tiles.js';
import { generateHand, rankDiscards, gradeAnswer } from './practice.js';

const $ = selector => document.querySelector(selector);
// Keep the v0.1 key and record shape so existing browser progress is retained.
const STORAGE_KEY = 'tw-mahjong-trainer:session:v1';
// V0.2 is NOT written here until Q-001/Q-002/I-003 and the archive adapter pass integration.
let storageHealth = 'ok';
const stats = loadStats();
let difficulty = 'intermediate';
let hand = [];
let ranking = [];
let choice = null;
let startTime = 0;

function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const stored = JSON.parse(raw);
    if (!Array.isArray(stored)) {
      storageHealth = 'corrupt';
      return [];
    }
    return stored.filter(item => item && ['perfect', 'acceptable', 'improve'].includes(item.grade)
      && Number.isFinite(item.seconds) && item.seconds >= 0).slice(-500);
  } catch {
    // Do not overwrite malformed historical data: it might be recoverable manually.
    storageHealth = 'corrupt';
    return [];
  }
}

function showStorageHealth() {
  const notice = $('#storage-status');
  notice.hidden = storageHealth === 'ok';
  notice.textContent = storageHealth === 'corrupt'
    ? '既有紀錄無法讀取。已改用本次暫存，原始資料不會被覆寫；重新整理後本次成績可能消失。'
    : storageHealth === 'blocked'
      ? '無法儲存到瀏覽器，本次成績僅暫存在目前頁面；重新整理後可能消失。'
      : '';
}

function saveStats() {
  if (storageHealth === 'corrupt') {
    showStorageHealth();
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    storageHealth = 'blocked';
  }
  showStorageHealth();
}

function tileMarkup(tile, index, { disabled = false, picked = false } = {}) {
  const label = TILE_LABELS[tile];
  const suit = tile < 9 ? '萬' : tile < 18 ? '筒' : tile < 27 ? '索' : '字';
  return `<button type="button" class="tile ${tileClass(tile)}${picked ? ' picked' : ''}"
    data-tile="${tile}" aria-label="第 ${index + 1} 張：${label}${disabled ? '' : '；按下立即捨牌並查看結果'}"
    ${disabled ? 'disabled' : ''}${picked ? ' data-picked="true"' : ''}>
    <span aria-hidden="true">${tile < 27 ? label.slice(0, 1) : label}</span>
    <small aria-hidden="true">${suit}</small>
  </button>`;
}

function updateStats() {
  const total = stats.length;
  const perfect = stats.filter(item => item.grade === 'perfect').length;
  const same = stats.filter(item => item.grade !== 'improve').length;
  const avg = total ? (stats.reduce((sum, item) => sum + item.seconds, 0) / total).toFixed(1) : '—';
  $('#stat-total').textContent = String(total);
  $('#stat-perfect').textContent = total ? `${Math.round(perfect / total * 100)}%` : '—';
  $('#stat-same').textContent = total ? `${Math.round(same / total * 100)}%` : '—';
  $('#stat-seconds').textContent = total ? `${avg}s` : '—';
  showStorageHealth();
}

function setStep(reviewing) {
  const decide = $('#step-decide');
  const review = $('#step-review');
  const repeat = $('#step-repeat');
  decide.className = reviewing ? 'is-done' : 'is-current';
  review.className = reviewing ? 'is-current' : '';
  repeat.className = '';
  if (reviewing) {
    decide.removeAttribute('aria-current');
    review.setAttribute('aria-current', 'step');
  } else {
    decide.setAttribute('aria-current', 'step');
    review.removeAttribute('aria-current');
  }
}

function drawNewHand({ focusHand = false } = {}) {
  try {
    // Preserve the original generateHand -> rankDiscards -> gradeAnswer contract.
    const generated = generateHand(difficulty);
    const ranked = rankDiscards(generated);
    hand = generated;
    ranking = ranked;
    choice = null;
    startTime = performance.now();
    $('#hand').innerHTML = hand.map((tile, i) => tileMarkup(tile, i)).join('');
    $('.table-surface').scrollLeft = 0;
    $('#exercise-status').textContent = '選擇一張牌捨棄；點選後立即顯示解析';
    $('#exercise-status').className = 'status';
    $('#hand-count').textContent = `${hand.length} / 17`;
    $('#answer').hidden = true;
    $('#next').hidden = true;
    $('#skip').hidden = false;
    setStep(false);
    if (focusHand) $('#hand button')?.focus();
  } catch (error) {
    $('#hand').replaceChildren();
    $('#exercise-status').textContent = '題目產生失敗，請換一題重試。';
    $('#exercise-status').className = 'status improve';
    console.error('Unable to generate a practice hand:', error);
  }
}

function drawList(draws) {
  if (!draws.length) return '無可降低向聽數的進張';
  return draws.map(draw => `${TILE_LABELS[draw.tile]} × ${draw.count}`).join('、');
}

function submitAnswer(tile) {
  if (choice !== null || !ranking.length) return;
  let result;
  try {
    result = gradeAnswer(ranking, tile);
    const candidate = ranking.find(item => item.tile === tile);
    if (!candidate || !result?.answer || !result?.best
      || result.answer.tile !== candidate.tile || result.best.tile !== ranking[0].tile
      || !['perfect', 'acceptable', 'improve'].includes(result.grade)) {
      throw new Error('練習評分與候選排序契約不一致');
    }
  } catch (error) {
    $('#exercise-status').textContent = '評分結果無法確認，已停止這題以避免顯示矛盾數據。請略過重新產題。';
    $('#exercise-status').className = 'status improve';
    console.error('Unable to reconcile grade with ranking:', error);
    return;
  }
  choice = tile;
  const seconds = Math.round((performance.now() - startTime) / 100) / 10;
  stats.push({ grade: result.grade, seconds, difficulty, date: new Date().toISOString() });
  if (stats.length > 500) stats.shift();
  saveStats();
  updateStats();

  $('#hand').innerHTML = hand.map((value, i) => tileMarkup(value, i, { disabled: true, picked: value === tile })).join('');
  const status = $('#exercise-status');
  status.textContent = result.title;
  status.className = `status ${result.grade}`;
  $('#answer').hidden = false;
  $('#next').hidden = false;
  $('#skip').hidden = true;
  setStep(true);

  // Ask the same authoritative grader which choices are equally best; do not derive a second score.
  const bestOptions = ranking.filter(item => gradeAnswer(ranking, item.tile).grade === 'perfect');
  $('#chosen-tile').textContent = TILE_LABELS[tile];
  $('#chosen-shanten').textContent = String(result.answer.shanten);
  $('#chosen-kinds').textContent = String(result.answer.kinds);
  $('#chosen-copies').textContent = String(result.answer.copies);
  $('#best-tiles').textContent = bestOptions.map(item => TILE_LABELS[item.tile]).join('、');
  $('#best-shanten').textContent = String(result.best.shanten);
  $('#best-kinds').textContent = String(result.best.kinds);
  $('#best-copies').textContent = String(result.best.copies);
  $('#feedback').textContent = result.grade === 'perfect'
    ? '依一般牌型的向聽與理論進張判準，這是並列最佳的選擇。'
    : result.grade === 'acceptable'
      ? `你的選擇仍為 ${result.answer.shanten} 向聽，但理論有效進張比最佳選擇少 ${result.best.copies - result.answer.copies} 張。`
      : `你的選擇為 ${result.answer.shanten} 向聽；較佳選擇可維持 ${result.best.shanten} 向聽。先比較向聽數，再比較有效進張。`;

  $('#rankings').innerHTML = ranking.map((item, index) => {
    const chosen = item.tile === tile;
    const optimal = item.shanten === result.best.shanten && item.copies === result.best.copies;
    return `<tr${chosen ? ' class="chosen"' : ''}>
      <td>${index + 1}</td>
      <td>${TILE_LABELS[item.tile]} ${chosen ? '<span class="pill">你的選擇</span>' : ''} ${optimal ? '<span class="pill green">最佳</span>' : ''}</td>
      <td>${item.shanten}</td><td>${item.kinds}</td><td>${item.copies}</td>
    </tr>`;
  }).join('');
  $('#draw-details').textContent = `你捨棄 ${TILE_LABELS[tile]} 後的有效進張：${drawList(result.answer.draws)}。`;
  $('#answer-heading').focus();
}

// Delegated handlers keep selection stable when the hand is regenerated.
$('#hand').addEventListener('click', event => {
  const button = event.target.closest('button[data-tile]');
  if (button && !button.disabled) submitAnswer(Number(button.dataset.tile));
});

$('#hand').addEventListener('keydown', event => {
  const button = event.target.closest('button[data-tile]');
  if (!button || button.disabled) return;
  const buttons = [...$('#hand').querySelectorAll('button[data-tile]')];
  const current = buttons.indexOf(button);
  const columns = window.matchMedia('(max-width: 345px)').matches ? 5
    : window.matchMedia('(max-width: 640px)').matches ? 6
      : window.matchMedia('(min-width: 1280px)').matches ? 17 : 9;
  const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  let target = null;
  if (Object.hasOwn(offsets, event.key)) target = Math.max(0, Math.min(buttons.length - 1, current + offsets[event.key]));
  if (event.key === 'Home') target = 0;
  if (event.key === 'End') target = buttons.length - 1;
  if (target !== null) {
    event.preventDefault();
    buttons[target].focus();
    buttons[target].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
});

$('#difficulty').addEventListener('change', event => {
  difficulty = event.target.value;
  drawNewHand();
});
$('#next').addEventListener('click', () => drawNewHand({ focusHand: true }));
$('#next-bottom').addEventListener('click', () => drawNewHand({ focusHand: true }));
$('#skip').addEventListener('click', () => drawNewHand({ focusHand: true }));
$('#clear-stats').addEventListener('click', () => {
  if (!confirm('確定清除這個瀏覽器的練習紀錄？此動作無法復原。')) return;
  stats.length = 0;
  // Clearing is an explicit user action, unlike silently overwriting corrupt data.
  storageHealth = 'ok';
  saveStats();
  updateStats();
});

updateStats();
drawNewHand();
