import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, applyAction, listLegalActions, createPlayerView, replayGame,
  validateGameState, startNextRound, RuleCapabilityError,
} from '../../src/rules/index.js';
import { SEED_87_R4 as GOLDEN } from '../rules/fixtures/seed-87-r4-trace.js';
import { createReplayService, ReplayError } from '../../src/replay/index.js';
import { createReplayArchive, validateReplayArchive, checksum } from '../../src/replay/internal.js';
import { prepareVerifiedAdaptiveEvidence } from '../../src/scenario/index.js';

const copy=x=>JSON.parse(JSON.stringify(x));
const code=(fn,expected)=>assert.throws(fn,e=>e instanceof ReplayError && e.code===expected);
const fresh=()=>createGame({gameId:GOLDEN.gameId,seed:GOLDEN.seed,...GOLDEN.ruleRef});
const submit=(state,action)=>applyAction(state,{
  actorSeat:action.actorSeat,actionId:action.actionId,
  expectedRevision:action.expectedRevision,
}).state;

let savedFixture;
function seed87() {
  if(savedFixture)return savedFixture;
  let state=fresh();
  const snapshots=new Map([[1,createPlayerView(state,1)]]);
  assert.equal(state.revision,1);
  for(const [rev,seat,actionId,after] of GOLDEN.successfulActions){
    assert.equal(state.revision,rev);
    const legal=listLegalActions(state,seat).find(a=>a.actionId===actionId);
    assert.ok(legal,'Golden LegalAction must come from Rules at '+rev);
    assert.equal(legal.actorSeat,seat);
    assert.equal(legal.expectedRevision,rev);
    state=submit(state,legal);
    assert.equal(state.revision,after,'atomic Rules transition');
    assert.equal(state.events.length,after);
    if([2,76,78,89,90,91,93,159,160,161,162].includes(after))
      snapshots.set(after,createPlayerView(state,1));
  }
  assert.equal(GOLDEN.successfulActions.length,157);
  assert.equal(state.revision,GOLDEN.expected.revision);
  assert.equal(validateGameState(state),true);
  assert.deepEqual(replayGame(state),state);
  const storage=new Map([['tw-mahjong-trainer:archive:v3','immutable-v3']]);
  const replay=createReplayService({storage});
  const manifest=replay.saveReplay(state,{ownerSeat:1,
    unsupportedSubmission:GOLDEN.rejectedSubmission});
  return savedFixture={state,storage,replay,manifest,snapshots};
}
function prefix(stopRevision) {
  let state=fresh();
  for(const [rev,seat,id,after] of GOLDEN.successfulActions){
    if(rev>=stopRevision)break;
    assert.equal(state.revision,rev);
    const a=listLegalActions(state,seat).find(v=>v.actionId===id);
    assert.ok(a);
    state=submit(state,a);
    assert.equal(state.revision,after);
  }
  assert.equal(state.revision,stopRevision);
  return state;
}
const errorSafeJSON=o=>JSON.stringify(o);

test('Seed87: exact 157 legal action groups -> 162 valid events; rejected PASS is NOT a TurnEvent',()=>{
  const {state,manifest,replay,storage}=seed87();
  assert.equal(state.round.phase,'claim_window');
  assert.equal(state.extensions.tw16.result,null);
  assert.equal(state.round.scores,undefined);
  assert.equal(manifest.completionStatus,'incomplete');
  assert.equal(manifest.eventCount,162);
  assert.equal(manifest.actionCount,157);
  assert.equal(manifest.lastLegalRevision,162);
  assert.equal(manifest.settlementResultRef,null);
  assert.equal(manifest.postgameAvailable,false);
  assert.equal(manifest.interruptionStatus,'unsupported-rule-capability');
  assert.equal(manifest.unsupportedCapability.code,'UNSUPPORTED_RULE_CAPABILITY');
  assert.equal(manifest.unsupportedCapability.capability,'redacted-private-claim');
  assert.ok(!errorSafeJSON(manifest).includes('multiple_winners'));
  assert.ok(!errorSafeJSON(manifest).includes(GOLDEN.seed));
  assert.ok(!errorSafeJSON(manifest).includes(GOLDEN.rejectedSubmission.actionId));
  assert.equal(storage.get('tw-mahjong-trainer:archive:v3'),'immutable-v3');
  const before=copy(state);
  assert.throws(()=>submit(state,GOLDEN.rejectedSubmission),error=>
    error instanceof RuleCapabilityError &&
    error.code===GOLDEN.expected.errorCode &&
    error.capability===GOLDEN.expected.capability);
  assert.deepEqual(state,before,'Rules state unchanged after unsupported');
  const raw=JSON.parse(storage.get('tw-mahjong-replay:archive:v1:'+manifest.replayId));
  assert.equal(raw.manifest.unsupportedInterruption.capability,'multiple_winners');
  assert.equal(validateReplayArchive(raw),true);
  code(()=>replay.getReplayFrame(manifest.replayId,162,{perspective:'postgame'}),
    'POSTGAME_UNAVAILABLE');
  code(()=>replay.saveReplay(state,{ownerSeat:1,
    disclosurePolicy:'settled-public-only'}),'INVALID_DISCLOSURE_POLICY');
});

test('Seed87: timeline boundaries exactly follow each successful Rules atomic action, not event index increments',()=>{
  const {state,manifest,replay,snapshots}=seed87();
  const boundaries=replay.listReplayFrameBoundaries(manifest.replayId,{viewerSeat:1});
  assert.deepEqual(boundaries,[1,...GOLDEN.successfulActions.map(row=>row[3])]);
  assert.equal(Object.isFrozen(boundaries),true);
  assert.equal(boundaries.length,158);
  assert.equal(boundaries[0],1);
  assert.equal(boundaries.at(-1),162);
  const gaps=GOLDEN.successfulActions.filter(([before,,,after])=>after>before+1);
  assert.ok(gaps.length>=3,'must actually exercise multi-event claim resolutions');
  for(const [before,,,after] of gaps)
    for(let intermediate=before+1;intermediate<after;intermediate++){
      assert.equal(boundaries.includes(intermediate),false);
      code(()=>replay.getReplayFrame(manifest.replayId,intermediate),
        'NON_ATOMIC_EVENT_SEQ');
    }
  for(const seq of [1,2,76,78,89,90,91,93,159,160,161,162]){
    const view=replay.getReplayFrame(manifest.replayId,seq,{viewerSeat:1}).playerView;
    assert.deepEqual(view,snapshots.get(seq),'Rules projected historical PlayerView at '+seq);
    assert.equal(view.asOfEventSeq,seq);
    assert.ok(view.publicEvents.every(event=>event.seq<=seq));
    assert.ok(view.opponents.every(p=>!Object.hasOwn(p,'concealed')));
    assert.equal(Object.hasOwn(view,'wall'),false);
    assert.equal(Object.hasOwn(view,'rng'),false);
  }
  code(()=>replay.listReplayFrameBoundaries(manifest.replayId,{viewerSeat:3}),
    'VIEW_FORBIDDEN');
  assert.deepEqual(replay.listReplayFrameBoundaries(manifest.replayId),boundaries);
  assert.deepEqual(replayGame(state),state);
});

test('Seed87: private WIN intent is noninterfering for third-party frame and can never enter coaching inputs',()=>{
  const {state,manifest,replay}=seed87();
  const seq160=replay.getReplayFrame(manifest.replayId,160);
  const seq161=replay.getReplayFrame(manifest.replayId,161);
  const seq162=replay.getReplayFrame(manifest.replayId,162);
  assert.equal(seq160.playerView.round.phase,'claim_window');
  assert.equal(seq160.playerView.publicEvents.length,160);
  for(const frame of [seq161,seq162]){
    assert.deepEqual(frame.publicEvent.payload,{});
    assert.equal(frame.publicEvent.visibility,'public');
    assert.equal(Object.hasOwn(frame.publicEvent,'actorSeat'),false);
    assert.equal(Object.hasOwn(frame.publicEvent,'causedByActionId'),false);
    assert.ok(frame.playerView.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  }
  const lastTwo=seq162.playerView.publicEvents.slice(-2);
  assert.deepEqual(lastTwo.map(x=>x.type),['claim','claim']);
  assert.ok(lastTwo.every(x=>!('actorSeat' in x)&&!('causedByActionId' in x)));
  // The owner's current legal PASS action ID is legitimately visible to that
  // owner; privacy applies to OTHER seats' private WIN declarations.
  assert.ok(seq162.playerView.legalActions.some(a=>
    a.actionId===GOLDEN.rejectedSubmission.actionId));
  assert.equal(errorSafeJSON(seq162.playerView.publicEvents).includes(
    GOLDEN.rejectedSubmission.actionId),false);
  for(const hiddenWin of state.events.slice(-2))
    assert.equal(errorSafeJSON(seq162.playerView.publicEvents)
      .includes(hiddenWin.causedByActionId),false);
  assert.equal(errorSafeJSON(seq162).includes(GOLDEN.seed),false);
  assert.equal(errorSafeJSON(seq160).includes('t:26:0'),true,'public discard is visible');

  let counterfactual=prefix(160);
  counterfactual=submit(counterfactual,listLegalActions(counterfactual,3).find(a=>a.kind==='pass'));
  counterfactual=submit(counterfactual,listLegalActions(counterfactual,0).find(a=>a.kind==='pass'));
  assert.equal(counterfactual.revision,162);
  assert.deepEqual(createPlayerView(counterfactual,1),createPlayerView(state,1),
    'private two-WIN and two-PASS declarations have identical third-party views');
  const ownTurn=GOLDEN.successfulActions.find(([,seat,id])=>seat===1&&id.includes(':discard:'));
  assert.ok(ownTurn);
  const analysis=replay.getDecisionAnalysis(manifest.replayId,ownTurn[0]+1);
  assert.equal(analysis.officialScorerVerified,false);
  assert.equal(analysis.recommendationAuthority,'advisory');
  for(const field of ['dealInRisk','winRate','expectedTai'])assert.equal(analysis.epistemic[field],'unknown');
  assert.ok(analysis.candidates.flatMap(c=>c.metrics)
    .filter(m=>m.name==='dealInRisk')
    .every(m=>m.value===null && m.epistemic==='unknown'));
  code(()=>prepareVerifiedAdaptiveEvidence({record:{},question:{},finding:{}}),'UNVERIFIED_SCORER');
});

test('Seed87: altered manifest, forged rejected action, and recomputed event checksums all fail closed',()=>{
  const {state,manifest,storage,replay}=seed87();
  const raw=JSON.parse(storage.get('tw-mahjong-replay:archive:v1:'+manifest.replayId));
  const corrupt=copy(raw);
  corrupt.manifest.unsupportedInterruption.capability='rob_added_kong';
  code(()=>validateReplayArchive(corrupt),'CORRUPT_REPLAY');
  const fakeSettled=copy(raw);
  fakeSettled.manifest.completionStatus='settled-experimental';
  code(()=>validateReplayArchive(fakeSettled),'CORRUPT_REPLAY');
  const badSeq=copy(raw);
  badSeq.events[159].turnEvent.eventId='evt:forged:160';
  badSeq.manifest.integrity.eventsChecksum=checksum(badSeq.events);
  code(()=>validateReplayArchive(badSeq),'CORRUPT_REPLAY');
  code(()=>replay.saveReplay(state,{ownerSeat:1,
    unsupportedSubmission:{...GOLDEN.rejectedSubmission,actionId:'act:forged'}}),
    'INVALID_INTERRUPTION');
  const legitimateIncomplete=createReplayArchive(state,{ownerSeat:1});
  assert.equal(legitimateIncomplete.manifest.completionStatus,'incomplete');
  assert.equal(legitimateIncomplete.manifest.unsupportedInterruption,undefined);
  assert.equal(legitimateIncomplete.manifest.settlementResultRef,null);
  code(()=>replay.saveReplay(state,{ownerSeat:1}),
    'REPLAY_ALREADY_EXISTS');
});

test('Seed87: independent legal single-WIN branch settles, replays its own complete groups, then starts fresh hand',()=>{
  let state=prefix(160);
  state=submit(state,listLegalActions(state,3).find(a=>a.kind==='win'));
  state=submit(state,listLegalActions(state,0).find(a=>a.kind==='pass'));
  const before=state.revision;
  state=submit(state,listLegalActions(state,1).find(a=>a.kind==='pass'));
  assert.equal(state.round.phase,'settled');
  assert.equal(state.extensions.tw16.result.reason,'win');
  assert.equal(state.extensions.tw16.result.winnerSeat,3);
  assert.equal(state.extensions.tw16.result.delta.reduce((a,b)=>a+b,0),0);
  assert.deepEqual(state.round.scores,state.extensions.tw16.result.delta);
  assert.deepEqual(state.events.slice(-3).map(e=>e.type),['pass','win','settle']);
  assert.equal(state.revision,before+3);
  assert.deepEqual(replayGame(state),state);
  const replay=createReplayService({storage:new Map()});
  const meta=replay.saveReplay(state,{ownerSeat:1,disclosurePolicy:'settled-public-only'});
  assert.equal(meta.completionStatus,'settled-experimental');
  const boundaries=replay.listReplayFrameBoundaries(meta.replayId);
  assert.equal(boundaries.at(-1),state.revision);
  assert.equal(boundaries.includes(state.revision-1),false);
  code(()=>replay.getReplayFrame(meta.replayId,state.revision-1),'NON_ATOMIC_EVENT_SEQ');
  const beforeView=replay.getReplayFrame(meta.replayId,160);
  const postgame=replay.getReplayFrame(meta.replayId,160,{perspective:'postgame'});
  assert.deepEqual(beforeView.playerView,postgame.playerView);
  assert.deepEqual(postgame.postgameDisclosure.outcome.delta,state.round.scores);
  assert.equal(postgame.postgameDisclosure.allowedForDecisionScoring,false);
  assert.equal(errorSafeJSON(postgame).includes(GOLDEN.seed),false);
  assert.equal(errorSafeJSON(postgame).includes('winningTileId'),false);

  const next=startNextRound(state,{gameId:'bot-r3-87-next',seed:'new-seed-87'});
  assert.equal(next.round.handIndex,state.round.handIndex+1);
  assert.equal(next.round.phase==='settled',false);
  const nextReplay=createReplayService({storage:new Map()});
  const nextMeta=nextReplay.saveReplay(next,{ownerSeat:1});
  assert.equal(nextMeta.completionStatus,'incomplete');
  assert.equal(nextMeta.lastLegalRevision,1);
  assert.equal(nextMeta.settlementResultRef,null);
  assert.deepEqual(nextReplay.listReplayFrameBoundaries(nextMeta.replayId),[1]);
  assert.deepEqual(nextReplay.getReplayFrame(nextMeta.replayId,1).playerView,
    createPlayerView(next,1));
  assert.deepEqual(replayGame(next),next);
});
