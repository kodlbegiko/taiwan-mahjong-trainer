/**
 * Phase 3 real-match host bridge.
 * Private GameState never leaves this module. Rules alone schedules and adjudicates.
 * Requires the newer R3 Rules (#43), Bots (#40), and Replay (#41) contracts.
 */
import * as rules from '../rules/index.js';

const KEY = 'tw-mahjong-master-academy:full-table:r3:v1';
const HUMAN = 0;
const copy = x => JSON.parse(JSON.stringify(x));
const isR3 = p => p?.profileId === 'tw16-configurable-table' &&
  p.ruleVersion === 'experimental-full-v1' && p.status === 'experimental';

export function fullRoundCapability() {
  try {
    return rules.listRuleProfiles().some(isR3) &&
      typeof rules.listPendingClaimResponders === 'function' &&
      typeof rules.createPlayerView === 'function';
  } catch { return false; }
}

export async function createFullRoundSession({storage} = {}) {
  if (!fullRoundCapability()) throw new Error('R3 Rules / Claim Host 尚未整合最新契約');
  const [botApi,replayApi] = await Promise.all([
    import('../bots/index.js'), import('../replay/index.js')
  ]);
  if (typeof botApi.createBotController !== 'function' ||
      typeof botApi.createBot !== 'function' ||
      typeof replayApi.createReplayService !== 'function')
    throw new Error('Bot / Replay 正式 API 尚未可用');
  if (!storage || typeof storage.getItem !== 'function' ||
      typeof storage.setItem !== 'function')
    throw new Error('正式 R3 對局需要可靠的本機儲存');

  let state = null, controller = null, blocked = false;
  let storageWarning = '', replayWarning = '', replayId = null;
  const replays = replayApi.createReplayService({storage});

  function persist(next) {
    if (blocked) throw new Error('舊紀錄損壞，禁止覆蓋');
    try {
      storage.setItem(KEY, JSON.stringify({version:1, gameState:next}));
      storageWarning = '';
    } catch (e) {
      storageWarning = 'R3 對局儲存失敗，重新整理可能遺失進度：' + e.message;
      throw e;
    }
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
    }).state;
    rules.validateGameState(next);
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
  function setupController() {
    controller = botApi.createBotController({
      bots:[1,2,3].map(seat=>botApi.createBot({
        seat,difficulty:'Beginner',seed:'table-bot-seat-'+seat
      })),
      humanSeat:HUMAN, maxRevision:100000,
      getActingSeat:()=>state.round.phase==='settled'
        ? state.round.currentSeat
        : state.round.phase==='claim_window'
          ? (rules.listPendingClaimResponders(state)[0] ?? state.round.currentSeat)
          : state.round.currentSeat,
      getPendingClaimResponders:()=>rules.listPendingClaimResponders(state),
      getPlayerView:seat=>rules.createPlayerView(state,seat),
      submitAction:submission=>commit(submission)
    });
  }
  function restore() {
    const raw=storage.getItem(KEY);
    if (!raw) return false;
    try {
      const obj=JSON.parse(raw);
      if (obj?.version!==1 || !obj.gameState || !isR3(rules.getRuleProfile(
        obj.gameState.ruleRef?.profileId,obj.gameState.ruleRef?.ruleVersion
      ))) throw new Error('Invalid R3 checkpoint');
      rules.validateGameState(obj.gameState);
      state=obj.gameState;
      setupController();
      if (state.round.phase==='settled') archive();
      return true;
    } catch (e) {
      blocked=true;
      storageWarning='既有 R3 對局驗證失敗，原始紀錄保留、不會覆寫：'+e.message;
      return false;
    }
  }
  function start({profileId='tw16-configurable-table',
                  ruleVersion='experimental-full-v1'}={}) {
    if (blocked) throw new Error(storageWarning);
    const p=rules.getRuleProfile(profileId,ruleVersion);
    if (!isR3(p)) throw new Error('目前只支援明確 experimental R3 RuleProfile');
    const seed='r3-'+(globalThis.crypto?.randomUUID?.() ??
      String(Date.now())+'-'+Math.floor(Math.random()*1000000));
    const next=rules.createGame({gameId:seed.replace(/[^A-Za-z0-9_-]/g,'-'),
      seed,profileId,ruleVersion,dealerSeat:HUMAN});
    rules.validateGameState(next);
    persist(next);
    state=next;
    replayId=null;replayWarning='';
    setupController();
    return snapshot();
  }
  function snapshot() {
    if (!state) return null;
    const view=rules.createPlayerView(state,HUMAN);
    if (view.opponents.some(x=>Object.hasOwn(x,'concealed')))
      throw new Error('Rules PlayerView exposes opponent concealed');
    const r=state.round.phase==='settled' ? state.extensions?.tw16?.result : null;
    const delta=Array.isArray(r?.delta)&&r.delta.length===4 ? r.delta : null;
    const result=r&&delta ? {
      source:'rules',experimental:true,
      publicSummary:{
        outcome:r.reason, winnerSeats:Number.isInteger(r.winnerSeat)?[r.winnerSeat]:[],
        winMethod:r.via ?? null, tai:r.tai ?? null,
        pattern:r.breakdown ?? null,
        scoreDelta:[...delta], scoringPolicy:'tw16-minimal-tai-v1',
        eventCount:state.events.length
      }
    }:null;
    return copy({
      view,profile:rules.getRuleProfile(state.ruleRef.profileId,state.ruleRef.ruleVersion),
      wallRemaining:state.wall.length, botConnected:true,
      replayConnected:!!replayId,storageWarning,
      replayWarning,phase:'experimental-full',result,
      paused:controller?.isPaused()??false
    });
  }
  async function submit({actionId,actorSeat,expectedRevision}={}) {
    if (!state || !controller) throw new Error('尚未開始 R3 對局');
    if (!legal({actionId,actorSeat,expectedRevision},HUMAN))
      throw new Error('過期或不合法的玩家 Action');
    const r=await controller.submitHumanAction({actionId,expectedRevision});
    if (r.status!=='acted')
      throw new Error('Bot Controller 拒絕：'+r.status+(r.reason?' / '+r.reason:''));
    return snapshot();
  }
  async function advanceBots({maxActions=1024,onProgress=()=>{}}={}) {
    if (!state || !controller) return {status:'not-started',snapshot:snapshot()};
    let remaining=maxActions, total=0;
    while (remaining>0) {
      const batch=Math.min(32,remaining);
      const r=await controller.runUntilHuman({maxActions:batch});
      total+=r.actions??0;remaining-=r.actions??0;
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
    return {
      verified:true,replayId,total:manifest.eventCount,manifest:copy(manifest),
      getFrame(index) {
        if (!Number.isInteger(index)||index<0||index>=manifest.eventCount)
          throw new RangeError('Invalid replay index');
        const seq=index+1;
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
    pause(){controller?.pause();return snapshot();},
    resume(){controller?.resume();return snapshot();},
    availableProfiles(){return rules.listRuleProfiles().filter(isR3);}
  });
}
