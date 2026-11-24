import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGame,createDeck,getRuleProfile,getRuleCapabilities,listLegalActions,listPendingClaimResponders,
  applyAction,createPlayerView,replayGame,RuleCapabilityError} from '../../src/rules/index.js';
import {createReplayService,ReplayError} from '../../src/replay/index.js';
import {createReplayArchive,validateReplayArchive,replayStateAt,replayIntegrityHashes,checksum} from '../../src/replay/internal.js';
import {sha256Utf8} from '../../src/replay/integrity.js';

// Fixture follows Rules PR #51 @ 633d20fa, driven only by real LegalActions.
const R7={profileId:'tw16-rob-added-kong',ruleVersion:'experimental-v1'};
const cp=x=>JSON.parse(JSON.stringify(x));
const actions=(s,seat,kind)=>listLegalActions(s,seat).filter(a=>!kind||a.kind===kind);
const choose=(s,seat,kind,id,reason)=>{
  const a=actions(s,seat,kind).find(a=>(id===undefined||a.tileIds.includes(id))&&
    (reason===undefined||a.legalityBasis.reasonCodes.includes(reason)));
  assert.ok(a,'Missing '+kind+' '+id+' '+reason+' seat '+seat);return a;
};
const take=(s,a)=>applyAction(s,{actorSeat:a.actorSeat,actionId:a.actionId,
  expectedRevision:a.expectedRevision}).state;
const triplets=start=>Array.from({length:4},(_,t)=>
  Array.from({length:3},(_,i)=>'t:'+(start+t)+':'+i)).flat();
const robber=(start,pair,i=0)=>[...triplets(start),'t:6:'+i,'t:7:'+i,
  't:'+pair+':0','t:'+pair+':1'];
function fixtureDeck(tiles,live){
  const all=createDeck(getRuleProfile(R7.profileId,R7.ruleVersion)),seen=new Set();
  const hands=Array.from({length:4},(_,i)=>[...(tiles[i]||[])]);
  for(const id of [...hands.flat(),...live]){
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
  const deck=[...hands.flat(),extra,...live,...all.filter(id=>!seen.has(id))];
  assert.equal(new Set(deck).size,144);return deck;
}
function respond(s,kinds={}){
  for(const seat of listPendingClaimResponders(s))s=take(s,choose(s,seat,kinds[seat]||'pass'));
  return s;
}
function prepared(two=false){
  const live=['t:31:3','t:32:3','t:33:3','t:5:2'];
  const seats={0:['t:5:3'],1:['t:5:0','t:5:1'],2:robber(9,27)};
  if(two)seats[3]=robber(18,28,1);
  let s=createGame({gameId:'r7-rob-'+(two?'multi':'one'),seed:'r7-seed',
    fixtureDeck:fixtureDeck(seats,live),...R7});
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

const code=(fn,want)=>assert.throws(fn,e=>e instanceof ReplayError&&e.code===want);
let robberyAvailable=false;
try {
  getRuleProfile(R7.profileId,R7.ruleVersion);
  robberyAvailable=getRuleCapabilities(R7).publicEventContractVersion==='tw16-rob-added-kong-public/1.0.0';
} catch {}
const dependency=robberyAvailable?false:'Rules PR #51 reviewed public-event contract not present; cross-source integration NOT RUN';
test('R7.1 dependency must be present on explicit integrated gate',()=>{
  if(process.env.REPLAY_REQUIRE_R7_RULES==='1')assert.ok(robberyAvailable,'Missing Rules PR #51');
});
const key=id=>'tw-mahjong-replay:archive:v1:'+id;
function openArchive(state,ownerSeat,disclosurePolicy='none'){
  const storage=new Map(),service=createReplayService({storage});
  const meta=service.saveReplay(state,{ownerSeat,disclosurePolicy});
  return {storage,service,meta,archive:JSON.parse(storage.get(key(meta.replayId)))};
}
test('R7.1 canonical SHA matches Node SHA-256, JSON and key-order invariance',()=>{
  for(const s of ['','abc','麻將🀄','\uD800','x'.repeat(55),'x'.repeat(56),'x'.repeat(64),'x'.repeat(1000)])
    assert.equal(sha256Utf8(s),createHash('sha256').update(s,'utf8').digest('hex'));
  const state=createGame({gameId:'r71-hash',seed:'r71-seed',profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'});
  const archive=createReplayArchive(state),reverse=v=>Array.isArray(v)?v.map(reverse):
    v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reverse(v[k])])):v;
  const copy=JSON.parse(JSON.stringify(reverse(archive)));
  assert.equal(validateReplayArchive(copy),true);
  assert.deepEqual(replayIntegrityHashes(copy.manifest,copy.events,copy.decisions,reverse(state)),archive.manifest.integrity.sha256);
  copy.manifest.scoringVersion='tw16-gametower-comparative@1.0.0-experimental';
  code(()=>validateReplayArchive(copy),'UNSUPPORTED_SCORING_PROFILE');
});
function legacySettled(){
  const ref={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
  const profile=getRuleProfile(ref.profileId,ref.ruleVersion),all=createDeck(profile);
  const hand=[...Array.from({length:5},(_,t)=>Array.from({length:3},(_,i)=>'t:'+t+':'+i)).flat(),'t:5:0','t:5:1'];
  const extra=hand.pop(),rest=all.filter(x=>!hand.includes(x)&&x!==extra);
  const state=createGame({gameId:'r71-legacy-win',seed:'r71-legacy',dealerSeat:0,...ref,
    fixtureDeck:[...hand,...rest.slice(0,48),extra,...rest.slice(48)]});
  return take(state,choose(state,0,'win'));
}
test('R7.1 legacy settled FNV bytes and historical result stay unchanged',()=>{
  const end=legacySettled();
  const archive=createReplayArchive(end,{disclosurePolicy:'settled-public-only'});
  delete archive.manifest.integrity.sha256;
  const raw=JSON.stringify(archive),id=archive.manifest.replayId,store=new Map([[key(id),raw]]);
  const svc=createReplayService({storage:store});
  assert.deepEqual(replayStateAt(archive,end.revision),end);
  assert.equal(svc.recoverReplay(id).scoringVersion,'tw16-minimal-tai-v1');
  assert.deepEqual(svc.getReplayFrame(id,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,end.extensions.tw16.result.delta);
  assert.equal(svc.saveReplay(end,{disclosurePolicy:'settled-public-only'}).replayId,id);
  assert.equal(store.get(key(id)),raw);
});
test('R7.1 proposal maps to kong action, private WIN/PASS cannot change observer frame',{skip:dependency},()=>{
  const {before,proposal,open}=prepared();
  const {service,meta,archive}=openArchive(open,1);
  assert.deepEqual(replayStateAt(archive,open.revision),open);
  assert.equal(service.getPlayerDecision(meta.replayId,open.revision).actionId,proposal.actionId);
  assert.equal(service.getPlayerDecision(meta.replayId,open.revision).kind,'kong');
  assert.equal(service.getDecisionAnalysis(meta.replayId,open.revision).analysisStatus,'advisory-legal-only');
  assert.deepEqual(service.getReplayFrame(meta.replayId,before.revision).playerView,createPlayerView(before,1));
  assert.equal(service.getReplayFrame(meta.replayId,open.revision).publicEvent.type,'kong_proposed');
  code(()=>service.getReplayFrame(meta.replayId,1,{perspective:'postgame'}),'POSTGAME_UNAVAILABLE');
  const win=take(open,choose(open,2,'win')),pass=take(open,choose(open,2,'pass'));
  const x=openArchive(win,3),y=openArchive(pass,3);
  assert.deepEqual(x.service.getReplayFrame(x.meta.replayId,win.revision).playerView,
    y.service.getReplayFrame(y.meta.replayId,pass.revision).playerView);
});
test('R7.1 successful robbery restores full state and historical minimal liability',{skip:dependency},()=>{
  const {open}=prepared();
  const end=respond(open,{2:'win'});
  const {service,meta,archive,storage}=openArchive(end,0,'settled-public-only');
  assert.deepEqual(replayStateAt(archive,end.revision),end);
  assert.deepEqual(replayGame(end),end);
  const r=end.extensions.tw16.result;
  assert.equal(meta.scoringVersion,'tw16-minimal-tai-v1');
  assert.deepEqual(archive.events.at(-1).turnEvent.payload.delta,r.delta);
  assert.equal(r.delta.reduce((n,v)=>n+v,0),0);
  assert.deepEqual(end.events.slice(-3).map(e=>e.type),['pass','win','settle']);
  const terminalView=service.getReplayFrame(meta.replayId,end.revision).playerView;
  const privateTrigger=end.events.at(-3).causedByActionId;
  assert.ok(privateTrigger);
  assert.ok(terminalView.publicEvents.every(e=>e.causedByActionId!==privateTrigger));
  for(const e of terminalView.publicEvents.slice(-3))
    assert.ok(!Object.hasOwn(e,'causedByActionId'));
  for(const seq of [end.revision-2,end.revision-1])code(()=>service.getReplayFrame(meta.replayId,seq),'NON_ATOMIC_EVENT_SEQ');
  for(const seq of [1,open.revision,end.revision]){
    const frame=service.getReplayFrame(meta.replayId,seq);
    assert.deepEqual(frame.playerView,createPlayerView(end,0,seq));
    assert.ok(frame.playerView.opponents.every(p=>!Object.hasOwn(p,'concealed')));
    assert.ok(frame.playerView.publicEvents.every(e=>e.seq<=seq));
  }
  const post=service.getReplayFrame(meta.replayId,open.revision,{perspective:'postgame'});
  assert.deepEqual(post.postgameDisclosure.outcome.robAddedKong,r.robAddedKong);
  assert.deepEqual(post.postgameDisclosure.outcome.delta,r.delta);
  assert.equal(post.postgameDisclosure.allowedForDecisionScoring,false);
  assert.equal(JSON.stringify(post).includes(end.rng.seed),false);
  const original=storage.get(key(meta.replayId));
  storage.delete('tw-mahjong-replay:index:v1');
  const reopened=createReplayService({storage});
  reopened.recoverReplay(meta.replayId);
  assert.equal(storage.get(key(meta.replayId)),original);
  assert.deepEqual(reopened.getReplayFrame(meta.replayId,end.revision),service.getReplayFrame(meta.replayId,end.revision));
  for(const mutate of [
    a=>a.events.pop(),a=>a.events.splice(-2,1),a=>a.events.splice(-2,0,cp(a.events.at(-2))),
    a=>{const n=a.events.length;[a.events[n-2],a.events[n-1]]=[a.events[n-1],a.events[n-2]];},
    a=>{a.events.at(-1).turnEvent.payload.delta=[0,0,0,0];a.manifest.integrity.eventsChecksum=checksum(a.events);},
    a=>{a.events.at(-1).turnEvent.payload.robAddedKong.fromSeat=0;
      a.manifest.integrity.eventsChecksum=checksum(a.events);
      a.manifest.integrity.sha256=replayIntegrityHashes(a.manifest,a.events,a.decisions,end);}
  ]){const bad=cp(archive);mutate(bad);code(()=>validateReplayArchive(bad),'CORRUPT_REPLAY');}
});
test('R7.1 all PASS commits kong atomically and replays exact tail replacement',{skip:dependency},()=>{
  const {open}=prepared(),committed=respond(open);
  const end=take(committed,choose(committed,1,'draw'));
  const {service,meta,archive}=openArchive(end,1);
  assert.equal(committed.events.at(-1).payload.proposalEventId,open.events.at(-1).eventId);
  assert.deepEqual(committed.events.slice(-2).map(e=>e.type),['pass','kong']);
  assert.ok(!Object.hasOwn(service.getReplayFrame(meta.replayId,committed.revision).publicEvent,'causedByActionId'));
  code(()=>service.getReplayFrame(meta.replayId,committed.revision-1),'NON_ATOMIC_EVENT_SEQ');
  assert.deepEqual(replayStateAt(archive,committed.revision),committed);
  assert.deepEqual(replayStateAt(archive,end.revision),end);
  assert.deepEqual(service.getReplayFrame(meta.replayId,end.revision).playerView,createPlayerView(end,1));
  assert.equal(meta.completionStatus,'incomplete');
  // Continue the same real hand to a terminal result, without bots or a
  // synthetic state edit. Always pass reactions to avoid unsupported
  // multi-winner arbitration; prefer canonical self-win when offered.
  let terminal=end;
  for(let i=0;i<1024&&terminal.round.phase!=='settled';i++){
    const seat=terminal.round.phase==='claim_window'
      ?listPendingClaimResponders(terminal)[0]:terminal.round.currentSeat;
    const legal=listLegalActions(terminal,seat);
    const action=terminal.round.phase==='claim_window'
      ?legal.find(a=>a.kind==='pass')
      :['replace_flower','win','draw','discard'].map(k=>legal.find(a=>a.kind===k)).find(Boolean);
    assert.ok(action,'Rules must provide a legal continuation at '+terminal.revision);
    terminal=take(terminal,action);
  }
  assert.equal(terminal.round.phase,'settled');
  const saved=openArchive(terminal,1,'settled-public-only');
  assert.deepEqual(replayStateAt(saved.archive,terminal.revision),terminal);
  assert.deepEqual(saved.service.getReplayFrame(saved.meta.replayId,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,
    terminal.extensions.tw16.result.delta);
});
test('R7.1 competing robbers preserve accepted prefix; rejected final PASS is not archived',{skip:dependency},()=>{
  const {open}=prepared(true);
  const first=take(open,choose(open,2,'win'));
  const state=take(first,choose(first,3,'win'));
  const action=choose(state,0,'pass'),submission={actorSeat:0,actionId:action.actionId,expectedRevision:action.expectedRevision};
  assert.throws(()=>applyAction(state,submission),e=>e instanceof RuleCapabilityError&&e.capability==='multiple_winners');
  const archive=createReplayArchive(state,{ownerSeat:0,unsupportedSubmission:submission});
  assert.equal(archive.manifest.completionStatus,'incomplete');
  assert.equal(archive.events.length,state.revision);
  assert.deepEqual(replayStateAt(archive,state.revision),state);
});

test('R7.1 opt-in comparison scoring never replaces historical Rules results, even with fees',async t=>{
  let scoring;
  try {scoring=await import('../../src/scoring/index.js');}
  catch(error){
    if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.url?.endsWith('/src/scoring/index.js'))throw error;
    if(process.env.REPLAY_REQUIRE_R7_SCORING==='1')throw error;
    t.skip('Scoring PR #52 not present; comparative adapter integration NOT RUN');return;
  }
  const cases=[legacySettled()];
  if(robberyAvailable){const {open}=prepared();cases.push(respond(open,{2:'win'}));}
  if(process.env.REPLAY_REQUIRE_R7_RULES==='1')assert.equal(cases.length,2);
  for(const state of cases){
    const original=JSON.stringify(state);
    const {service,meta,archive,storage}=openArchive(state,0,'settled-public-only');
    const raw=storage.get(key(meta.replayId));
    const definition=cp(scoring.getScoringProfile('tw16-gametower-comparative'));
    definition.settlement.fee={mode:'fixed-per-player',points:7};
    const profile=scoring.createScoringProfile(definition);
    const capabilities=getRuleCapabilities(state.ruleRef);
    const publicEventContractVersion=capabilities.publicEventContractVersion;
    if(state.extensions.tw16.result.robAddedKong){
      assert.equal(publicEventContractVersion,'tw16-rob-added-kong-public/1.0.0');
      assert.throws(()=>scoring.settleRulesState(profile,state),
        {code:'UNSUPPORTED_SCORING_CAPABILITY'});
      assert.throws(()=>scoring.settleRulesState(profile,state,{publicEventContractVersion:'unknown'}),
        {code:'UNSUPPORTED_SCORING_CAPABILITY'});
    }
    const comparison=scoring.settleRulesState(profile,state,{publicEventContractVersion});
    assert.equal(scoring.assertLedgerConservation(comparison),true);
    assert.equal(comparison.scoringVersion,profile.profileId+'@'+profile.version);
    assert.equal(comparison.playerTransferDeltas.reduce((n,v)=>n+v,0),0);
    assert.equal(comparison.playerDeltas.reduce((n,v)=>n+v,0)+comparison.houseDelta,0);
    assert.equal(comparison.houseDelta,28);
    const result=state.extensions.tw16.result;
    if(result.robAddedKong){
      assert.equal(comparison.payments.length,1);
      assert.equal(comparison.payments[0].payerSeat,result.sourceSeat);
      assert.ok(comparison.score.breakdown.some(x=>x.code==='rob-added-kong'));
    }
    assert.equal(JSON.stringify(state),original,'comparison scorer must be read-only');
    assert.equal(storage.get(key(meta.replayId)),raw,'comparison must not write archive');
    assert.equal(service.loadReplay(meta.replayId).scoringVersion,'tw16-minimal-tai-v1');
    assert.deepEqual(replayStateAt(archive,state.revision),state);
    assert.deepEqual(service.getReplayFrame(meta.replayId,1,{perspective:'postgame'}).postgameDisclosure.outcome.delta,result.delta);
    const forged=cp(archive);
    forged.manifest.scoringVersion=comparison.scoringVersion;
    code(()=>validateReplayArchive(forged),'UNSUPPORTED_SCORING_PROFILE');
  }
});
