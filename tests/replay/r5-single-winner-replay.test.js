import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, getRuleProfile, listLegalActions, applyAction, createPlayerView,
  replayGame, RuleCapabilityError,
} from '../../src/rules/index.js';
import { SEED_87_R4 as GOLDEN } from '../rules/fixtures/seed-87-r4-trace.js';
import { createReplayService, ReplayError } from '../../src/replay/index.js';
import { validateReplayArchive } from '../../src/replay/internal.js';

const NEW={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const LEGACY={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
let r5Ready=false;
try { r5Ready=getRuleProfile(NEW.profileId,NEW.ruleVersion).status==='experimental'; }
catch { /* Rules R5 is a source PR dependency, not present in standalone Replay #41. */ }
const unavailable=r5Ready?false:'R5 Rules #43 source must be integrated; standalone Replay adapter is not acceptance';
const clone=x=>JSON.parse(JSON.stringify(x));
function play(ref){
  let state=createGame({gameId:GOLDEN.gameId,seed:GOLDEN.seed,...ref});
  for(const [revision,seat,id,after] of GOLDEN.successfulActions){
    assert.equal(state.revision,revision);
    const action=listLegalActions(state,seat).find(a=>a.actionId===id);
    assert.ok(action,'Original Rules-issued action missing at '+revision);
    state=applyAction(state,{actorSeat:action.actorSeat,actionId:action.actionId,
      expectedRevision:action.expectedRevision}).state;
    assert.equal(state.revision,after);
  }
  return state;
}
function pass(state){
  const action=listLegalActions(state,1).find(a=>a.kind==='pass');
  assert.ok(action);
  return applyAction(state,{actorSeat:1,actionId:action.actionId,
    expectedRevision:action.expectedRevision}).state;
}

test('R5 Replay: Legacy Seed87 still fails closed without mutation',{skip:unavailable},()=>{
  const state=play(LEGACY),before=clone(state);
  assert.equal(state.revision,162);
  assert.throws(()=>pass(state),e=>e instanceof RuleCapabilityError &&
    e.code==='UNSUPPORTED_RULE_CAPABILITY' && e.capability==='multiple_winners');
  assert.deepEqual(state,before);
});

test('R5 Replay: claim-window WIN/WIN/PASS is atomic, deterministic, privately staged and publicly resolved',{skip:unavailable},()=>{
  const before=play(NEW);
  assert.equal(before.revision,162);
  assert.deepEqual(before.extensions.tw16.window.decisions.map(d=>d.kind),['win','win']);
  const beforeView=createPlayerView(before,1);
  assert.equal(JSON.stringify(beforeView.publicEvents).includes('multiple_winners'),false);
  const final=pass(before);
  assert.equal(final.revision,165);
  assert.equal(final.round.phase,'settled');
  assert.equal(final.extensions.tw16.result.winnerSeat,3);
  assert.deepEqual(final.extensions.tw16.result.claimResolution.declaredWinSeats,[3,0]);
  assert.deepEqual(final.extensions.tw16.result.claimResolution.interceptedWinSeats,[0]);
  assert.deepEqual(final.extensions.tw16.result.delta,[0,0,-100,100]);
  assert.equal(final.extensions.tw16.result.delta.reduce((a,b)=>a+b,0),0);
  assert.deepEqual(final.events.slice(-3).map(e=>e.type),['pass','win','settle']);
  assert.deepEqual(replayGame(final),final);

  const storage=new Map([['tw-mahjong-trainer:archive:v3','do-not-touch']]);
  const replay=createReplayService({storage});
  const manifest=replay.saveReplay(final,{ownerSeat:1,disclosurePolicy:'settled-public-only'});
  assert.equal(manifest.completionStatus,'settled-experimental');
  assert.equal(manifest.ruleRef.profileId,NEW.profileId);
  assert.equal(manifest.eventCount,165);
  assert.equal(manifest.postgameAvailable,true);
  assert.equal(storage.get('tw-mahjong-trainer:archive:v3'),'do-not-touch');
  const boundaries=replay.listReplayFrameBoundaries(manifest.replayId,{viewerSeat:1});
  assert.equal(boundaries.at(-2),162);
  assert.equal(boundaries.at(-1),165);
  assert.equal(boundaries.includes(163),false);
  assert.equal(boundaries.includes(164),false);
  for(const seq of [163,164])assert.throws(()=>replay.getReplayFrame(manifest.replayId,seq,{viewerSeat:1}),
    e=>e instanceof ReplayError && e.code==='NON_ATOMIC_EVENT_SEQ');
  const pre=replay.getReplayFrame(manifest.replayId,162,{viewerSeat:1});
  assert.deepEqual(pre.playerView,beforeView);
  assert.equal(pre.playerView.round.phase,'claim_window');
  assert.ok(pre.playerView.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  assert.equal(Object.hasOwn(pre.playerView,'rng'),false);
  assert.equal(Object.hasOwn(pre.playerView,'wall'),false);
  assert.equal(JSON.stringify(pre).includes(GOLDEN.seed),false);
  const post=replay.getReplayFrame(manifest.replayId,162,{viewerSeat:1,perspective:'postgame'});
  assert.deepEqual(post.playerView,pre.playerView);
  assert.deepEqual(post.postgameDisclosure.outcome.delta,[0,0,-100,100]);
  assert.deepEqual(post.postgameDisclosure.outcome.singleWinnerArbitration,{
    selectedSeat:3,declaredWinSeats:[3,0],interceptedWinSeats:[0],status:'experimental',
  });
  assert.equal(post.postgameDisclosure.allowedForDecisionScoring,false);
  assert.equal(JSON.stringify(post).includes(GOLDEN.seed),false);
  assert.equal(JSON.stringify(post).includes('selectedClaimActionId'),false);
  // Every viewer gets only its own canonical final hand, including when
  // public WIN has an arbitration DTO unsupported by Strategy V1.
  for(const ownerSeat of [0,1,2,3]){
    const api=createReplayService({storage:new Map()});
    const meta=api.saveReplay(final,{ownerSeat,disclosurePolicy:'settled-public-only'});
    const frame=api.getReplayFrame(meta.replayId,165,{viewerSeat:ownerSeat});
    assert.deepEqual(frame.playerView,createPlayerView(final,ownerSeat,165));
    assert.equal(frame.publicEvent.type,'settle');
    assert.deepEqual(frame.playerView.legalActions,[]);
    assert.equal(frame.postgameDisclosure,null);
    assert.ok(frame.playerView.opponents.every(p=>!Object.hasOwn(p,'concealed')));
    assert.equal(frame.playerView.publicEvents.filter(e=>e.payload.claimResolution).length,1);
    const terminalPost=api.getReplayFrame(meta.replayId,165,{viewerSeat:ownerSeat,perspective:'postgame'});
    assert.deepEqual(terminalPost.playerView,frame.playerView);
    assert.deepEqual(terminalPost.postgameDisclosure.outcome.delta,[0,0,-100,100]);
  }
  assert.throws(()=>replay.getReplayFrame(manifest.replayId,165,{viewerSeat:0}),
    e=>e instanceof ReplayError && e.code==='VIEW_FORBIDDEN');
  const raw=JSON.parse(storage.get('tw-mahjong-replay:archive:v1:'+manifest.replayId));
  assert.equal(validateReplayArchive(raw),true);
  const changed=clone(raw);changed.events.at(-1).turnEvent.type='draw';
  assert.throws(()=>validateReplayArchive(changed),
    e=>e instanceof ReplayError && e.code==='CORRUPT_REPLAY');
});
