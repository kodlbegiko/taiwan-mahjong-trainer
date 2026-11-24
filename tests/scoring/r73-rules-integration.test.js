import test from 'node:test';
import assert from 'node:assert/strict';
import * as Rules from '../../src/rules/index.js';
import {assertLedgerConservation,AUTHORITATIVE_RULE_REF,AUTHORITATIVE_SCORING_REF} from '../../src/scoring/index.js';

// This source-owned gate becomes mandatory once the Rules-owned implementation
// is present. On a standalone Scoring branch do not imply a joint pass.
const ref=AUTHORITATIVE_RULE_REF;
let available=false;
try{available=!!Rules.getRuleProfile(ref.profileId,ref.ruleVersion)}catch{}
const mandatory=process.env.SCORING_REQUIRE_R73_RULES==='1';
const opts={skip:!available&&!mandatory?'Rules #51 authoritative dependency not present in standalone checkout':false};
const requireRules=()=>assert.ok(available,'Required authoritative Rules dependency unavailable');
const choose=(s,seat,kind,id,reason)=>{
  const a=Rules.listLegalActions(s,seat).find(a=>a.kind===kind&&
    (id===undefined||a.tileIds.includes(id))&&
    (reason===undefined||a.legalityBasis.reasonCodes.includes(reason)));
  assert.ok(a,'Missing legal '+kind+' '+id+' seat '+seat);
  return a;
};
const take=(s,a)=>Rules.applyAction(s,{actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
function respond(s,choices={}){
  for(const seat of Rules.listPendingClaimResponders(s))
    s=take(s,choose(s,seat,choices[seat]||'pass'));
  return s;
}
function deck(assigned,live){
  const all=Rules.createDeck(Rules.getRuleProfile(ref.profileId,ref.ruleVersion));
  const hands=Array.from({length:4},(_,i)=>[...(assigned[i]||[])]);
  const seen=new Set([...hands.flat(),...live]);
  assert.equal(seen.size,hands.flat().length+live.length);
  for(let seat=0;seat<4;seat++){
    for(const id of all){
      if(hands[seat].length>=(seat===0?17:16))break;
      if(!id.startsWith('t:')||seen.has(id))continue;
      hands[seat].push(id);seen.add(id);
    }
    assert.equal(hands[seat].length,seat===0?17:16);
  }
  const extra=hands[0].pop();
  return [...hands.flat(),extra,...live,...all.filter(id=>!seen.has(id))];
}
function start(gameId,assigned,live){
  requireRules();
  return Rules.createGame({gameId,seed:gameId,fixtureDeck:deck(assigned,live),...ref});
}
function verify(s,expectedKind,expectedPayers){
  assert.equal(s.round.phase,'settled');
  assert.equal(Rules.validateGameState(s),true);
  const r=s.extensions.tw16.result,settle=s.events.at(-1);
  assert.equal(settle.type,'settle');
  const ledger=r.scoringLedger;
  assert.ok(ledger,'Rules must persist complete authoritative scoringLedger');
  assert.equal(ledger.scoringVersion,AUTHORITATIVE_SCORING_REF.profileId+'@'+AUTHORITATIVE_SCORING_REF.version);
  assert.equal(ledger.winType,expectedKind);
  assert.deepEqual(ledger.payments.map(p=>p.payerSeat),expectedPayers);
  assert.deepEqual(ledger.playerDeltas,s.round.scores);
  assert.deepEqual(settle.payload.scoringLedger,ledger);
  assert.equal(assertLedgerConservation(ledger),true);
  assert.deepEqual(JSON.parse(JSON.stringify(ledger)),ledger);
  assert.equal(ledger.settlementId,s.round.roundId);
  assert.ok(ledger.sourceRevision<settle.seq);
  assert.deepEqual(Rules.replayGame(s),s);
  return ledger;
}
const waiting=[0,1,2,3,4,5,9,10,11,12,13,14,18,19,20,24].map(t=>'t:'+t+':0');
function ordinary(ron){
  const live=['t:33:0','t:32:0','t:31:0',ron?'t:24:1':'t:30:0',...(ron?[]:['t:24:1'])];
  let s=start(ron?'r73-ron':'r73-self',{1:waiting},live);
  s=respond(take(s,choose(s,0,'discard')));
  for(const [i,seat] of [1,2,3,0].entries()){
    s=take(s,choose(s,seat,'draw'));
    s=take(s,choose(s,seat,'discard',live[i]));
    s=respond(s,ron&&seat===0?{1:'win'}:{});
  }
  if(!ron){
    s=take(s,choose(s,1,'draw'));s=take(s,choose(s,1,'win'));
  }
  return s;
}
test('R73 real Rules second-turn selfdraw commits authority before terminal events and replays',opts,()=>{
  const s=ordinary(false);const l=verify(s,'self-draw',[0,2,3]);
  assert.equal(l.score.breakdown.find(i=>i.code==='concealed-self-draw')?.tai,3);
  assert.equal(l.score.breakdown.find(i=>i.code==='unique-wait')?.tai,1);
});
test('R73 real Rules later discard win has one source payer and exact canonical replay',opts,()=>{
  const s=ordinary(true);const l=verify(s,'discard',[0]);
  assert.equal(l.score.breakdown.find(i=>i.code==='concealed')?.tai,1);
  assert.equal(l.score.breakdown.find(i=>i.code==='unique-wait')?.tai,1);
});
test('R73 real Rules rob-added-kong legal WIN/PASS group settles one declarer',opts,()=>{
  const trips=Array.from({length:4},(_,t)=>Array.from({length:3},(_,i)=>'t:'+(9+t)+':'+i)).flat();
  const live=['t:31:3','t:32:3','t:33:3','t:5:2'];
  let s=start('r73-rob',{0:['t:5:3'],1:['t:5:0','t:5:1'],2:[...trips,'t:6:0','t:7:0','t:27:0','t:27:1']},live);
  s=respond(take(s,choose(s,0,'discard','t:5:3')),{1:'pong'});
  s=take(s,choose(s,1,'discard'));
  for(const [i,seat] of [2,3,0].entries()){
    s=respond(s);s=take(s,choose(s,seat,'draw'));s=take(s,choose(s,seat,'discard',live[i]));
  }
  s=respond(s);s=take(s,choose(s,1,'draw'));
  s=take(s,choose(s,1,'kong','t:5:2','ADDED_KONG'));
  s=respond(s,{2:'win'});
  const l=verify(s,'rob-added-kong',[1]);
  assert.equal(l.score.breakdown.find(i=>i.code==='rob-added-kong')?.tai,1);
  assert.equal(s.extensions.tw16.result.robAddedKong.fromSeat,1);
});
test('R73 real Rules reaches exhaustive draw and commits strict positive-zero authority ledger',opts,()=>{
  let s=start('r73-draw',{},[]);
  for(let i=0;i<1000&&s.round.phase!=='settled';i++){
    if(s.round.phase==='claim_window'){s=respond(s);continue;}
    const seat=s.round.currentSeat;
    const a=Rules.listLegalActions(s,seat).find(x=>['replace_flower','draw','discard'].includes(x.kind));
    assert.ok(a,'stalled '+s.round.phase);s=take(s,a);
  }
  const l=verify(s,null,[]);
  assert.equal(l.reason,'exhaustive-draw');
  assert.deepEqual(l.playerDeltas,[0,0,0,0]);
  assert.equal(l.houseDelta,0);
});
