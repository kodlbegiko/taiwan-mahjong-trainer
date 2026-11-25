/** Pure public-view rendering. Never receives a private GameState. */
import { tileAccessibleName, tileFaceMarkup } from '../tile-visuals.js';

const SEATS = Object.freeze(['你', '下家', '對家', '上家']);
const ACTIONS = Object.freeze({
  draw: '摸牌', discard: '捨牌', chi: '吃', chow: '吃', kong_proposed: '加槓提案（等待規則裁定）',
  pong: '碰', pung: '碰', kong: '槓', exposed_kong: '明槓',
  concealed_kong: '暗槓', add_kong: '加槓', win: '胡牌',
  ron: '榮和', tsumo: '自摸', pass: '放棄宣告', replace_flower: '補花',
});
const escapeHtml = input => String(input ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function BotDifficultySelect(selected='Beginner') {
  const labels={Beginner:'Beginner（初級／歷史預設）',Intermediate:'Intermediate（中級）',Advanced:'Advanced（進階）'};
  return '<label for="table-bot-difficulty">三位 Bot 難度（新局生效）</label>'+
    '<select id="table-bot-difficulty" data-bot-difficulty-select>'+
    Object.entries(labels).map(([level,label])=>'<option value="'+level+'" '+
      (level===selected?'selected':'')+'>'+escapeHtml(label)+'</option>').join('')+'</select>';
}
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
function tileButton(tile, action, selected, drawn=false) {
  const t = typeFromTile(tile);
  if (t === null) return '<span class="table-flower table-hand-flower" role="img" aria-label="'+escapeHtml(tile?.flowerCode ?? '花牌')+'">花</span>';
  return '<button type="button" class="table-tile tile table-hand-tile' +
    (selected ? ' is-selected' : '') + (drawn?' table-fresh-draw':'') + '" aria-pressed="' + (selected ? 'true' : 'false') +
    '" aria-label="' + escapeHtml(tileAccessibleName(t)) + (drawn?'；剛摸到的牌':'') +
    '；' + (action ? '選取後確認捨牌' : '目前不能捨牌') + '" ' +
    (action ? 'data-pick-action="' + escapeHtml(action.actionId) + '"' : 'disabled') +
    '>' + tileFaceMarkup(t) + '</button>';
}

function meldSection(melds) {
  return '<div class="table-melds" role="group" aria-label="公開副露">' +
    (melds.length ? melds.map(m =>
      '<div class="table-meld" role="group" aria-label="' + escapeHtml(m.kind ?? '副露') + '">' +
      (m.tileIds ?? []).map(tile => tileSpan(tile)).join('') + '</div>').join('')
      : '<span class="table-quiet">副露 0</span>') + '</div>';
}
function flowersSection(flowers) {
  return '<div class="table-flowers" role="group" aria-label="公開花牌">' +
    (flowers.length ? flowers.map(f => '<span class="table-flower">' +
      escapeHtml(f.flowerCode ?? '花') + '</span>').join('') :
      '<span class="table-quiet">花牌 0</span>') + '</div>';
}
/** Identify the one newest public discard, only while it remains an unclaimed river tile.
 * No hidden draw/claim data or guessed seat is used. */
export function latestPublicDiscard(view) {
  if(!Array.isArray(view?.publicEvents))return null;
  const e=[...view.publicEvents].reverse().find(x=>x.type==='discard'&&x.visibility==='public'&&
    Number.isSafeInteger(x.seq)&&x.seq<=view.asOfEventSeq);
  if(!e||e.gameId!==view.gameId||!Number.isInteger(e.actorSeat)||e.actorSeat<0||e.actorSeat>3||
    typeof e.payload?.tileId!=='string'||typeFromTile(e.payload.tileId)===null)return null;
  const person=[view.self,...(view.opponents??[])].find(p=>p?.seat===e.actorSeat);
  const matches=(person?.river??[]).filter(d=>d.seq===e.seq&&d.tileId===e.payload.tileId&&!d.claimedByEventId);
  return matches.length===1?{seat:e.actorSeat,seq:e.seq,tileId:e.payload.tileId}:null;
}
function riverSection(river, latest=null, seat=null) {
  return '<div class="table-river" role="group" aria-label="牌河">' +
    (river.length ? river.map(d => tileSpan(d, latest&&latest.seat===seat&&d.seq===latest.seq&&
      d.tileId===latest.tileId&&!d.claimedByEventId?'table-last-discard':'')).join('')
      : '<span class="table-quiet">尚未捨牌</span>') + '</div>';
}
// Seat wind is relative to the dealer, not the prevailing round wind.
export function seatWind(seat,dealerSeat) {
  if(!Number.isInteger(seat)||seat<0||seat>3||!Number.isInteger(dealerSeat)||dealerSeat<0||dealerSeat>3)return '';
  return ['東','南','西','北'][(seat-dealerSeat+4)%4];
}
function seatMedallion(seat,dealerSeat){
  const wind=seatWind(seat,dealerSeat);
  return wind?'<span class="table-seat-medallion" data-seat-wind="'+wind+'" data-player-seat="'+seat+
    '" aria-label="門風：'+wind+'"'+(seat===dealerSeat?' data-dealer-seat="true"':'')+'>'+wind+'</span>':'';
}
export function OpponentSeat(person, currentSeat, dealerSeat, latest=null) {
  const active = currentSeat === person.seat;
  return '<section class="table-opponent table-seat-' + person.seat +
    (active ? ' table-seat-active' : '') + '" aria-label="' + SEATS[person.seat] + '">' +
    '<div class="table-seat-heading"><div class="table-seat-identity">'+seatMedallion(person.seat,dealerSeat)+
    '<strong>' + SEATS[person.seat] + (dealerSeat === person.seat ? ' · 莊家' : '') +
    '</strong></div><span class="table-seat-status"'+(active?' data-seat-turn="true"':'')+'>' +
    (active ? '行動席' : '等待') + '</span></div>' +
    '<div class="table-concealed" aria-label="暗牌僅顯示張數">' +
    '<span class="table-back-stack" aria-hidden="true">' +
    (Number.isSafeInteger(person.concealedCount)&&person.concealedCount>=0&&person.concealedCount<=18?
      '<i class="table-back-tile"></i>'.repeat(person.concealedCount):'') + '</span>' +
    '<span class="table-back-count">' + escapeHtml(person.concealedCount) + ' 張暗牌</span></div>' +
    '<div class="table-seat-extras">' + meldSection(person.melds ?? []) + flowersSection(person.flowers ?? []) + '</div>' +
    riverSection(person.river ?? [],latest,person.seat) + '</section>';
}
/** Conservative draw cue from two self-only PlayerViews. The projected draw
 * never contains a hidden tile ID. Only a unique newly owned tile can be marked.
 * No cue on initial restore, other seats, ambiguous batches or replacement draws
 * without a matching public draw event. This is presentation, not game evidence. */
export function observedOwnDraw(previous, view) {
  if(!previous||!view||previous.gameId!==view.gameId||previous.audienceSeat!==view.audienceSeat||
      previous.self?.seat!==view.audienceSeat||view.self?.seat!==view.audienceSeat||
      !Number.isSafeInteger(previous.asOfEventSeq)||!Number.isSafeInteger(view.asOfEventSeq)||
      view.asOfEventSeq<=previous.asOfEventSeq||view.round?.currentSeat!==view.audienceSeat||
      view.round?.phase!=='await_discard'||!Array.isArray(view.publicEvents)||
      !Array.isArray(previous.self.concealed)||!Array.isArray(view.self.concealed))return null;
  const events=view.publicEvents.filter(e=>e.gameId===view.gameId&&e.visibility==='public'&&
    Number.isSafeInteger(e.seq)&&e.seq>previous.asOfEventSeq&&e.seq<=view.asOfEventSeq&&e.actorSeat===view.audienceSeat);
  const draws=events.filter(e=>e.type==='draw'&&e.payload?.count===1);
  if(draws.length!==1||events.some(e=>e.seq>draws[0].seq&&['discard','claim','kong','kong_proposed','flower','win','settle'].includes(e.type)))return null;
  const prior=new Set(previous.self.concealed.map(t=>t.id));
  const now=view.self.concealed.map(t=>t.id);
  if(prior.size!==previous.self.concealed.length||new Set(now).size!==now.length)return null;
  const added=now.filter(id=>!prior.has(id));
  if(added.length!==1||typeFromTile(added[0])===null)return null;
  return {gameId:view.gameId,seat:view.audienceSeat,revision:view.asOfEventSeq,seq:draws[0].seq,tileId:added[0]};
}
export function PlayerHand(self, legalActions, selectedId, latest=null, drawnId=null, dealerSeat=null, currentSeat=null) {
  const byPhysicalId = new Map(legalActions.filter(a => a.kind === 'discard' && a.tileIds?.length === 1)
    .map(a => [a.tileIds[0], a]));
  const replacing=legalActions.some(a=>a.kind==='replace_flower');
  // Presentation order only. Keep every physical tile/action ID, and never mutate PlayerView.
  const ordered=[...self.concealed].sort((a,b)=>(typeFromTile(a)??34)-(typeFromTile(b)??34)||
    String(a.id).localeCompare(String(b.id),'en'));
  const active=self.seat===currentSeat;
  return '<div class="table-self'+(active?' table-self-active':'')+'"><div class="table-seat-heading">'+
    '<div class="table-seat-identity">'+seatMedallion(self.seat,dealerSeat)+'<strong>你的手牌 · ' +
    self.concealed.length + ' 張'+(self.seat===dealerSeat?' · 莊家':'')+'</strong></div><span'+
    (active?' class="table-seat-status" data-seat-turn="true"':'')+'>' +
    (replacing?'補花階段：先選擇合法補花操作':'點牌選擇，二次確認')+
    '</span></div>' +
    (drawnId?'<span class="table-fresh-label">剛摸到的牌已標記</span>':'')+
    '<div class="table-own-river"><span class="table-river-label">我的牌河</span>' + riverSection(self.river ?? [],latest,self.seat) + '</div>' +
    '<div class="table-hand" role="group" aria-label="自己的手牌">' +
    ordered.map(tile => tileButton(tile, byPhysicalId.get(tile.id), selectedId === byPhysicalId.get(tile.id)?.actionId,drawnId===tile.id)).join('') +
    '</div><div class="table-seat-extras">' + meldSection(self.melds ?? []) + flowersSection(self.flowers ?? []) + '</div>' +
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
    action.kind==='win'?(reason==='SELF_DRAW_WIN'?'自摸胡牌':reason==='ROB_ADDED_KONG_WIN'?'搶加槓胡牌':'胡牌'):
    (ACTIONS[action.kind]??action.kind);
  // Distinguish multiple physically different combinations without fabricating IDs.
  const physical=action.kind==='chi'&&ids.length?' ['+ids.join(', ')+']':'';
  return kind+(action.kind!=='discard'&&extra.length?' · '+extra.join('、'):'')+physical;
}
const DECLARATION_LABELS=Object.freeze({chi:'吃',pong:'碰',kong:'槓',win:'胡',pass:'過',draw:'摸',replace_flower:'補花'});
function declarationButton(a,busy) {
  const kind=Object.hasOwn(DECLARATION_LABELS,a.kind)?a.kind:'other';
  const title=actionName(a);
  const preview=(a.tileIds??[]).map(id=>typeFromTile(id)).filter(n=>n!==null);
  return '<button type="button" class="secondary table-declare-button" data-action-kind="'+kind+
    '" data-submit-action="'+escapeHtml(a.actionId)+'" aria-label="'+escapeHtml(title)+'" '+(busy?'disabled':'')+'>'+
    '<span class="table-declare-symbol" aria-hidden="true">'+(DECLARATION_LABELS[kind]??'宣告')+'</span>'+
    (preview.length?'<span class="table-declare-preview" aria-hidden="true">'+
      preview.map(n=>'<span class="table-declare-face">'+tileFaceMarkup(n)+'</span>').join('')+'</span>':'')+
    '<span class="table-declare-caption">'+escapeHtml(title)+'</span></button>';
}

/** Public presentation only: never read private claim intent, or treat a kong
 * proposal as a completed kong. A subsequent discard invalidates the badge. */
export function publicDeclaration(view) {
  if(!Array.isArray(view?.publicEvents))return null;
  const e=[...view.publicEvents].reverse().find(x=>x.gameId===view.gameId&&
    x.visibility==='public'&&Number.isSafeInteger(x.seq)&&x.seq<=view.asOfEventSeq&&
    (['discard','kong_proposed','win','kong'].includes(x.type)||
      (x.type==='claim'&&Number.isInteger(x.actorSeat)&&typeof x.payload?.kind==='string')));
  if(!e||!Number.isInteger(e.actorSeat)||e.actorSeat<0||e.actorSeat>3)return null;
  const p=e.payload??{};
  let kind=null,label=null;
  if(e.type==='claim'&&['chi','pong'].includes(p.kind)&&Array.isArray(p.tileIds)&&
      p.tileIds.length===3&&p.tileIds.every(id=>typeFromTile(id)!==null)&&
      new Set(p.tileIds).size===3&&typeof p.claimEventId==='string'&&
      Number.isInteger(p.sourceSeat)&&p.sourceSeat>=0&&p.sourceSeat<=3&&p.sourceSeat!==e.actorSeat){
    kind=p.kind;label=DECLARATION_LABELS[kind];
  }else if(e.type==='kong'&&Array.isArray(p.tileIds)&&p.tileIds.every(id=>typeFromTile(id)!==null)&&
      new Set(p.tileIds).size===p.tileIds.length&&
      ((p.kind==='kong'&&p.tileIds.length===4&&typeof p.claimEventId==='string')||
       (p.kind==='CONCEALED_KONG'&&p.tileIds.length===4)||
       (p.kind==='ADDED_KONG'&&[1,4].includes(p.tileIds.length)))){
    kind='kong';label=p.kind==='CONCEALED_KONG'?'暗槓':p.kind==='ADDED_KONG'?'加槓':'明槓';
  }else if(e.type==='win'&&view.round?.phase==='settled'&&p.seat===e.actorSeat&&
      Number.isInteger(p.sourceSeat)&&p.sourceSeat>=0&&p.sourceSeat<=3){
    kind='win';label=p.sourceSeat===e.actorSeat?'自摸':'胡牌';
  }
  return kind?{kind,label,seat:e.actorSeat,seq:e.seq}:null;
}
function declarationNotice(notice){
  return notice?'<span class="table-declaration-notice" data-public-declaration="'+notice.kind+
    '" data-declaration-seq="'+notice.seq+'"><span>'+SEATS[notice.seat]+'</span><b>'+notice.label+'</b></span>':'';
}
export function ActionBar(legalActions, selectedId, busy, confirmation=null) {
  const chosen = legalActions.find(a => a.kind === 'discard' && a.actionId === selectedId);
  const declarationActions = legalActions.filter(a => a.kind !== 'discard');
  const pending = declarationActions.find(a => a.actionId===confirmation?.actionId &&
    a.actorSeat===confirmation?.actorSeat && a.expectedRevision===confirmation?.expectedRevision &&
    a.kind===confirmation?.kind);
  return '<section class="table-actions" aria-label="合法動作" aria-busy="'+(busy?'true':'false')+'"><div class="table-actions-heading">' +
    '<h3>可操作動作</h3><span>僅顯示 Rules Engine 回傳的 LegalAction</span></div>' +
    (chosen ? '<div class="table-selected"><span role="status" aria-live="polite">已選：' + escapeHtml(actionName(chosen)) +
      '</span><button type="button" data-submit-action="' + escapeHtml(chosen.actionId) +
      '" class="primary" ' + (busy ? 'disabled' : '') + '>確認捨牌</button>' +
      '<button type="button" data-clear-selection class="secondary" '+(busy?'disabled':'')+'>取消</button></div>'
      : '<p class="table-quiet">請點選一張手牌；捨牌不會立即送出。</p>') +
    '<div class="table-action-buttons">' + declarationActions.map(a=>declarationButton(a,busy)).join('') + '</div>' +
    (pending?'<div class="table-selected table-confirmation" data-action-confirmation role="group" '+
      'aria-label="正式動作確認"><p role="status" aria-live="polite">確定執行合法動作：'+escapeHtml(actionName(pending))+
      '？宣告後無法撤銷。</p><button type="button" class="primary" data-confirm-action="'+
      escapeHtml(pending.actionId)+'" '+(busy?'disabled':'')+'>確認宣告</button>'+
      '<button type="button" class="secondary" data-cancel-action '+(busy?'disabled':'')+
      '>取消</button></div>':'') +
    (!declarationActions.length && !chosen ? '<p class="table-muted">目前無其他合法宣告，未提供的吃／碰／槓／胡／過操作一律不顯示。</p>' : '') +
    '</section>';
}
function lastEvent(events) {
  if (!events.length) return '等待 Rules Engine 發出事件';
  const e = events[events.length - 1];
  const prefix = e.actorSeat === undefined ? '牌局' : SEATS[e.actorSeat];
  return prefix + ' · ' + (e.type === 'deal' ? '配牌' : (ACTIONS[e.type] ?? e.type)) + ' · 事件 ' + e.seq;
}
// No speculative kong or supplementary draw: render only the public proposal and
// linked Rules-issued WIN/PASS; a malformed public contract fails closed.
export function RobberyNotice(view,window){
  if(!window)return {html:'',valid:true};
  const proposal=view.publicEvents?.find(e=>e.type==='kong_proposed'&&e.eventId===window.sourceEventId);
  const valid=view.round?.phase==='claim_window'&&window.sourceKind==='rob-added-kong'&&
    window.status==='open'&&window.expectedRevision===view.asOfEventSeq&&
    proposal?.actorSeat===window.fromSeat&&proposal?.payload?.kind==='ADDED_KONG'&&
    typeof proposal?.payload?.tileId==='string'&&Number.isInteger(window.fromSeat)&&
    window.fromSeat>=0&&window.fromSeat<4&&
    view.legalActions.every(a=>['win','pass'].includes(a.kind)&&a.claimEventId===window.sourceEventId);
  return valid?{valid,html:'<p role="status" aria-live="polite" data-robbery-window>搶加槓宣告中：'+
    SEATS[window.fromSeat]+' · '+escapeHtml(actionName({kind:'add_kong',tileIds:[proposal.payload.tileId]}))+
    '；等待 Rules 裁定，尚未完成加槓或替代摸牌。</p>'}:
    {valid:false,html:'<p role="alert" data-robbery-invalid>搶加槓公開契約不相容，已停止本次操作。</p>'};
}
export const TABLE_THEMES=Object.freeze({'jade-room':'翡翠綠桌','walnut-room':'胡桃木桌','midnight-room':'午夜藍桌'});
export function normalizeTableTheme(value){
  return typeof value==='string'&&Object.hasOwn(TABLE_THEMES,value)?value:'jade-room';
}
function tableThemeSelect(theme){
  return '<label class="table-theme-control"><span>牌桌</span><select data-table-theme-select aria-label="牌桌主題">'+
    Object.entries(TABLE_THEMES).map(([id,name])=>'<option value="'+id+'"'+(id===theme?' selected':'')+'>'+name+'</option>').join('')+
    '</select></label>';
}
export function TableView(snapshot,{selection=null,busy=false,error='',botStatus='',
  confirmation=null,restartPending=false,drawCue=null,soundEnabled=false,soundAvailable=true,theme='jade-room'}={}) {
  if(!snapshot)return '';
  theme=normalizeTableTheme(theme);
  const {view,profile,wallRemaining,botConnected,replayConnected,storageWarning,replayWarning}=snapshot;
  const opponents=new Map(view.opponents.map(p=>[p.seat,p]));
  const robbery=RobberyNotice(view,snapshot.robbery);
  const latest=latestPublicDiscard(view);
  const notice=publicDeclaration(view);
  const drawnId=drawCue?.gameId===view.gameId&&drawCue.seat===view.audienceSeat&&
    drawCue.revision===view.asOfEventSeq&&view.round.phase==='await_discard'&&
    view.round.currentSeat===view.audienceSeat&&view.self.concealed.some(t=>t.id===drawCue.tileId)&&
    typeFromTile(drawCue.tileId)!==null?drawCue.tileId:null;
  const actions=robbery.valid?view.legalActions.filter(a=>a.actorSeat===view.audienceSeat &&
    a.expectedRevision===view.asOfEventSeq&&typeof a.actionId==='string'):[];
  const humanCanAct=actions.length>0;
  const ended=view.round.phase==='settled';
  const claim=view.round.phase==='claim_window';
  const activeSeat=ended||snapshot.paused?null:view.round.currentSeat;
  const phaseLabel=snapshot.paused?'對局已暫停':ended?'本局已結束':humanCanAct?
    (claim?'請回應合法宣告':'輪到你'):botConnected?'等待三位 Bot':'等待 Bot API';
  return '<header class="table-heading"><div><span class="table-overline">EXPERIMENTAL / '+
    escapeHtml(profile.ruleVersion)+'</span><h1 id="table-heading" tabindex="-1">四人牌桌</h1>'+
    '<p>Rules Engine 決定牌局、宣告與結算；此規則與台數政策均未取得完整台灣通用驗證。</p></div>'+
    '<div class="table-header-tools"><span class="table-version">Revision '+
    view.asOfEventSeq+'</span>'+tableThemeSelect(theme)+'<button type="button" class="secondary table-sound-toggle" data-table-sound aria-pressed="'+
    (soundEnabled?'true':'false')+'" '+(soundAvailable?'':'disabled')+'>'+
    (soundAvailable?(soundEnabled?'音效：開啟':'音效：關閉'):'音效：不支援')+'</button>'+
    '<button type="button" class="secondary" data-start-new '+
    (busy?'disabled':'')+'>重新開局</button></div></header>'+
    (restartPending?'<div class="table-selected table-confirmation" data-restart-confirmation '+
      'role="group" aria-label="重新開局確認"><p>確定重新開局？目前對局會被取代。</p>'+
      (botConnected?BotDifficultySelect(snapshot.botDifficulty):'')+
      '<button type="button" class="primary" data-confirm-new>確定重新開局</button>'+
      '<button type="button" class="secondary" data-cancel-new>取消</button></div>':'')+
    '<div class="table-facts" data-table-busy="'+(busy?'true':'false')+'"><span>規則：'+escapeHtml(profile.profileId)+
    '</span>'+(botConnected?'<span data-bot-difficulty="'+escapeHtml(snapshot.botDifficulty)+'">Bot 難度：'+escapeHtml(snapshot.botDifficulty)+'</span>':'')+
    '<span>階段：'+escapeHtml(view.round.phase)+
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
    '<div class="table-game-surface" data-table-theme="'+theme+'">'+
    '<div class="table-grid" role="group" aria-label="四人牌桌公開資訊">'+
    OpponentSeat(opponents.get(2),activeSeat,view.round.dealerSeat,latest)+
    OpponentSeat(opponents.get(3),activeSeat,view.round.dealerSeat,latest)+
    '<div class="table-felt" aria-live="polite"><strong>'+phaseLabel+
    '</strong>'+declarationNotice(notice)+'<span>'+escapeHtml(botStatus||lastEvent(view.publicEvents))+
    '</span>'+(latest?'<span class="table-latest-label">最新捨牌 · '+SEATS[latest.seat]+' · '+escapeHtml(tileAccessibleName(typeFromTile(latest.tileId)))+'</span>':'')+
    '<span class="table-center-wall">牌山 · '+escapeHtml(wallRemaining)+' 張</span><small>僅顯示當下的公開牌面與本人手牌</small></div>'+
    OpponentSeat(opponents.get(1),activeSeat,view.round.dealerSeat,latest)+'</div>'+
    robbery.html+PlayerHand(view.self,actions,selection,latest,drawnId,view.round.dealerSeat,activeSeat)+'</div>'+
    (!robbery.valid?'<section class="table-actions" aria-label="契約不相容">操作已停止</section>':ended?'<section class="table-actions"><h3>正式 Rules 已結算本局</h3></section>':
      humanCanAct?ActionBar(actions,selection,busy||snapshot.paused,confirmation):
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
        profile.profileId==='tw16-authoritative-scoring'?'權威計分由 Rules settlement 提供，UI 不計分；實驗性、未認證。':
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
// R7.3 exact public DTO only. This renderer never reads private scoring evidence,
// derives a tai value, or fabricates payments. The opt-in host remains disabled
// until Rules, Scoring, Bot and Replay joint gates have passed.
const PUBLIC_SETTLEMENT_VERSION='tw16-gametower-authoritative@1.0.0-experimental';
export function AuthoritativeSettlement(summary){
  if(!summary)return '';
  const item=x=>x&&typeof x.code==='string'&&typeof x.name==='string'&&
    typeof x.ruleVersion==='string'&&typeof x.source==='string'&&
    ['hand','payment'].includes(x.scope)&&Number.isInteger(x.tai)&&x.tai>=0;
  const seat=x=>Number.isInteger(x)&&x>=0&&x<4;
  const nonnegative=n=>Number.isSafeInteger(n)&&n>=0&&!Object.is(n,-0);
  const delta=x=>Array.isArray(x)&&x.length===4&&x.every(n=>Number.isSafeInteger(n)&&!Object.is(n,-0));
  if(summary.contractVersion!=='tw16-pre-settlement/1.0.0'||
    summary.scoringVersion!==PUBLIC_SETTLEMENT_VERSION||
    summary.status!=='experimental-not-rule-certified'||summary.unit!=='abstract-points'||
    typeof summary.settlementId!=='string'||!summary.settlementId||
    !['win','exhaustive-draw'].includes(summary.reason)||
    !nonnegative(summary.tai)||
    !Array.isArray(summary.breakdown)||!summary.breakdown.every(item)||
    !delta(summary.playerDeltas)||!delta(summary.playerTransferDeltas)||
    !Array.isArray(summary.payerSeats)||!summary.payerSeats.every(seat)||
    !Array.isArray(summary.payments)||!summary.payments.every(p=>p&&seat(p.payerSeat)&&
      seat(p.payeeSeat)&&['points','handTai','appliedTai'].every(k=>nonnegative(p[k]))&&
      Array.isArray(p.dealerItems)&&p.dealerItems.every(item))||
    !Array.isArray(summary.fees)||summary.fees.length!==0||summary.houseDelta!==0||
    (summary.reason==='win'?(!seat(summary.winnerSeat)||!['self-draw','discard','rob-added-kong'].includes(summary.winType)):
      (summary.winnerSeat!==null||summary.winType!==null||summary.payments.length!==0||summary.payerSeats.length!==0)))
    return '<section role="alert" data-authority-unavailable>權威結算契約不相容，無法顯示計分。</section>';
  // Validate public accounting invariants without deriving any scoring decision.
  // All paid amounts and tai remain Rules-owned; inconsistent DTOs never render.
  const bad=()=>'<section role="alert" data-authority-unavailable>權威結算契約不相容，無法顯示計分。</section>';
  const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
  const sum=a=>a.reduce((s,n)=>s+BigInt(n),0n);
  if(!summary.breakdown.every(x=>nonnegative(x.tai))||
     sum(summary.breakdown.map(x=>x.tai))!==BigInt(summary.tai)||
     !same(summary.playerDeltas,summary.playerTransferDeltas)||
     sum(summary.playerDeltas)!==0n)return bad();
  if(summary.reason==='exhaustive-draw'){
    if(summary.sourceSeat!==null||summary.tai!==0||summary.breakdown.length||
       summary.playerDeltas.some(n=>n!==0))return bad();
  }else{
    const winner=summary.winnerSeat;
    if(!seat(summary.sourceSeat))return bad();
    const self=summary.winType==='self-draw';
    if(self!==(summary.sourceSeat===winner))return bad();
    const expected=self?[0,1,2,3].filter(s=>s!==winner):[summary.sourceSeat];
    if(!same(summary.payerSeats,expected)||!same(summary.payments.map(p=>p.payerSeat),expected))return bad();
    const balances=[0n,0n,0n,0n];
    for(const p of summary.payments){
      if(p.payeeSeat!==winner||p.handTai!==summary.tai||
         !p.dealerItems.every(x=>nonnegative(x.tai))||
         BigInt(p.appliedTai)!==BigInt(p.handTai)+sum(p.dealerItems.map(x=>x.tai)))return bad();
      balances[p.payerSeat]-=BigInt(p.points);balances[p.payeeSeat]+=BigInt(p.points);
    }
    if(!balances.every((n,i)=>n===BigInt(summary.playerDeltas[i])))return bad();
  }
  const line=x=>'<li>'+escapeHtml(x.name)+'（'+escapeHtml(x.code)+'）：'+x.tai+
    ' 台 · '+escapeHtml(x.ruleVersion)+' · '+escapeHtml(x.source)+' · '+escapeHtml(x.scope)+'</li>';
  return '<section class="table-round-summary" data-authoritative-settlement aria-label="Rules 權威結算">'+
    '<h2>局後權威結算 · EXPERIMENTAL</h2>'+
    '<p>結果：'+escapeHtml(summary.reason)+'</p>'+
    '<p>勝方：'+(seat(summary.winnerSeat)?SEATS[summary.winnerSeat]:'流局／無')+'</p>'+
    '<p>胡牌方式：'+escapeHtml(summary.winType??'無')+'</p>'+
    '<p>計分政策：'+escapeHtml(summary.scoringVersion)+'</p>'+
    '<p>結算識別：'+escapeHtml(summary.settlementId)+'</p>'+
    '<p>實驗台數：'+summary.tai+'</p><h3>逐項台數（Rules 公開結果）</h3><ul>'+
    summary.breakdown.map(line).join('')+'</ul><h3>支付明細（abstract-points）</h3><ul>'+
    summary.payments.map(p=>'<li>'+SEATS[p.payerSeat]+' → '+SEATS[p.payeeSeat]+'：'+p.points+
      ' 點；手牌 '+p.handTai+' 台；適用 '+p.appliedTai+' 台<ul>'+p.dealerItems.map(line).join('')+'</ul></li>').join('')+
    '</ul><p>四家分數變化：'+summary.playerDeltas.map((x,i)=>SEATS[i]+' '+x).join(' / ')+'</p>'+
    '<p>平台變動：'+summary.houseDelta+'；費用：無</p>'+
    '<p class="table-warning">實驗性計分、非金額、未取得通用台制認證。</p></section>';
}
export function RoundSummary(result){
  const summary=result?.source==='rules'&&result?.experimental===true?
    result.publicSummary:result?.verified===true?result.publicSummary:null;
  if(!summary||typeof summary!=='object')return '';
  if(Object.hasOwn(summary,'settlement')||summary.scoringPolicy===PUBLIC_SETTLEMENT_VERSION)
    return AuthoritativeSettlement(summary.settlement??{});
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
  const latest=latestPublicDiscard(view);
  return '<div class="table-grid table-history-grid" aria-label="歷史各家公開牌河與副露">' +
    OpponentSeat(opponents.get(2), view.round?.currentSeat, view.round?.dealerSeat, latest) +
    OpponentSeat(opponents.get(3), view.round?.currentSeat, view.round?.dealerSeat, latest) +
    '<div class="table-felt"><strong>歷史事件 ' + escapeHtml(view.asOfEventSeq) +
    '</strong><small>僅展示 Replay API 的歷史快照</small></div>' +
    OpponentSeat(opponents.get(1), view.round?.currentSeat, view.round?.dealerSeat, latest) +
    '</div><section class="table-replay-self"><h3>當時你的公開牌河、副露與花牌</h3>' +
    riverSection(view.self.river ?? [],latest,view.self.seat) + meldSection(view.self.melds ?? []) +
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
  const authority=frame.view.round?.phase==='settled'?
    frame.view.publicEvents?.find(e=>e.type==='settle')?.payload?.settlement:null;
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
    (authority?AuthoritativeSettlement(authority):'')+
    '<button type="button" class="secondary" data-return-table>返回牌桌</button></section>';
}
