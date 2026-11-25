import { createSandboxSession, availableTableProfiles } from './session.js';
import { createFullRoundSession, fullRoundCapability } from './full-round.js';
import { createDailyPanel } from './daily.js';
import { TableView, ReplayControls, BotDifficultySelect, latestPublicDiscard, publicDeclaration } from './view.js';
import { installTileFaceFallback } from '../tile-visuals.js';

const root=document.querySelector('#full-table-root');
const controls=document.querySelector('#full-table-navigation');
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
let session=null, daily=null, fullMode=false, selection=null;
let busy=false,lastError='',activePage='academy',timeline=null,replayIndex=0;
let replayFrame=null,replayBusy=false,botStatus='',storage=null;
let dailyBoot='idle';
let pendingAction=null,restartPending=false;
let lastPaintedGame=null,lastPaintedRevision=-1;
const forceSandbox=new URLSearchParams(window.location.search).get('table')==='sandbox';
const seededQA=new URLSearchParams(window.location.search).get('qa')==='seeded';


function profilesList() {
  return fullMode ? session.availableProfiles().sort((a,b)=>
    Number(b.profileId==='tw16-single-winner-interception')-
    Number(a.profileId==='tw16-single-winner-interception')) :
    availableTableProfiles().filter(p=>p.profileId==='tw16-four-player-sandbox');
}
function profiles() {
  return profilesList().map(p=>'<option value="'+safe(p.profileId+'@'+p.ruleVersion)+'">'+
    safe(p.profileId==='tw16-single-winner-interception'?'一炮一響／攔胡（實驗性）':
      p.profileId==='tw16-configurable-table'?'舊實驗桌規（多人胡牌拒絕）':p.profileId)+
      ' ['+safe(p.profileId)+'] · '+safe(p.ruleVersion)+' · '+safe(p.status)+'</option>').join('');
}
function renderEmpty() {
  return '<header class="table-heading"><div><span class="table-overline">PHASE 3 · EXPERIMENTAL</span>'+
    '<h1 id="table-heading" tabindex="-1">四人實戰</h1>'+
    '<p>'+(fullMode
      ? 'R3 規則、三名 Bot 與 Replay 正式接線；台數仍為實驗性簡化政策。'
      : '目前沒有通過版本驗證的 R3 Bot／Replay 接線，僅提供舊版摸打 Sandbox。')+
    '</p></div></header><section class="table-empty"><h2>建立實驗牌桌</h2>'+
    '<label for="table-profile">明確選擇 RuleProfile</label>'+
    '<select id="table-profile">'+profiles()+'</select>'+
    (fullMode?BotDifficultySelect('Beginner'):'')+
    (fullMode&&seededQA?'<label for="table-fixed-seed">固定種子（實驗性重現；留空隨機）</label><input id="table-fixed-seed" maxlength="48" pattern="[A-Za-z0-9_\\-]+" autocomplete="off"><p class="table-muted">只使用 Rules 正式洗牌；每個固定種子請使用獨立測試瀏覽器工作階段。</p>':'')+
    '<button type="button" class="primary" data-start-new '+(!profilesList().length?'disabled':'')+'>'+
    (fullMode?'開始 R3 四人對局':'開始摸打 Sandbox')+'</button>'+
    (lastError?'<p role="alert" class="table-warning">'+safe(lastError)+'</p>':'')+
    '<p class="table-muted">對局資料使用獨立儲存鍵，不改動 Academy v1/v3 紀錄。</p>'+
    '<button type="button" class="secondary" data-return-academy>返回課程</button></section>';
}
function activate(page,{focus=true}={}) {
  if(page!==activePage){pendingAction=null;selection=null;restartPending=false;}
  activePage=page;
  document.body.dataset.tableView=page==='academy'?'none':page;
  if(root)root.hidden=page==='academy';
  controls?.querySelectorAll('[data-table-nav]').forEach(button=>
    button.setAttribute('aria-current',button.dataset.tableNav===page?'page':'false'));
  if(page!=='academy'){
    draw();
    if(focus)root?.querySelector('#table-heading, .table-replay h2, .table-empty h2')
      ?.focus?.({preventScroll:true});
  }
}
function draw() {
  if(!root)return;
  if(activePage==='daily') {
    root.innerHTML=daily?daily.render():
      '<header class="table-heading"><h1 id="table-heading" tabindex="-1">今日訓練</h1></header>'+
      '<section class="table-empty" data-daily-state="'+safe(dailyBoot==='loading'?'loading':'failed')+
      '"><p role="status">'+(dailyBoot==='loading'?'正式 Daily Module 載入中…':
      '正式 Daily Controller 尚未就緒。'+safe(lastError))+'</p>'+
      (dailyBoot==='loading'?'':'<button type="button" data-daily-retry>重試連線</button>')+
      '</section>';
    return;
  }
  if(activePage==='replay'){
    root.innerHTML='<header class="table-heading"><h1 tabindex="-1" id="table-heading">牌局複盤</h1>'+
      '<span class="table-overline">HISTORICAL PLAYER VIEW · EXPERIMENTAL</span></header>'+
      (replayBusy?'<p role="status">正在由正式 Replay API 重建歷史資料…</p>':
        ReplayControls(timeline,replayIndex,replayFrame))+
      (lastError?'<p role="alert" class="table-warning">'+safe(lastError)+'</p>':'');
    return;
  }
  const snapshot=session?.snapshot();
  root.innerHTML=snapshot?TableView(snapshot,{selection,busy,error:lastError,
    botStatus,confirmation:pendingAction,restartPending}):renderEmpty();
  // Animate only a genuinely new, already committed public discard. Selection,
  // confirmation, rerender, initial restore and replay never replay the effect.
  const view=snapshot?.view, latest=latestPublicDiscard(view);
  const changed=Boolean(view&&latest&&view.gameId===lastPaintedGame&&latest.seq>lastPaintedRevision);
  const notice=publicDeclaration(view);
  const newNotice=Boolean(view&&notice&&view.gameId===lastPaintedGame&&notice.seq>lastPaintedRevision);
  lastPaintedGame=view?.gameId??null;
  lastPaintedRevision=view?.asOfEventSeq??-1;
  const motionAllowed=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(newNotice&&motionAllowed){
    root.querySelector('[data-public-declaration]')?.animate?.(
      [{transform:'scale(.84)',opacity:.35},{transform:'scale(1.08)',opacity:1},{transform:'scale(1)',opacity:1}],
      {duration:360,easing:'ease-out'});
  }
  if(changed&&motionAllowed){
    const tile=root.querySelector('.table-last-discard');
    tile?.animate?.([{transform:'translateY(-7px) scale(1.10)',opacity:.75},
      {transform:'translateY(0) scale(1)',opacity:1}],{duration:230,easing:'ease-out'});
  }
}
async function driveBots() {
  if(!session?.snapshot()||busy===false) return;
  botStatus='三位 Bot 依 Rules LegalAction 行動中…';
  draw();
  const result=await session.advanceBots({
    maxActions:2048,
    onProgress:({actions,status})=>{
      if(actions===1||actions%32===0){
        botStatus='Bot 已完成 '+actions+' 步 · '+status;
        draw();
      }
    }
  });
  if(result?.status==='action-budget-reached')
    throw new Error('Bot 已達本次安全行動上限，可按繼續 Bot 重試');
  botStatus='';
}
async function startNew() {
  if(busy)return;
  busy=true;
  try {
    const selected=root.querySelector('#table-profile')?.value??'';
    const current=session.snapshot()?.profile;
    const available=profilesList();
    const profile=available.find(p=>p.profileId+'@'+p.ruleVersion===selected)??
      available.find(p=>p.profileId===current?.profileId&&p.ruleVersion===current?.ruleVersion)??
      available[0];
    if(!profile)throw new Error('沒有已註冊且可用的四人 RuleProfile');
    const difficulty=root.querySelector('#table-bot-difficulty')?.value??session.snapshot()?.botDifficulty??'Beginner';
    const fixedSeed=seededQA?(root.querySelector('#table-fixed-seed')?.value||null):null;
    session.start({profileId:profile.profileId,ruleVersion:profile.ruleVersion,...(fullMode?{difficulty,fixedSeed}:{})});
    selection=null;pendingAction=null;restartPending=false;
    lastError='';botStatus='';timeline=null;replayFrame=null;
    activate('play',{focus:false});
    await driveBots();
  } catch(error) {
    lastError='建立對局失敗：'+error.message;
  } finally {busy=false;draw();}
}
function stageAction(actionId) {
  const previous=session?.snapshot();
  const action=previous?.view?.legalActions?.find(a=>a.actionId===actionId);
  if(!action||action.actorSeat!==previous.view.audienceSeat||
      action.expectedRevision!==previous.view.asOfEventSeq){
    pendingAction=null;selection=null;
    lastError='原始動作已過期或不合法，請重新選擇。';draw();return;
  }
  if(action.kind==='discard'){
    if(selection!==actionId){lastError='請先選取要捨出的合法手牌。';draw();return;}
    pendingAction=null;
    void submit(actionId);
    return;
  }
  // Use an in-page, keyboard-accessible confirmation instead of window.confirm.
  // No Rules action is submitted by opening or cancelling this panel.
  pendingAction={actionId:action.actionId,actorSeat:action.actorSeat,
    expectedRevision:action.expectedRevision,kind:action.kind};
  restartPending=false;selection=null;lastError='';
  draw();
  root.querySelector('[data-confirm-action]')?.focus({preventScroll:true});
}
async function submit(actionId) {
  if(busy)return;
  const previous=session?.snapshot();
  const action=previous?.view?.legalActions?.find(a=>a.actionId===actionId);
  const valid=action&&action.actorSeat===previous.view.audienceSeat&&
    action.expectedRevision===previous.view.asOfEventSeq;
  const confirmed=(action?.kind==='discard'&&selection===actionId)||(pendingAction?.actionId===actionId&&
    pendingAction?.actorSeat===action?.actorSeat&&
    pendingAction?.expectedRevision===action?.expectedRevision&&
    pendingAction?.kind===action?.kind);
  if(!valid||!confirmed){
    lastError='原始動作已過期或尚未確認，已取消選擇。';
    selection=null;pendingAction=null;draw();return;
  }
  // Synchronously prevent duplicate submission before awaiting Controller/Bots.
  busy=true;pendingAction=null;restartPending=false;
  try {
    await session.submit({actionId:action.actionId,actorSeat:action.actorSeat,
      expectedRevision:action.expectedRevision});
    selection=null;lastError='';draw();
    await driveBots();
  } catch(error) {
    selection=null;
    lastError='規則／Bot 動作未完成：'+error.message;
  } finally {busy=false;botStatus='';draw();
    if(activePage==='play')root.querySelector('.table-actions button:not(:disabled), .table-hand button:not(:disabled), #table-heading')?.focus({preventScroll:true});
  }
}
async function loadReplayFrame(index) {
  if(!timeline?.verified||replayBusy)return;
  const limit=Number.isInteger(timeline.total)?timeline.total:timeline.frames?.length??0;
  if(index<0||index>=limit)return;
  replayBusy=true;draw();
  try {
    const frame=typeof timeline.getFrame==='function'
      ?await timeline.getFrame(index):timeline.frames[index];
    if(!frame?.view||frame.view.audienceSeat!==0||
       frame.view.opponents?.some(p=>Object.hasOwn(p,'concealed')))
      throw new Error('歷史 PlayerView 未通過隔離驗證');
    replayIndex=index;replayFrame=frame;lastError='';
  }catch(error){lastError='Replay 歷史資料驗證失敗：'+error.message;}
  finally{replayBusy=false;draw();}
}
async function openReplay() {
  if(busy)return;
  lastError='';timeline=null;replayIndex=0;replayFrame=null;
  activate('replay',{focus:false});
  try {
    timeline=await session.replay();
    if(timeline?.verified)await loadReplayFrame(0);
  }catch(error){lastError='Replay API 無法驗證：'+error.message;}
  draw();
}
async function ensureDaily() {
  if(dailyBoot==='loading')return;
  dailyBoot='loading';lastError='';
  activate('daily',{focus:false});
  try {
    if(!daily)daily=await createDailyPanel(storage);
    await daily.refresh();
    dailyBoot='ready';
  }catch(error) {
    dailyBoot='failed';
    lastError='Daily 正式服務不可用：'+error.message;
  }
  draw();
}
async function dailyAction(kind) {
  if(busy)return;
  // Read values before the progress indicator rerenders the form.
  const selectedMinutes=kind==='start'?
    Number(root.querySelector('#daily-minutes')?.value??30):null;
  const selectedMode=kind==='start'?(root.querySelector('#daily-mode')?.value??'structural'):null;
  if(kind==='abort'&&!window.confirm(
    '結束今天的訓練？已保存的正式成績不會刪除。'))return;
  busy=true;lastError='';
  try{
    if(kind==='retry'){
      daily=null;
      await ensureDaily();
      return;
    }
    if(!daily)throw new Error('Daily Controller 不可用');
    // Invoke the panel method first: it sets loading/submitting synchronously.
    // Then paint that explicit state, while the official locked API is pending.
    let operation;
    if(kind==='start')operation=daily.start(selectedMinutes,selectedMode);
    else if(kind==='resume')operation=daily.resume();
    else if(kind==='submit')operation=daily.submit(root);
    else if(kind==='complete')operation=daily.finish();
    else if(kind==='abort')operation=daily.abort();
    else throw new Error('不支援的 Daily UI 操作');
    draw();
    const result=await operation;
    if(result?.status==='recovery-required'||result?.status==='pending-recovery')
      lastError='正式提交需要恢復與讀回，未標示為成功儲存。';
  }catch(error){lastError='Daily 操作未完成：'+error.message;}
  finally{busy=false;draw();}
}
function onClick(event) {
  const button=event.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-pause-bots')){
    pendingAction=null;selection=null;restartPending=false;
    session?.pause?.();botStatus='對局已暫停';draw();return;
  }
  if(button.hasAttribute('data-resume-bots')){
    session?.resume?.();botStatus='';
    if(!busy){
      busy=true;void driveBots().catch(e=>lastError=e.message).finally(()=>{
        busy=false;botStatus='';draw();
      });
    }else draw();
    return;
  }
  if(busy)return;
  if(button.hasAttribute('data-confirm-new')){
    if(restartPending){restartPending=false;void startNew();}
    return;
  }
  if(button.hasAttribute('data-cancel-new')){
    restartPending=false;draw();root.querySelector('[data-start-new]')?.focus({preventScroll:true});return;
  }
  if(button.hasAttribute('data-cancel-action')){
    const id=pendingAction?.actionId;
    pendingAction=null;lastError='';draw();
    const prior=Array.from(root.querySelectorAll('[data-submit-action]:not(:disabled)')).find(el=>el.dataset.submitAction===id);
    (prior??root.querySelector('#table-heading'))?.focus({preventScroll:true});return;
  }
  if(button.hasAttribute('data-confirm-action')){
    const actionId=button.dataset.confirmAction;
    if(actionId!==pendingAction?.actionId){
      pendingAction=null;selection=null;
      lastError='確認動作已過期，請重新選擇。';draw();return;
    }
    return void submit(actionId);
  }
  if(button.hasAttribute('data-return-academy'))return activate('academy');
  if(button.hasAttribute('data-return-table'))return activate('play');
  if(button.hasAttribute('data-start-new')){
    if(session?.snapshot()){
      pendingAction=null;restartPending=true;lastError='';draw();
      root.querySelector('[data-confirm-new]')?.focus({preventScroll:true});
    }else void startNew();
    return;
  }
  if(button.hasAttribute('data-show-replay'))return void openReplay();
  for(const kind of ['start','resume','submit','complete','abort','retry'])
    if(button.hasAttribute('data-daily-'+kind))return void dailyAction(kind);
  if(button.hasAttribute('data-continue-bots')) {
    busy=true;void driveBots().catch(e=>lastError=e.message).finally(()=>{
      busy=false;botStatus='';draw();
    });return;
  }
  if(button.hasAttribute('data-pick-action')){
    pendingAction=null;restartPending=false;
    const actionId=button.dataset.pickAction;
    const view=session.snapshot()?.view;
    if(!view?.legalActions.some(a=>a.kind==='discard'&&
      a.actionId===actionId&&a.expectedRevision===view.asOfEventSeq)){
      lastError='動作已過期，請重新選牌。';selection=null;
    }else{selection=selection===actionId?null:actionId;lastError='';}
    draw();
    if(selection)root.querySelector('[data-submit-action]')?.focus({preventScroll:true});
    return;
  }
  if(button.hasAttribute('data-clear-selection')){
    const id=selection;selection=null;draw();
    Array.from(root.querySelectorAll('[data-pick-action]:not(:disabled)')).find(el=>el.dataset.pickAction===id)?.focus({preventScroll:true});return;
  }
  if(button.hasAttribute('data-submit-action'))return stageAction(button.dataset.submitAction);
  if(button.hasAttribute('data-replay-first'))return void loadReplayFrame(0);
  if(button.hasAttribute('data-replay-prev'))return void loadReplayFrame(Math.max(0,replayIndex-1));
  if(button.hasAttribute('data-replay-next')){
    const max=Number.isInteger(timeline?.total)?timeline.total-1:(timeline?.frames?.length??1)-1;
    return void loadReplayFrame(Math.min(max,replayIndex+1));
  }
}
async function init() {
  if(!root||!controls)return;
  try{storage=window.localStorage;}catch{storage=null;}
  session=createSandboxSession({storage});
  if(!forceSandbox&&fullRoundCapability()){
    try{session=await createFullRoundSession({storage});fullMode=true;}
    catch(error){lastError='R3 功能版本尚未完全整合：'+error.message;}
  }
  try{session.restore();}
  catch(error){lastError='無法驗證歷史對局：'+error.message;}
  // Add the Daily route without touching index.html (AI6 owns shared shell).
  if(!controls.querySelector('[data-table-nav="daily"]')){
    const nav=document.createElement('button');
    nav.type='button';nav.dataset.tableNav='daily';
    nav.setAttribute('aria-current','false');nav.textContent='今日正式訓練';
    controls.appendChild(nav);
  }
  installTileFaceFallback(root);
  root.addEventListener('click',onClick);
  root.addEventListener('change',event=>{
    if(event.target.matches('[data-replay-jump]')){
      const index=Number(event.target.value);
      if(Number.isInteger(index))void loadReplayFrame(index);
    }
  });
  controls.addEventListener('click',event=>{
    const b=event.target.closest('[data-table-nav]');
    if(!b||busy)return;
    if(b.dataset.tableNav==='replay')void openReplay();
    else if(b.dataset.tableNav==='daily')void ensureDaily();
    else activate(b.dataset.tableNav);
  });
  window.addEventListener('pageshow',()=>{
    if(activePage!=='academy')draw();
  });
  draw();
  // A restored R3 bot turn may continue only through official Controller.
  if(fullMode&&session.snapshot()&&!session.snapshot().view.legalActions.length&&
      session.snapshot().view.round.phase!=='settled'){
    busy=true;
    try{await driveBots();}
    catch(e){lastError='恢復後的 Bot 自動輪轉已安全停止：'+e.message;}
    finally{busy=false;botStatus='';draw();}
  }
}
void init();
