import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  createGame, createPlayerView, listLegalActions, listPendingClaimResponders,
  applyAction, validateGameState, replayGame,
} from '../../src/rules/index.js';
import {analyzePlayerView} from '../../src/strategy/index.js';
import {analyzeDiscards,analyzeDraws} from '../../src/core/efficiency.js';
import {readBotView,isSupportedBotTableProfile} from '../../src/bots/view.js';
import {createBot,chooseBotAction,validateBotDecision} from '../../src/bots/index.js';

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
// Twenty independent seeds: 20 x 4 target seats x 2 policies = 160 games.
// Beginner/Advanced get separate four-seed controlled smoke comparisons.
const seeds=(process.env.R7_BENCH_SEEDS||
  Array.from({length:20},(_,i)=>String(i)).join(',')).split(',').map(s=>s.trim());
if(!seeds.every(s=>/^\d+$/.test(s)))throw new RangeError('R7_BENCH_SEEDS must be comma-separated integer seeds');
const explicitLevel=process.env.R7_BENCH_LEVEL;
const levels=explicitLevel?[explicitLevel]:['Intermediate','Beginner','Advanced'];
if(!levels.every(x=>['Beginner','Intermediate','Advanced'].includes(x)))throw new RangeError('R7_BENCH_LEVEL invalid');
const MAX_ACTIONS=1800;

function runMatch(seed,targetSeat,contender,contenderLevel){
  // The host alone owns full state. Decisions receive PlayerView only.
  let state=createGame({
    gameId:`r7-compare-${seed}`,
    seed:`fixed-round-${seed}`,dealerSeat:Number(BigInt(seed)%4n),...REF,
  });
  const bots=Array.from({length:4},(_,seat)=>createBot({
    seat,difficulty:seat===targetSeat&&contender?contenderLevel:'Intermediate',
    seed:'r7-compare-independent-seat-'+seat,
  }));
  let invalid=0,decisions=0,decisionMs=0,submitted=0;
  let targetDecisions=0,targetDecisionMs=0;
  while(state.round.phase!=='settled' && submitted<MAX_ACTIONS){
    const seat=state.round.phase==='claim_window'
      ? listPendingClaimResponders(state)[0] : state.round.currentSeat;
    assert.ok(Number.isInteger(seat),'Rules must supply pending responder');
    const view=createPlayerView(state,seat);
    const start=performance.now();
    let actionId, proposed=null;
    if(contender&&seat===targetSeat){
      proposed=chooseBotAction(bots[seat],view);
      actionId=proposed.status==='ready'?proposed.actionId:null;
    }else actionId=legacyIntermediateAction(bots[seat],view);
    // Time decision policy only; the contender's extra validation belongs to
    // the legality gate, not a one-sided addition to its latency metric.
    const elapsed=performance.now()-start;
    decisionMs+=elapsed;
    decisions++;
    if(seat===targetSeat){targetDecisionMs+=elapsed;targetDecisions++;}
    if(proposed!==null)validateBotDecision(bots[seat],view,proposed);
    const offered=view.legalActions.find(a=>a.actionId===actionId);
    if(!offered){invalid++;break;}
    try {
      state=applyAction(state,{
        actorSeat:seat,actionId:offered.actionId,
        expectedRevision:offered.expectedRevision,
      }).state;
    }catch(error){invalid++;throw error;}
    submitted++;
  }
  assert.equal(invalid,0,`illegal action seed=${seed} target=${targetSeat}`);
  assert.equal(state.round.phase,'settled',`unfinished seed=${seed} target=${targetSeat}`);
  assert.equal(validateGameState(state,{replay:false}),true);
  assert.deepEqual(replayGame(state),state);
  const result=state.extensions.tw16.result;
  assert.ok(['win','exhaustive-draw'].includes(result?.reason));
  return {
    seed,targetSeat,contender,finish:result.reason,
    won:result.winnerSeat===targetSeat,
    drew:result.reason==='exhaustive-draw',
    dealIn:result.reason==='win'&&result.via==='discard'&&
      result.sourceSeat===targetSeat&&result.winnerSeat!==targetSeat,
    invalid,decisions,submitted,decisionMs,targetDecisions,targetDecisionMs,
    replayMatched:true,
  };
}
function summary(rows){
  const total=rows.length;
  const ms=rows.reduce((n,r)=>n+r.decisionMs,0);
  const decisions=rows.reduce((n,r)=>n+r.decisions,0);
  const targetDecisions=rows.reduce((n,r)=>n+r.targetDecisions,0);
  const targetMs=rows.reduce((n,r)=>n+r.targetDecisionMs,0);
  return {
    games:total,wins:rows.filter(r=>r.won).length,
    winRate:rows.filter(r=>r.won).length/total,
    draws:rows.filter(r=>r.drew).length,
    drawRate:rows.filter(r=>r.drew).length/total,
    dealIns:rows.filter(r=>r.dealIn).length,
    dealInRate:rows.filter(r=>r.dealIn).length/total,
    invalidActions:rows.reduce((n,r)=>n+r.invalid,0),
    actions:rows.reduce((n,r)=>n+r.submitted,0),
    decisions,
    avgDecisionMs:Number((ms/decisions).toFixed(3)),
    targetDecisions,
    avgTargetDecisionMs:targetDecisions?
      Number((targetMs/targetDecisions).toFixed(3)):null,
    replayMatches:rows.filter(r=>r.replayMatched).length,
  };
}

for(const contenderLevel of levels)test('R7 paired 4-seat baseline vs '+contenderLevel+'; measured outcomes',
  {timeout:1200000},()=>{
    const testSeeds=explicitLevel||contenderLevel==='Intermediate'?seeds:seeds.slice(0,4);
    const before=[],after=[];
    for(const seed of testSeeds){
      for(let seat=0;seat<4;seat++){
        before.push(runMatch(seed,seat,false,contenderLevel));
        after.push(runMatch(seed,seat,true,contenderLevel));
      }
    }
    const baseline=summary(before),candidate=summary(after);
    const report={
      benchmark:'R7-paired-baseline/1.0',sourceBaseline:'pre-R7 Intermediate snapshot',
      contenderLevel,profile:REF,scoring:'tw16-minimal-tai-v1 EXPERIMENTAL',
      seeds:testSeeds,seats:[0,1,2,3],opponents:'three fixed pre-R7 Intermediate',
      pairedGames:before.length,baseline,candidate,
      byTargetSeat:[0,1,2,3].map(seat=>({
        seat,
        baseline:summary(before.filter(x=>x.targetSeat===seat)),
        candidate:summary(after.filter(x=>x.targetSeat===seat)),
      })),
      delta:{winRate:Number((candidate.winRate-baseline.winRate).toFixed(4)),
        dealInRate:Number((candidate.dealInRate-baseline.dealInRate).toFixed(4)),
        drawRate:Number((candidate.drawRate-baseline.drawRate).toFixed(4))},
      bySeed:testSeeds.map(seed=>({seed,baseline:summary(before.filter(x=>x.seed===seed)),candidate:summary(after.filter(x=>x.seed===seed))})),
      limitations:'Seat outcomes share seed; use seed-clustered analysis. Beginner/Advanced smoke defaults to four seeds only. Hardware timing is runner-specific.',
    };
    console.log('BOT_R7_PAIRED_BENCHMARK '+JSON.stringify(report));
    assert.equal(before.length,testSeeds.length*4);
    assert.equal(after.length,before.length);
    assert.equal(baseline.invalidActions,0);assert.equal(candidate.invalidActions,0);
    assert.equal(baseline.replayMatches,before.length);
    assert.equal(candidate.replayMatches,after.length);
    assert.ok(Number.isFinite(candidate.avgDecisionMs));
    assert.ok(Number.isFinite(baseline.avgDecisionMs));
    assert.ok(Number.isFinite(candidate.avgTargetDecisionMs));
    assert.ok(Number.isFinite(baseline.avgTargetDecisionMs));
});
