import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createGame,createPlayerView,listPendingClaimResponders,applyAction,validateGameState,replayGame,getRuleCapabilities} from '../../src/rules/index.js';
import {analyzePlayerView} from '../../src/strategy/index.js';
import {analyzeDiscards,analyzeDraws,calculateShanten} from '../../src/core/efficiency.js';
import {readBotView,isSupportedBotTableProfile} from '../../src/bots/view.js';
import {createBot,chooseBotAction,validateBotDecision,chooseExperimentalAdvancedAction} from '../../src/bots/decision.js';
import {R73_VARIANTS} from '../../src/bots/strategy-r7.js';
// Snapshot of pre-R7 Intermediate, for an actual before/after comparison.
// Intentionally kept test-only; nobody imports the opponent's GameState into
// a Bot. This reference preserves the old seeded self-kong and >=0 claim.
function hash(input){
  let n=2166136261;
  for(const c of input){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}
  return n>>>0;
}
function roll(seed){
  let s=hash(seed)||0x9e3779b9;
  s^=s<<13;s^=s>>>17;s^=s<<5;
  return (s>>>0)/4294967296;
}
function legacyIntermediateAction(bot,input){
  const {view,hand,visible,fixedMelds}=readBotView(input);
  assert.equal(view.audienceSeat,bot.seat);
  const seed=[bot.seed,view.gameId,view.asOfEventSeq,bot.seat,'Intermediate'].join('|');
  const legal=view.legalActions;
  for(const kind of ['win','draw','replace_flower']){
    const a=legal.find(x=>x.kind===kind);if(a)return a.actionId;
  }
  const ownKong=legal.find(a=>a.kind==='kong' &&
    ['CONCEALED_KONG','ADDED_KONG'].includes(a.legalityBasis.reasonCodes[0]));
  if(ownKong&&roll(seed+'|self-kong')<0.4)return ownKong.actionId;
  const discards=legal.filter(a=>a.kind==='discard');
  if(discards.length){
    if(!view.capabilities.structuralScore) return null;
    return analyzePlayerView(view,{seed,samples:0,maxSimulatedRoutes:0})
      .recommendations[0]?.actionId??null;
  }
  const pass=legal.find(a=>a.kind==='pass');
  const claims=legal.filter(a=>['chi','pong','kong'].includes(a.kind));
  if(pass&&claims.length&&isSupportedBotTableProfile(view.ruleRef)&&
     view.round.phase==='claim_window'&&view.capabilities.structuralScore){
    const own=new Set(view.self.concealed.map(t=>t.id));
    const before=analyzeDraws(hand,{visible,fixedMelds}).shanten;
    const candidates=[];
    for(const a of claims){
      const used=a.tileIds.filter(id=>own.has(id));
      if(used.length!==(a.kind==='kong'?3:2))continue;
      const after=[...hand];
      for(const id of used){
        const type=Number(id.split(':')[1]),pos=after.indexOf(type);
        if(pos<0)throw new RangeError('Invalid legacy claim fixture');
        after.splice(pos,1);
      }
      const next=fixedMelds+1;
      if(next>5)continue;
      const projected=a.kind==='kong'
        ? analyzeDraws(after,{visible,fixedMelds:next}).shanten
        : Math.min(...analyzeDiscards(after,{visible,fixedMelds:next}).map(x=>x.shanten));
      if(Number.isFinite(projected))candidates.push({a,benefit:before-projected});
    }
    candidates.sort((a,b)=>b.benefit-a.benefit||
      a.a.actionId.localeCompare(b.a.actionId));
    if(candidates[0]&&candidates[0].benefit>=0)return candidates[0].a.actionId;
  }
  return pass?.actionId??claims[0]?.actionId??null;
}


const REF={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const cap=getRuleCapabilities(REF);
assert.equal(cap.scoring.policy,'tw16-minimal-tai-v1','Scoring policy changed; do not combine results');
const SCORE=cap.scoring.policy;
const [phase,batchArg,outPath,selectedArg]=process.argv.slice(2);
const batch=Number(batchArg),selected=selectedArg||'combined';
assert.ok(['calibration','validation','smoke'].includes(phase));
assert.ok(Number.isInteger(batch)&&batch>=0);
assert.ok(outPath);
assert.ok(R73_VARIANTS.includes(selected));
const size=phase==='calibration'?5:phase==='validation'?10:1;
const limit=phase==='calibration'?4:phase==='validation'?10:1;
assert.ok(batch<limit);
const seeds=Array.from({length:size},(_,i)=>(phase==='calibration'?1000:phase==='validation'?2000:3000)+batch*size+i);
const raw={schema:'r73-benchmark/1.0',sourceSHA:process.env.GITHUB_SHA??null,
  phase,batch,seeds,selected:phase==='validation'?selected:null,profile:REF,scoring:SCORE,
  policies:['legacy','Beginner','Intermediate','Advanced',...R73_VARIANTS],
  games:[],failure:null};
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function play(seed,lineup,mode,target=null){
  const gameId='r73-game-'+seed,wallSeed='r73-wall-'+seed,dealerSeat=seed%4;
  let state=createGame({gameId,seed:wallSeed,dealerSeat,...REF});
  const bots=lineup.map((p,seat)=>createBot({seat,difficulty:p==='legacy'?'Intermediate':
    R73_VARIANTS.includes(p)?'Advanced':p,seed:'r73-seat-'+seat}));
  const stats=lineup.map(policy=>({policy,latencyMs:[],postDiscardShanten:[],
    legalClaimWindows:0,claimActions:0,claimPasses:0,ownKongOffers:0,ownKongs:0,
    discardActions:0,actions:0}));
  let actions=0;
  while(state.round.phase!=='settled'){
    assert.ok(actions<1800,'action limit exceeded');
    const seat=state.round.phase==='claim_window'?listPendingClaimResponders(state)[0]:state.round.currentSeat;
    assert.ok(Number.isInteger(seat));
    const view=createPlayerView(state,seat),policy=lineup[seat],bot=bots[seat],s=stats[seat];
    const start=performance.now();
    const d=policy==='legacy'?null:R73_VARIANTS.includes(policy)
      ?chooseExperimentalAdvancedAction(bot,view,policy):chooseBotAction(bot,view);
    const actionId=policy==='legacy'?legacyIntermediateAction(bot,view):d.actionId;
    s.latencyMs.push(performance.now()-start);
    if(d){assert.equal(d.status,'ready');validateBotDecision(bot,view,d);}
    const a=view.legalActions.find(x=>x.actionId===actionId);
    assert.ok(a,'illegal or missing decision');
    const hasClaim=view.round.phase==='claim_window'&&view.legalActions.some(x=>['chi','pong','kong'].includes(x.kind));
    if(hasClaim){s.legalClaimWindows++;if(a.kind==='pass')s.claimPasses++;else if(['chi','pong','kong'].includes(a.kind))s.claimActions++;}
    if(view.round.phase==='await_discard'&&view.legalActions.some(x=>x.kind==='kong')){
      s.ownKongOffers++;if(a.kind==='kong')s.ownKongs++;
    }
    if(a.kind==='discard'){
      const hand=view.self.concealed.filter(t=>t.id!==a.tileIds[0]).map(t=>t.tileType);
      s.postDiscardShanten.push(calculateShanten(hand,{fixedMelds:view.self.melds.length}));
      s.discardActions++;
    }
    state=applyAction(state,{actorSeat:seat,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
    s.actions++;actions++;
  }
  assert.equal(validateGameState(state,{replay:false}),true);
  assert.deepEqual(replayGame(state),state);
  const result=state.extensions.tw16.result;
  assert.ok(['win','exhaustive-draw'].includes(result.reason));
  assert.ok(Array.isArray(result.delta)&&result.delta.length===4&&result.delta.every(Number.isFinite));
  assert.equal(result.delta.reduce((a,b)=>a+b,0),0);
  const observations=stats.map((s,seat)=>({...s,seat,won:result.winnerSeat===seat?1:0,
    dealIn:result.reason==='win'&&result.via==='discard'&&result.sourceSeat===seat&&result.winnerSeat!==seat?1:0,
    draw:result.reason==='exhaustive-draw'?1:0,score:result.delta[seat],
    meanShanten:mean(s.postDiscardShanten)}));
  return {seed,gameId,wallSeed,dealerSeat,mode,target,lineup,finish:result.reason,
    replayMatched:true,invalidActions:0,actions,observations};
}
try{
  for(const seed of seeds){
    // One deterministic all-legacy match supplies all four paired seat controls.
    raw.games.push(play(seed,Array(4).fill('legacy'),'baseline'));
    const contenders=phase==='calibration'?['Advanced',...R73_VARIANTS]:
      ['Beginner','Intermediate','Advanced',selected];
    for(const policy of contenders)for(let seat=0;seat<4;seat++){
      const lineup=Array(4).fill('legacy');lineup[seat]=policy;
      raw.games.push(play(seed,lineup,'paired',seat));
    }
    if(phase!=='calibration'){
      // All four policies occupy every seat once per seed; fixed dealer.
      const lineup=['Beginner','Intermediate',selected,'legacy'];
      for(let rotate=0;rotate<4;rotate++)
        raw.games.push(play(seed,Array.from({length:4},(_,seat)=>lineup[(seat+rotate)%4]),'direct'));
    }
  }
}catch(e){raw.failure={name:e.name,message:e.message};process.exitCode=1;}
finally{
  mkdirSync(dirname(outPath),{recursive:true});
  writeFileSync(outPath,JSON.stringify(raw));
  console.log('BOT_R73_BATCH '+JSON.stringify({phase,batch,seeds,selected:raw.selected,games:raw.games.length,scoring:SCORE,sourceSHA:raw.sourceSHA,failure:raw.failure}));
}
