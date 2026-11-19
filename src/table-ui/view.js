/** Pure public-view rendering. Never receives a private GameState. */
import { tileAccessibleName, tileFaceMarkup } from '../tile-visuals.js';

const SEATS = Object.freeze(['你', '下家', '對家', '上家']);
const ACTIONS = Object.freeze({
  draw: '摸牌', discard: '捨牌', chi: '吃', chow: '吃',
  pong: '碰', pung: '碰', kong: '槓', exposed_kong: '明槓',
  concealed_kong: '暗槓', add_kong: '加槓', win: '胡牌',
  ron: '榮和', tsumo: '自摸', pass: '放棄宣告', replace_flower: '補花',
});
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function typeFromTile(tile) {
  if (Number.isInteger(tile?.tileType) && tile.tileType >= 0 && tile.tileType <= 33) return tile.tileType;
  const match = /^t:(0|[1-9]|[12][0-9]|3[0-3]):[0-3]$/.exec(tile?.id ?? tile?.tileId ?? tile);
  return match ? Number(match[1]) : null;
}
function tileSpan(tile, className = '') {
  const t = typeFromTile(tile);
  if (t === null) return '<span class="table-flower" aria-label="花牌（無可用 SVG）">花</span>';
  return '<span class="table-tile tile ' + className + '" role="img" aria-label="' +
    escapeHtml(tileAccessibleName(t)) + '">' + tileFaceMarkup(t) + '</span>';
}
function tileButton(tile, action, selected) {
  const t = typeFromTile(tile);
  if (t === null) return '';
  return '<button type="button" class="table-tile tile table-hand-tile' +
    (selected ? ' is-selected' : '') + '" aria-pressed="' + (selected ? 'true' : 'false') +
    '" aria-label="' + escapeHtml(tileAccessibleName(t)) +
    '；' + (action ? '選取後確認捨牌' : '目前不能捨牌') + '" ' +
    (action ? 'data-pick-action="' + escapeHtml(action.actionId) + '"' : 'disabled') +
    '>' + tileFaceMarkup(t) + '</button>';
}

function meldSection(melds) {
  return '<div class="table-melds" aria-label="公開副露">' +
    (melds.length ? melds.map(m =>
      '<div class="table-meld" aria-label="' + escapeHtml(m.kind ?? '副露') + '">' +
      (m.tileIds ?? []).map(tile => tileSpan(tile)).join('') + '</div>').join('')
      : '<span class="table-quiet">副露 0</span>') + '</div>';
}
function flowersSection(flowers) {
  return '<div class="table-flowers" aria-label="公開花牌">' +
    (flowers.length ? flowers.map(f => '<span class="table-flower">' +
      escapeHtml(f.flowerCode ?? '花') + '</span>').join('') :
      '<span class="table-quiet">花牌 0</span>') + '</div>';
}
function riverSection(river) {
  return '<div class="table-river" role="group" aria-label="牌河">' +
    (river.length ? river.map((d, i) => tileSpan(d, i === river.length - 1 ? 'table-last-discard' : '')).join('')
      : '<span class="table-quiet">尚未捨牌</span>') + '</div>';
}
export function OpponentSeat(person, currentSeat, dealerSeat) {
  const active = currentSeat === person.seat;
  return '<section class="table-opponent table-seat-' + person.seat +
    (active ? ' table-seat-active' : '') + '" aria-label="' + SEATS[person.seat] + '">' +
    '<div class="table-seat-heading"><strong>' + SEATS[person.seat] +
    (dealerSeat === person.seat ? ' · 莊家' : '') + '</strong><span>' +
    (active ? '行動中' : '等待') + '</span></div>' +
    '<div class="table-concealed" aria-label="暗牌僅顯示張數">' +
    escapeHtml(person.concealedCount) + ' 張暗牌</div>' +
    meldSection(person.melds ?? []) + flowersSection(person.flowers ?? []) +
    riverSection(person.river ?? []) + '</section>';
}
export function PlayerHand(self, legalActions, selectedId) {
  const byPhysicalId = new Map(legalActions.filter(a => a.kind === 'discard' && a.tileIds?.length === 1)
    .map(a => [a.tileIds[0], a]));
  return '<div class="table-self"><div class="table-seat-heading"><strong>你的手牌 · ' +
    self.concealed.length + ' 張</strong><span>點牌選擇，二次確認</span></div>' +
    '<div class="table-hand" role="group" aria-label="自己的手牌">' +
    self.concealed.map(tile => tileButton(tile, byPhysicalId.get(tile.id), selectedId === byPhysicalId.get(tile.id)?.actionId)).join('') +
    '</div>' + meldSection(self.melds ?? []) + flowersSection(self.flowers ?? []) + riverSection(self.river ?? []) +
    '</div>';
}
function actionName(action) {
  const extra = (action.tileIds ?? []).map(id => {
    const type = typeFromTile(id);
    return type === null ? '花牌' : tileAccessibleName(type);
  });
  return (ACTIONS[action.kind] ?? action.kind) + (action.kind !== 'discard' && extra.length ? ' · ' + extra.join('、') : '');
}
export function ActionBar(legalActions, selectedId, busy) {
  const chosen = legalActions.find(a => a.kind === 'discard' && a.actionId === selectedId);
  const declarationActions = legalActions.filter(a => a.kind !== 'discard');
  return '<section class="table-actions" aria-label="合法動作"><div class="table-actions-heading">' +
    '<h3>可操作動作</h3><span>僅顯示 Rules Engine 回傳的 LegalAction</span></div>' +
    (chosen ? '<div class="table-selected"><span>已選：' + escapeHtml(actionName(chosen)) +
      '</span><button type="button" data-submit-action="' + escapeHtml(chosen.actionId) +
      '" class="primary" ' + (busy ? 'disabled' : '') + '>確認捨牌</button>' +
      '<button type="button" data-clear-selection class="secondary">取消</button></div>'
      : '<p class="table-quiet">請點選一張手牌；捨牌不會立即送出。</p>') +
    '<div class="table-action-buttons">' + declarationActions.map(a =>
      '<button type="button" class="secondary" data-submit-action="' +
      escapeHtml(a.actionId) + '" ' + (busy ? 'disabled' : '') +
      '>' + escapeHtml(actionName(a)) + '</button>').join('') + '</div>' +
    (!declarationActions.length && !chosen ? '<p class="table-muted">目前無其他合法宣告，未提供的吃／碰／槓／胡／過操作一律不顯示。</p>' : '') +
    '</section>';
}
function lastEvent(events) {
  if (!events.length) return '等待 Rules Engine 發出事件';
  const e = events[events.length - 1];
  const prefix = e.actorSeat === undefined ? '牌局' : SEATS[e.actorSeat];
  return prefix + ' · ' + (e.type === 'deal' ? '配牌' : (ACTIONS[e.type] ?? e.type)) + ' · 事件 ' + e.seq;
}
export function TableView(snapshot, { selection = null, busy = false, error = '' } = {}) {
  if (!snapshot) return '';
  const { view, profile, wallRemaining, botConnected, replayConnected, storageWarning } = snapshot;
  const opponents = new Map(view.opponents.map(p => [p.seat, p]));
  const actions = view.legalActions.filter(a => a.actorSeat === view.audienceSeat &&
    a.expectedRevision === view.asOfEventSeq && typeof a.actionId === 'string');
  const currentlyHuman = view.round.currentSeat === view.audienceSeat;
  const claim = actions.filter(a => a.kind !== 'discard');
  return '<header class="table-heading"><div><span class="table-overline">EXPERIMENTAL / ' +
    escapeHtml(profile.ruleVersion) + '</span><h1 id="table-heading" tabindex="-1">四人牌桌</h1>' +
    '<p>Rules Engine 驅動的四座位公開局面；不是正式完整台麻規則。</p></div>' +
    '<div class="table-header-tools"><span class="table-version">Revision ' +
    view.asOfEventSeq + '</span><button type="button" class="secondary" data-start-new>重新開局</button></div></header>' +
    '<div class="table-facts"><span>規則：' + escapeHtml(profile.profileId) +
    '</span><span>莊家：' + SEATS[view.round.dealerSeat] +
    '</span><span>輪到：' + SEATS[view.round.currentSeat] +
    '</span><span>牌山剩餘：' + wallRemaining + ' 張</span></div>' +
    (storageWarning ? '<p class="table-warning" role="status">' + escapeHtml(storageWarning) + '</p>' : '') +
    (error ? '<p class="table-warning" role="alert">' + escapeHtml(error) + '</p>' : '') +
    '<div class="table-grid" aria-label="四人牌桌公開資訊">' +
    OpponentSeat(opponents.get(2), view.round.currentSeat, view.round.dealerSeat) +
    OpponentSeat(opponents.get(3), view.round.currentSeat, view.round.dealerSeat) +
    '<div class="table-felt" aria-label="牌桌中央狀態"><strong>' +
    (currentlyHuman ? '輪到你' : botConnected ? '等待正式 Bot' : '等待 Bot API') +
    '</strong><span>' + escapeHtml(lastEvent(view.publicEvents)) +
    '</span><small>僅顯示公開資訊 · 不顯示其他玩家暗牌</small></div>' +
    OpponentSeat(opponents.get(1), view.round.currentSeat, view.round.dealerSeat) +
    '</div>' +
    PlayerHand(view.self, actions, selection) +
    (currentlyHuman ? ActionBar(actions, selection, busy) :
      '<section class="table-actions" aria-label="等待其他玩家"><h3>目前輪到' +
      SEATS[view.round.currentSeat] + '</h3><p>' +
      (botConnected ? 'Bot 正由正式 API 決策；每步仍須符合 LegalAction。'
        : '目前尚未整合正式 Bot API，牌局已安全暫停。UI 不會自行替 Bot 摸牌或出牌。') +
      '</p></section>') +
    '<p class="table-muted">吃／碰／槓／胡與結算必須由正式 Rules Engine 開放。' +
    (replayConnected ? '已連接正式 Replay Provider。' : '目前沒有正式 Replay Provider。') +
    '</p>' +
    '<div class="table-footer-controls"><button type="button" class="secondary" data-show-replay>查看牌局複盤</button>' +
    '<button type="button" class="secondary" data-return-academy>返回課程學院</button></div>';
}
export function ReplayControls(timeline, index) {
  if (!timeline?.verified || !Array.isArray(timeline.frames)) {
    return '<section class="table-empty" aria-label="複盤不可用"><h2>牌局複盤尚未開放</h2>' +
      '<p>目前沒有經正式 Replay API 驗證的事件快照與 CoachingFinding。' +
      '不會使用當前手牌偽裝歷史牌局，也不產生策略評分。</p>' +
      '<button type="button" class="secondary" data-return-table>返回牌桌</button></section>';
  }
  const frame = timeline.frames[index];
  const own = frame?.view?.self?.concealed ?? [];
  const options = frame?.legalActions ?? frame?.view?.legalActions ?? [];
  return '<section class="table-replay" aria-label="正式牌局複盤"><h2>逐巡複盤</h2>' +
    '<div class="table-replay-controls"><button type="button" data-replay-first ' +
    (index === 0 ? 'disabled' : '') + '>開局</button><button type="button" data-replay-prev ' +
    (index === 0 ? 'disabled' : '') + '>上一巡</button><label>事件<select data-replay-jump>' +
    timeline.frames.map((f, i) => '<option value="' + i + '"' + (i === index ? ' selected' : '') +
      '>#' + (f.event?.seq ?? i) + ' ' + escapeHtml(f.event?.type ?? '狀態') + '</option>').join('') +
    '</select></label><button type="button" data-replay-next ' +
    (index === timeline.frames.length - 1 ? 'disabled' : '') + '>下一巡</button></div>' +
    '<h3>當時你的手牌</h3><div class="table-hand table-replay-hand">' +
    own.map(t => tileSpan(t)).join('') + '</div>' +
    '<h3>當時官方合法選項</h3><p>' +
    (options.length ? options.map(actionName).map(escapeHtml).join('、') : '無可用的合法選項') + '</p>' +
    '<h3>官方 CoachingFinding</h3><p>' +
    (frame.coachingFinding?.verified === true
      ? escapeHtml(frame.coachingFinding.summary ?? '官方已驗證，無文字解說')
      : '無法評估；尚無可驗證的決策品質分析') +
    '</p><button type="button" class="secondary" data-return-table>返回牌桌</button></section>';
}
