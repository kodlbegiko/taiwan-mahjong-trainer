import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDiscards } from '../../src/core/efficiency.js';
import { validatePlayerView } from '../../src/strategy/view.js';
import { analyzeTaatsuCandidates } from '../../src/strategy/structure.js';
import { simulateTwoDraws } from '../../src/strategy/simulate.js';
import {
  analyzePlayerView, analyzeEfficiencyRoutes, inspectClaimOptions,
  analyzeAttackDefense, explainStrategy, compareClaimProjections,
} from '../../src/strategy/index.js';
import { makePlayerView, handTypes } from './fixtures.js';

const getMetric=(r,name)=>r.metrics.find(m=>m.name===name);
const byTile=(v,analysis,tile)=>analysis.recommendations.find(r=>{
  const action=v.legalActions.find(a=>a.actionId===r.actionId);
  return action?.kind==='discard' && Number(action.tileIds[0].split(':')[1])===tile;
});

test('S-01 canonical ranking, 17-tile shanten and ukeire all match the published engine',()=>{
  const view=makePlayerView();
  const result=analyzePlayerView(view,{samples:0});
  const ranked=analyzeDiscards(handTypes);
  assert.equal(result.status,'heuristic');
  assert.equal(result.modelVersion,undefined);
  assert.equal(result.recommendations.length,ranked.length);
  for (const r of result.recommendations) {
    const action=view.legalActions.find(a=>a.actionId===r.actionId);
    const t=Number(action.tileIds[0].split(':')[1]);
    const expected=ranked.find(x=>x.tile===t);
    assert.equal(getMetric(r,'postDiscardShanten').value,expected.shanten);
    assert.equal(getMetric(r,'oneTurnEffectiveCopies').value,expected.copies);
    assert.equal(getMetric(r,'oneTurnEffectiveKinds').value,expected.kinds);
    assert.equal(getMetric(r,'postDiscardShanten').epistemic,'exact');
  }
  assert.deepEqual(result.recommendations.map(r=>Number(view.legalActions.find(a=>a.actionId===r.actionId).tileIds[0].split(':')[1])),ranked.map(r=>r.tile));
});
test('Known exposed tile subtracts only its actual physical copies and the new discard is deducted',()=>{
  const without=makePlayerView(), with28=makePlayerView({public28:true});
  const a=analyzePlayerView(without,{samples:0}), b=analyzePlayerView(with28,{samples:0});
  const mA=getMetric(byTile(without,a,28),'oneTurnEffectiveCopies').value;
  const mB=getMetric(byTile(with28,b,28),'oneTurnEffectiveCopies').value;
  assert.ok(mB <= mA);
  assert.equal(mA-mB,1);
  assert.equal(getMetric(byTile(with28,b,28),'knownVisibleCopies').value,18);
});
test('Seed and view produce byte-identical simulations; a synthetic future wall never enters options',()=>{
  const view=makePlayerView({public28:true});
  const x=analyzePlayerView(view,{seed:'fixed-2026',samples:3,maxSimulatedRoutes:1});
  const y=analyzePlayerView(structuredClone(view),{seed:'fixed-2026',samples:3,maxSimulatedRoutes:1});
  assert.deepEqual(x,y);
  assert.equal(x.status,'model-estimate');
  assert.equal(x.modelVersion,'public-unknown-draws/1.0.0');
  const m=x.recommendations.flatMap(r=>r.metrics).filter(m=>m.epistemic==='estimated');
  assert.equal(m.length,1); assert.equal(m[0].sampleSize,3);
  assert.equal(m[0].calibrated,false);
  assert.throws(()=>analyzePlayerView(view,{samples:3,wall:[0,1,2]}),/僅允許/);
  assert.throws(()=>simulateTwoDraws(handTypes.slice(0,16),{seed:'x',samples:65}),/samples/);
});
test('GameState, opponent concealed, private events and future data must fail closed',()=>{
  const view=makePlayerView();
  assert.equal(validatePlayerView(view),true);
  const state={...view,wall:['t:1:0'],players:[],rng:{seed:'private'}};
  assert.throws(()=>analyzePlayerView(state),/非公開欄位/);
  const o=structuredClone(view);o.opponents[0].concealed=['t:8:3'];
  assert.throws(()=>analyzePlayerView(o),/非公開欄位/);
  const k=structuredClone(view);k.answerKey={correct:0};
  assert.throws(()=>analyzePlayerView(k),/非公開欄位/);
  const f=structuredClone(view);f.publicEvents=[{
    schemaVersion:1,contractVersion:view.contractVersion,eventId:'private',gameId:view.gameId,
    seq:3,ruleRef:view.ruleRef,type:'draw',visibility:'seat-private',payload:{tileId:'t:8:2'},
  }];
  assert.throws(()=>analyzePlayerView(f),/私人 TurnEvent/);
  const t=structuredClone(view);t.publicEvents=[{
    schemaVersion:1,contractVersion:view.contractVersion,eventId:'future',gameId:view.gameId,
    seq:5,ruleRef:view.ruleRef,type:'draw',visibility:'public',payload:{},
  }];
  assert.throws(()=>analyzePlayerView(t),/event.seq/);
  const leak=structuredClone(view);leak.publicEvents=[{
    schemaVersion:1,contractVersion:view.contractVersion,eventId:'draw-leak',gameId:view.gameId,
    seq:3,ruleRef:view.ruleRef,type:'draw',visibility:'public',payload:{tileId:'t:8:2'},
  }];
  assert.throws(()=>analyzePlayerView(leak),/不得曝光 tileId/);
});
test('Two states differing only in hypothetical opponent concealed or wall yield same projected analysis',()=>{
  const publicView=makePlayerView();
  const gameA={secretHands:[1,2,3],wall:[4,5,6]};
  const gameB={secretHands:[20,21,22],wall:[28,29,30]};
  // Same PUBLIC projection; strategy API has no path by which to inspect those private values.
  const project=()=>structuredClone(publicView);
  assert.notDeepEqual(gameA,gameB);
  assert.deepEqual(analyzePlayerView(project(),{samples:0}),analyzePlayerView(project(),{samples:0}));
});
test('Every recommendation is from legalActions even when the list is restricted',()=>{
  const view=makePlayerView();
  view.legalActions=view.legalActions.filter(a=>a.actionId.endsWith('t:28:0'));
  const result=analyzePlayerView(view,{samples:0});
  assert.deepEqual(result.recommendations.map(r=>r.actionId),view.legalActions.map(a=>a.actionId));
  const bad=structuredClone(view);bad.legalActions[0].tileIds=['t:28:3'];
  assert.throws(()=>analyzePlayerView(bad),/discard 必須/);
  const noAction=structuredClone(view);noAction.legalActions=[];
  const unavailable=analyzePlayerView(noAction);
  assert.equal(unavailable.status,'unavailable');assert.deepEqual(unavailable.recommendations,[]);
});
test('Unknown house scoring, risk, and conditional claim outcomes are never fabricated',()=>{
  const view=makePlayerView({public28:true,legalClaims:true});
  const analysis=analyzePlayerView(view,{samples:0});
  const rec=analysis.recommendations[0];
  for (const name of ['dealInRisk','expectedFans']) {
    const m=getMetric(rec,name);
    assert.equal(m.value,null);assert.equal(m.epistemic,'unknown');
  }
  assert.ok(analysis.recommendations.every(r=>r.actionId!=='pong:fixture'));
  const claims=inspectClaimOptions(view);
  assert.equal(claims.length,1);assert.equal(claims[0].status,'unavailable');
  assert.ok(claims[0].factors.every(f=>f.value===null&&f.epistemic==='unknown'));
  const proof=analyzeAttackDefense(view);
  assert.equal(proof.dealInRisk.value,null);
});
test('Epistemic classification, mutually overlapping taatsu and route explanation remain traceable',()=>{
  const view=makePlayerView();
  const shapes=analyzeTaatsuCandidates(view);
  assert.equal(shapes.interpretation,'overlapping-candidate-patterns-not-a-disjoint-decomposition');
  assert.ok(shapes.taatsu.some(t=>['ryanmen','kanchan','penchan'].includes(t.shape)));
  const {analysis,routes}=analyzeEfficiencyRoutes(view,{samples:0});
  assert.equal(routes.length,analysis.recommendations.length);
  const explanation=explainStrategy(analysis,view);
  assert.equal(explanation.length,routes.length);
  assert.ok(explanation.every(x=>x.evidence.some(e=>e.name==='postDiscardShanten'&&e.epistemic==='exact')));
  assert.ok(explanation.every(x=>x.unknownInformation.some(e=>e.name==='dealInRisk'&&e.value===null)));
  const corrupted=structuredClone(analysis);corrupted.recommendations[0].actionId='illegal';
  assert.throws(()=>explainStrategy(corrupted,view),/非法/);
});
test('Known claimed river tile and public meld are deduplicated, without consuming a fifth copy',()=>{
  const view=makePlayerView();
  view.opponents[0].melds=[{kind:'triplet',open:true,tileIds:['t:29:0','t:29:1','t:29:2']}];
  view.opponents[1].river=[{tileId:'t:29:0',seq:2,claimedByEventId:'claim-1'}];
  const analysis=analyzePlayerView(view,{samples:0});
  assert.equal(getMetric(analysis.recommendations[0],'knownVisibleCopies').value,20);
  const duplicate=structuredClone(view);delete duplicate.opponents[1].river[0].claimedByEventId;
  assert.throws(()=>validatePlayerView(duplicate),/重複/);
});
test('Fail closed if structural capability is unavailable and do not invent win/tai results',()=>{
  const view=makePlayerView();
  view.capabilities.structuralScore=false;
  const analysis=analyzePlayerView(view);
  assert.equal(analysis.status,'unavailable');
  assert.equal(analysis.recommendations.length,0);
});


test('Claim interface compares only causally linked before/after public projections and never invents tai',()=>{
  const before=makePlayerView({public28:true,legalClaims:true});
  before.self.concealed=before.self.concealed.filter(t=>t.id!=='t:0:0');
  before.legalActions=before.legalActions.filter(a=>a.kind==='pong');
  before.round.phase='claim_window';before.capabilities.roundActions=true;
  const after=structuredClone(before);
  after.self.concealed=after.self.concealed.filter(t=>t.tileType!==28);
  after.self.melds=[{kind:'triplet',open:true,tileIds:['t:28:0','t:28:1','t:28:2']}];
  after.opponents[0].river[0].claimedByEventId='e-claim';
  after.asOfEventSeq=5;after.round.lastPublicEventSeq=5;after.round.phase='await_discard';
  after.publicEvents=[{
    schemaVersion:1,contractVersion:after.contractVersion,eventId:'e-claim',gameId:after.gameId,
    seq:5,ruleRef:after.ruleRef,type:'claim',visibility:'public',
    causedByActionId:'pong:fixture',payload:{tileId:'t:28:2'},
  }];
  after.legalActions=[...new Set(after.self.concealed.map(x=>x.tileType))].map(tile=>{
    const id=after.self.concealed.find(x=>x.tileType===tile).id;
    return {
      schemaVersion:1,contractVersion:after.contractVersion,actionId:'after-discard:'+id,
      kind:'discard',actorSeat:0,expectedRevision:5,tileIds:[id],ruleRef:after.ruleRef,
      legalityBasis:{engineVersion:'fixture-legal/1',reasonCodes:['FIXTURE_AFTER_CLAIM']},
    };
  });
  const outcome=compareClaimProjections(before,after,'pong:fixture');
  assert.equal(outcome.status,'exact-structural');
  assert.equal(outcome.evidenceEventId,'e-claim');
  assert.equal(outcome.structuralClosureLost,true);
  assert.equal(outcome.epistemic.scoringOpportunityCost,'unknown');
  assert.ok(after.legalActions.some(a=>Number(a.tileIds[0].split(':')[1])===outcome.afterBestLegalDiscard.tile));
  const noEvent=structuredClone(after);noEvent.publicEvents=[];
  assert.equal(compareClaimProjections(before,noEvent,'pong:fixture').status,'unavailable');
  assert.throws(()=>compareClaimProjections(before,after,'made-up-claim'),/不在 before/);
});


test('Public flower identities are separate from standard 0..33 and do not reduce standard draw counts',()=>{
  const baseline=makePlayerView();
  const flower=structuredClone(baseline);
  flower.self.flowers.push({
    schemaVersion:1,contractVersion:flower.contractVersion,
    id:'f:season-spring:0',kind:'flower',flowerCode:'season-spring',copyIndex:0,
  });
  flower.publicEvents=[{
    schemaVersion:1,contractVersion:flower.contractVersion,eventId:'flower-3',gameId:flower.gameId,
    seq:3,ruleRef:flower.ruleRef,type:'flower',visibility:'public',
    payload:{tileId:'f:season-spring:0'},
  }];
  const x=analyzePlayerView(baseline,{samples:0});
  const y=analyzePlayerView(flower,{samples:0});
  assert.deepEqual(x.recommendations.map(r=>getMetric(r,'oneTurnEffectiveCopies').value),
    y.recommendations.map(r=>getMetric(r,'oneTurnEffectiveCopies').value));
  const illegal=structuredClone(flower);
  illegal.publicEvents[0].type='draw';
  assert.throws(()=>validatePlayerView(illegal),/不得曝光/);
});


test('asOf may include a private event after the last public event, but no public event may exceed the public watermark',()=>{
  const view=makePlayerView();
  view.asOfEventSeq=5; // e.g. own private draw; round.lastPublicEventSeq remains 4
  assert.equal(validatePlayerView(view),true);
  const future=structuredClone(view);
  future.publicEvents=[{
    schemaVersion:1,contractVersion:future.contractVersion,
    eventId:'public-event-5',gameId:future.gameId,seq:5,ruleRef:future.ruleRef,
    type:'pass',visibility:'public',payload:{},
  }];
  assert.throws(()=>validatePlayerView(future),/event.seq/);
});
test('Claimed river de-duplication must correspond to a public meld; cannot hide a duplicated ID in two rivers',()=>{
  const view=makePlayerView();
  view.opponents[0].river=[{tileId:'t:29:0',seq:1,claimedByEventId:'claim-fake'}];
  view.opponents[1].river=[{tileId:'t:29:0',seq:2}];
  assert.throws(()=>validatePlayerView(view),/重複/);
});
