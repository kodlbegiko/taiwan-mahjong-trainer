import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as Rules from '../../src/rules/index.js';
import * as Scoring from '../../src/scoring/index.js';
import {replayStateAt} from '../../src/replay/internal.js';
import {createFullRoundSession,AUTHORITY_EXPERIMENT_KEY} from '../../src/table-ui/full-round.js';
import {TableView} from '../../src/table-ui/view.js';
const legacyKey='tw-mahjong-master-academy:full-table:r3:v1';
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),m};};
const ref=Rules.AUTHORITATIVE_RULE_REF;
const fixture=JSON.parse(readFileSync(new URL('../replay/fixtures/r73-authoritative-robbery-archive.json',import.meta.url),'utf8'));
const opts={settlementRuntime:Rules.createSettlementRuntime(Scoring)};
const forbidden=x=>assert.doesNotMatch(JSON.stringify(x),/"(?:authoritativeSettlement|evidenceEventIds|decomposition|winningTileId|fixtureDeck|initialSeed|rng|wall)"/);
test('default host unchanged; explicit authority host has isolated namespace',async()=>{
  const storage=memory();
  const legacy=await createFullRoundSession({storage});
  const l=legacy.start({fixedSeed:'r74-legacy-host'});
  assert.equal(l.profile.profileId,'tw16-single-winner-interception');
  assert.ok(!legacy.availableProfiles().some(p=>p.profileId===ref.profileId));
  assert.throws(()=>legacy.start({...ref,fixedSeed:'r74-denied'}));
  const old=storage.getItem(legacyKey);
  const experimental=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(experimental.availableProfiles().length,1);
  const a=experimental.start({...ref,fixedSeed:'r74-authority-host'});
  assert.equal(a.profile.profileId,ref.profileId);
  assert.equal(storage.getItem(legacyKey),old);
  assert.ok(storage.getItem(AUTHORITY_EXPERIMENT_KEY));
  assert.ok(a.view.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  forbidden(a);
  const restored=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(restored.restore(),true);assert.deepEqual(restored.snapshot().view,a.view);
  assert.throws(()=>experimental.start({profileId:l.profile.profileId,ruleVersion:l.profile.ruleVersion}));
  const reopened=await createFullRoundSession({storage});
  assert.equal(reopened.restore(),true);assert.deepEqual(reopened.snapshot().view,l.view);
});
test('real authority terminal archive restores, renders and replays without rewriting legacy bytes',async()=>{
  const storage=memory(),state=replayStateAt(fixture.archive,fixture.archive.manifest.eventCount,opts);
  const raw=JSON.stringify({version:1,gameState:state,botCheckpoint:{paused:false},botDifficulty:'Intermediate'});
  storage.setItem(AUTHORITY_EXPERIMENT_KEY,raw);
  storage.setItem(legacyKey,'historical-legacy-sentinel');
  const session=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(session.restore(),true);
  const snap=session.snapshot();
  assert.deepEqual(snap.result.publicSummary.settlement.playerDeltas,fixture.expectedScores);
  assert.equal(snap.replayConnected,true,snap.replayWarning);
  forbidden(snap);
  assert.match(TableView(snap),/data-authoritative-settlement/);
  const timeline=await session.replay();
  assert.equal(timeline.verified,true);
  const frame=timeline.getFrame(timeline.total-1);
  assert.deepEqual(frame.view.publicEvents.at(-1).payload.settlement,snap.result.publicSummary.settlement);
  assert.deepEqual(frame.legalActions,[]);
  forbidden(frame);
  assert.equal(storage.getItem(legacyKey),'historical-legacy-sentinel');
  assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),raw);
  assert.ok([...storage.m.keys()].some(k=>k.startsWith('tw-mahjong-authority-experiment:tw-mahjong-replay:archive:')));
  assert.ok(![...storage.m.keys()].some(k=>k.startsWith('tw-mahjong-replay:')));
});
test('damaged authority checkpoint fails closed without overwriting either namespace',async()=>{
  const storage=memory(),raw='{"version":1,"gameState":{"ruleRef":{"profileId":"tw16-authoritative-scoring","ruleVersion":"experimental-v1"}}}';
  storage.setItem(AUTHORITY_EXPERIMENT_KEY,raw);storage.setItem(legacyKey,'keep');
  const s=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(s.restore(),false);assert.throws(()=>s.start(ref));
  assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),raw);assert.equal(storage.getItem(legacyKey),'keep');
});

// Real deterministic competing-robber fixture from r74-authority-bot.test.js.
const {createGame,createDeck,getRuleProfile,listLegalActions,listPendingClaimResponders,applyAction,AUTHORITATIVE_RULE_REF}=Rules;
const activeRuntime=opts.settlementRuntime;
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


test('authority host preserves real multiwinner capability stop across reload without retry or settlement',async()=>{
  const storage=memory();
  const {open}=prepared(true);
  storage.setItem(AUTHORITY_EXPERIMENT_KEY,JSON.stringify({version:1,gameState:open,botCheckpoint:{paused:false},botDifficulty:'Intermediate'}));
  storage.setItem(legacyKey,'preserve-legacy');
  const s=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(s.restore(),true);
  assert.equal((await s.advanceBots()).status,'human-turn');
  const before=JSON.parse(storage.getItem(AUTHORITY_EXPERIMENT_KEY));
  const a=s.snapshot().view.legalActions.find(a=>a.kind==='pass');
  assert.ok(a);
  const isBlocked=e=>e.code==='UNSUPPORTED_RULE_CAPABILITY'&&e.capability==='multiple_winners';
  await assert.rejects(s.submit(a),isBlocked);
  const raw=storage.getItem(AUTHORITY_EXPERIMENT_KEY),saved=JSON.parse(raw);
  assert.deepEqual(saved.gameState,before.gameState);
  assert.equal(saved.botCheckpoint.blocked.capability,'multiple_winners');
  assert.equal(saved.botCheckpoint.blocked.expectedRevision,saved.gameState.revision);
  const reopened=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(reopened.restore(),true);
  const snap=reopened.snapshot();
  assert.equal(snap.result,null);
  assert.equal(snap.replayConnected,false);
  assert.equal(snap.capabilityBlock.capability,'multiple_winners');
  const html=TableView(snap);
  assert.match(html,/data-authority-capability-block/);
  assert.doesNotMatch(html,/data-(?:submit-action|pick-action|continue-bots|resume-bots|pause-bots)/);
  await assert.rejects(reopened.submit(a),isBlocked);
  await assert.rejects(reopened.advanceBots(),isBlocked);
  assert.throws(()=>reopened.resume(),isBlocked);
  assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),raw);
  assert.equal(storage.getItem(legacyKey),'preserve-legacy');
  assert.ok(![...storage.m.keys()].some(k=>k.includes('replay:archive:')));
  const tampered=structuredClone(saved);tampered.botCheckpoint.blocked.expectedRevision++;
  const badRaw=JSON.stringify(tampered);storage.setItem(AUTHORITY_EXPERIMENT_KEY,badRaw);
  const bad=await createFullRoundSession({storage,enableAuthoritative:true});
  assert.equal(bad.restore(),false);assert.equal(bad.snapshot(),null);assert.throws(()=>bad.start(ref));
  assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),badRaw);
});
