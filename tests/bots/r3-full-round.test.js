import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as R3Authority from '../../src/rules/index.js';
import {
  createGame,createPlayerView,listLegalActions,applyAction,replayGame,
  validateGameState,startNextRound,
} from '../../src/rules/index.js';
import {
  createBot,chooseBotAction,validateBotDecision,createBotController,
} from '../../src/bots/index.js';

const ruleRef={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const bot=(seat,difficulty='Beginner')=>
  createBot({seat,difficulty,seed:'r3-independent-seat-'+seat});
const clone=x=>JSON.parse(JSON.stringify(x));
const move=(state,seat,action)=>applyAction(state,{
  actorSeat:seat,actionId:action.actionId,
  expectedRevision:action.expectedRevision,
}).state;

async function fullRound(seed,{difficulty='Beginner',maxEvents=1500}={}){
  const gameId='bot-r3-'+seed;
  let state=createGame({gameId,seed:'fixed-round-'+seed,...ruleRef});
  let claimWindows=0,invalidActions=0,stalls=0,decisionMs=0,decisions=0;
  let lastRulesError=null;
  const bots=[bot(1,difficulty),bot(2,difficulty),bot(3,difficulty)];
  const humanPolicy=bot(0,difficulty);
  const controller=createBotController({
    bots,humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    ...(typeof R3Authority.listPendingClaimResponders==='function'
      ? {getPendingClaimResponders:()=>R3Authority.listPendingClaimResponders(state)}
      : {}),
    submitAction:submission=>{
      lastRulesError=null;
      try { state=applyAction(state,submission).state; }
      catch(error) {
        lastRulesError={
          name:String(error?.name||'Error'),
          code:typeof error?.code==='string'?error.code:null,
          capability:typeof error?.capability==='string'?error.capability:null,
          message:String(error?.message||'unknown Rules error'),
        };
        throw error;
      }
    },
    yieldControl:async()=>{},
    maxRevision:maxEvents,
  });
  const before=performance.now();
  let reason=null,steps=0,claims=0,unsupportedCapability=null,failedSubmission=null,failedContext=null;
  const actionTrace=[];
  for(;steps<maxEvents && state.round.phase!=='settled';steps++){
    const oldRevision=state.revision,wasClaim=state.round.phase==='claim_window';
    let result=await controller.tick(),attempted=null,humanDecision=null;
    if(result.status==='human-turn'){
      const view=createPlayerView(state,0);
      const start=performance.now();
      const decision=chooseBotAction(humanPolicy,view);
      humanDecision=decision;
      decisionMs+=performance.now()-start;decisions++;
      validateBotDecision(humanPolicy,view,decision);
      if(decision.status!=='ready'){reason='human-'+decision.status;break;}
      attempted={actorSeat:0,actionId:decision.actionId,
        expectedRevision:decision.expectedRevision};
      result=await controller.submitHumanAction({
        actionId:decision.actionId,expectedRevision:decision.expectedRevision,
      });
    }else if(result.status==='acted'){
      decisionMs+=result.decisionMs;decisions++;
    }
    if(!attempted&&result.decision)attempted={actorSeat:result.seat,
      actionId:result.decision.actionId,expectedRevision:result.decision.expectedRevision};
    if(result.status!=='acted'){
      reason=result.reason||result.status;
      unsupportedCapability=result.capability??null;
      failedSubmission=attempted;
      const actor=attempted?.actorSeat;
      // Forensics are reconstructed from THIS actor's own Rules PlayerView.
      // Do not put GameState, the wall, private claim intents or any other
      // seat's concealed tiles in logs or Bot's inputs.
      const v=Number.isInteger(actor)?createPlayerView(state,actor):null;
      failedContext=v?{
        gameId:v.gameId,ruleRef:v.ruleRef,actorSeat:actor,
        currentSeat:v.round.currentSeat,phase:v.round.phase,
        asOfEventSeq:v.asOfEventSeq,expectedRevision:attempted.expectedRevision,
        legalActions:v.legalActions.map(a=>({
          kind:a.kind,actionId:a.actionId,actorSeat:a.actorSeat,
          expectedRevision:a.expectedRevision,
          claimEventId:a.claimEventId??null,
          reasonCodes:a.legalityBasis?.reasonCodes??[],
        })),
        visibleEventCount:v.publicEvents.length,
        ownConcealedCount:v.self.concealed.length,
        opponentConcealedCounts:v.opponents.map(p=>({
          seat:p.seat,count:p.concealedCount,
        })),
        decisionReasonCodes:(humanDecision||result.decision)?.reasonCodes??[],
        rulesError:lastRulesError,
        afterRevision:state.revision,afterPhase:state.round.phase,
      }:null;
      break;
    }
    actionTrace.push({revision:oldRevision,actorSeat:attempted?.actorSeat,
      actionId:attempted?.actionId,expectedRevision:attempted?.expectedRevision,
      fromPhase:wasClaim?'claim_window':null,
      afterRevision:state.revision,afterPhase:state.round.phase});
    if(wasClaim)claims++;
    if(!wasClaim&&state.round.phase==='claim_window')claimWindows++;
    if(state.revision<=oldRevision) {
      stalls++;
      reason='unchanged-revision';break;
    }
    // Fail closed on changing action semantics or a discontinuous ledger.
    if(state.revision!==state.events.length){invalidActions++;reason='event-gap';break;}
  }
  if(!reason&&state.round.phase!=='settled')reason='max-event-budget';
  const completed=state.round.phase==='settled'&&!reason;
  let replayMatch=false,prefixReplayMatch=false;
  try{
    validateGameState(state,{replay:false});
    prefixReplayMatch=JSON.stringify(replayGame(state))===JSON.stringify(state);
    if(completed)replayMatch=prefixReplayMatch;
    if(!prefixReplayMatch)reason=reason||'replay-prefix-mismatch';
  }catch(e){reason=reason||('state-or-replay:'+e.message);}
  return {seed,ruleProfile:ruleRef.profileId+'@'+ruleRef.ruleVersion,
    botPolicy:difficulty,events:state.events.length,steps,
    completed:completed&&!reason,finish:completed?state.extensions.tw16.result?.reason:null,
    winnerSeat:completed?state.extensions.tw16.result?.winnerSeat:null,
    invalidActions,claimWindows,claimResponses:claims,stalls,
    replayMatch,decisionCount:decisions,
    decisionMs:Number(decisionMs.toFixed(3)),
    elapsedMs:Number((performance.now()-before).toFixed(3)),
    reason,unsupportedCapability,failedSubmission,failedContext,
    prefixReplayMatch,
    terminalCategory:completed&&!reason?'settled':
      reason==='unsupported-rule-capability'?'unsupported':
      reason==='unchanged-revision'?'stalled':
      reason==='replay-prefix-mismatch'||reason?.startsWith('state-or-replay:')?
        'replay-mismatch':'invalid',
    // Only unsuccessful seeds emit full reproducible public action submissions;
    // private wall, opponent hands, and full GameState remain out of CI logs.
    failureActionTrace:reason?actionTrace:null,
    state,controller};
}

test('R3 Controller: initial flower replacement, three independent claims, then legal next turn',async()=>{
  // Dealer seat is human; the three responder seats must not be skipped.
  let state=createGame({gameId:'claim-integration',seed:'claim-integration-seed',...ruleRef});
  const controller=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:a=>{state=applyAction(state,a).state;},
    yieldControl:async()=>{},
  });
  let replacementCount=0;
  for(let i=0;i<30&&state.round.phase==='replacement';i++){
    const seat=state.round.currentSeat;
    const v=createPlayerView(state,seat);
    const replacement=v.legalActions.find(a=>a.kind==='replace_flower');
    assert.ok(replacement,'R3 must offer a real replacement');
    const before=state.revision;
    const result=seat===0
      ? await controller.submitHumanAction({
        actionId:replacement.actionId,expectedRevision:replacement.expectedRevision})
      : await controller.tick();
    assert.equal(result.status,'acted');
    assert.ok(state.revision>before);
    replacementCount++;
  }
  assert.equal(state.round.phase,'await_discard');
  const own=createPlayerView(state,0);
  const discard=own.legalActions.find(a=>a.kind==='discard');
  assert.equal((await controller.submitHumanAction({
    actionId:discard.actionId,expectedRevision:discard.expectedRevision,
  })).status,'acted');
  assert.equal(state.round.phase,'claim_window');
  for(let i=0;i<3;i++){
    const before=state.revision;
    const result=await controller.tick();
    assert.equal(result.status,'acted',JSON.stringify(result));
    assert.ok(state.revision>before);
  }
  assert.notEqual(state.round.phase,'claim_window','Rules must resolve all three responders');
  assert.equal(validateGameState(state,{replay:false}),true);
  assert.deepEqual(replayGame(state),state);
  assert.ok(replacementCount>=0);
  assert.ok(controller.history().length>=3);
});

test('R3 PlayerView isolation: counterfactual opponent concealed vs wall produces identical bot decisions',()=>{
  let game=createGame({gameId:'isolation-r3',seed:'isolation-r3-seed',...ruleRef});
  while(game.round.phase==='replacement'){
    const seat=game.round.currentSeat;
    const a=listLegalActions(game,seat).find(x=>x.kind==='replace_flower');
    game=move(game,seat,a);
  }
  const copy=clone(game),self=game.round.currentSeat,other=(self+1)%4;
  const own=copy.players[other].concealed.findIndex(x=>x.startsWith('t:'));
  const wall=copy.wall.findIndex(x=>x.startsWith('t:'));
  [copy.players[other].concealed[own],copy.wall[wall]]=
    [copy.wall[wall],copy.players[other].concealed[own]];
  assert.equal(validateGameState(copy,{replay:false}),true);
  const v1=createPlayerView(game,self),v2=createPlayerView(copy,self);
  assert.deepEqual(v1,v2);
  for(const difficulty of ['Beginner','Intermediate','Advanced']){
    assert.deepEqual(chooseBotAction(bot(self,difficulty),v1),
      chooseBotAction(bot(self,difficulty),v2));
  }
  assert.throws(()=>chooseBotAction(bot(self),{...v1,wall:copy.wall}));
});

test('R3 stale and forged claim actions are rejected by authoritative Rules',()=>{
  let game=createGame({gameId:'stale-r3',seed:'stale-r3-seed',...ruleRef});
  while(game.round.phase==='replacement'){
    const a=listLegalActions(game,game.round.currentSeat)[0];
    game=move(game,game.round.currentSeat,a);
  }
  const seat=game.round.currentSeat,discard=listLegalActions(game,seat)
    .find(a=>a.kind==='discard');
  game=move(game,seat,discard);
  assert.equal(game.round.phase,'claim_window');
  const candidate=(seat+1)%4;
  const legal=listLegalActions(game,candidate).find(a=>a.kind==='pass');
  assert.ok(legal);
  assert.throws(()=>applyAction(game,{actorSeat:candidate,actionId:'forged-action',
    expectedRevision:game.revision}),/illegal/i);
  const after=move(game,candidate,legal);
  assert.throws(()=>applyAction(after,{actorSeat:candidate,
    actionId:legal.actionId,expectedRevision:legal.expectedRevision}),/Stale/);
});

test('R4 Seed 87: deterministic revision-162 arbitration evidence, no stale action and replayable prefix',async()=>{
  const r=await fullRound('87');
  const {state,controller,...publicResult}=r;
  console.log('BOT_R4_SEED87 '+JSON.stringify({
    seed:r.seed,ruleProfile:r.ruleProfile,policy:r.botPolicy,
    status:r.terminalCategory,events:r.events,steps:r.steps,
    unsupportedCapability:r.unsupportedCapability,
    failedSubmission:r.failedSubmission,failedContext:r.failedContext,
    finalPublicActions:r.failureActionTrace?.slice(-12)??null,
    prefixReplayMatch:r.prefixReplayMatch,
    decisionMs:r.decisionMs,elapsedMs:r.elapsedMs,
  }));
  assert.equal(r.invalidActions,0);
  assert.equal(r.stalls,0);
  assert.equal(r.prefixReplayMatch,true);
  assert.deepEqual(replayGame(state),state);
  if(r.terminalCategory==='unsupported'){
    assert.equal(r.reason,'unsupported-rule-capability');
    assert.equal(r.unsupportedCapability,'multiple_winners');
    assert.equal(state.revision,162);
    assert.equal(state.round.phase,'claim_window');
    assert.equal(r.failedSubmission.actorSeat,1);
    assert.equal(r.failedSubmission.expectedRevision,162);
    assert.ok(r.failedSubmission.actionId.includes(':pass:CLAIM_WINDOW_PASS:'));
    assert.equal(r.failedContext.rulesError.code,'UNSUPPORTED_RULE_CAPABILITY');
    assert.equal(r.failedContext.rulesError.capability,'multiple_winners');
    assert.ok(r.failedContext.legalActions.some(a=>
      a.actionId===r.failedSubmission.actionId &&
      a.expectedRevision===162 && a.actorSeat===1));
    const preceding=r.failureActionTrace.slice(-2);
    assert.deepEqual(preceding.map(x=>[x.revision,x.actorSeat,
      x.actionId.includes(':win:'),x.expectedRevision]),
      [[160,3,true,160],[161,0,true,161]]);
    assert.equal(r.completed,false);
    assert.equal(r.finish,null);
    assert.equal((await controller.tick()).status,'unsupported');
    assert.equal((await controller.runUntilHuman({maxActions:4})).capability,
      'multiple_winners');
    assert.equal(controller.checkpoint().blocked.expectedRevision,162);
    assert.equal(state.revision,162,'must not retry the failed claim');
  }else{
    // The older R3 source tree did not enforce explicit multiwinner rejection.
    // A settlement there is NOT evidence that the latest R4 Rules support it.
    assert.equal(r.terminalCategory,'settled');
    assert.equal(r.completed,true);
    assert.equal(r.replayMatch,true);
  }
  assert.ok(!JSON.stringify(r.failedContext??{}).includes('"wall"'));
  assert.ok(!JSON.stringify(r.failedContext??{}).includes('"concealed"'));
});

test('R4 10 representative fixed seeds: explicit terminal classifications',async()=>{
  const seeds=['0','1','6','19','37','42','50','72','87','99'],results=[];
  for(const seed of seeds){
    const {state,controller, failureActionTrace,...r}=await fullRound(seed);
    results.push({seed,status:r.terminalCategory,finish:r.finish,
      capability:r.unsupportedCapability,events:r.events,
      replayPrefix:r.prefixReplayMatch,invalidActions:r.invalidActions,
      stalls:r.stalls,decisionMs:r.decisionMs,elapsedMs:r.elapsedMs});
    assert.equal(r.prefixReplayMatch,true);
    assert.equal(r.invalidActions,0);
    assert.equal(r.stalls,0);
    assert.ok(r.terminalCategory==='settled'||(
      seed==='87' && r.terminalCategory==='unsupported' &&
      r.unsupportedCapability==='multiple_winners'));
  }
  console.log('BOT_R4_TEN_SEED '+JSON.stringify(results));
});

test('R3 100 fixed-seed complete hands: observed coverage, settlements and replay',async()=>{
  const reports=[],failures=[];
  for(let n=0;n<100;n++){
    let r;
    try{r=await fullRound(''+n);}
    catch(e){failures.push({seed:n,error:String(e?.stack||e)});continue;}
    const {state,controller,...row}=r;
    reports.push(row);
    if(!row.completed||!row.replayMatch||row.invalidActions||row.stalls)
      failures.push(row);
    console.log('BOT_FULL_ROUND_SEED '+JSON.stringify(row));
  }
  const completed=reports.filter(r=>r.completed);
  const durations=reports.map(r=>r.decisionMs/r.decisionCount).filter(Number.isFinite)
    .sort((a,b)=>a-b);
  const summary={
    version:'bot-full-round-bench/0.2.0-r3-experimental',
    ruleRef,seedRange:'0..99',requested:100,executed:reports.length,
    completed:completed.length,
    completionRate:completed.length/100,
    wins:completed.filter(x=>x.finish==='win').length,
    draws:completed.filter(x=>x.finish==='exhaustive-draw').length,
    claims:reports.reduce((a,r)=>a+r.claimWindows,0),
    claimResponses:reports.reduce((a,r)=>a+r.claimResponses,0),
    settled:reports.filter(r=>r.terminalCategory==='settled').length,
    unsupported:reports.filter(r=>r.terminalCategory==='unsupported').length,
    invalid:reports.filter(r=>r.terminalCategory==='invalid').length,
    stalled:reports.filter(r=>r.terminalCategory==='stalled').length,
    replayMismatch:reports.filter(r=>r.terminalCategory==='replay-mismatch').length,
    unsupportedCodes:[...new Set(reports.filter(r=>r.terminalCategory==='unsupported')
      .map(r=>r.unsupportedCapability))],
    invalidActions:reports.reduce((a,r)=>a+r.invalidActions,0),
    stalls:reports.reduce((a,r)=>a+r.stalls,0),
    replayMatched:reports.filter(r=>r.replayMatch).length,
    prefixReplayMatched:reports.filter(r=>r.prefixReplayMatch).length,
    avgDecisionMs:durations.length?Number((durations.reduce((a,b)=>a+b,0)/durations.length).toFixed(3)):null,
    p95DecisionMs:durations.length?Number(durations[Math.ceil(.95*durations.length)-1].toFixed(3)):null,
    failedSeeds:failures.map(x=>x.seed),
    fullMatchGo:completed.length===100 && failures.length===0,
    limitations:'Coverage only. Unsupported is NOT settled. Full-match release gate requires 100/100 settled and verified policy.',
  };
  console.log('BOT_FULL_ROUND_SUMMARY '+JSON.stringify(summary));
  if(failures.length)console.log('BOT_FULL_ROUND_FAILURES '+JSON.stringify(failures));
  assert.equal(reports.length,100,'all 100 fixed seeds must execute');
  assert.equal(summary.invalidActions,0,'Bot must never submit forged or stale actions');
  assert.equal(summary.invalid,0);
  assert.equal(summary.stalled,0);
  assert.equal(summary.replayMismatch,0);
  assert.equal(summary.prefixReplayMatched,100,'unsupported prefix must also replay deterministically');
  // A known R3 experimental capability gap remains a distinct unresolved
  // FULL_MATCH_GO blocker, NOT a completed game and NOT a synthetic draw.
  const knownUnsupported=reports.filter(r=>r.terminalCategory==='unsupported');
  assert.ok(knownUnsupported.every(r=>r.seed==='87' &&
    r.unsupportedCapability==='multiple_winners'),
    'Any new or unexpected unsupported seed requires separate Rules adjudication');
  assert.equal(summary.settled+summary.unsupported,100);
  if(!summary.fullMatchGo)console.log('BOT_FULL_MATCH_GATE NO_GO '+JSON.stringify({
    actualSettled:summary.settled,unsupported:summary.unsupported,
    unsupportedCodes:summary.unsupportedCodes,failedSeeds:summary.failedSeeds,
  }));
  // Coverage/classification is allowed to pass while FULL_MATCH_GO stays NO-GO.
  // This test never asserts that unsupported counts as completion.
  // Explicitly verify Rules-authoritative next-round creation after settlement.
  const sample=await fullRound('next-round');
  assert.equal(sample.completed,true);
  const next=startNextRound(sample.state,{
    gameId:'bot-r3-next-round-2',seed:'next-round-seed',
  });
  assert.equal(next.round.handIndex,sample.state.round.handIndex+1);
  assert.equal(next.round.phase==='replacement'||next.round.phase==='await_discard',true);
  assert.equal(validateGameState(next,{replay:false}),true);
});
