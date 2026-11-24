import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,listLegalActions,listPendingClaimResponders,applyAction,listRuleProfiles,getRuleCapabilities} from '../../src/rules/index.js';
import {createReplayArchive,validateReplayArchive,replayStateAt,replayIntegrityHashes,checksum,ReplayError} from '../../src/replay/internal.js';
import {createReplayService} from '../../src/replay/index.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/r73-historical-win.json',import.meta.url),'utf8'));
const cp=x=>JSON.parse(JSON.stringify(x));
const INDEX='tw-mahjong-replay:index:v1';
const key=id=>'tw-mahjong-replay:archive:v1:'+id;
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof ReplayError&&e.code===code);
const ref={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
test('R7.3 frozen pre-R7 FNV and R7 SHA archives retain exact historical result and bytes',()=>{
  for(const old of [fixture.legacyArchive,fixture.shaArchive]){
    const raw=JSON.stringify(old),id=old.manifest.replayId;
    const storage=new Map([[key(id),raw]]);
    const svc=createReplayService({storage});
    assert.equal(validateReplayArchive(old),true);
    const state=replayStateAt(old,old.events.length);
    assert.deepEqual(state.extensions.tw16.result,fixture.expectedResult);
    assert.deepEqual(state.round.scores,[540,-180,-180,-180]);
    assert.equal(svc.recoverReplay(id).scoringVersion,'tw16-minimal-tai-v1');
    assert.equal(svc.saveReplay(state,{disclosurePolicy:'settled-public-only'}).replayId,id);
    assert.equal(storage.get(key(id)),raw);
    assert.equal(JSON.stringify(JSON.parse(storage.get(key(id)))),raw);
    assert.deepEqual(svc.getReplayFrame(id,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,fixture.expectedScores);
  }
  assert.equal(fixture.legacyArchive.manifest.integrity.sha256,undefined);
  assert.equal(fixture.shaArchive.manifest.integrity.sha256.eventChain,'d712ff2d867f53ed2967ade84c63fe45c84d4e94100457017afaf17499c25bcb');
});
test('R7.3 historical archive rejects version loss, unknown checksum/hash, forged settlement, repeated and reordered terminal events',()=>{
  const original=fixture.shaArchive,state=replayStateAt(original,original.events.length);
  const mutations=[
    ['CORRUPT_REPLAY',a=>delete a.manifest.scoringVersion],
    ['UNSUPPORTED_SCORING_PROFILE',a=>a.manifest.scoringVersion='retired-unavailable-policy@99'],
    ['UNKNOWN_RULE_PROFILE',a=>a.manifest.ruleRef.profileId='unknown-old-rule'],
    ['CORRUPT_REPLAY',a=>delete a.events.at(-1).turnEvent.contractVersion],
    ['CORRUPT_REPLAY',a=>a.events.at(-1).turnEvent.contractVersion='unknown'],
    ['CORRUPT_REPLAY',a=>a.manifest.integrity.algorithm='unknown'],
    ['CORRUPT_REPLAY',a=>a.manifest.integrity.sha256.version='unknown'],
    ['CORRUPT_REPLAY',a=>a.events.at(-1).turnEvent.payload.tai++],
    ['CORRUPT_REPLAY',a=>a.events.at(-1).turnEvent.payload.delta=[540,-540,0,0]],
    ['CORRUPT_REPLAY',a=>a.events.push(cp(a.events.at(-1)))],
    ['CORRUPT_REPLAY',a=>a.events.splice(-1,1)],
    ['CORRUPT_REPLAY',a=>{const n=a.events.length;[a.events[n-2],a.events[n-1]]=[a.events[n-1],a.events[n-2]];}]
  ];
  for(const [want,mutate] of mutations){
    const bad=cp(original);mutate(bad);
    // Re-signing corruption checksums cannot bypass the canonical replay.
    if(bad.manifest.integrity.sha256.version===original.manifest.integrity.sha256.version){
      bad.manifest.integrity.eventsChecksum=checksum(bad.events);
      bad.manifest.integrity.sha256=replayIntegrityHashes(bad.manifest,bad.events,bad.decisions,state);
    }
    const raw=JSON.stringify(bad),id=bad.manifest.replayId,storage=new Map([[key(id),raw]]);
    const svc=createReplayService({storage});
    fails(()=>svc.recoverReplay(id),want);
    assert.equal(storage.has(INDEX),false);
    assert.equal(storage.get(key(id)),raw);
  }
});
test('R7.3 malformed original score breakdown and payer amounts never become stored settlement',()=>{
  const state=replayStateAt(fixture.shaArchive,fixture.shaArchive.events.length);
  for(const mutate of [
    x=>x.extensions.tw16.result.breakdown[0].tai++,
    x=>x.extensions.tw16.result.breakdown.push(cp(x.extensions.tw16.result.breakdown[0])),
    x=>{x.round.scores=[540,-540,0,0];x.extensions.tw16.result.delta=[540,-540,0,0];x.events.at(-1).payload.delta=[540,-540,0,0];},
    x=>x.events.push(cp(x.events.at(-1)))
  ]){
    const bad=cp(state);mutate(bad);const storage=new Map();
    assert.throws(()=>createReplayService({storage}).saveReplay(bad),e=>e instanceof ReplayError&&['INVALID_GAME_STATE','INVALID_SETTLEMENT'].includes(e.code));
    assert.equal(storage.size,0);
  }
});
test('R7.3 actual exhaustive DRAW rebuilds exact final state and preserves zero settlement',()=>{
  let state=createGame({gameId:'r73-draw',seed:'r73-draw',...ref});
  const start=cp(state);
  for(let i=0;i<1024&&state.round.phase!=='settled';i++){
    const seat=state.round.phase==='claim_window'?listPendingClaimResponders(state)[0]:state.round.currentSeat;
    const legal=listLegalActions(state,seat);
    const action=state.round.phase==='claim_window'?legal.find(a=>a.kind==='pass'):
      ['replace_flower','draw','discard'].map(k=>legal.find(a=>a.kind===k)).find(Boolean);
    assert.ok(action,'Canonical LegalAction required');
    state=applyAction(state,{actorSeat:seat,actionId:action.actionId,expectedRevision:action.expectedRevision}).state;
  }
  assert.equal(state.round.phase,'settled');
  assert.equal(state.extensions.tw16.result.reason,'exhaustive-draw');
  assert.deepEqual(state.round.scores,[0,0,0,0]);
  const archive=createReplayArchive(state,{disclosurePolicy:'settled-public-only'});
  assert.deepEqual(replayStateAt(archive,1),start);
  assert.deepEqual(replayStateAt(archive,state.revision),state);
  assert.deepEqual(archive.events.at(-1).turnEvent.payload.delta,state.extensions.tw16.result.delta);
  const store=new Map(),svc=createReplayService({storage:store}),m=svc.saveReplay(state,{disclosurePolicy:'settled-public-only'});
  const raw=store.get(key(m.replayId));store.delete(INDEX);
  const reopened=createReplayService({storage:store});
  reopened.recoverReplay(m.replayId);
  assert.equal(store.get(key(m.replayId)),raw);
  assert.deepEqual(reopened.getReplayFrame(m.replayId,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,[0,0,0,0]);
});
test('R7.3 authoritative scoring integration dependency gate (no SKIP)',()=>{
  // No speculative profile ID, no comparison adapter as authoritative scorer.
  // Until #51 publishes a distinct versioned RuleRef and #52 pre-settlement API,
  // the explicit release gate must FAIL, not silently skip or claim green.
  const candidates=listRuleProfiles().filter(p=>p.scoringPolicy?.mode==='configured'&&
    p.scoringPolicy.configRef!=='tw16-minimal-tai-v1');
  if(process.env.REPLAY_REQUIRE_R73_AUTHORITATIVE==='1'){
    assert.ok(candidates.length>0,'BLOCKED: Rules #51 has no distinct authoritative ScoringProfile-backed RuleProfile');
    assert.fail('BLOCKED: new authoritative profile exists but requires reviewed pinned Replay adapter and real WIN/DRAW/robbery Goldens');
  }
  if(candidates.length)assert.fail('Unreviewed authoritative RuleProfile detected; add pinned Replay contract and mandatory Goldens');
  assert.equal(getRuleCapabilities(ref).scoring.policy,'tw16-minimal-tai-v1');
});
