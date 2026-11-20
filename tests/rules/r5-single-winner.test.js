import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeck,getRuleProfile,getRuleCapabilities,createGame,listLegalActions,
  applyAction,createPlayerView,replayGame,validateGameState,listPendingClaimResponders,
  RuleCapabilityError,
} from '../../src/rules/index.js';
import {SEED_87_R4 as GOLDEN} from './fixtures/seed-87-r4-trace.js';
const NEW={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const OLD={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const cp=x=>JSON.parse(JSON.stringify(x));
const acts=(s,seat,kind)=>listLegalActions(s,seat).filter(a=>!kind||a.kind===kind);
const submit=(s,a)=>applyAction(s,{actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
function trace(ref=NEW,stop=162) {
  let s=createGame({gameId:GOLDEN.gameId,seed:GOLDEN.seed,...ref});
  for(const [rev,seat,id,after] of GOLDEN.successfulActions){
    if(rev>=stop)break;
    assert.equal(s.revision,rev);
    const a=acts(s,seat).find(x=>x.actionId===id);
    assert.ok(a,'original Rules-issued action '+rev);
    s=submit(s,a);assert.equal(s.revision,after);
  }
  assert.equal(s.revision,stop);
  return s;
}
function fixture(discarder,tiles){
  const all=createDeck(getRuleProfile(NEW.profileId,NEW.ruleVersion)),taken=new Set();
  const hands=Array.from({length:4},(_,seat)=>[...(tiles[seat]||[])]);
  for(const h of hands)for(const id of h){assert.ok(all.includes(id));assert.ok(!taken.has(id));taken.add(id);}
  for(let seat=0;seat<4;seat++){
    const count=seat===discarder?17:16;
    for(const id of all){if(hands[seat].length>=count)break;
      if(taken.has(id)||id.startsWith('f:'))continue;
      taken.add(id);hands[seat].push(id);}
    assert.equal(hands[seat].length,count);
  }
  const deck=[...hands[0].slice(0,16),...hands[1].slice(0,16),
    ...hands[2].slice(0,16),...hands[3].slice(0,16),
    hands[discarder][16],...all.filter(id=>!taken.has(id))];
  assert.equal(deck.length,144);return deck;
}
const trips=base=>[0,1,2,3,4].flatMap(t=>[0,1,2].map(c=>'t:'+(base+t)+':'+c));
function pair(discarder=0){
  const seats=[1,2,3].map(i=>(discarder+i)%4),fixed={};
  for(let i=0;i<3;i++)fixed[seats[i]]=[...trips([0,9,18][i]),'t:26:'+i];
  fixed[discarder]=['t:26:3'];
  let s=createGame({gameId:'r5pair'+discarder,seed:'r5-pair-'+discarder,
    dealerSeat:discarder,fixtureDeck:fixture(discarder,fixed),...NEW});
  assert.equal(s.round.phase,'await_discard');
  s=submit(s,acts(s,discarder,'discard').find(a=>a.tileIds[0]==='t:26:3'));
  assert.equal(s.round.phase,'claim_window');
  for(const seat of seats)assert.ok(acts(s,seat,'win').length);
  return {s,seats,discarder};
}
function mixed(kind){
  const fixed={
    0:['t:5:3'],
    2:[...[0,1,2,3].flatMap(t=>[0,1,2].map(c=>'t:'+t+':'+c)),
      't:4:0','t:6:0','t:27:0','t:27:1'],
    1:kind==='kong'?['t:5:0','t:5:1','t:5:2']:
      kind==='pong'?['t:5:0','t:5:1']:['t:4:1','t:6:1'],
  };
  let s=createGame({gameId:'r5mixed'+kind,seed:'r5mixed'+kind,
    fixtureDeck:fixture(0,fixed),...NEW});
  s=submit(s,acts(s,0,'discard').find(a=>a.tileIds[0]==='t:5:3'));
  assert.ok(acts(s,2,'win').length);
  assert.ok(acts(s,1,kind).length);
  return s;
}
function end(s,kinds={},order=listPendingClaimResponders(s)){
  for(const seat of order)s=submit(s,acts(s,seat,kinds[seat]||'pass')[0]);
  return s;
}
function check(s,winner,discarder){
  assert.equal(s.round.phase,'settled');
  const r=s.extensions.tw16.result;
  assert.equal(r.winnerSeat,winner);assert.equal(r.sourceSeat,discarder);
  assert.equal(r.reason,'win');assert.equal(r.via,'discard');
  assert.equal(r.delta.reduce((sum,n)=>sum+n,0),0);
  assert.deepEqual(s.round.scores,r.delta);
  assert.equal(s.events.filter(e=>e.type==='settle').length,1);
  assert.equal(s.events.filter(e=>e.type==='win'&&e.visibility==='public').length,1);
  assert.equal(validateGameState(s),true);assert.deepEqual(replayGame(s),s);
  for(let i=0;i<4;i++)assert.deepEqual(acts(s,i),[]);
  return r;
}
test('R5 Seed 87: unchanged action trace, atomic last PASS, intercepted WIN retained',()=>{
  const before=trace(),snapshot=cp(before);
  assert.deepEqual(before.extensions.tw16.window.decisions.map(d=>[d.seat,d.kind]),[[3,'win'],[0,'win']]);
  const pass=acts(before,1,'pass')[0];
  assert.equal(pass.actionId,GOLDEN.rejectedSubmission.actionId);
  const applied=applyAction(before,{actorSeat:1,actionId:pass.actionId,expectedRevision:pass.expectedRevision});
  assert.deepEqual(before,snapshot);
  assert.deepEqual(applied.events.map(e=>e.type),['pass','win','settle']);
  assert.equal(applied.state.revision,165);
  const r=check(applied.state,3,2);
  assert.deepEqual(r.claimResolution.declaredWinSeats,[3,0]);
  assert.deepEqual(r.claimResolution.interceptedWinSeats,[0]);
  assert.equal(r.claimResolution.selectedClaimActionId,before.extensions.tw16.window.decisions[0].actionId);
  assert.deepEqual(applied.events[1].payload.claimResolution,r.claimResolution);
  assert.deepEqual(applied.events[2].payload.claimResolution,r.claimResolution);
  assert.deepEqual(applied.state.events.filter(e=>e.visibility==='seat-private'&&e.payload?.kind==='win')
    .slice(-2).map(e=>e.actorSeat),[3,0]);
});
test('R5 old RuleProfile stays atomic fail-closed for exact Seed 87',()=>{
  const s=trace(OLD),snapshot=cp(s);
  assert.throws(()=>submit(s,acts(s,1,'pass')[0]),
    e=>e instanceof RuleCapabilityError&&e.capability==='multiple_winners');
  assert.deepEqual(s,snapshot);assert.equal(s.events.length,162);
});
test('R5 both Seat 3 and Seat 0 independently have legal WIN',()=>{
  let s=trace(NEW,160);s=submit(s,acts(s,3,'win')[0]);
  assert.ok(acts(s,0,'win').length);
  s=submit(s,acts(s,0,'win')[0]);
  assert.deepEqual(s.extensions.tw16.window.decisions.map(d=>d.kind),['win','win']);
  assert.equal(s.extensions.tw16.result,null);
});
test('R5 different discarder positions select nearest clockwise even with reverse submission order',()=>{
  for(let d=0;d<4;d++){
    const {s,seats}=pair(d);
    const k=Object.fromEntries(seats.map(x=>[x,'win']));
    const r=check(end(s,k,[...seats].reverse()),seats[0],d);
    assert.deepEqual(r.claimResolution.declaredWinSeats,seats);
    assert.deepEqual(r.claimResolution.interceptedWinSeats,seats.slice(1));
  }
});
test('R5 three WIN claims record all legal intents but settle only one winner',()=>{
  const {s,seats}=pair();
  const r=check(end(s,{1:'win',2:'win',3:'win'}),seats[0],0);
  assert.deepEqual(r.claimResolution.declaredWinSeats,seats);
});
test('R5 single WIN is supported with versioned resolution',()=>{
  const {s,seats}=pair();
  const r=check(end(s,{[seats[1]]:'win'}),seats[1],0);
  assert.deepEqual(r.claimResolution.declaredWinSeats,[seats[1]]);
  assert.deepEqual(r.claimResolution.interceptedWinSeats,[]);
});
test('R5 no WIN claims does not fabricate settlement',()=>{
  const s=end(pair().s);
  assert.equal(s.round.phase,'await_draw');
  assert.equal(s.extensions.tw16.result,null);
  assert.equal(validateGameState(s),true);assert.deepEqual(replayGame(s),s);
});
for(const kind of ['pong','chi','kong'])test('R5 WIN outranks legal '+kind.toUpperCase(),()=>{
  const s=end(mixed(kind),{1:kind,2:'win'});
  check(s,2,0);
  assert.ok(s.events.some(e=>e.visibility==='seat-private'&&e.payload?.kind===kind));
  assert.ok(s.events.some(e=>e.visibility==='seat-private'&&e.payload?.kind==='win'));
});
test('R5 forged WIN rejected',()=>{
  const {s}=pair(),before=cp(s);
  assert.throws(()=>applyAction(s,{actorSeat:1,actionId:'forged:WIN',
    expectedRevision:s.revision}),/illegal/);
  assert.deepEqual(s,before);
});
test('R5 pass-win lock retained',()=>{
  const {s}=pair(),next=submit(s,acts(s,1,'pass')[0]);
  assert.equal(next.extensions.tw16.passLocks[1],true);
  assert.equal(end(next).extensions.tw16.passLocks[1],true);
});
test('R5 duplicate claimant is rejected',()=>{
  const {s}=pair(),action=acts(s,1,'win')[0],next=submit(s,action);
  assert.throws(()=>applyAction(next,{actorSeat:1,actionId:action.actionId,
    expectedRevision:next.revision}),/illegal/);
});
test('R5 stale revision is rejected',()=>{
  const {s}=pair(),old=acts(s,2,'win')[0],next=submit(s,acts(s,1,'pass')[0]);
  assert.throws(()=>submit(next,old),/Stale/);
});
test('R5 failed last responder with forged tiles cannot partially settle',()=>{
  let {s}=pair();s=submit(s,acts(s,1,'win')[0]);s=submit(s,acts(s,2,'win')[0]);
  const before=cp(s),last=acts(s,3,'pass')[0];
  assert.throws(()=>applyAction(s,{actorSeat:3,actionId:last.actionId,
    expectedRevision:last.expectedRevision,tileIds:['forged']}),/Forged tileIds/);
  assert.deepEqual(s,before);check(submit(s,last),1,0);
});
test('R5 score zero sum and intercepted winners receive zero points',()=>{
  const r=check(end(pair().s,{1:'win',2:'win',3:'win'}),1,0);
  assert.ok(r.delta[1]>0&&r.delta[0]<0);
  assert.equal(r.delta[2],0);assert.equal(r.delta[3],0);
});
test('R5 full ledger replay is deterministic with public post-resolution outcome',()=>{
  const {s,seats}=pair(2);
  const ended=end(s,{3:'win',0:'win',1:'win'},[1,0,3]);
  const r=check(ended,seats[0],2);
  assert.deepEqual(replayGame(cp(ended)),ended);
  const shown=createPlayerView(ended,0).publicEvents.find(e=>e.type==='win');
  assert.deepEqual(shown.payload.claimResolution,r.claimResolution);
});
test('R5 PlayerView hides pre-arbitration WIN versus PASS',()=>{
  const start=trace(NEW,160);
  let win=submit(start,acts(start,3,'win')[0]);
  win=submit(win,acts(win,0,'win')[0]);
  let pass=submit(start,acts(start,3,'pass')[0]);
  pass=submit(pass,acts(pass,0,'pass')[0]);
  assert.deepEqual(createPlayerView(win,1),createPlayerView(pass,1));
  const view=createPlayerView(win,1);
  assert.ok(view.publicEvents.slice(-2).every(e=>e.type==='claim'&&
    Object.keys(e.payload).length===0&&!Object.hasOwn(e,'actorSeat')));
  assert.ok(!Object.hasOwn(view,'wall')&&!Object.hasOwn(view,'rng'));
});
test('R5 capabilities expose only static public policy, old profile unchanged',()=>{
  const caps=getRuleCapabilities(NEW),old=getRuleCapabilities(OLD);
  assert.equal(getRuleProfile(NEW.profileId,NEW.ruleVersion).status,'experimental');
  assert.deepEqual(caps.claimArbitration.multipleDiscardWins,{
    status:'experimental-supported',mode:'single-winner',
    priority:'nearest-clockwise-from-discarder'});
  assert.equal(caps.claimArbitration.singleWinner,true);
  assert.equal(caps.claimArbitration.robAddedKong.status,'unsupported');
  assert.equal(caps.claimArbitration.multipleWinnerSettlement.status,'unsupported');
  assert.equal(caps.scoring.policy,'tw16-minimal-tai-v1');
  assert.deepEqual(old.claimArbitration.multipleDiscardWins,{
    status:'unsupported',capability:'multiple_winners'});
  for(const forbidden of ['decisions','tileIds','actorSeat','GameState','wall'])
    assert.ok(!JSON.stringify(caps).includes(forbidden));
});
test('R5 tampered claimResolution fails validation',()=>{
  const s=end(pair().s,{1:'win',2:'win',3:'win'}),tampered=cp(s);
  tampered.extensions.tw16.result.claimResolution.interceptedWinSeats=[];
  assert.throws(()=>validateGameState(tampered,{replay:false}),
    /Invalid versioned single-winner settlement/);
  assert.equal(validateGameState(s),true);
});
