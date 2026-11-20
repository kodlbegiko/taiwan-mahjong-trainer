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
  if (t === null) return '<span class="table-flower table-hand-flower" role="img" aria-label="'+escapeHtml(tile?.flowerCode ?? '花牌')+'">花</span>';
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
  const ids=action.tileIds??[];
  const extra=ids.map(id=>{
    const type=typeFromTile(id);
    return type===null ? (typeof id==='string'&&id.startsWith('f:')?
      id.slice(2).split(':')[0]:'花牌') : tileAccessibleName(type);
  });
  const reason=action.legalityBasis?.reasonCodes?.[0];
  const kind=action.kind==='kong'?
    (reason==='CONCEALED_KONG'?'暗槓':reason==='ADDED_KONG'?'加槓':'明槓'):
    action.kind==='win'?(reason==='SELF_DRAW_WIN'?'自摸胡牌':'胡牌'):
    (ACTIONS[action.kind]??action.kind);
  // Distinguish multiple physically different combinations without fabricating IDs.
  const physical=action.kind==='chi'&&ids.length?' ['+ids.join(', ')+']':'';
  return kind+(action.kind!=='discard'&&extra.length?' · '+extra.join('、'):'')+physical;
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
export function TableView(snapshot,{selection=null,busy=false,error='',botStatus=''}={}) {
  if(!snapshot)return '';
  const {view,profile,wallRemaining,botConnected,replayConnected,storageWarning,replayWarning}=snapshot;
  const opponents=new Map(view.opponents.map(p=>[p.seat,p]));
  const actions=view.legalActions.filter(a=>a.actorSeat===view.audienceSeat &&
    a.expectedRevision===view.asOfEventSeq&&typeof a.actionId==='string');
  const humanCanAct=actions.length>0;
  const ended=view.round.phase==='settled';
  const claim=view.round.phase==='claim_window';
  const phaseLabel=snapshot.paused?'對局已暫停':ended?'本局已結束':humanCanAct?
    (claim?'請回應合法宣告':'輪到你'):botConnected?'等待三位 Bot':'等待 Bot API';
  return '<header class="table-heading"><div><span class="table-overline">EXPERIMENTAL / '+
    escapeHtml(profile.ruleVersion)+'</span><h1 id="table-heading" tabindex="-1">四人牌桌</h1>'+
    '<p>Rules Engine 決定牌局、宣告與結算；此規則與台數政策均未取得完整台灣通用驗證。</p></div>'+
    '<div class="table-header-tools"><span class="table-version">Revision '+
    view.asOfEventSeq+'</span><button type="button" class="secondary" data-start-new>重新開局</button></div></header>'+
    '<div class="table-facts"><span>規則：'+escapeHtml(profile.profileId)+
    '</span><span>階段：'+escapeHtml(view.round.phase)+
    '</span><span>莊家：'+SEATS[view.round.dealerSeat]+
    '</span><span>行動席：'+(ended?'結束':SEATS[view.round.currentSeat])+
    '</span><span>牌山剩餘：'+wallRemaining+' 張</span>'+
    '<span data-table-physical-count="'+view.self.concealed.length+'">實體手牌：'+
      view.self.concealed.length+' 張</span>'+
    '<span data-table-discard-count="'+actions.filter(a=>a.kind==='discard').length+
      '">合法捨牌：'+actions.filter(a=>a.kind==='discard').length+' 種</span>'+
    '<span data-table-legal-count="'+actions.length+'">可執行動作：'+
      actions.length+' 種</span></div>'+
    (storageWarning?'<p role="status" class="table-warning">'+escapeHtml(storageWarning)+'</p>':'')+
    (replayWarning?'<p role="status" class="table-warning">'+escapeHtml(replayWarning)+'</p>':'')+
    (error?'<p role="alert" class="table-warning">'+escapeHtml(error)+'</p>':'')+
    '<div class="table-grid" aria-label="四人牌桌公開資訊">'+
    OpponentSeat(opponents.get(2),view.round.currentSeat,view.round.dealerSeat)+
    OpponentSeat(opponents.get(3),view.round.currentSeat,view.round.dealerSeat)+
    '<div class="table-felt" aria-live="polite"><strong>'+phaseLabel+
    '</strong><span>'+escapeHtml(botStatus||lastEvent(view.publicEvents))+
    '</span><small>僅顯示當下的公開牌面與本人手牌</small></div>'+
    OpponentSeat(opponents.get(1),view.round.currentSeat,view.round.dealerSeat)+'</div>'+
    PlayerHand(view.self,actions,selection)+
    (ended?'<section class="table-actions"><h3>正式 Rules 已結算本局</h3></section>':
      humanCanAct?ActionBar(actions,selection,busy||snapshot.paused):
        '<section class="table-actions" aria-label="等待其他玩家"><h3>'+
        (botConnected?'三名 Bot 自動執行中':'Bot API 尚未連接')+'</h3><p>'+
        (botConnected?'請等待正式 Controller 的合法回合與宣告，不會跳過關鍵 Claim。':
          '目前僅供 Sandbox 摸打驗證。')+'</p>'+
        (botConnected&&!busy?'<button type="button" data-continue-bots class="primary">繼續 Bot</button>':'')+
        '</section>')+
    (claim?'<p class="table-muted">Claim Window：只顯示本人此版 PlayerView 的有效合法宣告；他家意圖不公開。</p>':'')+
    '<p class="table-muted">'+
      (profile.scoringPolicy?.configRef==='tw16-minimal-tai-v1'?
        '計分為 tw16-minimal-tai-v1 實驗性簡化台數，不代表台灣通用台制。':
        '此 Sandbox 不具正式胡牌計分能力。')+
    (replayConnected?' 已建立官方 Replay 歷史封存。':' 尚無完成的 Replay。')+'</p>'+
    RoundSummary(snapshot.result)+
    '<div class="table-footer-controls">'+
    (botConnected&&!ended?'<button type="button" class="secondary" data-'+
      (snapshot.paused?'resume-bots':'pause-bots')+'>'+
      (snapshot.paused?'繼續 Bot／玩家':'暫停 Bot')+'</button>':'')+
    '<button type="button" class="secondary" data-show-replay>'+
    '查看牌局複盤</button><button type="button" class="secondary" data-return-academy>返回課程學院</button></div>';
}
/**
 * Official end-of-round summary only. Unknown or unverified results do not
 * become wins, tai, scores or settlement merely because the UI can display them.
 */
export function RoundSummary(result){
  const summary=result?.source==='rules'&&result?.experimental===true?
    result.publicSummary:result?.verified===true?result.publicSummary:null;
  if(!summary||typeof summary!=='object')return '';
  const winners=Array.isArray(summary.winnerSeats)?summary.winnerSeats.filter(x=>
    Number.isInteger(x)&&x>=0&&x<4).map(x=>SEATS[x]):[];
  const score=Array.isArray(summary.scoreDelta)&&summary.scoreDelta.length===4?
    summary.scoreDelta:null;
  return '<section class="table-round-summary" aria-label="Rules 局後結果">'+
    '<h2>局後結算 · '+(result.experimental?'EXPERIMENTAL':'正式來源')+'</h2>'+
    '<p>結果：'+escapeHtml(summary.outcome??'未提供')+'</p>'+
    '<p>勝方：'+escapeHtml(winners.join('、')||'流局／無')+'</p>'+
    (summary.winMethod?'<p>胡牌方式：'+escapeHtml(summary.winMethod)+'</p>':'')+
    (summary.pattern?'<p>官方牌型／台數項目：'+escapeHtml(JSON.stringify(summary.pattern))+'</p>':'')+
    (Number.isInteger(summary.tai)?'<p>實驗台數：'+summary.tai+'</p>':'')+
    (score?'<p>四家分數變化：'+score.map((x,i)=>SEATS[i]+' '+x).join(' / ')+'</p>':'')+
    '<p>計分政策：'+escapeHtml(summary.scoringPolicy??'未提供')+'</p>'+
    (Number.isInteger(summary.eventCount)?'<p>牌局事件數：'+summary.eventCount+'</p>':'')+
    (result.experimental?'<p class="table-warning">此為實驗性簡化計分，不可視為通用台灣麻將正式台數。</p>':'')+
    '</section>';
}
/** Render historical PlayerView's open information, not today's game state. */
function ReplayPublicTable(view) {
  if (!view || !Array.isArray(view.opponents) || view.opponents.length !== 3 ||
    view.opponents.some(p => Object.hasOwn(p, 'concealed')) || !view.self ||
    !Array.isArray(view.self.concealed)) return '<p>當時牌桌資訊無法驗證。</p>';
  const opponents = new Map(view.opponents.map(p => [p.seat, p]));
  if (![1, 2, 3].every(s => opponents.has(s))) return '<p>當時座位資料不完整。</p>';
  return '<div class="table-grid table-history-grid" aria-label="歷史各家公開牌河與副露">' +
    OpponentSeat(opponents.get(2), view.round?.currentSeat, view.round?.dealerSeat) +
    OpponentSeat(opponents.get(3), view.round?.currentSeat, view.round?.dealerSeat) +
    '<div class="table-felt"><strong>歷史事件 ' + escapeHtml(view.asOfEventSeq) +
    '</strong><small>僅展示 Replay API 的歷史快照</small></div>' +
    OpponentSeat(opponents.get(1), view.round?.currentSeat, view.round?.dealerSeat) +
    '</div><section class="table-replay-self"><h3>當時你的公開牌河、副露與花牌</h3>' +
    riverSection(view.self.river ?? []) + meldSection(view.self.melds ?? []) +
    flowersSection(view.self.flowers ?? []) + '</section>';
}
export function ReplayControls(timeline,index,externalFrame=null){
  const valid=timeline?.verified===true;
  const length=Number.isInteger(timeline?.total)?timeline.total:timeline?.frames?.length??0;
  const frame=externalFrame??timeline?.frames?.[index];
  if(!valid||length<1||!frame?.view){
    return '<section class="table-empty" aria-label="複盤不可用"><h2>牌局複盤尚未開放</h2>'+
      '<p>僅在正式 Replay Service 驗證成功並提供歷史 PlayerView 時可查看；'+
      '不從現有牌局推造歷史資料或大師失誤分數。</p>'+
      '<button type="button" class="secondary" data-return-table>返回牌桌</button></section>';
  }
  const own=frame.view.self?.concealed??[];
  const options=frame.legalActions??frame.view.legalActions??[];
  const findings=frame.findings??[];
  const analysis=frame.analysis;
  return '<section class="table-replay" aria-label="正式牌局複盤">'+
    '<h2>逐事件歷史複盤</h2><p>歷史 PlayerView · 事件 '+(frame.asOfEventSeq??(index+1))+' / '+(timeline.manifest?.eventCount??length)+
    ' · '+escapeHtml(timeline.manifest?.completionStatus??'來源已驗證')+'</p>'+
    '<div class="table-replay-controls"><button type="button" data-replay-first '+
    (index===0?'disabled':'')+'>開局</button><button type="button" data-replay-prev '+
    (index===0?'disabled':'')+'>上一事件</button><label for="table-replay-jump">事件</label>'+
    '<select id="table-replay-jump" data-replay-jump aria-label="跳至指定事件">'+
    Array.from({length},(_,i)=>'<option value="'+i+'"'+(i===index?' selected':'')+
      '>#'+(timeline.boundaries?.[i]??(i+1))+'</option>').join('')+'</select>'+
    '<button type="button" data-replay-next '+(index===length-1?'disabled':'')+
    '>下一事件</button></div>'+
    ReplayPublicTable(frame.view)+
    '<h3>當時你的手牌</h3><div class="table-hand table-replay-hand">'+
    own.map(x=>tileSpan(x)).join('')+'</div>'+
    '<h3>當時 Rules 合法選項</h3><p>'+
    (options.length?options.map(actionName).map(escapeHtml).join('、'):'無合法選項')+'</p>'+
    '<h3>策略解說與 CoachingFinding</h3>'+
    (analysis?'<p>策略分析依據為歷史資訊，建議屬啟發式，不構成已驗證失誤評分。</p>'+
      (analysis.limitations?.length?'<p>限制：'+escapeHtml(analysis.limitations.join('；'))+'</p>':''):
      '<p>本事件無可授權的玩家決策分析。</p>')+
    (findings.length?findings.map(x=>'<p>'+escapeHtml(x.kind)+
       ' · '+escapeHtml(x.rationale??'證據不完整')+
       ' · '+escapeHtml(x.verificationStatus??'未驗證')+'</p>').join(''):
      '<p>目前無可驗證的 CoachingFinding；不提供虛構錯誤分數。</p>')+
    '<button type="button" class="secondary" data-return-table>返回牌桌</button></section>';
}
