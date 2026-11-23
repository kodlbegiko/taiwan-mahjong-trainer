import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createDeck,getRuleProfile,createPlayerView,listLegalActions,applyAction} from '../../src/rules/index.js';
import {createReplayService,ReplayError} from '../../src/replay/index.js';
import {createReplayArchive,validateReplayArchive,replayIntegrityHashes,checksum} from '../../src/replay/internal.js';
import {sha256Utf8,REPLAY_HASH_VERSION} from '../../src/replay/integrity.js';

const INDEX='tw-mahjong-replay:index:v1';
const DATA='tw-mahjong-replay:archive:v1:';
const ruleRef={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const code=(fn,want)=>assert.throws(fn,e=>e instanceof ReplayError && e.code===want,want);
const clone=o=>structuredClone(o);

function sandbox({seed='r7-safe-seed',gameId='r7-safe',steps=12}={}) {
  let state=createGame({seed,gameId,profileId:'tw16-four-player-sandbox',
    ruleVersion:'experimental-move-v1'});
  for(let i=0;i<steps;i++){
    const seat=state.round.currentSeat,action=listLegalActions(state,seat)[0];
    if(!action)break;
    state=applyAction(state,{actorSeat:seat,actionId:action.actionId,
      expectedRevision:action.expectedRevision}).state;
  }
  return state;
}

function settledR5() {
  const profile=getRuleProfile(ruleRef.profileId,ruleRef.ruleVersion);
  const all=createDeck(profile),standard=all.filter(x=>x.startsWith('t:'));
  const copies=(t,n)=>Array.from({length:n},(_,i)=>'t:'+t+':'+i);
  const configured=Array.from({length:4},()=>[]);
  configured[0]=[...[0,1,2,3,4].flatMap(t=>copies(t,3)),...copies(5,2)];
  const taken=new Set(configured.flat());
  for(let seat=0;seat<4;seat++) {
    const count=seat===0?17:16;
    for(const id of standard) {
      if(configured[seat].length===count)break;
      if(!taken.has(id)){taken.add(id);configured[seat].push(id);}
    }
    assert.equal(configured[seat].length,count);
  }
  const dealer=[...configured[0]],extra=dealer.pop();
  const deck=[...dealer,...configured[1],...configured[2],...configured[3],extra,
    ...all.filter(id=>!taken.has(id))];
  assert.equal(deck.length,all.length);
  let state=createGame({gameId:'r7-r5-settled',seed:'r7-r5-seed',dealerSeat:0,
    fixtureDeck:deck,...ruleRef});
  const action=listLegalActions(state,0).find(a=>a.kind==='win');
  assert.ok(action,'canonical Rules must issue a self-win');
  state=applyAction(state,{actorSeat:0,actionId:action.actionId,
    expectedRevision:action.expectedRevision}).state;
  assert.equal(state.round.phase,'settled');
  return state;
}

function webStore({failIndex=false}={}) {
  const bytes=new Map();
  let blocked=failIndex;
  return {bytes,
    getItem(key){return bytes.has(key)?bytes.get(key):null;},
    setItem(key,value){
      if(blocked && key===INDEX)throw new Error('simulated quota at index write');
      bytes.set(key,String(value));
    },
    allowWrites(){blocked=false;},
  };
}

test('SHA-256 deterministic cross-runtime vectors, Unicode and canonical replay chains',()=>{
  assert.equal(sha256Utf8(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Utf8('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Utf8('麻將'),'aa0ef99fba127a3c1a76944d7a1a7816848cf5c422ef4a18c4cffc0ff78dbe42'); // independent reference
  const state=sandbox(),a=createReplayArchive(state),b=createReplayArchive(state);
  assert.deepEqual(a,b);
  assert.equal(a.manifest.integrity.sha256.version,REPLAY_HASH_VERSION);
  assert.equal(a.manifest.integrity.sha256.eventChain.length,64);
  assert.equal(a.manifest.integrity.sha256.finalState.length,64);
  assert.deepEqual(a.manifest.integrity.sha256,
    replayIntegrityHashes(a.manifest,a.events,a.decisions,state));
  assert.equal(validateReplayArchive(a),true);
});

test('completed R5 self-win reconstructs authoritative end state, atomic history and no future leakage',()=>{
  const state=settledR5(),store=new Map();
  const service=createReplayService({storage:store});
  const meta=service.saveReplay(state,{ownerSeat:2,disclosurePolicy:'settled-public-only'});
  assert.equal(meta.completionStatus,'settled-experimental');
  assert.equal(meta.eventCount,state.events.length);
  const archive=JSON.parse(store.get(DATA+meta.replayId));
  assert.equal(archive.manifest.integrity.sha256.version,REPLAY_HASH_VERSION);
  assert.equal(validateReplayArchive(archive),true);
  const bounds=service.listReplayFrameBoundaries(meta.replayId,{viewerSeat:2});
  assert.deepEqual(bounds,[1,state.revision]);
  for(const seq of bounds) {
    assert.deepEqual(service.getReplayFrame(meta.replayId,seq,{viewerSeat:2}).playerView,
      createPlayerView(state,2,seq));
  }
  code(()=>service.getReplayFrame(meta.replayId,2,{viewerSeat:2}),'NON_ATOMIC_EVENT_SEQ');
  code(()=>service.getReplayFrame(meta.replayId,1,{viewerSeat:0}),'VIEW_FORBIDDEN');
  const initial=service.getReplayFrame(meta.replayId,1,{viewerSeat:2});
  const post=service.getReplayFrame(meta.replayId,1,{viewerSeat:2,perspective:'postgame'});
  assert.deepEqual(initial.playerView,post.playerView);
  assert.equal(initial.postgameDisclosure,null);
  assert.equal(post.postgameDisclosure.allowedForDecisionScoring,false);
  const serialized=JSON.stringify([meta,initial,post]);
  for(const sensitive of ['fixtureDeck','initialSeed','turnEvent','selectedClaimActionId','"rng"','"wall"'])
    assert.equal(serialized.includes(sensitive),false,sensitive);
  assert.equal(serialized.includes(state.rng.seed),false);
});

test('event deletion, duplication and mutated digests cannot be accepted as a completed replay',()=>{
  const state=settledR5(),base=createReplayArchive(state);
  const broken=[
    x=>x.events.splice(1,1),
    x=>x.events.splice(1,0,clone(x.events[1])),
    x=>{x.events.at(-1).turnEvent.type='draw';x.manifest.integrity.eventsChecksum=checksum(x.events);},
    x=>{x.manifest.integrity.sha256.eventChain='0'.repeat(64);},
    x=>{x.manifest.integrity.sha256.finalState='0'.repeat(64);},
    x=>{x.manifest.integrity.sha256.version='tw16-replay-chain-sha256/999';},
    x=>{x.decisions[0].actionId='forged';x.manifest.integrity.decisionChecksum=checksum(x.decisions);},
    x=>{x.manifest.settlementResultChecksum='00000000';},
    x=>{x.manifest.replayVersion='future-v99';},
  ];
  for(const mutate of broken) {
    const record=clone(base);mutate(record);
    code(()=>validateReplayArchive(record),'CORRUPT_REPLAY');
  }
});

test('index quota failure creates no fictional completion; explicit recovery validates existing bytes',()=>{
  const state=sandbox({gameId:'r7-index-failure'}),storage=webStore({failIndex:true});
  const service=createReplayService({storage});
  code(()=>service.saveReplay(state,{ownerSeat:1}),'STORAGE_WRITE_FAILED');
  const id='replay:'+state.gameId;
  assert.equal(storage.bytes.has(INDEX),false);
  assert.equal(storage.bytes.has(DATA+id),true);
  // The validated archive is still individually loadable; it is not indexed.
  assert.equal(service.loadReplay(id).eventCount,state.events.length);
  assert.deepEqual(service.listReplays(),[]);
  storage.allowWrites();
  const reopened=createReplayService({storage});
  assert.equal(reopened.recoverReplay(id,{viewerSeat:1}).replayId,id);
  assert.deepEqual(reopened.listReplays().map(x=>x.replayId),[id]);
  assert.deepEqual(reopened.listReplays(),service.listReplays());
  code(()=>reopened.recoverReplay(id,{viewerSeat:0}),'VIEW_FORBIDDEN');
  code(()=>reopened.recoverReplay('replay:does-not-exist'),'REPLAY_NOT_FOUND');
});

test('idempotent re-save restores a missing index without replacing an existing archive',()=>{
  const state=sandbox({gameId:'r7-repeat-index'}),store=new Map();
  const service=createReplayService({storage:store}),first=service.saveReplay(state);
  const bytes=store.get(DATA+first.replayId);
  store.delete(INDEX);
  assert.deepEqual(service.listReplays(),[]);
  assert.deepEqual(service.saveReplay(state),first);
  assert.equal(store.get(DATA+first.replayId),bytes);
  assert.deepEqual(createReplayService({storage:store}).listReplays(),[first]);
  const different=sandbox({gameId:'r7-repeat-index',seed:'different-r7-seed'});
  code(()=>service.saveReplay(different),'REPLAY_ALREADY_EXISTS');
  assert.equal(store.get(DATA+first.replayId),bytes);
});

test('corrupt orphan, malformed index, incompatible version and invalid JSON fail closed',()=>{
  const state=sandbox({gameId:'r7-corrupt'}),store=new Map();
  const service=createReplayService({storage:store}),meta=service.saveReplay(state);
  const key=DATA+meta.replayId,bytes=store.get(key);
  store.delete(INDEX);
  store.set(key,'{bad-json');
  code(()=>service.recoverReplay(meta.replayId),'CORRUPT_REPLAY');
  assert.equal(store.has(INDEX),false);
  store.set(key,bytes);
  const bad=JSON.parse(bytes);bad.manifest.integrity.sha256.eventChain='bad';
  store.set(key,JSON.stringify(bad));
  code(()=>service.recoverReplay(meta.replayId),'CORRUPT_REPLAY');
  assert.equal(store.has(INDEX),false);
  store.set(key,bytes);
  store.set(INDEX,JSON.stringify([meta.replayId,meta.replayId]));
  code(()=>service.listReplays(),'STORAGE_CORRUPT');
  const next=sandbox({gameId:'r7-followup'});
  code(()=>service.saveReplay(next),'STORAGE_CORRUPT');
  assert.equal(store.has(DATA+'replay:r7-followup'),false);
  store.set(INDEX,JSON.stringify([meta.replayId]));
  assert.equal(service.loadReplay(meta.replayId).replayId,meta.replayId);
  const newer=JSON.parse(bytes);newer.replayVersion='future-version';
  store.set(key,JSON.stringify(newer));
  code(()=>service.loadReplay(meta.replayId),'CORRUPT_REPLAY');
});

test('legacy V1 replay without SHA-256 field remains readable and never acquires a fabricated digest',()=>{
  const state=sandbox({gameId:'r7-legacy'}),archive=createReplayArchive(state);
  delete archive.manifest.integrity.sha256;
  assert.equal(validateReplayArchive(archive),true);
  const store=new Map([[DATA+archive.manifest.replayId,JSON.stringify(archive)]]);
  const service=createReplayService({storage:store});
  assert.equal(service.recoverReplay(archive.manifest.replayId).replayId,archive.manifest.replayId);
  assert.equal(JSON.parse(store.get(DATA+archive.manifest.replayId)).manifest.integrity.sha256,undefined);
  assert.equal(service.getReplayFrame(archive.manifest.replayId,1).asOfEventSeq,1);
});

test('unfinished replay never exposes postgame result or opponents via an old frame',()=>{
  const state=sandbox({gameId:'r7-unfinished'}),store=new Map(),service=createReplayService({storage:store});
  const meta=service.saveReplay(state,{ownerSeat:1});
  code(()=>service.getReplayFrame(meta.replayId,1,{viewerSeat:1,perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  code(()=>service.getReplayFrame(meta.replayId,1,{viewerSeat:3}),'VIEW_FORBIDDEN');
  const view=service.getReplayFrame(meta.replayId,1,{viewerSeat:1}).playerView;
  assert.ok(view.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  assert.ok(view.publicEvents.every(x=>x.seq<=1));
  assert.equal(JSON.stringify(view).includes(state.rng.seed),false);
});
