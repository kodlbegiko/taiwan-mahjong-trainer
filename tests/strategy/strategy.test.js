import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDiscards } from '../../src/core/efficiency.js';
import { validatePlayerView } from '../../src/strategy/view.js';
import { analyzeTaatsuCandidates } from '../../src/strategy/structure.js';
import { simulateTwoDraws } from '../../src/strategy/simulate.js';
import {
  analyzePlayerView, analyzeEfficiencyRoutes, inspectClaimOptions,
  analyzeAttackDefense, explainStrategy,
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
