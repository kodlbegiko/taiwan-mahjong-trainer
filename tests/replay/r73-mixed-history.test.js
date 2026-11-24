import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Rules from '../../src/rules/index.js';
import {createReplayService,ReplayError} from '../../src/replay/index.js';

const read=name=>JSON.parse(readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const old=read('r73-historical-win.json');
const authority=read('r73-authoritative-robbery-archive.json');
const key=id=>'tw-mahjong-replay:archive:v1:'+id;
const INDEX='tw-mahjong-replay:index:v1';
const cp=x=>JSON.parse(JSON.stringify(x));
const errorCode=(fn,code)=>assert.throws(fn,e=>e instanceof ReplayError&&e.code===code);
function storeOf(...pairs){
  const store=new Map(pairs.map(([id,archive])=>[key(id),typeof archive==='string'?archive:JSON.stringify(archive)]));
  store.set(INDEX,JSON.stringify(pairs.map(([id])=>id)));
  return store;
}
test('mixed policy availability preserves readable legacy history and rejects unverified records',()=>{
  const legacy=old.legacyArchive,id=legacy.manifest.replayId;
  const future=cp(old.shaArchive),futureId='replay:future-policy';
  Object.assign(future.manifest,{replayId:futureId,gameId:'future-policy',
    scoringVersion:'unknown-policy@999'});
  const corrupted='replay:corrupt-record',missing='replay:missing-record';
  const store=storeOf([futureId,future],[id,legacy],[corrupted,'{broken']);
  store.set(INDEX,JSON.stringify([futureId,id,corrupted,missing]));
  const before=[...store.entries()],svc=createReplayService({storage:store});
  errorCode(()=>svc.listReplays(),'UNSUPPORTED_SCORING_PROFILE');
  const entries=svc.listReplayAvailability();
  assert.deepEqual(entries,[
    {replayId:futureId,status:'incompatible',code:'UNSUPPORTED_SCORING_PROFILE'},
    {replayId:id,status:'verified',manifest:svc.loadReplay(id)},
    {replayId:corrupted,status:'unavailable',code:'CORRUPT_REPLAY'},
    {replayId:missing,status:'unavailable',code:'REPLAY_NOT_FOUND'}
  ]);
  assert.deepEqual(svc.getReplayFrame(id,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,old.expectedScores);
  for(const [bad,code] of [[futureId,'UNSUPPORTED_SCORING_PROFILE'],[corrupted,'CORRUPT_REPLAY'],[missing,'REPLAY_NOT_FOUND']]){
    errorCode(()=>svc.loadReplay(bad),code);
    errorCode(()=>svc.recoverReplay(bad),code);
    errorCode(()=>svc.getReplayFrame(bad,1),code);
  }
  assert.deepEqual([...store.entries()],before);
  assert.ok(!JSON.stringify(entries).includes('initialSeed'));
  assert.ok(!JSON.stringify(entries).includes('ruleProfileSnapshot'));
});
test('mixed inventory cannot hide systemic storage failure or malformed index',()=>{
  const svc=createReplayService({storage:new Map([[INDEX,'{}']])});
  errorCode(()=>svc.listReplayAvailability(),'STORAGE_CORRUPT');
  const badStorage={
    getItem(k){if(k===INDEX)return JSON.stringify(['replay:unreadable']);throw Error('private backend detail')},
    setItem(){throw Error('must not write')}
  };
  errorCode(()=>createReplayService({storage:badStorage}).listReplayAvailability(),'STORAGE_READ_FAILED');
});
test('mixed historical and authority archive inventory negotiates runtime without rewriting history',async t=>{
  const legacy=old.shaArchive,auth=authority.archive;
  const id=legacy.manifest.replayId,authId=auth.manifest.replayId;
  const storage=storeOf([authId,auth],[id,legacy]),before=[...storage.entries()];
  const legacySvc=createReplayService({storage});
  const entries=legacySvc.listReplayAvailability();
  const expected=typeof Rules.createSettlementRuntime==='function'?'SCORING_RUNTIME_REQUIRED':'UNKNOWN_RULE_PROFILE';
  assert.deepEqual(entries[0],{replayId:authId,status:'incompatible',code:expected});
  assert.deepEqual(entries[1],{replayId:id,status:'verified',manifest:legacySvc.loadReplay(id)});
  assert.deepEqual([...storage.entries()],before);
  if(typeof Rules.createSettlementRuntime!=='function'){
    if(process.env.REPLAY_REQUIRE_R73_AUTHORITATIVE==='1')assert.fail('BLOCKED: authoritative Rules missing');
    t.diagnostic('Standalone inventory verified; authority runtime branch NOT_RUN');return;
  }
  let Scoring;
  try{Scoring=await import('../../src/scoring/index.js')}catch(error){
    if(error.code!=='ERR_MODULE_NOT_FOUND'||process.env.REPLAY_REQUIRE_R73_AUTHORITATIVE==='1')throw error;
    t.diagnostic('BLOCKED: Scoring missing');return;
  }
  const settlementRuntime=Rules.createSettlementRuntime(Scoring);
  const service=createReplayService({storage,settlementRuntime});
  const available=service.listReplayAvailability();
  assert.deepEqual(available,service.listReplays().map(manifest=>({replayId:manifest.replayId,status:'verified',manifest})));
  assert.deepEqual(service.getReplayFrame(authId,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,authority.expectedScores);
  assert.deepEqual([...storage.entries()],before);
});
