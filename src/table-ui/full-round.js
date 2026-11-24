/**
 * Phase 3 real-match host bridge.
 * Private GameState never leaves this module. Rules alone schedules and adjudicates.
 * Requires the newer R3 Rules (#43), Bots (#40), and Replay (#41) contracts.
 */
import * as rules from '../rules/index.js';

const KEY = 'tw-mahjong-master-academy:full-table:r3:v1';
export const AUTHORITY_EXPERIMENT_KEY = 'tw-mahjong-master-academy:full-table:authority-experiment:v1';
const AUTHORITY_REPLAY_PREFIX = 'tw-mahjong-authority-experiment:';
const isAuthority = p => p?.status==='experimental' &&
  p.profileId==='tw16-authoritative-scoring' && p.ruleVersion==='experimental-v1';
const HUMAN = 0;
const DIFFICULTIES=Object.freeze(['Beginner','Intermediate','Advanced']);
function checkedDifficulty(value){
  if(!DIFFICULTIES.includes(value))throw new RangeError('不支援的 Bot 難度');
  return value;
}
const copy = x => JSON.parse(JSON.stringify(x));
// Explicit reproducibility is opt-in QA/training, not a hidden deck override.
// Stable gameId also pins the Bot tie-break input. Normal random mode is unchanged.
function fixedRoundConfig(seed,profileId,difficulty){
  if(typeof seed!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(seed))
    throw new RangeError('固定種子須為 1–48 個英數字、底線或連字號');
  let hash=2166136261;
  for(const c of seed){hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}
  return {seed,gameId:'r73-fixed-'+profileId+'-'+difficulty+'-'+hash.toString(16)};
}
const isR3 = p => p?.status === 'experimental' && (
  (p.profileId === 'tw16-configurable-table' && p.ruleVersion === 'experimental-full-v1') ||
  (p.profileId === 'tw16-single-winner-interception' && p.ruleVersion === 'experimental-v1'));
const isR5 = p => p?.profileId === 'tw16-single-winner-interception' &&
  p.ruleVersion === 'experimental-v1' && p.status === 'experimental';

export function fullRoundCapability() {
  try {
    return rules.listRuleProfiles().some(isR3) &&
      typeof rules.listPendingClaimResponders === 'function' &&
      typeof rules.createPlayerView === 'function';
  } catch { return false; }
}

export async function createFullRoundSession({storage,enableAuthoritative=false} = {}) {
  if (!fullRoundCapability()) throw new Error('R3 Rules / Claim Host 尚未整合最新契約');
  const [botApi,replayApi] = await Promise.all([
    import('../bots/index.js'), import('../replay/index.js')
  ]);
  if (typeof botApi.createBotController !== 'function' ||
      typeof botApi.createBot !== 'function' ||
      botApi.BOT_ENGINE_VERSION !== 'tw16-bots/0.2.0-r3-experimental' ||
      typeof replayApi.createReplayService !== 'function' ||
      replayApi.REPLAY_API_VERSION !== 'tw16-replay-api/1.0.0')
    throw new Error('Bot / Replay 正式 API 版本不符；拒絕啟動不完整整局');
  if (!storage || typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function')
    throw new Error('正式 R3 對局需要可靠的本機儲存');

  // Explicit developer-only opt-in, with an isolated checkpoint and replay
  // namespace. Never let an unsupported experiment block legacy history.
  if(typeof enableAuthoritative!=='boolean')throw new TypeError('Invalid authority opt-in');
  let settlementRuntime;
  if(enableAuthoritative){
    const p=rules.listRuleProfiles().find(isAuthority);
    if(!p||typeof rules.createSettlementRuntime!=='function')
      throw new Error('Authority Rules capability unavailable');
    const scoring=await import('../scoring/index.js');
    settlementRuntime=rules.createSettlementRuntime(scoring);
  }
  const opts={settlementRuntime};
  const key=enableAuthoritative?AUTHORITY_EXPERIMENT_KEY:KEY;
  const supported=p=>enableAuthoritative?isAuthority(p):isR3(p);
  const replayStorage=enableAuthoritative?{
    getItem:k=>storage.getItem(AUTHORITY_REPLAY_PREFIX+k),
    setItem:(k,v)=>storage.setItem(AUTHORITY_REPLAY_PREFIX+k,v)
  }:storage;
  let state = null, controller = null, blocked = false, submitting=false;
  let botDifficulty='Beginner';
  let storageWarning = '', replayWarning = '', replayId = null;
  const replays = replayApi.createReplayService({storage:replayStorage,...opts});

  function persist(next,{paused=controller?.isPaused()??false,difficulty=botDifficulty}={}) {
    if (blocked) throw new Error('舊紀錄損壞，禁止覆蓋');
    try {
      // A rejection never advances Rules revision. Persist the Controller's
      // bound stop alongside that exact state, never into a newly started game.
      const stopped=enableAuthoritative&&next===state?controller?.checkpoint()?.blocked:undefined;
      storage.setItem(key, JSON.stringify({version:1, gameState:next,
        botCheckpoint:{paused,...(stopped?{blocked:stopped}:{})},botDifficulty:checkedDifficulty(difficulty)}));
      storageWarning = '';
    } catch (e) {
      storageWarning = 'R3 對局儲存失敗，重新整理可能遺失進度：' + e.message;
      throw e;
    }
  }
  function capabilityError(stop){
    const error=new Error('實驗桌規尚未支援：'+stop.capability+'；對局已停止，未完成結算。');
    error.code=stop.code;error.capability=stop.capability;
    return error;
  }
  function currentBlock(){
    return enableAuthoritative?controller?.checkpoint()?.blocked:null;
  }
  function refuseBlocked(){
    const stop=currentBlock();
    if(stop)throw capabilityError(stop);
  }
  function saveBlockAndRefuse(){
    const stop=currentBlock();
    if(stop){persist(state);throw capabilityError(stop);}
  }
  function legal(submission, seat) {
    if (!state || !submission || submission.actorSeat !== seat ||
        submission.expectedRevision !== state.revision)
      return false;
    return rules.listLegalActions(state,seat).some(a=>
      a.actionId === submission.actionId &&
      a.actorSeat === submission.actorSeat &&
      a.expectedRevision === submission.expectedRevision);
  }
  function commit(submission) {
    if (!legal(submission,submission?.actorSeat))
      throw new Error('非法／過期的 Rules Action，請更新 PlayerView');
    const next = rules.applyAction(state,{
      actionId:submission.actionId,
      actorSeat:submission.actorSeat,
      expectedRevision:submission.expectedRevision
    },opts).state;
    rules.validateGameState(next,opts);
    // Save first; do not report this action as durable when storage rejected it.
    persist(next);
    state = next;
    if (state.round.phase === 'settled') archive();
  }
  function archive() {
    if (!state || state.round.phase !== 'settled' || replayId) return;
    try {
      const manifest = replays.saveReplay(state,{
        ownerSeat:HUMAN, disclosurePolicy:'settled-public-only'
      });
      if (!manifest?.replayId) throw new Error('Replay manifest 缺少 ID');
      replayId = manifest.replayId;
      replayWarning = '';
    } catch (e) {
      replayWarning = '正式 Replay 儲存／驗證失敗：' + e.message;
    }
  }
  function setupController(checkpoint=null) {
    controller = botApi.createBotController({
      bots:[1,2,3].map(seat=>botApi.createBot({
        seat,difficulty:botDifficulty,seed:'table-bot-seat-'+seat
      })),
      humanSeat:HUMAN, maxRevision:100000,checkpoint,
      getActingSeat:()=>state.round.phase==='settled'
        ? state.round.currentSeat
        : state.round.phase==='claim_window'
          ? (rules.listPendingClaimResponders(state)[0] ?? state.round.currentSeat)
          : state.round.currentSeat,
      getPendingClaimResponders:()=>rules.listPendingClaimResponders(state),
      getPlayerView:seat=>rules.createPlayerView(state,seat,state.revision,opts),
      submitAction:submission=>commit(submission)
    });
  }
  function restore() {
    const raw=storage.getItem(key);
    if (!raw) return false;
    try {
      const obj=JSON.parse(raw);
      if (obj?.version!==1 || !obj.gameState || !supported(rules.getRuleProfile(
        obj.gameState.ruleRef?.profileId,obj.gameState.ruleRef?.ruleVersion
      ))) throw new Error('Invalid R3 checkpoint');
      rules.validateGameState(obj.gameState,opts);
      const stop=obj.botCheckpoint?.blocked;
      if(stop!==undefined&&(!enableAuthoritative||stop?.gameId!==obj.gameState.gameId||
         stop.expectedRevision!==obj.gameState.revision||obj.gameState.round.phase==='settled'||
         !rules.listLegalActions(obj.gameState,stop.seat).length))
        throw new Error('Blocked checkpoint does not bind to the current Rules state');
      botDifficulty=checkedDifficulty(Object.hasOwn(obj,'botDifficulty')?obj.botDifficulty:'Beginner');
      state=obj.gameState;
      setupController(obj.botCheckpoint??null);
      if (state.round.phase==='settled') archive();
      return true;
    } catch (e) {
      blocked=true;state=null;controller=null;
      storageWarning='既有 R3 對局驗證失敗，原始紀錄保留、不會覆寫：'+e.message;
      return false;
    }
  }
  function start({profileId,ruleVersion,difficulty='Beginner',fixedSeed=null}={}) {
    checkedDifficulty(difficulty);
    if (blocked) throw new Error(storageWarning);
    const preferred=enableAuthoritative?rules.listRuleProfiles().find(isAuthority):
      rules.listRuleProfiles().find(isR5) ?? rules.listRuleProfiles().find(isR3);
    const p=rules.getRuleProfile(profileId??preferred?.profileId,ruleVersion??preferred?.ruleVersion);
    profileId=p.profileId;ruleVersion=p.ruleVersion;
    if (!supported(p)) throw new Error('桌規未在此實驗性宿主開放');
    const config=fixedSeed===null?(()=>{
      const seed='r3-'+(globalThis.crypto?.randomUUID?.() ??
        String(Date.now())+'-'+Math.floor(Math.random()*1000000));
      return {seed,gameId:seed.replace(/[^A-Za-z0-9_-]/g,'-')};
    })():fixedRoundConfig(fixedSeed,profileId,difficulty);
    // Do not overwrite existing deterministic archives with another playthrough.
    if(fixedSeed!==null && (state?.gameId===config.gameId ||
      replays.listReplays().some(m=>m.gameId===config.gameId)))
      throw new Error('此固定種子對局已存在；使用獨立測試瀏覽器工作階段重現，不覆寫既有 Replay');
    const next=rules.createGame({...config,profileId,ruleVersion,dealerSeat:HUMAN},opts);
    rules.validateGameState(next,opts);
    persist(next,{paused:false,difficulty});
    botDifficulty=difficulty;
    state=next;
    replayId=null;replayWarning='';
    setupController();
    return snapshot();
  }
  function snapshot() {
    if (!state) return null;
    const view=rules.createPlayerView(state,HUMAN,state.revision,opts);
    if (view.opponents.some(x=>Object.hasOwn(x,'concealed')))
      throw new Error('Rules PlayerView exposes opponent concealed');
    const r=state.round.phase==='settled' ? state.extensions?.tw16?.result : null;
    const delta=Array.isArray(r?.delta)&&r.delta.length===4 ? r.delta : null;
    const legacyResult=r&&delta ? {
      source:'rules',experimental:true,
      publicSummary:{
        outcome:r.reason, winnerSeats:Number.isInteger(r.winnerSeat)?[r.winnerSeat]:[],
        winMethod:r.via ?? null, tai:r.tai ?? null,
        pattern:r.breakdown ?? null,
        scoreDelta:[...delta], scoringPolicy:'tw16-minimal-tai-v1',
        eventCount:state.events.length
      }
    }:null;
    // The new policy may never fall back to legacy tai. Consume only the
    // Rules-projected public settlement, never the private authority ledger.
    const authority=state.ruleRef.profileId==='tw16-authoritative-scoring';
    const publicSettle=view.publicEvents.find(e=>e.type==='settle')?.payload?.settlement;
    const result=authority&&state.round.phase==='settled'?{
      source:'rules',experimental:true,publicSummary:{
        scoringPolicy:'tw16-gametower-authoritative@1.0.0-experimental',
        settlement:publicSettle??null,eventCount:view.asOfEventSeq
      }}:legacyResult;
    const window=state.round.phase==='claim_window'?rules.getClaimWindowPublic(state):null;
    const robbery=window?.sourceKind==='rob-added-kong'?{
      sourceKind:window.sourceKind,sourceEventId:window.sourceEventId,
      fromSeat:window.fromSeat,expectedRevision:window.expectedRevision,status:window.status
    }:null;
    return copy({
      view,robbery,profile:rules.getRuleProfile(state.ruleRef.profileId,state.ruleRef.ruleVersion),
      wallRemaining:state.wall.length, botConnected:true,botDifficulty,
      replayConnected:!!replayId,storageWarning,
      replayWarning,phase:'experimental-full',result,
      paused:controller?.isPaused()??false,
      ...(currentBlock()?{capabilityBlock:currentBlock()}: {})
    });
  }
  async function submit({actionId,actorSeat,expectedRevision}={}) {
    if (!state || !controller) throw new Error('尚未開始 R3 對局');
    refuseBlocked();
    if (!legal({actionId,actorSeat,expectedRevision},HUMAN))
      throw new Error('過期或不合法的玩家 Action');
    if(submitting)throw new Error('玩家 Action 已在提交中');
    submitting=true;
    try{
      const r=await controller.submitHumanAction({actionId,expectedRevision});
      if(r.status==='unsupported')saveBlockAndRefuse();
      if (r.status!=='acted')
        throw new Error('Bot Controller 拒絕：'+r.status+(r.reason?' / '+r.reason:''));
      return snapshot();
    }finally{submitting=false;}
  }
  async function advanceBots({maxActions=1024,onProgress=()=>{}}={}) {
    if (!state || !controller) return {status:'not-started',snapshot:snapshot()};
    refuseBlocked();
    let remaining=maxActions, total=0;
    while (remaining>0) {
      const batch=Math.min(32,remaining);
      const r=await controller.runUntilHuman({maxActions:batch});
      total+=r.actions??0;remaining-=r.actions??0;
      if(r.status==='unsupported')saveBlockAndRefuse();
      onProgress({actions:total,status:r.status,revision:state.revision});
      if (r.status==='action-budget-reached') {
        if (r.actions===0) throw new Error('Bot 未前進，已安全停止');
        await new Promise(resolve=>setTimeout(resolve,0));
        continue;
      }
      if (['human-turn','settled','paused'].includes(r.status))
        return {status:r.status,actions:total,snapshot:snapshot()};
      throw new Error('Bot 安全停止：'+r.status+(r.reason?' ('+r.reason+')':''));
    }
    return {status:'action-budget-reached',actions:total,snapshot:snapshot()};
  }
  async function replay() {
    if (!state || state.round.phase!=='settled')
      throw new Error('目前只支援已結束的 R3 正式事件複盤');
    archive();
    if (!replayId) throw new Error(replayWarning || 'Replay 尚未可用');
    const manifest=replays.loadReplay(replayId);
    if (!manifest || manifest.integrityStatus!=='canonical-replay-verified' ||
        !Number.isInteger(manifest.eventCount) || manifest.eventCount<1)
      throw new Error('Replay 內容尚未通過正式驗證');
    // Group-atomic Replay frames are supplied by the owner-only Replay service.
    const boundaries=replays.listReplayFrameBoundaries(replayId,{viewerSeat:HUMAN});
    if(!Array.isArray(boundaries)||!boundaries.length||
       boundaries[0]!==1||boundaries.at(-1)!==manifest.eventCount)
      throw new Error('Replay 缺少完整合法動作事件邊界');
    return {
      verified:true,replayId,total:boundaries.length,boundaries:copy(boundaries),
      manifest:copy(manifest),
      getFrame(index) {
        if (!Number.isInteger(index)||index<0||index>=boundaries.length)
          throw new RangeError('Invalid replay index');
        const seq=boundaries[index];
        const frame=replays.getReplayFrame(replayId,seq,{viewerSeat:HUMAN,
          perspective:'player-at-time'});
        if (frame?.playerView?.audienceSeat!==HUMAN ||
            frame.playerView.opponents.some(x=>Object.hasOwn(x,'concealed')))
          throw new Error('Replay PlayerView 未通過資訊隔離');
        let analysis=null;
        try { analysis=replays.getDecisionAnalysis(replayId,seq,{viewerSeat:HUMAN}); }
        catch (e) { if (e?.code!=='DECISION_NOT_FOUND' && e?.code!=='VIEW_FORBIDDEN') throw e; }
        return copy({event:frame.publicEvent??null,
          view:frame.playerView,legalActions:frame.playerView.legalActions,
          analysis,findings:analysis?.findings??[],asOfEventSeq:seq});
      }
    };
  }
  return Object.freeze({
    start,restore,snapshot,submit,advanceBots,replay,
    pause(){refuseBlocked();controller?.pause();if(state)persist(state);return snapshot();},
    resume(){refuseBlocked();controller?.resume();if(state)persist(state);return snapshot();},
    availableProfiles(){return rules.listRuleProfiles().filter(supported);}
  });
}
