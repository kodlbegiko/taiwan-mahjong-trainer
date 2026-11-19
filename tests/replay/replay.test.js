import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createPlayerView, listLegalActions, applyAction } from '../../src/rules/index.js';
import { analyzePlayerView } from '../../src/strategy/index.js';
import { createReplayService, createReplayArchive, validateReplayArchive, ReplayError } from '../../src/replay/index.js';
import { checksum } from '../../src/replay/internal.js';
import { prepareVerifiedAdaptiveEvidence } from '../../src/scenario/index.js';

const game=(seed='replay-golden-2026',gameId='replay-golden') =>
  createGame({gameId,seed,profileId:'tw16-four-player-sandbox',ruleVersion:'experimental-move-v1'});
function play(seed='replay-golden-2026',steps=14) {
  let state=game(seed);
  for(let i=0;i<steps;i++) {
    const seat=state.round.currentSeat;
    const action=listLegalActions(state,seat)[0];
    if(!action) break;
    state=applyAction(state,{actorSeat:seat,actionId:action.actionId,expectedRevision:action.expectedRevision}).state;
  }
  return state;
}
function serviceWithGame(state=play()) {
  const storage=new Map([['tw-mahjong-trainer:archive:v3','immutable-legacy-v3']]);
  const service=createReplayService({storage});
  const manifest=service.saveReplay(state,{ownerSeat:0});
  return {storage,service,manifest,state};
}
function assertErrorCode(fn,code) {
  assert.throws(fn,e=>e instanceof ReplayError && e.code===code,code);
}

test('event-ledger replay recreates every sequential PlayerView, including random-access historical frames',()=>{
  const {service,manifest,state}=serviceWithGame();
  assert.equal(manifest.eventCount,state.events.length);
  assert.equal(manifest.completionStatus,'incomplete');
  assert.equal(manifest.ruleStatus,'experimental');
  assert.equal(manifest.digestIsCryptographic,false);
  const initial=createPlayerView(game(state.rng.seed),0);
  assert.deepEqual(service.getReplayFrame(manifest.replayId,1).playerView,initial);
  for(let seq=1;seq<=state.revision;seq++) {
    const v=service.getReplayFrame(manifest.replayId,seq).playerView;
    assert.deepEqual(v,createPlayerView(state,0,seq));
    assert.equal(v.asOfEventSeq,seq);
    assert.ok(v.publicEvents.every(e=>e.seq<=seq));
  }
  assert.deepEqual(service.getReplayFrame(manifest.replayId,2),
    service.getReplayFrame(manifest.replayId,2));
});

test('repeated fixed seed and actions give identical internal archives and result manifests',()=>{
  const a=createReplayArchive(play('repro-seed-88',12));
  const b=createReplayArchive(play('repro-seed-88',12));
  assert.deepEqual(a,b);
  assert.equal(validateReplayArchive(a),true);
});

test('public frame and listing never serialize the seed, wall, rng, or opposing concealed hands',()=>{
  const {service,manifest,state}=serviceWithGame();
  const publicPayload=JSON.stringify([service.listReplays(),service.loadReplay(manifest.replayId)]);
  assert.equal(publicPayload.includes(state.rng.seed),false);
  assert.equal(publicPayload.includes('initialSeed'),false);
  assert.equal(publicPayload.includes('turnEvent'),false);
  const opponentDraw=state.events.find(e=>e.type==='draw' && e.actorSeat!==0);
  assert.ok(opponentDraw);
  const frame=service.getReplayFrame(manifest.replayId,opponentDraw.seq);
  const json=JSON.stringify(frame);
  assert.equal(json.includes(opponentDraw.payload.tileId),false);
  assert.equal(json.includes('"wall"'),false);
  assert.equal(json.includes('"rng"'),false);
  assert.equal(json.includes('"concealedCount"'),true);
  assert.equal(json.includes('"postgameDisclosure":null'),true);
  assert.equal(frame.playerView.publicEvents.at(-1).type,'draw');
  assert.deepEqual(frame.playerView.publicEvents.at(-1).payload,{count:1});
  assert.equal(frame.playerView.opponents.every(p=>!('concealed' in p)),true);
});

test('historical own hand, river and legal actions are not formed from future state',()=>{
  const {service,manifest,state}=serviceWithGame();
  const before=service.getReplayFrame(manifest.replayId,1).playerView;
  const after=service.getReplayFrame(manifest.replayId,state.revision).playerView;
  assert.equal(before.self.river.length,0);
  assert.ok(after.self.river.length>=1);
  assert.equal(before.self.concealed.length,17);
  assert.ok(before.legalActions.every(a=>a.expectedRevision===1));
  assert.equal(before.publicEvents.length,1);
});

test('archive rejects changed future event even if corruption checksum is recomputed',()=>{
  const state=play();
  const archive=createReplayArchive(state);
  const tampered=structuredClone(archive);
  const event=tampered.events.find(e=>e.turnEvent.type==='draw');
  event.turnEvent.payload.tileId='t:0:0'===event.turnEvent.payload.tileId?'t:0:1':'t:0:0';
  tampered.manifest.integrity.eventsChecksum=checksum(tampered.events);
  assertErrorCode(()=>validateReplayArchive(tampered),'CORRUPT_REPLAY');
});

test('archive rejects forged unknown action ID even when all ledger checksums are refreshed',()=>{
  const archive=createReplayArchive(play());
  const tampered=structuredClone(archive);
  tampered.events[1].turnEvent.causedByActionId='act:forged:not-legal';
  tampered.decisions[0].actionId='act:forged:not-legal';
  tampered.manifest.integrity.eventsChecksum=checksum(tampered.events);
  tampered.manifest.integrity.decisionChecksum=checksum(tampered.decisions);
  assertErrorCode(()=>validateReplayArchive(tampered),'CORRUPT_REPLAY');
});

test('unknown RuleProfile is rejected, not silently downgraded to default rules',()=>{
  const archive=createReplayArchive(play());
  archive.manifest.ruleRef.profileId='nonexistent-house-rules';
  assertErrorCode(()=>validateReplayArchive(archive),'UNKNOWN_RULE_PROFILE');
});

test('frame perspective and seat authorization fail closed',()=>{
  const {service,manifest,state}=serviceWithGame();
  assertErrorCode(()=>service.getReplayFrame(manifest.replayId,0),'INVALID_EVENT_SEQ');
  assertErrorCode(()=>service.getReplayFrame(manifest.replayId,state.revision+1),'INVALID_EVENT_SEQ');
  assertErrorCode(()=>service.getReplayFrame(manifest.replayId,1,{viewerSeat:1}),'VIEW_FORBIDDEN');
  assertErrorCode(()=>service.getReplayFrame(manifest.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  assertErrorCode(()=>service.getReplayFrame(manifest.replayId,1,{perspective:'god-mode'}),'INVALID_PERSPECTIVE');
});

test('nonexistent or opponent action cannot become official decision analysis',()=>{
  const {service,manifest,state}=serviceWithGame();
  const ownerDiscard=state.events.find(e=>e.type==='discard' && e.actorSeat===0);
  const opponentDiscard=state.events.find(e=>e.type==='discard' && e.actorSeat===1);
  assertErrorCode(()=>service.getDecisionAnalysis(manifest.replayId,999),'DECISION_NOT_FOUND');
  assertErrorCode(()=>service.getDecisionAnalysis(manifest.replayId,opponentDiscard.seq),'VIEW_FORBIDDEN');
  assertErrorCode(()=>service.getDecisionAnalysis(manifest.replayId,ownerDiscard.seq,
    {actionId:'act:nonexistent'}),'INVALID_ACTION_ID');
});

test('decision analysis is stable and only uses exact at-time structural evidence; no fabricated probabilities',()=>{
  const {service,manifest,state}=serviceWithGame();
  const seq=state.events.find(e=>e.type==='discard' && e.actorSeat===0).seq;
  const a=service.getDecisionAnalysis(manifest.replayId,seq);
  assert.deepEqual(a,service.getDecisionAnalysis(manifest.replayId,seq));
  assert.equal(a.sourceViewRef.asOfEventSeq,seq-1);
  assert.equal(a.scoringVersion,'unavailable');
  assert.equal(a.epistemic.dealInRisk,'unknown');
  assert.equal(a.epistemic.winRate,'unknown');
  assert.equal(a.epistemic.expectedTai,'unknown');
  assert.equal(a.epistemic.twoTurn,'unknown');
  assert.ok(a.legalActionIds.includes(a.chosenActionId));
  assert.equal(a.candidates.every(c=>a.legalActionIds.includes(c.actionId)),true);
  const danger=a.candidates.flatMap(c=>c.metrics).filter(m=>m.name==='dealInRisk');
  assert.ok(danger.length);
  assert.ok(danger.every(m=>m.value===null && m.epistemic==='unknown'));
});

test('Golden: a deliberately structurally inferior discard produces an exact-metric advisory finding, never an official wrong answer',()=>{
  let selected=null;
  for(let i=0;i<40 && !selected;i++) {
    const state=game('replay-inferior-'+i,'golden-case');
    const view=createPlayerView(state,0);
    const results=analyzePlayerView(view,{samples:0,maxSimulatedRoutes:0}).recommendations;
    const metric=(r,k)=>r.metrics.find(m=>m.name===k)?.value;
    const first=results[0];
    const inferior=results.find(r=>r.actionId!==first?.actionId &&
      (metric(r,'postDiscardShanten')>metric(first,'postDiscardShanten') ||
      (metric(r,'postDiscardShanten')===metric(first,'postDiscardShanten') &&
       metric(r,'oneTurnEffectiveCopies')<metric(first,'oneTurnEffectiveCopies'))));
    if(inferior)selected={state,inferior};
  }
  assert.ok(selected,'Golden requires at least one deterministic seeded efficiency disadvantage');
  const action=listLegalActions(selected.state,0).find(a=>a.actionId===selected.inferior.actionId);
  const state=applyAction(selected.state,
    {actorSeat:0,actionId:action.actionId,expectedRevision:action.expectedRevision}).state;
  const {service,manifest}=serviceWithGame(state);
  // serviceWithGame accepts a state and does not change its deterministic seed.
  const analysis=service.getDecisionAnalysis(manifest.replayId,2);
  assert.ok(analysis.findings.length>=1);
  assert.ok(['higher-shanten','lower-ukeire'].includes(analysis.findings[0].kind));
  assert.equal(analysis.findings[0].evidence.epistemic,'exact');
  assert.equal(analysis.findings[0].verificationStatus,'heuristic-recommendation');
  assert.equal(analysis.findings[0].verifiedError,false);
  assert.equal(analysis.findings[0].canCountAsWrong,false);
  assert.equal(analysis.findings[0].canScheduleReview,false);
  assert.deepEqual(service.listCoachingFindings(manifest.replayId),analysis.findings);
});

test('replay scenario is a safe PlayerView snapshot and deliberately unscorable',()=>{
  const {service,manifest,state}=serviceWithGame();
  const seq=state.events.find(e=>e.type==='discard'&&e.actorSeat===0).seq;
  const q=service.createReviewQuestion(manifest.replayId,seq);
  assert.equal(q.taskType,'scenario');
  assert.equal(q.status,'unscorable');
  assert.equal(q.canRecordOfficialAnswer,false);
  assert.equal(q.verifiedScorer,null);
  assert.deepEqual(q.prompt.legalActionIds,service.getReplayFrame(manifest.replayId,seq-1)
    .playerView.legalActions.map(a=>a.actionId));
  assert.equal(JSON.stringify(q).includes(state.rng.seed),false);
  assertErrorCode(()=>prepareVerifiedAdaptiveEvidence({record:{},question:q,finding:{}}),'UNVERIFIED_SCORER');
});

test('reopening with same Map is stable; duplicate saves do not change evidence or v3 records',()=>{
  const {service,storage,manifest,state}=serviceWithGame();
  const previous=service.getDecisionAnalysis(manifest.replayId,2);
  assert.deepEqual(service.saveReplay(state),manifest);
  const reopened=createReplayService({storage});
  assert.deepEqual(reopened.listReplays(),[manifest]);
  assert.deepEqual(reopened.getDecisionAnalysis(manifest.replayId,2),previous);
  assert.equal(storage.get('tw-mahjong-trainer:archive:v3'),'immutable-legacy-v3');
  assert.ok([...storage.keys()].filter(k=>k.includes('tw-mahjong-replay:index:')).length===1);
});

test('corrupted persisted bytes are rejected; not re-scored against future profiles',()=>{
  const {service,manifest,storage}=serviceWithGame();
  const key='tw-mahjong-replay:archive:v1:'+manifest.replayId;
  const record=JSON.parse(storage.get(key));
  record.events[1].turnEvent.payload.tileId='t:20:0';
  storage.set(key,JSON.stringify(record));
  assertErrorCode(()=>service.loadReplay(manifest.replayId),'CORRUPT_REPLAY');
});
