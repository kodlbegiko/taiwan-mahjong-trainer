import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {
  createGame, createPlayerView, listLegalActions, applyAction, replayGame,
  validateGameState, getRuleProfile, getRuleCapabilities, listPendingClaimResponders,
} from '../../src/rules/index.js';
import {
  createBot, chooseBotAction, validateBotDecision, createBotController,
} from '../../src/bots/index.js';

// R5 is source-owned by Rules #43. This Bot-owned test runs automatically
// once the real RuleProfile is present in the *same checkout*. Never substitute
// legacy Rules, a fabricated settlement, or an adjusted Seed 87.
const NEW={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const OLD={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const SEEDS=Array.from({length:100},(_,i)=>String(i));
const REPRESENTATIVE=['0','1','6','19','37','42','50','72','87','99'];
const NAME=ref=>ref.profileId+'@'+ref.ruleVersion;
const clone=x=>JSON.parse(JSON.stringify(x));
let ready=false,unavailableReason='';
try {
  const profile=getRuleProfile(NEW.profileId,NEW.ruleVersion);
  const caps=getRuleCapabilities(NEW);
  ready=profile.status==='experimental' &&
    caps.claimArbitration?.multipleDiscardWins?.status==='experimental-supported' &&
    caps.claimArbitration.multipleDiscardWins.mode==='single-winner' &&
    caps.claimArbitration.singleWinner===true &&
    caps.claimArbitration.multipleWinnerSettlement.status==='unsupported' &&
    caps.claimArbitration.robAddedKong.status==='unsupported';
  if(!ready) unavailableReason='R5 capability negotiation incomplete';
}catch(error){unavailableReason=String(error.message);}
const gate={skip:ready?false:'Rules #43 not integrated on Bot branch: '+unavailableReason};

// Four-player host owns all GameState. A Bot receives only createPlayerView.
// The fourth (human) seat uses the SAME bounded deterministic public Bot policy
// for automated QA, and always submits through controller.submitHumanAction.
async function runHand(seed,ref=NEW,{maxActions=1800}={}) {
  let state=createGame({gameId:'bot-r3-'+seed,seed:'fixed-round-'+seed,...ref});
  const bots=[1,2,3].map(seat=>createBot({
    seat,difficulty:'Beginner',seed:'r3-independent-seat-'+seat,
  }));
  const human=createBot({
    seat:0,difficulty:'Beginner',seed:'r3-independent-seat-0',
  });
  const trace=[],start=performance.now();
  let claimWindows=0,claimResponses=0,legalActions=0,legalChoicesOffered=0;
  let invalidActions=0,stalls=0,decisionCount=0,decisionMs=0;
  let reason=null,unsupportedCapability=null,at160=null;
  const controller=createBotController({
    bots,humanSeat:0,maxRevision:maxActions,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    getPendingClaimResponders:()=>listPendingClaimResponders(state),
    submitAction:submission=>{
      const issued=listLegalActions(state,submission.actorSeat);
      legalChoicesOffered+=issued.length;
      const valid=issued.find(a=>a.actorSeat===submission.actorSeat &&
        a.actionId===submission.actionId &&
        a.expectedRevision===submission.expectedRevision);
      if(!valid){invalidActions++;throw new RangeError('unissued or stale action');}
      try {
        state=applyAction(state,submission).state;
      }catch(error){
        if(error?.code==='UNSUPPORTED_RULE_CAPABILITY')
          unsupportedCapability=error.capability;
        else invalidActions++;
        throw error;
      }
      legalActions++;
      trace.push({revision:submission.expectedRevision,seat:submission.actorSeat,
        kind:valid.kind,actionId:submission.actionId,afterRevision:state.revision});
    },
    yieldControl:async()=>{},
  });
  for(let n=0;n<maxActions && state.round.phase!=='settled';n++){
    const beforeRevision=state.revision,wasClaim=state.round.phase==='claim_window';
    if(seed==='87'&&beforeRevision===160)at160=state;
    let result=await controller.tick();
    if(result.status==='human-turn'){
      const view=createPlayerView(state,0),begin=performance.now();
      const decision=chooseBotAction(human,view);
      decisionMs+=performance.now()-begin;decisionCount++;
      validateBotDecision(human,view,decision);
      if(decision.status!=='ready'){reason='human-'+decision.status;break;}
      result=await controller.submitHumanAction({
        actionId:decision.actionId,expectedRevision:decision.expectedRevision,
      });
    }else if(result.status==='acted'){
      decisionCount++;decisionMs+=result.decisionMs;
    }
    if(result.status!=='acted'){
      reason=result.reason||result.status;
      unsupportedCapability=result.capability??unsupportedCapability;
      break;
    }
    if(wasClaim)claimResponses++;
    if(!wasClaim&&state.round.phase==='claim_window')claimWindows++;
    if(state.revision<=beforeRevision){stalls++;reason='stalled-revision';break;}
    if(state.events.length!==state.revision){invalidActions++;reason='event-gap';break;}
  }
  if(!reason&&state.round.phase!=='settled')reason='max-action-budget';
  let prefixReplayMatch=false,replayMatch=false;
  try{
    assert.equal(validateGameState(state,{replay:false}),true);
    assert.deepEqual(replayGame(state),state);
    prefixReplayMatch=true;
    replayMatch=state.round.phase==='settled';
  }catch(error){reason=reason||'replay-mismatch: '+error.message;}
  const settlement=state.round.phase==='settled'?clone(state.extensions.tw16.result):null;
  const completed=state.round.phase==='settled'&&!reason&&replayMatch;
  return {
    seed,ruleProfileId:NAME(ref),completed,
    finish:completed?settlement?.reason:null,
    winnerSeat:completed?settlement?.winnerSeat:null,
    claimWindows,claimResponses,legalActions,legalChoicesOffered,
    invalidActions,stalls,unsupportedCapability,replayMatch,prefixReplayMatch,
    SettlementResult:completed?settlement:null,
    elapsedMs:Number((performance.now()-start).toFixed(3)),
    decisionCount,decisionMs:Number(decisionMs.toFixed(3)),
    reason,
    category:completed?'settled':unsupportedCapability?'unsupported':
      stalls?'stalled':reason?.includes('replay-mismatch')?'replay-mismatch':'invalid',
    // Test-local forensic state: never supplied to the Bot or logged as GameState.
    _state:state,_trace:trace,_at160:at160,
  };
}
function printable(row){
  const {_state,_trace,_at160,...safe}=row;
  return safe;
}
function assertValid(row){
  assert.equal(row.invalidActions,0,JSON.stringify(printable(row)));
  assert.equal(row.stalls,0,JSON.stringify(printable(row)));
  assert.equal(row.prefixReplayMatch,true,JSON.stringify(printable(row)));
}
function submit(state,seat,kind){
  const action=listLegalActions(state,seat).find(a=>a.kind===kind);
  assert.ok(action,'Rules-issued '+seat+' '+kind);
  return applyAction(state,{
    actorSeat:seat,actionId:action.actionId,expectedRevision:action.expectedRevision,
  }).state;
}
test('R5 capability is independent of all private WIN intents',{...gate},()=>{
  const caps=getRuleCapabilities(NEW),old=getRuleCapabilities(OLD);
  assert.equal(caps.claimArbitration.multipleDiscardWins.mode,'single-winner');
  assert.equal(caps.claimArbitration.winPriority,'nearest-clockwise-from-discarder');
  assert.equal(old.claimArbitration.multipleDiscardWins.status,'unsupported');
  for(const word of ['decisions','wall','tileIds','hiddenWinningIntents'])
    assert.ok(!JSON.stringify(caps).includes(word));
});
test('R5 Seed 87: same fixed seed, unchanged actions, Rules selects the sole winner',{...gate},async()=>{
  const old=await runHand('87',OLD),fresh=await runHand('87',NEW);
  console.log('BOT_R5_SEED87_COMPARE '+JSON.stringify({
    legacy:printable(old),singleWinner:printable(fresh),
    legacyLastActions:old._trace.slice(-3),
    newLastActions:fresh._trace.slice(-4),
  }));
  assertValid(old);assertValid(fresh);
  assert.equal(old.completed,false);
  assert.equal(old.category,'unsupported');
  assert.equal(old.unsupportedCapability,'multiple_winners');
  assert.equal(old._state.revision,162);
  assert.equal(old.SettlementResult,null);
  assert.equal(fresh.completed,true);
  assert.equal(fresh.finish,'win');
  assert.equal(fresh.winnerSeat,3);
  assert.equal(fresh.SettlementResult?.claimResolution?.selectedSeat,3);
  assert.deepEqual(fresh.SettlementResult.claimResolution.declaredWinSeats,[3,0]);
  assert.deepEqual(fresh.SettlementResult.claimResolution.interceptedWinSeats,[0]);
  assert.equal(fresh._state.events.filter(e=>e.type==='settle').length,1);
  assert.equal(fresh._state.events.filter(e=>e.type==='win'&&e.visibility==='public').length,1);
  assert.equal(fresh._state.revision,165);
  assert.deepEqual(fresh._trace.slice(0,old._trace.length),old._trace,
    'No R5-special-case bot action, same original deterministic prefix');
  assert.deepEqual(fresh.SettlementResult.delta,[0,0,-100,100]);
  assert.equal(fresh.SettlementResult.delta.reduce((x,y)=>x+y,0),0);
});
test('R5 counterfactual pending WIN/PASS intents yield the same PlayerView-only Bot decision',{...gate},async()=>{
  const actual=await runHand('87');
  assertValid(actual);assert.equal(actual.completed,true);
  const before=actual._at160;assert.ok(before,'actual Seed87 event 160');
  const wins=submit(submit(before,3,'win'),0,'win');
  const passes=submit(submit(before,3,'pass'),0,'pass');
  const a=createPlayerView(wins,1),b=createPlayerView(passes,1);
  assert.deepEqual(a,b,'private claims must not change responder PlayerView');
  const bot=createBot({seat:1,seed:'r5-counterfactual',difficulty:'Beginner'});
  const first=chooseBotAction(bot,a),second=chooseBotAction(bot,b);
  assert.deepEqual(first,second);
  assert.equal(validateBotDecision(bot,a,first),true);
  assert.equal(first.expectedRevision,162);
  assert.equal(Object.hasOwn(a,'wall'),false);
  assert.equal(Object.hasOwn(a,'rng'),false);
  assert.ok(a.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  assert.equal(JSON.stringify(a).includes('declaredWinSeats'),false);
});
test('R5 ten representative seeds: every unsupported case is a real failure',{...gate},async()=>{
  const reports=[];
  for(const seed of REPRESENTATIVE){
    const row=await runHand(seed);reports.push(printable(row));assertValid(row);
  }
  console.log('BOT_R5_TEN_SEED '+JSON.stringify(reports));
  assert.ok(reports.every(r=>r.completed&&r.replayMatch),JSON.stringify(reports.filter(r=>!r.completed)));
});
test('R5 100 fixed seeds: strict single-winner full-match gate',{...gate},async()=>{
  const rows=[];
  for(const seed of SEEDS){
    let row;
    try { row=await runHand(seed); }
    catch(error) {
      // Never erase a Seed because its engine/controller crashed.
      row={seed,ruleProfileId:NAME(NEW),completed:false,finish:null,
        winnerSeat:null,claimWindows:0,claimResponses:0,legalActions:0,
        invalidActions:1,stalls:0,unsupportedCapability:null,replayMatch:false,
        SettlementResult:null,elapsedMs:null,reason:String(error?.stack||error),
        category:'invalid'};
    }
    const safe=printable(row);rows.push(safe);
    console.log('BOT_R5_FIXED_SEED '+JSON.stringify(safe));
    if(!row.completed)console.log('BOT_R5_FAILED_TRACE '+JSON.stringify({
      seed,reason:row.reason,unsupportedCapability:row.unsupportedCapability,
      // Action provenance only; no wall, concealed opponents or full state.
      actions:row._trace?.map(({revision,seat,kind,actionId,afterRevision})=>
        ({revision,seat,kind,actionId,afterRevision}))??[],
    }));
  }
  const settled=rows.filter(r=>r.completed),decisions=rows.filter(r=>r.decisionCount>0);
  const times=decisions.map(r=>r.decisionMs/r.decisionCount).sort((a,b)=>a-b);
  const summary={
    profile:NAME(NEW),requested:100,executed:rows.length,
    completed:settled.length,wins:rows.filter(r=>r.finish==='win').length,
    draws:rows.filter(r=>r.finish==='exhaustive-draw').length,
    unsupported:rows.filter(r=>r.category==='unsupported').length,
    invalid:rows.filter(r=>r.category==='invalid').length,
    stalled:rows.filter(r=>r.category==='stalled').length,
    replayMismatch:rows.filter(r=>!r.prefixReplayMatch).length,
    invalidActions:rows.reduce((x,r)=>x+(r.invalidActions||0),0),
    stalls:rows.reduce((x,r)=>x+(r.stalls||0),0),
    replayMatches:rows.filter(r=>r.replayMatch).length,
    avgDecisionMs:times.length?Number((times.reduce((a,b)=>a+b,0)/times.length).toFixed(3)):null,
    p95DecisionMs:times.length?Number(times[Math.ceil(times.length*.95)-1].toFixed(3)):null,
    totalElapsedMs:rows.reduce((x,r)=>x+(r.elapsedMs||0),0),
    failedSeeds:rows.filter(r=>!r.completed).map(r=>r.seed),
    fullMatchGo:rows.length===100&&settled.length===100&&
      rows.every(r=>r.replayMatch&&!r.invalidActions&&!r.stalls),
    environment:'GitHub/Node runner only, not iPhone hardware',
  };
  console.log('BOT_R5_100_SUMMARY '+JSON.stringify(summary));
  assert.equal(rows.length,100,'all original fixed Seeds must be executed');
  assert.equal(summary.invalidActions,0);
  assert.equal(summary.stalls,0);
  assert.equal(summary.replayMismatch,0);
  assert.equal(summary.fullMatchGo,true,
    'FULL_MATCH_GO=false; never convert unsupported/invalid/stalled into settled');
});
