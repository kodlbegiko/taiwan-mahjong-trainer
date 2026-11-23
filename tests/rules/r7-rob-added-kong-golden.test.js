
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createDeck, getRuleProfile, getRuleCapabilities,
  listLegalActions, listPendingClaimResponders, getClaimWindowPublic,
  applyAction, validateGameState, createPlayerView, replayGame,
  RuleCapabilityError,
} from '../../src/rules/index.js';
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
test('R7 profile is opt-in; unchanged R3/R5 explicitly lack robbery',()=>{
  assert.equal(getRuleCapabilities(R7).claimArbitration.robAddedKong.status,'experimental-supported');
  assert.equal(getRuleCapabilities(R7).claimArbitration.multipleDiscardWins.status,'unsupported');
  for(const ref of [
    {profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'},
    {profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'},
  ])assert.equal(getRuleCapabilities(ref).claimArbitration.robAddedKong.status,'unsupported');
});
test('R7 proposal opens WIN/PASS only, publishes tile and hides private intent',()=>{
  const {before,proposal,open}=prepared();
  assert.equal(open.round.phase,'claim_window');
  assert.equal(open.events.at(-1).type,'kong_proposed');
  assert.equal(open.events.at(-1).causedByActionId,proposal.actionId);
  assert.ok(open.players[1].concealed.includes('t:5:2'));
  assert.deepEqual(open.players[1].melds,before.players[1].melds);
  assert.deepEqual(listPendingClaimResponders(open),[2,3,0]);
  assert.equal(getClaimWindowPublic(open).sourceKind,'rob-added-kong');
  assert.equal(getClaimWindowPublic(open).discardEventId,null);
  assert.equal(getClaimWindowPublic(open).sourceEventId,open.events.at(-1).eventId);
  for(const seat of [2,3,0])assert.ok(actions(open,seat).every(a=>['win','pass'].includes(a.kind)));
  assert.ok(actions(open,2,'win').length);
  const pass=take(open,choose(open,2,'pass'));
  const win=take(open,choose(open,2,'win'));
  assert.deepEqual(createPlayerView(pass,3),createPlayerView(win,3));
  assert.equal(validateGameState(win),true);
  assert.deepEqual(replayGame(win),win);
  assert.equal(before.round.phase,'await_discard');
});
test('R7 actual robbery: one winner, tile conservation, minimal discard liability',()=>{
  const {open}=prepared();
  let s=take(open,choose(open,2,'win'));
  s=take(s,choose(s,3,'pass'));
  const snapshot=cp(s),last=choose(s,0,'pass');
  const result=applyAction(s,{actorSeat:0,actionId:last.actionId,
    expectedRevision:last.expectedRevision});
  assert.deepEqual(s,snapshot,'authoritative input remains immutable');
  assert.deepEqual(result.events.map(e=>e.type),['pass','win','settle']);
  s=result.state;
  assert.equal(s.round.phase,'settled');
  assert.equal(s.extensions.tw16.result.winnerSeat,2);
  assert.equal(s.extensions.tw16.result.via,'discard');
  assert.deepEqual(s.extensions.tw16.result.robAddedKong,{
    proposalEventId:open.events.at(-1).eventId,fromSeat:1,tileId:'t:5:2'});
  assert.equal(s.players[1].melds.at(-1).kind,'triplet');
  assert.ok(!s.players[1].concealed.includes('t:5:2'));
  assert.ok(s.players[1].river.some(d=>d.tileId==='t:5:2'));
  assert.equal(s.round.scores.reduce((a,b)=>a+b,0),0);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  assert.ok(createPlayerView(s,0).publicEvents.some(e=>
    e.type==='win'&&e.payload.robAddedKong?.tileId==='t:5:2'));
});
test('R7 all PASS confirms added kong, then one tail replacement',()=>{
  const {open}=prepared();
  let s=respond(open);
  assert.equal(s.round.phase,'replacement');
  assert.equal(s.round.currentSeat,1);
  assert.equal(s.players[1].melds.at(-1).kind,'kong');
  assert.equal(s.events.at(-1).payload.proposalEventId,open.events.at(-1).eventId);
  const size=s.wall.length;
  s=take(s,choose(s,1,'draw'));
  assert.equal(s.wall.length,size-1);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
});
test('R7 forged/stale/wrong-seat actions cannot partially mutate',()=>{
  const {open}=prepared(),original=cp(open),a=choose(open,2,'win');
  for(const x of [
    {actorSeat:1,actionId:a.actionId,expectedRevision:a.expectedRevision},
    {actorSeat:2,actionId:a.actionId,expectedRevision:a.expectedRevision-1},
    {actorSeat:2,actionId:a.actionId,expectedRevision:a.expectedRevision,tileIds:['t:5:1']},
    {actorSeat:2,actionId:'forged:kong',expectedRevision:a.expectedRevision},
  ])assert.throws(()=>applyAction(open,x));
  assert.deepEqual(open,original);
  assert.equal(validateGameState(open),true);
  assert.deepEqual(replayGame(open),open);
});
test('R7 multiple robbers remain typed UNSUPPORTED, final action atomic',()=>{
  const {open}=prepared(true);
  assert.ok(actions(open,2,'win').length);
  assert.ok(actions(open,3,'win').length);
  let s=take(open,choose(open,2,'win'));
  s=take(s,choose(s,3,'win'));
  const before=cp(s);
  assert.throws(()=>take(s,choose(s,0,'pass')),e=>
    e instanceof RuleCapabilityError&&e.code==='UNSUPPORTED_RULE_CAPABILITY'&&
    e.capability==='multiple_winners');
  assert.deepEqual(s,before);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
});
