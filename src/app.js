import { TILE_LABELS, tileClass } from './tiles.js';
import { gradeAnswer } from './practice.js';
import { explainDiscard, analyzeStructure } from './analysis/explain.js';
import { createExercise, EXERCISE_SCHEMA_VERSION, SCORING_VERSION } from './training/exercises.js';
import { createDecisionRecord, RECORD_SCHEMA_VERSION } from './training/records.js';
import { createLocalTrainingStore } from './storage/local.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, emptyArchive, importTrainingJSON } from './storage/archive.js';

const $ = selector => document.querySelector(selector);
const MODES = Object.freeze({
  discard: { title: '何切練習', instruction: '點選你想捨出的牌，立即比較向聽與有效進張。', hand: '摸牌後 17 張 · 點牌立即作答' },
  tenpai: { title: '聽牌判斷', instruction: '從 34 種牌中選出所有可以胡牌的張數；可能有不只一種。', hand: '聽牌狀態 16 張 · 從下方複選聽張' },
  multi_wait: { title: '多面聽訓練', instruction: '辨認多種胡牌張，選出完整的等待集合。', hand: '多面聽 16 張 · 複選全部胡牌張' },
});
const LABELS = { perfect: '完全正確', acceptable: '部分正確', improve: '需要再練習' };
const ROLE_LABELS = { meld: '面子', head: '將眼', taatsu: '搭子', isolated: '孤張' };
const KIND_LABELS = { triplet: '刻子', sequence: '順子', pair: '對子', consecutive: '兩面候選', gap: '嵌張候選', isolated: '孤張' };

let mode = 'discard';
let difficulty = 'intermediate';
let exercise = null;
let finished = false;
let startedAt = 0;
let selectedWaits = new Set();
let storageCondition = 'ok';
let storageNotice = '';
let localStore;
let archive = emptyArchive();
let legacyOriginal = [];
let pendingWorker = null;
let installPrompt = null;

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tileName = tile => TILE_LABELS[tile] ?? '未知牌';
const tileNames = tiles => tiles.length ? tiles.map(tileName).join('、') : '無';

function createText(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items) || items.some(x => !x || !['perfect', 'acceptable', 'improve'].includes(x.grade)
      || !Number.isFinite(x.seconds) || x.seconds < 0 || typeof x.date !== 'string'
      || !Number.isFinite(Date.parse(x.date)))) throw new Error('v1 schema invalid');
    return items;
  } catch {
    storageNotice = '舊版 v1 紀錄無法完整讀取，原資料維持不變，不會自動覆寫。';
    return [];
  }
}

function initStorage() {
  let storage = null;
  try {
    // Inspect the current archive before allowing the adapter to write: a damaged
    // v3 key must never be silently replaced with an empty archive.
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    if (raw) importTrainingJSON(raw);
    storage = {
      getItem: key => localStorage.getItem(key),
      setItem: (key, value) => {
        try { localStorage.setItem(key, value); }
        catch (error) { storageCondition = 'blocked'; throw error; }
      },
    };
  } catch (error) {
    storageCondition = error instanceof SyntaxError || /封存|JSON|schemaVersion|紀錄|題目|不支援/.test(String(error))
      ? 'corrupt' : 'blocked';
    storage = null;
  }
  legacyOriginal = readLegacy();
  localStore = createLocalTrainingStore(storage);
  archive = localStore.load();
  displayStorageCondition();
}

function displayStorageCondition() {
  const notice = $('#storage-status');
  const issues = [];
  if (storageCondition === 'corrupt') issues.push('v3 訓練封存資料損毀，本次只使用記憶體；原始封存不會覆寫。');
  if (storageCondition === 'blocked') issues.push('瀏覽器儲存被拒絕或空間不足，本次紀錄僅保留到關閉頁面。');
  if (storageNotice) issues.push(storageNotice);
  notice.hidden = issues.length === 0;
  notice.textContent = issues.join(' ');
}

function getLegacyEntries() {
  return archive.legacySessions.length ? archive.legacySessions : legacyOriginal;
}

function updateProgress() {
  const legacy = getLegacyEntries();
  const records = archive.records;
  const total = legacy.length + records.length;
  const perfect = legacy.filter(x => x.grade === 'perfect').length + records.filter(x => x.grade === 'perfect').length;
  const discards = [...legacy.map(x => ({ grade: x.grade })), ...records.filter(x => x.taskType === 'discard')];
  const same = discards.filter(x => x.grade !== 'improve').length;
  const seconds = [...legacy.map(x => x.seconds), ...records.map(x => x.durationMs / 1000)];
  $('#stat-total').textContent = String(total);
  $('#stat-perfect').textContent = total ? `${Math.round(perfect / total * 100)}%` : '—';
  $('#stat-same').textContent = discards.length ? `${Math.round(same / discards.length * 100)}%` : '—';
  $('#stat-seconds').textContent = total ? `${(seconds.reduce((a, b) => a + b, 0) / total).toFixed(1)}s` : '—';
  displayStorageCondition();
  renderHistory();
}

function renderHistory() {
  const list = $('#history-list');
  list.replaceChildren();
  const legacyCount = getLegacyEntries().length;
  if (legacyCount) list.append(createText('p', `保留 ${legacyCount} 筆 V0.1 統計（舊格式無題目、選牌或完整答案）。`, 'legacy-note'));
  const items = archive.records.slice(-12).reverse();
  if (!items.length) list.append(createText('p', '目前尚無 V0.2 完整作答紀錄。', 'history-empty'));
  for (const record of items) {
    const details = document.createElement('details');
    details.className = 'history-entry';
    const summary = document.createElement('summary');
    const date = new Date(record.timestamp);
    summary.textContent = `${date.toLocaleString('zh-TW')} · ${MODES[record.taskType]?.title ?? record.taskType} · ${LABELS[record.grade]}`;
    details.append(summary);
    details.append(createText('p', `題號 ${record.exerciseId} · ${record.durationMs / 1000} 秒 · 分數 ${(record.score * 100).toFixed(0)}%`));
    details.append(createText('p', `手牌：${tileNames(record.exerciseSnapshot.hand)}`));
    details.append(createText('p', `你的答案：${Array.isArray(record.chosen) ? tileNames(record.chosen) : tileName(record.chosen)}`));
    details.append(createText('p', record.taskType === 'discard'
      ? `最佳捨牌：${tileNames(record.answerMetadata.optimalTiles)}`
      : `正確胡牌張：${tileNames(record.answerMetadata.expectedTiles)}`));
    details.append(createText('p', `Exercise v${record.exerciseSnapshot.schemaVersion} · Record v${record.schemaVersion} · ${record.scoringVersion}`));
    list.append(details);
  }
}

function tileMarkup(tile, index, { interactive = true, picked = false } = {}) {
  const label = tileName(tile);
  const suit = tile < 9 ? '萬' : tile < 18 ? '筒' : tile < 27 ? '索' : '字';
  const contents = `<span aria-hidden="true">${tile < 27 ? label.slice(0, 1) : label}</span><small aria-hidden="true">${suit}</small>`;
  if (!interactive) return `<span class="tile ${tileClass(tile)}${picked ? ' picked' : ''}" role="img" aria-label="第 ${index + 1} 張：${label}">${contents}</span>`;
  return `<button type="button" class="tile ${tileClass(tile)}" data-tile="${tile}" data-index="${index}" aria-label="第 ${index + 1} 張：${label}；按下即捨牌並評分">${contents}</button>`;
}

function updateSteps(reviewing) {
  const decide = $('#step-decide'), review = $('#step-review');
  decide.className = reviewing ? 'is-done' : 'is-current';
  review.className = reviewing ? 'is-current' : '';
  $('#step-repeat').className = '';
  decide.removeAttribute('aria-current');
  review.removeAttribute('aria-current');
  (reviewing ? review : decide).setAttribute('aria-current', 'step');
}

function renderWaitPicker() {
  const counts = Array(34).fill(0);
  for (const tile of [...exercise.hand, ...exercise.visibleTiles]) counts[tile]++;
  $('#wait-options').innerHTML = TILE_LABELS.map((_, tile) => {
    const unavailable = counts[tile] === 4;
    return `<button type="button" class="wait-tile tile ${tileClass(tile)}" data-wait="${tile}" aria-pressed="false" aria-label="${tileName(tile)}${unavailable ? '；手牌及明牌已經四張，不可摸' : '；切換選取'}" ${unavailable ? 'disabled' : ''}><span aria-hidden="true">${tile < 27 ? tileName(tile).slice(0, 1) : tileName(tile)}</span><small aria-hidden="true">${tile < 9 ? '萬' : tile < 18 ? '筒' : tile < 27 ? '索' : '字'}</small></button>`;
  }).join('');
  $('#wait-selected').textContent = '已選 0 種';
  $('#submit-waits').disabled = false;
}

function generateQuestion({ focusHand = false } = {}) {
  try {
    exercise = createExercise({ seed: newId(), index: 0, taskType: mode, level: difficulty });
    if (exercise.schemaVersion !== EXERCISE_SCHEMA_VERSION || exercise.answerRules.version !== SCORING_VERSION) {
      throw new Error('題目版本不是最新已驗證的版本');
    }
    selectedWaits = new Set();
    finished = false;
    startedAt = performance.now();
    const isDiscard = mode === 'discard';
    $('#practice-heading').textContent = MODES[mode].title;
    $('#mode-instruction').textContent = MODES[mode].instruction;
    $('#hand-description').textContent = MODES[mode].hand;
    $('#hand-count').textContent = `${exercise.hand.length} / ${isDiscard ? 17 : 16}`;
    $('#hand').setAttribute('aria-label', isDiscard ? '17 張手牌，選一張捨棄' : '16 張固定手牌，從下方選擇全部胡牌張');
    $('#hand').innerHTML = exercise.hand.map((tile, index) => tileMarkup(tile, index, { interactive: isDiscard })).join('');
    $('#wait-picker').hidden = isDiscard;
    if (!isDiscard) renderWaitPicker();
    $('#answer').hidden = true;
    $('#next').hidden = true;
    $('#skip').hidden = false;
    $('#explanation-panel').hidden = true;
    $('#exercise-status').textContent = isDiscard ? '請選一張捨牌，點選後立即評分。' : '請選出所有胡牌張，然後按確認聽張。';
    $('#exercise-status').className = 'status';
    updateSteps(false);
    if (focusHand) (isDiscard ? $('#hand button') : $('#wait-options button:not(:disabled)'))?.focus();
  } catch (error) {
    exercise = null;
    $('#hand').replaceChildren();
    $('#wait-picker').hidden = true;
    $('#exercise-status').textContent = '本題產生失敗，請略過再試。';
    $('#exercise-status').className = 'status improve';
    console.error('Failed to create exercise:', error);
  }
}

function reconcileExplanation(exp, ranking, grader) {
  if (exp.candidates.length !== ranking.length || exp.decision.trainingGrade !== grader.grade ||
      exp.selected.discard.tile !== grader.answer.tile) throw new Error('教學評分與正式題目不符');
  for (let i = 0; i < ranking.length; i++) {
    const a = ranking[i], b = exp.candidates[i];
    if (b.discard.tile !== a.tile || b.metrics.shanten !== a.shanten ||
      b.metrics.kinds !== a.kinds || b.metrics.copies !== a.copies ||
      JSON.stringify(b.metrics.draws.map(({ tile, count }) => ({ tile, count }))) !== JSON.stringify(a.draws)) {
      throw new Error('教學進張與 canonical ranking 不符');
    }
  }
}

function drawList(draws) {
  return draws.length ? draws.map(x => `${tileName(x.tile)} × ${x.count}`).join('、') : '無可降低向聽數的進張';
}

function describeGroup(group) {
  return `${KIND_LABELS[group.kind] ?? ROLE_LABELS[group.role] ?? '牌組'}：${group.labels.join('、')}`;
}

function renderStructure(target, structure) {
  target.replaceChildren();
  target.append(createText('p', structure.matchesCanonical
    ? `正式向聽 ${structure.shanten}；以下為同分的候選拆解，不代表唯一拆法。`
    : `正式向聽 ${structure.shanten}；候選拆解分數 ${structure.structuralShanten} 未對齊，只可作牌組示意。`,
  structure.matchesCanonical ? '' : 'structural-warning'));
  for (const [i, decomp] of structure.decompositions.entries()) {
    const section = document.createElement('section');
    section.className = 'structure-item';
    section.append(createText('h5', `拆解 ${i + 1}`));
    for (const [name, groups] of [
      ['面子', decomp.melds], ['將眼', decomp.head ? [decomp.head] : []],
      ['搭子', decomp.taatsu], ['孤張', decomp.isolated],
    ]) section.append(createText('p', `${name}：${groups.length ? groups.map(describeGroup).join(' ｜ ') : '無'}`));
    target.append(section);
  }
  if (structure.truncated) target.append(createText('p', '另有未展示的同分拆解。'));
}

function renderTeaching(explanation) {
  $('#explanation-panel').hidden = false;
  const summary = $('#explanation-summary');
  summary.replaceChildren();
  for (const sentence of explanation.decision.explanations.beginner) summary.append(createText('p', sentence));
  const retained = explanation.decision.structuralTradeoff.retainedReference;
  if (retained) summary.append(createText('p', `比較保留 ${retained.label} 的可能結構角色：${retained.possibleRoles.join('、') || '未分類'}。此證據僅來自列出的候選拆解。`));
  const advanced = $('#explanation-advanced');
  advanced.replaceChildren();
  advanced.append(createText('h5', '正式判斷依據'));
  for (const sentence of explanation.decision.explanations.advanced) advanced.append(createText('p', sentence));
  advanced.append(createText('h5', '捨牌後 16 張的面子／搭子拆解'));
  const structure = document.createElement('div');
  renderStructure(structure, explanation.selected.structure);
  advanced.append(structure);
  $('#explanation-details').open = false;
}

function finishRecord(chosen, expectedGrade) {
  const options = { durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    timestamp: new Date().toISOString(), attemptId: `dr3-ui-${newId()}` };
  const preview = createDecisionRecord(exercise, chosen, options);
  if (preview.schemaVersion !== RECORD_SCHEMA_VERSION || preview.grade !== expectedGrade ||
      preview.exerciseSnapshot.id !== exercise.id) throw new Error('紀錄評分與題目不一致');
  // The official storage adapter writes the complete immutable exercise snapshot.
  const record = localStore.addDecision(exercise, chosen, options);
  archive = localStore.load();
  updateProgress();
  return record;
}

function revealResult(record) {
  finished = true;
  $('#answer').hidden = false;
  $('#next').hidden = false;
  $('#skip').hidden = true;
  $('#exercise-status').textContent = `${LABELS[record.grade]} · 本題已記錄`;
  $('#exercise-status').className = `status ${record.grade}`;
  updateSteps(true);
  $('#answer-heading').focus();
}

function submitDiscard(tile, pickedIndex) {
  if (!exercise || mode !== 'discard' || finished) return;
  try {
    const ranking = exercise.answer.ranking;
    const grading = gradeAnswer(ranking, tile);
    const explain = explainDiscard(exercise.hand, tile, { visibleTiles: exercise.visibleTiles, maxDecompositions: 4 });
    reconcileExplanation(explain, ranking, grading);
    const record = finishRecord(tile, grading.grade);
    $('#hand').innerHTML = exercise.hand.map((value, index) => tileMarkup(value, index, { interactive: false, picked: index === pickedIndex })).join('');
    $('#discard-comparison').hidden = false;
    $('#discard-rankings').hidden = false;
    $('#wait-answer').hidden = true;
    const best = ranking.filter(x => gradeAnswer(ranking, x.tile).grade === 'perfect');
    $('#chosen-tile').textContent = tileName(tile);
    $('#chosen-shanten').textContent = String(grading.answer.shanten);
    $('#chosen-kinds').textContent = String(grading.answer.kinds);
    $('#chosen-copies').textContent = String(grading.answer.copies);
    $('#best-tiles').textContent = tileNames(best.map(x => x.tile));
    $('#best-shanten').textContent = String(grading.best.shanten);
    $('#best-kinds').textContent = String(grading.best.kinds);
    $('#best-copies').textContent = String(grading.best.copies);
    $('#feedback').textContent = `${grading.title}。以下原因來自與評分相同的捨牌排序，並非勝率或台數估計。`;
    $('#rankings').innerHTML = ranking.map((item, index) => {
      const selected = item.tile === tile;
      const optimal = gradeAnswer(ranking, item.tile).grade === 'perfect';
      return `<tr${selected ? ' class="chosen"' : ''}><td>${index + 1}</td><td>${tileName(item.tile)} ${selected ? '<span class="pill">你的選擇</span>' : ''} ${optimal ? '<span class="pill green">並列最佳</span>' : ''}</td><td>${item.shanten}</td><td>${item.kinds}</td><td>${item.copies}</td></tr>`;
    }).join('');
    $('#draw-details').textContent = `你捨棄 ${tileName(tile)} 後的有效進張：${drawList(grading.answer.draws)}。`;
    renderTeaching(explain);
    revealResult(record);
  } catch (error) { showAnswerError(error); }
}

function submitWaits() {
  if (!exercise || mode === 'discard' || finished) return;
  try {
    const choice = [...selectedWaits].sort((a, b) => a - b);
    const preview = createDecisionRecord(exercise, choice, {
      durationMs: 0, timestamp: new Date().toISOString(), attemptId: `preview-${newId()}`,
    });
    const record = finishRecord(choice, preview.grade);
    $('#wait-options').querySelectorAll('button').forEach(button => { button.disabled = true; });
    $('#submit-waits').disabled = true;
    $('#discard-comparison').hidden = true;
    $('#discard-rankings').hidden = true;
    $('#wait-answer').hidden = false;
    const expected = exercise.answer.winningTiles;
    $('#wait-grade').textContent = `評分：${LABELS[record.grade]}（${(record.score * 100).toFixed(0)}%）；精確比對所有可胡張。`;
    $('#wait-expected').textContent = `正確胡牌張：${expected.map(x => `${tileName(x.tile)} × ${x.copies}`).join('、')}（合計 ${expected.reduce((sum, x) => sum + x.copies, 0)} 張理論剩餘牌）。`;
    $('#wait-chosen').textContent = `你的選擇：${tileNames(choice)}。`;
    $('#wait-diff').textContent = `漏選：${tileNames(record.answerMetadata.missedTiles)}；誤選：${tileNames(record.answerMetadata.extraTiles)}。`;
    $('#feedback').textContent = '此題只檢查摸入後能否完成一般五面子一將眼；「可胡張」不同於一般未聽牌時的有效進張。';
    $('#explanation-panel').hidden = false;
    $('#explanation-summary').replaceChildren(createText('p', `本題已經是 0 向聽。所有正確胡牌張及數量均取自正式 Exercise 答案，不是前端重新推算。`));
    $('#explanation-advanced').replaceChildren();
    $('#explanation-advanced').append(createText('h5', '16 張手牌的結構候選'));
    const structure = document.createElement('div');
    renderStructure(structure, analyzeStructure(exercise.hand));
    $('#explanation-advanced').append(structure);
    $('#explanation-details').open = false;
    revealResult(record);
  } catch (error) { showAnswerError(error); }
}

function showAnswerError(error) {
  $('#exercise-status').textContent = '題目評分或存檔發生錯誤，未展示可能矛盾的結果；請略過本題。';
  $('#exercise-status').className = 'status improve';
  console.error('Unable to grade or persist exercise:', error);
}

function arrowNavigation(event, selector) {
  const button = event.target.closest(selector);
  if (!button || button.disabled) return;
  const buttons = [...event.currentTarget.querySelectorAll(selector)].filter(x => !x.disabled);
  const current = buttons.indexOf(button);
  const firstRow = getComputedStyle(event.currentTarget).gridTemplateColumns;
  const columns = firstRow && firstRow !== 'none' ? firstRow.split(' ').length : 1;
  const offsets = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns };
  let next = null;
  if (Object.hasOwn(offsets, event.key)) next = Math.max(0, Math.min(buttons.length - 1, current + offsets[event.key]));
  if (event.key === 'Home') next = 0;
  if (event.key === 'End') next = buttons.length - 1;
  if (next !== null) {
    event.preventDefault();
    buttons[next].focus();
    buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function switchMode(nextMode) {
  if (!MODES[nextMode] || nextMode === mode) return;
  mode = nextMode;
  document.querySelectorAll('[data-mode]').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  generateQuestion();
}

function registerEvents() {
  document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.mode)));
  $('#difficulty').addEventListener('change', event => { difficulty = event.target.value; generateQuestion(); });
  $('#hand').addEventListener('click', event => {
    const button = event.target.closest('button[data-tile]');
    if (button && !button.disabled) submitDiscard(Number(button.dataset.tile), Number(button.dataset.index));
  });
  $('#hand').addEventListener('keydown', event => arrowNavigation(event, 'button[data-tile]'));
  $('#wait-options').addEventListener('click', event => {
    const button = event.target.closest('button[data-wait]');
    if (!button || button.disabled || finished) return;
    const tile = Number(button.dataset.wait);
    if (selectedWaits.has(tile)) selectedWaits.delete(tile);
    else selectedWaits.add(tile);
    button.setAttribute('aria-pressed', String(selectedWaits.has(tile)));
    button.classList.toggle('picked', selectedWaits.has(tile));
    $('#wait-selected').textContent = `已選 ${selectedWaits.size} 種：${tileNames([...selectedWaits].sort((a,b)=>a-b))}`;
  });
  $('#wait-options').addEventListener('keydown', event => arrowNavigation(event, 'button[data-wait]'));
  $('#submit-waits').addEventListener('click', submitWaits);
  $('#next').addEventListener('click', () => generateQuestion({ focusHand: true }));
  $('#next-bottom').addEventListener('click', () => generateQuestion({ focusHand: true }));
  $('#skip').addEventListener('click', () => generateQuestion({ focusHand: true }));
  $('#clear-stats').addEventListener('click', () => {
    if (!confirm('只清除 V0.2 本機作答與完整題目快照？舊版 v1/v2 紀錄保留，無法復原已刪除的 v3 作答。')) return;
    try {
      const updated = localStore.load();
      updated.exercises = updated.exercises.filter(x => x.schemaVersion !== EXERCISE_SCHEMA_VERSION);
      updated.records = updated.records.filter(x => x.schemaVersion !== RECORD_SCHEMA_VERSION);
      localStore.save(updated);
      archive = localStore.load();
      updateProgress();
    } catch (error) { showAnswerError(error); }
  });
  $('#export-history').addEventListener('click', () => {
    try {
      const blob = new Blob([localStore.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'taiwan-mahjong-training-v3.json';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { storageNotice = `匯出失敗：${error.message}`; displayStorageCondition(); }
  });
}

async function setupPWA() {
  const notice = $('#offline-status');
  const update = () => {
    notice.textContent = navigator.onLine
      ? '訓練可在裝置內執行。首次連線完成快取後可離線開啟，資料只存在此瀏覽器。'
      : '目前離線：若已成功快取完整版本，訓練仍可繼續。';
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    notice.textContent = '離線安裝需要 HTTPS 或 localhost 及支援 Service Worker 的瀏覽器。';
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { scope: new URL('../', import.meta.url).pathname });
    const showUpdate = worker => { pendingWorker = worker; $('#update-app').hidden = !worker || !navigator.serviceWorker.controller; };
    showUpdate(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate(installing);
      });
    });
    $('#update-app').addEventListener('click', () => pendingWorker?.postMessage({ type: 'SKIP_WAITING' }));
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshed) { refreshed = true; location.reload(); }
    });
    // Explicitly verify that a worker controls the page; registration alone is not an offline guarantee.
    if (!navigator.serviceWorker.controller) notice.textContent = '初次安裝快取中；重新載入後可使用離線模式。';
    registration.update().catch(() => {});
  } catch (error) {
    notice.textContent = '離線快取註冊失敗；目前仍可在連線狀態下訓練。';
    console.warn('Service Worker registration failed', error);
  }
}
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event; $('#install-app').hidden = false;
});
$('#install-app').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#install-app').hidden = true;
});
window.addEventListener('appinstalled', () => { $('#install-app').hidden = true; });

initStorage();
registerEvents();
updateProgress();
generateQuestion();
setupPWA();
