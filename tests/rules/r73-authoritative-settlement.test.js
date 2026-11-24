import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,createDeck,getRuleProfile,getRuleCapabilities,listLegalActions,
  listPendingClaimResponders,applyAction,validateGameState,createPlayerView,replayGame,
  startNextRound,createSettlementRuntime,AUTHORITATIVE_RULE_REF,AUTHORITATIVE_SCORING_REF,
  AUTHORITATIVE_SCORING_VERSION,PRE_SETTLEMENT_CONTRACT,RuleCapabilityError,
} from '../../src/rules/index.js';

// Strict combined gate must not silently skip. Standalone Rules branch has
// no Scoring-owned files; Agent 8 pins both sources in a single checkout.
let scoring=null,loadError=null;
try {scoring=await import('../../src/scoring/index.js')}catch(e){
  if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;loadError=e;
}
const strict=process.env.RULES_REQUIRE_R73_SCORING==='1';
const gate={skip:scoring?false:'Scoring source absent on standalone Rules branch'};
let activeRuntime;
if(scoring)activeRuntime=createSettlementRuntime(scoring);
test('R7.3 missing Scoring dependency is never a combined PASS',()=>{
  if(strict)assert.ok(scoring,loadError?.message);
  const caps=getRuleCapabilities(AUTHORITATIVE_RULE_REF);
  assert.equal(caps.scoring.policy,AUTHORITATIVE_SCORING_VERSION);
  assert.equal(caps.scoring.evidenceContractVersion,PRE_SETTLEMENT_CONTRACT);
  assert.throws(()=>createGame({seed:'missing-runtime',...AUTHORITATIVE_RULE_REF}),e=>e instanceof RuleCapabilityError&&e.capability==='authoritative_scoring_runtime_required');
  assert.throws(()=>createSettlementRuntime({}));
});
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
function checkSettlement(s,expected){
  const r=s.extensions.tw16.result,commit=r.authoritativeSettlement;
  assert.equal(r.scoringVersion,AUTHORITATIVE_SCORING_VERSION);
  assert.equal(commit.evidence.contractVersion,PRE_SETTLEMENT_CONTRACT);
  assert.equal(commit.evidence.settlementId,s.round.roundId);
  assert.equal(commit.evidence.winType,expected);
  assert.equal(s.events.filter(e=>e.type==='settle').length,1);
  assert.equal(s.events.filter(e=>e.type==='win').length,expected===null?0:1);
  assert.deepEqual(commit.scoringProfile,scoring.getScoringProfile(AUTHORITATIVE_SCORING_REF.profileId,AUTHORITATIVE_SCORING_REF.version));
  assert.deepEqual(r.delta,commit.ledger.playerDeltas);
  assert.deepEqual(s.round.scores,r.delta);
  assert.equal(r.delta.reduce((a,b)=>a+b,0),0);
  assert.equal(commit.ledger.houseDelta,0);
  assert.deepEqual(commit.ledger.fees,[]);
  assert.ok(r.delta.every(n=>!Object.is(n,-0)));
  assert.deepEqual(scoring.settlePreSettlement(scoring.getScoringProfile(AUTHORITATIVE_SCORING_REF.profileId,AUTHORITATIVE_SCORING_REF.version),commit.evidence),commit.ledger);
  assert.equal(validateGameState(s,opts()),true);
  assert.deepEqual(replayGame(s,opts()),s);
  for(let seat=0;seat<4;seat++){
    const view=createPlayerView(s,seat,s.revision,opts()),raw=JSON.stringify(view.publicEvents);
    assert.deepEqual(view.publicEvents.at(-1).payload.settlement,r.settlement);
    assert.ok(!raw.includes('"authoritativeSettlement"')&&!raw.includes('"decomposition"')&&!raw.includes('"evidenceEventIds"'));
    assert.deepEqual(view.legalActions,[]);
  }
  return r;
}
test('R7.3 real Scoring: sole robbery payer, immutable evidence, one atomic settlement and replay',gate,()=>{
  const {open}=prepared();
  let s=take(open,choose(open,2,'win'));s=take(s,choose(s,3,'pass'));
  const before=cp(s),a=choose(s,0,'pass');
  const applied=applyAction(s,actionInput(a),opts());
  assert.deepEqual(s,before);
  assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.players[1].concealed));
  assert.deepEqual(applied.events.map(e=>e.type),['pass','win','settle']);
  s=applied.state;
  const r=checkSettlement(s,'rob-added-kong');
  assert.equal(r.winnerSeat,2);assert.equal(r.sourceSeat,1);
  assert.equal(r.tai,7);
  assert.deepEqual(r.delta,[0,-7,7,0]);
  assert.deepEqual(r.authoritativeSettlement.evidence.payerSeats,[1]);
  assert.equal(s.players[1].melds.at(-1).kind,'triplet');
  assert.equal(r.settlement.breakdown.find(x=>x.code==='rob-added-kong').tai,1);
  assert.throws(()=>applyAction(s,actionInput(a),opts()),/Stale|illegal/);
  assert.throws(()=>replayGame({...s,events:s.events.slice(0,-1)},opts()),/atomic/);
  assert.throws(()=>startNextRound(s,{seed:'next',gameId:'next'},opts()),e=>e.capability==='unverified_dealer_streak_chain');
  const forged=cp(s);forged.events.at(-1).payload.settlement.payments[0].points++;
  assert.throws(()=>replayGame(forged,opts()));
});
test('R7.3 real Scoring: ordinary discard WIN and no-robbery committed kong',gate,()=>{
  let s=createGame({gameId:'r73-discard',seed:'r73',fixtureDeck:fixtureDeck({0:['t:5:3'],2:robber(9,27)},firstOrbitLive),...R7},opts());
  s=respond(advanceOrbit(s,'t:5:3'),{2:'win'});
  const r=checkSettlement(s,'discard');assert.deepEqual(r.authoritativeSettlement.evidence.payerSeats,[0]);
  const {open}=prepared();const committed=respond(open);
  assert.equal(committed.events.at(-1).type,'kong');
  assert.equal(committed.players[1].melds.at(-1).kind,'kong');
  assert.equal(committed.extensions.tw16.result,null);
  assert.deepEqual(replayGame(committed,opts()),committed);
});
test('R7.3 real Scoring: live self-draw pays from all three other seats',gate,()=>{
  let s=createGame({gameId:'r73-selfdraw',seed:'r73',fixtureDeck:fixtureDeck({1:robber(9,27)},[...firstOrbitLive,'t:5:2']),...R7},opts());
  s=advanceOrbit(s);
  s=take(s,choose(s,1,'draw'));
  s=take(s,choose(s,1,'win'));
  const r=checkSettlement(s,'self-draw');assert.deepEqual(r.authoritativeSettlement.evidence.payerSeats,[0,2,3]);
});
test('R7.3 real Scoring: exhaustive live-wall DRAW has one zero ledger and no WIN',gate,()=>{
  let s=createGame({gameId:'r73-draw',seed:'r73',fixtureDeck:fixtureDeck({},[]),...R7},opts());
  let guard=0;
  while(s.round.phase!=='settled'&&guard++<500){
    if(s.round.phase==='claim_window')s=respond(s);
    else {const a=actions(s,s.round.currentSeat).find(a=>['discard','draw','replace_flower'].includes(a.kind));assert.ok(a);s=take(s,a);}
  }
  assert.equal(s.round.phase,'settled');
  const r=checkSettlement(s,null);assert.deepEqual(r.delta,[0,0,0,0]);assert.equal(r.reason,'exhaustive-draw');
});
test('R7.3 scorer failure / malformed payer ledger rolls back final action, no partial settlement',gate,()=>{
  const {open}=prepared();let s=take(open,choose(open,2,'win'));s=take(s,choose(s,3,'pass'));
  const before=cp(s),a=choose(s,0,'pass');
  for(const failing of [
    {...scoring,settlePreSettlement(profile,e){assert.ok(Object.isFrozen(e)&&Object.isFrozen(e.evidence)&&Object.isFrozen(e.evidence.concealed));throw new Error('injected scorer failure')}},
    {...scoring,settlePreSettlement(profile,e){const l=cp(scoring.settlePreSettlement(profile,e));l.payments[0].payerSeat=3;return l}},
    {...scoring,settlePreSettlement(profile,e){const l=cp(scoring.settlePreSettlement(profile,e));l.scoringVersion='forged';return l}},
  ]){
    assert.throws(()=>applyAction(s,actionInput(a),{settlementRuntime:createSettlementRuntime(failing)}));
    assert.deepEqual(s,before);assert.equal(s.extensions.tw16.result,null);assert.ok(!s.events.some(e=>e.type==='settle'));
  }
  const recovered=applyAction(s,actionInput(a),opts()).state;
  checkSettlement(recovered,'rob-added-kong');
});
test('R7.3 competing robbers fail closed with no scorer call',gate,()=>{
  const {open}=prepared(true);let s=take(open,choose(open,2,'win'));s=take(s,choose(s,3,'win'));
  const before=cp(s),a=choose(s,0,'pass');let calls=0;
  const runtime=createSettlementRuntime({...scoring,settlePreSettlement(){calls++;throw Error('must not score')}});
  assert.throws(()=>applyAction(s,actionInput(a),{settlementRuntime:runtime}),e=>e.capability==='multiple_winners');
  assert.equal(calls,0);assert.deepEqual(s,before);
});

test('R7.3 actual missing seat-wind evidence fails closed on flower tai, not guessed from dealer seat',gate,()=>{
  const flower='f:season-spring:0',hand=robber(9,27);hand[15]=flower;
  let s=createGame({gameId:'r73-no-seatwind',seed:'r73',
    fixtureDeck:fixtureDeck({0:['t:5:3'],2:hand},firstOrbitLive,{tail:['t:27:1']}),...R7},opts());
  assert.equal(s.round.phase,'replacement');assert.equal(s.round.currentSeat,2);
  s=take(s,choose(s,2,'replace_flower',flower));
  s=advanceOrbit(s,'t:5:3');
  s=take(s,choose(s,1,'pass'));s=take(s,choose(s,2,'win'));
  const a=choose(s,3,'pass'),before=cp(s);
  assert.throws(()=>applyAction(s,actionInput(a),opts()),/seat wind|wind proof/i);
  assert.deepEqual(s,before);assert.equal(s.extensions.tw16.result,null);
  assert.deepEqual(replayGame(s,opts()),s);
});
test('R7.3 untrusted serialized state requires exact canonical replay before apply',gate,()=>{
  const {open}=prepared(),s=cp(open),a=choose(s,2,'win');
  const old=s.players[0].concealed[0];s.players[0].concealed[0]=s.wall[0];s.wall[0]=old;
  const before=cp(s);
  assert.throws(()=>applyAction(s,actionInput(a),opts()),/replay|mismatch/i);
  assert.deepEqual(s,before);
  assert.throws(()=>replayGame(open),e=>e.capability==='authoritative_scoring_runtime_required');
  assert.throws(()=>createGame({gameId:'bad-chain',seed:'r73',handIndex:1,...R7},opts()),e=>e.capability==='unverified_dealer_streak_chain');
});

test('R7.3 first-orbit special WIN is unsupported, no ordinary settlement fabricated',gate,()=>{
  let s=createGame({gameId:'r73-first-orbit',seed:'r73',fixtureDeck:fixtureDeck({0:['t:5:3'],2:robber(9,27)},[]),...R7},opts());
  s=take(s,choose(s,0,'discard','t:5:3'));s=take(s,choose(s,1,'pass'));s=take(s,choose(s,2,'win'));
  const before=cp(s),a=choose(s,3,'pass');
  assert.throws(()=>applyAction(s,actionInput(a),opts()),e=>e.capability==='first_orbit_win_variant');
  assert.deepEqual(s,before);assert.equal(s.extensions.tw16.result,null);
});
