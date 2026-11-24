import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Rules from '../../src/rules/index.js';
import {createReplayService,ReplayError} from '../../src/replay/index.js';
import {createReplayArchive,validateReplayArchive,replayStateAt,replayIntegrityHashes,checksum,
  AUTHORITATIVE_RULE_REF,AUTHORITATIVE_SCORING_REF,AUTHORITATIVE_SCORING_VERSION,AUTHORITATIVE_PRE_SETTLEMENT} from '../../src/replay/internal.js';
const {createGame,createDeck,getRuleProfile,getRuleCapabilities,listLegalActions,listPendingClaimResponders,applyAction,replayGame,createPlayerView}=Rules;
let activeRuntime,scoring;
const R7=AUTHORITATIVE_RULE_REF;
const cp=x=>JSON.parse(JSON.stringify(x));
const actions=(s,seat,kind)=>listLegalActions(s,seat).filter(a=>!kind||a.kind===kind);
const choose=(s,seat,kind,id,reason)=>{
  const a=actions(s,seat,kind).find(a=>(id===undefined||a.tileIds.includes(id))&&
    (reason===undefined||a.legalityBasis.reasonCodes.includes(reason)));
  assert.ok(a,'Missing '+kind+' '+id+' '+reason+' seat '+seat);return a;
};
const take=(s,a,runtime=activeRuntime)=>applyAction(s,{actorSeat:a.actorSeat,actionId:a.actionId,
  expectedRevision:a.expectedRevision},{settlementRuntime:runtime}).state;
const triplets=start=>Array.from({length:4},(_,t)=>
  Array.from({length:3},(_,i)=>'t:'+(start+t)+':'+i)).flat();
const robber=(start,pair,i=0)=>[...triplets(start),'t:6:'+i,'t:7:'+i,
  't:'+pair+':0','t:'+pair+':1'];
function fixtureDeck(tiles,live,{tail=[],liveLast=[]}={}){
  const all=createDeck(getRuleProfile(R7.profileId,R7.ruleVersion)),seen=new Set();
  const hands=Array.from({length:4},(_,i)=>[...(tiles[i]||[])]);
  for(const id of [...hands.flat(),...live,...liveLast,...tail]){
    assert.ok(all.includes(id)&&!seen.has(id),'duplicate/unknown fixture '+id);seen.add(id);
  }
  for(let seat=0;seat<4;seat++){
    const quota=seat===0?17:16;
    for(const id of all){
      if(hands[seat].length>=quota)break;
      if(id.startsWith('f:')||seen.has(id))continue;
      hands[seat].push(id);seen.add(id);
    }
    assert.equal(hands[seat].length,quota);
  }
  const extra=hands[0].pop();
  const deck=[...hands.flat(),extra,...live,...all.filter(id=>!seen.has(id)),...liveLast,...tail];
  assert.equal(new Set(deck).size,144);return deck;
}
function respond(s,kinds={}){
  for(const seat of listPendingClaimResponders(s))s=take(s,choose(s,seat,kinds[seat]||'pass'));
  return s;
}
function prepared(two=false,{tail=[],three=false}={}){
  const live=['t:31:3','t:32:3','t:33:3','t:5:2'];
  const seats={0:['t:5:3'],1:['t:5:0','t:5:1'],2:robber(9,27)};
  if(two||three)seats[3]=robber(18,28,1);
  if(three)seats[0]=['t:5:3',...robber(0,29,2)];
  let s=createGame({gameId:'r7-rob-'+(two?'multi':'one'),seed:'r7-seed',
    fixtureDeck:fixtureDeck(seats,live,{tail}),...R7},{settlementRuntime:activeRuntime});
  s=take(s,choose(s,0,'discard','t:5:3'));
  s=respond(s,{1:'pong'});
  assert.equal(s.players[1].melds.at(-1).kind,'triplet');
  assert.equal(actions(s,1,'kong').length,0,'no immediate post-pong kong');
  s=take(s,choose(s,1,'discard'));
  for(const [i,seat] of [2,3,0].entries()){
    s=respond(s);
    assert.equal(s.round.currentSeat,seat);
    s=take(s,choose(s,seat,'draw'));
    assert.ok(s.players[seat].concealed.includes(live[i]));
    s=take(s,choose(s,seat,'discard',live[i]));
  }
  s=respond(s);
  assert.equal(s.round.currentSeat,1);
  s=take(s,choose(s,1,'draw'));
  assert.ok(s.players[1].concealed.includes('t:5:2'));
  const added=choose(s,1,'kong','t:5:2','ADDED_KONG');
  return {before:s,proposal:added,open:take(s,added)};
}

const opts=()=>({settlementRuntime:activeRuntime});
const firstOrbitLive=['t:31:3','t:32:3','t:33:3','t:30:3'];
function advanceOrbit(s,ronTile){
  const initial=s.players[0].concealed.find(id=>id!==ronTile&&id.split(':')[1]!=='5'&&id.split(':')[1]!=='8');
  s=respond(take(s,choose(s,0,'discard',initial)));
  for(const [i,seat] of [1,2,3,0].entries()){
    s=take(s,choose(s,seat,'draw'));
    s=take(s,choose(s,seat,'discard',i===3&&ronTile?ronTile:firstOrbitLive[i]));
    if(i!==3||!ronTile)s=respond(s);
  }
  return s;
}
const actionInput=a=>({actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision});

const key=id=>'tw-mahjong-replay:archive:v1:'+id;
const INDEX='tw-mahjong-replay:index:v1';
const errorCode=(fn,code)=>assert.throws(fn,e=>e instanceof ReplayError&&e.code===code);
function assertPrivate(value){
  const raw=JSON.stringify(value);
  for(const key of ['authoritativeSettlement','scoringProfileSnapshot','decomposition','evidenceEventIds','fixtureDeck','initialSeed','winningTileId','rng','wall'])
    assert.ok(!raw.includes('"'+key+'"'),'private field '+key);
  if(value.playerView)assert.ok(value.playerView.opponents.every(p=>!Object.hasOwn(p,'concealed')));
}
function verifyArchive(state,type,payers){
  const r=state.extensions.tw16.result,c=r.authoritativeSettlement,l=c.ledger;
  const storage=new Map(),svc=createReplayService({storage,...opts()});
  const meta=svc.saveReplay(state,{ownerSeat:0,disclosurePolicy:'settled-public-only'}),id=meta.replayId,raw=storage.get(key(id)),a=JSON.parse(raw);
  assert.equal(meta.scoringVersion,AUTHORITATIVE_SCORING_VERSION);
  assert.deepEqual(meta.scoringRef,AUTHORITATIVE_SCORING_REF);
  assert.equal(meta.preSettlementContractVersion,AUTHORITATIVE_PRE_SETTLEMENT);
  assert.equal(a.manifest.scoringVersion,AUTHORITATIVE_SCORING_VERSION);
  assert.deepEqual(a.manifest.scoringProfileSnapshot,c.scoringProfile);
  assert.equal(validateReplayArchive(a,opts()),true);
  assert.deepEqual(replayStateAt(a,state.revision,opts()),state);
  assert.deepEqual(replayGame(state,opts()),state);
  assert.deepEqual(r.delta,state.round.scores);
  assert.deepEqual(l.playerDeltas,r.delta);
  assert.deepEqual(l.payments.map(p=>p.payerSeat),payers);
  assert.equal(l.winType,type);
  assert.equal(scoring.assertLedgerConservation(l),true);
  assert.deepEqual(state.events.at(-1).payload.settlement,r.settlement);
  assert.deepEqual(svc.getReplayFrame(id,state.revision).playerView,createPlayerView(state,0,state.revision,opts()));
  const old=svc.getReplayFrame(id,1),post=svc.getReplayFrame(id,1,{perspective:'postgame'});
  assert.deepEqual(old.playerView,post.playerView);
  assert.deepEqual(post.postgameDisclosure.outcome.settlement,r.settlement);
  for(const v of [meta,old,post,svc.getReplayFrame(id,state.revision)])assertPrivate(v);
  if(type!==null)errorCode(()=>svc.getReplayFrame(id,state.revision-1),'NON_ATOMIC_EVENT_SEQ');
  errorCode(()=>validateReplayArchive(a),'SCORING_RUNTIME_REQUIRED');
  errorCode(()=>createReplayService({storage}).loadReplay(id),'SCORING_RUNTIME_REQUIRED');
  errorCode(()=>validateReplayArchive(a,{settlementRuntime:{contractVersion:AUTHORITATIVE_PRE_SETTLEMENT,
    scoringVersion:AUTHORITATIVE_SCORING_VERSION}}),'SCORING_RUNTIME_REQUIRED');
  const unknown=cp(a);unknown.manifest.scoringVersion='retired-or-unknown@99';
  errorCode(()=>validateReplayArchive(unknown,opts()),'UNSUPPORTED_SCORING_PROFILE');
  storage.delete(INDEX);
  const reopened=createReplayService({storage,...opts()});
  assert.equal(reopened.recoverReplay(id).replayId,id);
  assert.equal(reopened.saveReplay(state,{ownerSeat:0,disclosurePolicy:'settled-public-only'}).replayId,id);
  assert.equal(storage.get(key(id)),raw);
  for(const mutate of [
    x=>delete x.manifest.integrity.sha256,x=>delete x.manifest.scoringRef,
    x=>x.manifest.scoringRef.version='latest',x=>x.manifest.preSettlementContractVersion='unknown',
    x=>x.manifest.scoringProfileSnapshot.tai.dealer++,
    x=>delete x.events.at(-1).turnEvent.payload.scoringVersion,
    x=>x.events.at(-1).turnEvent.payload.settlement.scoringVersion='unknown',
    x=>x.events.at(-1).turnEvent.payload.settlement.playerDeltas[0]++,
    x=>x.events.at(-1).turnEvent.payload.settlement.breakdown.push({code:'forged',tai:9}),
    x=>x.events.push(cp(x.events.at(-1))),x=>x.events.pop(),
    x=>{const n=x.events.length;[x.events[n-1],x.events[n-2]]=[x.events[n-2],x.events[n-1]];}
  ]){
    const bad=cp(a);mutate(bad);
    // For structural terminal tamper re-compute FNV; keep canonical SHA check
    // except on deliberate missing-digest tests. No mutated archive accepted.
    bad.manifest.integrity.eventsChecksum=checksum(bad.events);
    const orphan=new Map([[key(id),JSON.stringify(bad)]]);
    errorCode(()=>createReplayService({storage:orphan,...opts()}).recoverReplay(id),'CORRUPT_REPLAY');
    assert.equal(orphan.has(INDEX),false);
  }
  const forged=cp(a);
  forged.events.at(-1).turnEvent.payload.settlement.playerDeltas[0]++;
  forged.manifest.integrity.eventsChecksum=checksum(forged.events);
  forged.manifest.integrity.sha256=replayIntegrityHashes(forged.manifest,forged.events,forged.decisions,state);
  errorCode(()=>validateReplayArchive(forged,opts()),'CORRUPT_REPLAY');
  return l;
}
test('R7.3 authoritative Rules + Scoring + Replay mandatory integration: actual WIN/DRAW/robbery and failures',async t=>{
  let profile;
  try{profile=getRuleProfile(AUTHORITATIVE_RULE_REF.profileId,AUTHORITATIVE_RULE_REF.ruleVersion)}catch{}
  if(!profile||typeof Rules.createSettlementRuntime!=='function'){
    if(process.env.REPLAY_REQUIRE_R73_AUTHORITATIVE==='1')assert.fail('BLOCKED: authoritative Rules source/runtime missing');
    t.diagnostic('BLOCKED: standalone Replay source has no authoritative Rules runtime; not integration evidence');return;
  }
  try{scoring=await import('../../src/scoring/index.js')}catch(error){
    if(error.code!=='ERR_MODULE_NOT_FOUND'||process.env.REPLAY_REQUIRE_R73_AUTHORITATIVE==='1')throw error;
    t.diagnostic('BLOCKED: Scoring source absent, no integrated evidence');return;
  }
  activeRuntime=Rules.createSettlementRuntime(scoring);
  const {open}=prepared();
  let s=take(open,choose(open,2,'win'));s=take(s,choose(s,3,'pass'));
  const prefix=cp(s),last=choose(s,0,'pass'),store=new Map(),svc=createReplayService({storage:store,...opts()});
  const incomplete=svc.saveReplay(s,{ownerSeat:0});
  assert.equal(incomplete.completionStatus,'incomplete');
  const frame=svc.getReplayFrame(incomplete.replayId,s.revision);
  assertPrivate(frame);
  errorCode(()=>svc.getReplayFrame(incomplete.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  const original=store.get(key(incomplete.replayId));
  store.delete(INDEX);
  errorCode(()=>createReplayService({storage:store}).recoverReplay(incomplete.replayId),'SCORING_RUNTIME_REQUIRED');
  assert.equal(store.has(INDEX),false);
  assert.equal(createReplayService({storage:store,...opts()}).recoverReplay(incomplete.replayId).replayId,incomplete.replayId);
  assert.equal(store.get(key(incomplete.replayId)),original);
  const failRuntime=Rules.createSettlementRuntime({...scoring,settlePreSettlement(){throw Error('injected test scorer failure')}});
  assert.throws(()=>applyAction(s,actionInput(last),{settlementRuntime:failRuntime}),/injected test scorer failure/);
  assert.deepEqual(s,prefix);assert.equal(s.extensions.tw16.result,null);
  assert.equal(store.get(key(incomplete.replayId)),original);
  const robbed=take(s,last);
  assert.deepEqual(verifyArchive(robbed,'rob-added-kong',[1]).playerDeltas,[0,-7,7,0]);
  // Fixed actual prior authoritative archive, not regenerated expectations.
  const frozen=JSON.parse(readFileSync(new URL('./fixtures/r73-authoritative-robbery-archive.json',import.meta.url),'utf8'));
  assert.deepEqual(createReplayArchive(robbed,{ownerSeat:0,disclosurePolicy:'settled-public-only',...opts()}),frozen.archive);
  assert.deepEqual(robbed.extensions.tw16.result,frozen.expectedResult);
  const frozenId=frozen.archive.manifest.replayId,frozenRaw=JSON.stringify(frozen.archive);
  const frozenStorage=new Map([[key(frozenId),frozenRaw]]),frozenService=createReplayService({storage:frozenStorage,...opts()});
  assert.deepEqual(replayStateAt(frozen.archive,frozen.archive.events.length,opts()),robbed);
  assert.equal(frozenService.recoverReplay(frozenId).scoringVersion,AUTHORITATIVE_SCORING_VERSION);
  assert.deepEqual(frozenService.getReplayFrame(frozenId,1,{perspective:'postgame'}).postgameDisclosure.outcome.settlement,frozen.expectedResult.settlement);
  assert.equal(frozenStorage.get(key(frozenId)),frozenRaw);
  assert.throws(()=>applyAction(robbed,actionInput(last),opts()));
  // Real scoring failure: no opening/dice seat-wind proof for flower tai.
  const flower='f:season-spring:0',hand=robber(9,27);hand[15]=flower;
  let blocked=createGame({gameId:'r73-replay-no-seatwind',seed:'r73',
    fixtureDeck:fixtureDeck({0:['t:5:3'],2:hand},firstOrbitLive,{tail:['t:27:1']}),...R7},opts());
  blocked=take(blocked,choose(blocked,2,'replace_flower',flower));
  blocked=advanceOrbit(blocked,'t:5:3');
  blocked=take(blocked,choose(blocked,1,'pass'));blocked=take(blocked,choose(blocked,2,'win'));
  const blockedBefore=cp(blocked),blockedAction=choose(blocked,3,'pass');
  assert.throws(()=>applyAction(blocked,actionInput(blockedAction),opts()),/seat wind|wind proof/i);
  assert.deepEqual(blocked,blockedBefore);assert.equal(blocked.extensions.tw16.result,null);
  const blockedStorage=new Map(),blockedService=createReplayService({storage:blockedStorage,...opts()});
  const blockedMeta=blockedService.saveReplay(blocked);
  assert.equal(blockedMeta.completionStatus,'incomplete');
  assert.deepEqual(replayStateAt(JSON.parse(blockedStorage.get(key(blockedMeta.replayId))),blocked.revision,opts()),blocked);
  errorCode(()=>blockedService.getReplayFrame(blockedMeta.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  let ron=createGame({gameId:'r73-replay-discard',seed:'r73',fixtureDeck:fixtureDeck({0:['t:5:3'],2:robber(9,27)},firstOrbitLive),...R7},opts());
  ron=respond(advanceOrbit(ron,'t:5:3'),{2:'win'});
  verifyArchive(ron,'discard',[0]);
  let self=createGame({gameId:'r73-replay-selfdraw',seed:'r73',fixtureDeck:fixtureDeck({1:robber(9,27)},[...firstOrbitLive,'t:5:2']),...R7},opts());
  self=advanceOrbit(self);self=take(self,choose(self,1,'draw'));self=take(self,choose(self,1,'win'));
  verifyArchive(self,'self-draw',[0,2,3]);
  let draw=createGame({gameId:'r73-replay-draw',seed:'r73',fixtureDeck:fixtureDeck({},[]),...R7},opts());
  for(let i=0;i<500&&draw.round.phase!=='settled';i++){
    if(draw.round.phase==='claim_window')draw=respond(draw);
    else{const a=actions(draw,draw.round.currentSeat).find(a=>['discard','draw','replace_flower'].includes(a.kind));assert.ok(a);draw=take(draw,a);}
  }
  assert.equal(draw.round.phase,'settled');
  assert.deepEqual(verifyArchive(draw,null,[]).playerDeltas,[0,0,0,0]);
});
