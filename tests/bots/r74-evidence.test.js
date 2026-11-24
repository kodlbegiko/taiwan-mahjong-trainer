import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGameEvidence,passesLatencyBudget} from '../../scripts/bots/r74-evidence.js';

const policies=['Beginner','Intermediate','Advanced','combined'];
const seed=2000;
const fixture=()=>({seed,gameId:'r73-game-2000',wallSeed:'r73-wall-2000',dealerSeat:0,
  mode:'paired',target:1,lineup:['legacy','combined','legacy','legacy'],finish:'win',
  replayMatched:true,invalidActions:0,actions:4,
  observations:['legacy','combined','legacy','legacy'].map((policy,seat)=>({
    policy,seat,won:seat===1?1:0,dealIn:seat===0?1:0,draw:0,score:[-5,5,0,0][seat],
    actions:1,discardActions:1,legalClaimWindows:0,claimActions:0,claimPasses:0,
    ownKongOffers:0,ownKongs:0,latencyMs:[1],postDiscardShanten:[2],meanShanten:2
  }))});
const check=g=>validateGameEvidence(g,new Set([seed]),policies,'validation','combined');

test('R7.4 benchmark evidence accepts valid paired and zero-score draw records',()=>{
  assert.doesNotThrow(()=>check(fixture()));
  const g=fixture();g.finish='exhaustive-draw';
  for(const o of g.observations){o.won=0;o.dealIn=0;o.draw=1;o.score=0;}
  assert.doesNotThrow(()=>check(g));
});

test('R7.4 benchmark evidence rejects malformed, misattributed and incomplete observations',()=>{
  const mutations=[
    g=>g.mode='unknown',g=>g.lineup[1]='unknown',g=>g.target=9,
    g=>g.observations.pop(),g=>g.observations.reverse(),g=>g.observations[1].policy='legacy',
    g=>g.observations[0].score=0,g=>g.observations[0].won=1,
    g=>g.observations[0].draw=1,g=>g.observations[0].latencyMs=[],
    g=>g.observations[0].latencyMs=[null],g=>g.observations[0].latencyMs=[-1],
    g=>g.observations[0].meanShanten=9,g=>g.actions=5,
    g=>g.wallSeed='other',g=>g.invalidActions=1,g=>g.replayMatched=false
  ];
  for(const mutate of mutations){const g=fixture();mutate(g);assert.throws(()=>check(g));}
});

test('R7.4 latency gate refuses absent and malformed measurements',()=>{
  for(const m of [{decisionCount:0,p95DecisionMs:null,p99DecisionMs:null},
    {decisionCount:2,p95DecisionMs:null,p99DecisionMs:null},
    {decisionCount:2,p95DecisionMs:NaN,p99DecisionMs:10},
    {decisionCount:2,p95DecisionMs:50,p99DecisionMs:49},
    {decisionCount:2,p95DecisionMs:51,p99DecisionMs:80},
    {decisionCount:2,p95DecisionMs:40,p99DecisionMs:101}])assert.equal(passesLatencyBudget(m),false);
  assert.equal(passesLatencyBudget({decisionCount:2,p95DecisionMs:50,p99DecisionMs:100}),true);
});
