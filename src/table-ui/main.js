import { createSandboxSession, availableTableProfiles } from './session.js';
import { TableView, ReplayControls } from './view.js';
import { installTileFaceFallback } from '../tile-visuals.js';

const root = document.querySelector('#full-table-root');
const controls = document.querySelector('#full-table-navigation');
const safe = value => String(value ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let session;
let selection = null;
let busy = false;
let lastError = '';
let activePage = 'academy';
let timeline = null;
let replayIndex = 0;

function profiles() {
  return availableTableProfiles().map(p => '<option value="' +
    safe(p.profileId + '@' + p.ruleVersion) + '">' + safe(p.profileId) +
    ' · ' + safe(p.status) + '</option>').join('');
}
function renderEmpty() {
  return '<header class="table-heading"><div><span class="table-overline">PHASE 3 · EXPERIMENTAL</span>' +
    '<h1 id="table-heading" tabindex="-1">四人實戰</h1>' +
    '<p>已使用現有 Rules Engine 的配牌／摸打，尚無完整吃碰槓胡或正式三名 Bot。</p></div></header>' +
    '<section class="table-empty"><h2>建立實驗牌桌</h2>' +
    '<p>目前可以驗證四座位布局、17 張真實 SVG 與 Rules LegalAction 捨牌。' +
    '輪到 Bot 時將暫停，而不是由前端假造決策。</p>' +
    '<label for="table-profile">明確選擇 RuleProfile</label>' +
    '<select id="table-profile">' + profiles() + '</select>' +
    '<button type="button" class="primary" data-start-new ' +
    (availableTableProfiles().length ? '' : 'disabled') + '>開始實驗對局</button>' +
    (lastError ? '<p role="alert" class="table-warning">' + safe(lastError) + '</p>' : '') +
    '<p class="table-muted">實驗資料使用獨立儲存鍵；不覆寫 Academy v1/v3 作答紀錄。</p>' +
    '<button type="button" class="secondary" data-return-academy>返回課程</button></section>';
}
function activate(page, { focus = true } = {}) {
  activePage = page;
  document.body.dataset.tableView = page === 'academy' ? 'none' : page;
  if (root) root.hidden = page === 'academy';
  controls?.querySelectorAll('[data-table-nav]').forEach(button => {
    button.setAttribute('aria-current', button.dataset.tableNav === page ? 'page' : 'false');
  });
  if (page !== 'academy') {
    draw();
    if (focus) root?.querySelector('#table-heading, .table-replay h2, .table-empty h2')?.focus?.({ preventScroll: true });
  }
}
function draw() {
  if (!root) return;
  if (activePage === 'replay') {
    root.innerHTML = '<header class="table-heading"><h1 tabindex="-1" id="table-heading">牌局複盤</h1>' +
      '<span class="table-overline">正式資料驗證模式</span></header>' +
      ReplayControls(timeline, replayIndex);
    return;
  }
  const snapshot = session?.snapshot();
  root.innerHTML = snapshot ? TableView(snapshot, { selection, busy, error: lastError }) : renderEmpty();
}
async function startNew() {
  if (session.snapshot() && !window.confirm('確定重新開局？目前實驗對局會被取代。')) return;
  try {
    const profile = document.querySelector('#table-profile')?.value ??
      availableTableProfiles()[0]?.profileId + '@' + availableTableProfiles()[0]?.ruleVersion;
    const match = availableTableProfiles().find(p => p.profileId + '@' + p.ruleVersion === profile);
    if (!match) throw new Error('沒有已註冊且可用的四人 RuleProfile');
    session.start({ profileId: match.profileId, ruleVersion: match.ruleVersion });
    selection = null;
    lastError = '';
    timeline = null;
    activate('play');
  } catch (error) { lastError = error.message; draw(); }
}
async function submit(actionId) {
  const previous = session.snapshot();
  const action = previous?.view?.legalActions?.find(a => a.actionId === actionId);
  if (!action || action.actorSeat !== previous.view.audienceSeat ||
      action.expectedRevision !== previous.view.asOfEventSeq) {
    lastError = '原始動作已過期，已取消選擇。'; selection = null; draw(); return;
  }
  if (busy) return;
  busy = true;
  try {
    // Exact server/engine-issued fields only. No custom tileIds/state writes.
    session.submit({ actionId: action.actionId, actorSeat: action.actorSeat,
      expectedRevision: action.expectedRevision });
    selection = null;
    lastError = '';
    draw();
    await session.advanceBots();
  } catch (error) {
    selection = null;
    lastError = 'Rules / Bot 動作未執行：' + error.message;
  } finally { busy = false; draw(); }
}
async function openReplay() {
  lastError = '';
  timeline = null;
  replayIndex = 0;
  try { timeline = await session.replay(); }
  catch (error) { lastError = 'Replay API 無法驗證：' + error.message; }
  activate('replay');
}
function onClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-return-academy')) return activate('academy');
  if (button.hasAttribute('data-return-table')) return activate('play');
  if (button.hasAttribute('data-start-new')) return startNew();
  if (button.hasAttribute('data-show-replay')) return void openReplay();
  if (button.hasAttribute('data-pick-action')) {
    if (busy) return;
    // Only action ID, never numeric tile type, selects a physical tile.
    const actionId = button.dataset.pickAction;
    const view = session.snapshot()?.view;
    if (!view?.legalActions.some(a => a.kind === 'discard' &&
      a.actionId === actionId && a.expectedRevision === view.asOfEventSeq)) {
      lastError = '動作已過期，請重新選牌。'; selection = null;
    } else { selection = selection === actionId ? null : actionId; lastError = ''; }
    draw();
    if (selection) root.querySelector('[data-submit-action]')?.focus({ preventScroll: true });
    return;
  }
  if (button.hasAttribute('data-clear-selection')) { selection = null; draw(); return; }
  if (button.hasAttribute('data-submit-action')) return void submit(button.dataset.submitAction);
  if (button.hasAttribute('data-replay-first')) { replayIndex = 0; draw(); return; }
  if (button.hasAttribute('data-replay-prev')) { replayIndex = Math.max(0, replayIndex - 1); draw(); return; }
  if (button.hasAttribute('data-replay-next')) {
    replayIndex = Math.min((timeline?.frames?.length ?? 1) - 1, replayIndex + 1); draw();
  }
}
function init() {
  if (!root || !controls) return;
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  session = createSandboxSession({ storage });
  try { session.restore(); }
  catch (error) { lastError = '無法驗證歷史對局：' + error.message; }
  installTileFaceFallback(root);
  root.addEventListener('click', onClick);
  root.addEventListener('change', event => {
    if (event.target.matches('[data-replay-jump]')) {
      const index = Number(event.target.value);
      if (Number.isInteger(index) && index >= 0 && index < (timeline?.frames.length ?? 0)) {
        replayIndex = index; draw();
      }
    }
  });
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-table-nav]');
    if (!button) return;
    if (button.dataset.tableNav === 'replay') void openReplay();
    else activate(button.dataset.tableNav);
  });
  window.addEventListener('pageshow', () => { if (activePage !== 'academy') draw(); });
  draw();
}
init();
