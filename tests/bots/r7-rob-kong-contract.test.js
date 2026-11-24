import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createGame,createDeck,getRuleProfile,listLegalActions,listPendingClaimResponders,
 applyAction,createPlayerView,replayGame
} from '../../src/rules/index.js';
import {createBot,chooseBotAction,validateBotDecision,createBotController} from '../../src/bots/index.js';
import {readBotView,readSettledBotView,isSupportedBotTableProfile} from '../../src/bots/view.js';
import {validateRobKongPublicEvent} from '../../src/strategy/view.js';
// Deterministic Rules #51 633d20fa fixture; actual actions go through Rules.
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

const levels=['Beginner','Intermediate','Advanced'];
const available=(()=>{
 try{return getRuleProfile(R7.profileId,R7.ruleVersion).profileId===R7.profileId;}
 catch{return false;}
})();
const gate={skip:available?false:'Rules #51 opt-in profile absent; combined-source integration required'};
test('R7 robbery public schema is exact-version and rejects hidden fields',()=>{
 const proposal={type:'kong_proposed',visibility:'public',actorSeat:1,
  gameId:'fixture',seq:4,eventId:'evt:fixture:4',ruleRef:R7,
  payload:{kind:'ADDED_KONG',tileId:'t:5:2'}};
 assert.equal(isSupportedBotTableProfile(R7),true);
 assert.equal(isSupportedBotTableProfile({...R7,ruleVersion:'experimental-v2'}),false);
 assert.equal(validateRobKongPublicEvent(proposal,[proposal],R7),true);
 assert.throws(()=>validateRobKongPublicEvent({...proposal,payload:{...proposal.payload,hiddenIntents:[2]}},[proposal],R7));
 assert.throws(()=>validateRobKongPublicEvent(proposal,[proposal],{...R7,ruleVersion:'experimental-v2'}));
 const committed={...proposal,type:'kong',seq:8,eventId:'evt:fixture:8',
  payload:{kind:'ADDED_KONG',tileIds:['t:5:2'],proposalEventId:proposal.eventId}};
 assert.equal(validateRobKongPublicEvent(committed,[proposal,committed],R7),true);
 assert.throws(()=>validateRobKongPublicEvent({...committed,payload:{...committed.payload,tileIds:['t:5:1']}},[proposal],R7));
 const win={...proposal,type:'win',actorSeat:2,seq:8,eventId:'evt:fixture:8',
  payload:{seat:2,sourceSeat:1,robAddedKong:{proposalEventId:proposal.eventId,fromSeat:1,tileId:'t:5:2'}}};
 assert.throws(()=>validateRobKongPublicEvent(win,[proposal,win],R7));
 assert.equal(validateRobKongPublicEvent(win,[proposal,win],R7,true),true);
 const settle={...win,type:'settle',seq:9,eventId:'evt:fixture:9',payload:{robAddedKong:win.payload.robAddedKong}};
 assert.equal(validateRobKongPublicEvent(settle,[proposal,win,settle],R7,true),true);
 assert.throws(()=>validateRobKongPublicEvent({...settle,payload:{robAddedKong:{...settle.payload.robAddedKong,privateClaimIntents:[1]}}},[proposal,win],R7,true));
});
test('R7 actual Rules proposal view, WIN/PASS and masked intent for every level',gate,()=>{
 const {open}=prepared();
 for(const seat of [2,3,0]){
   const view=createPlayerView(open,seat),parsed=readBotView(view);
   assert.equal(parsed.counts[5],4,'public fourth tile counted once');
   assert.ok(view.knownUnavailableTypes.includes(5));
   assert.ok(view.legalActions.every(a=>['win','pass'].includes(a.kind)));
   for(const difficulty of levels){
     const b=createBot({seat,difficulty,seed:'r7-rob-public'});
     const d=chooseBotAction(b,view);
     assert.deepEqual(d,chooseBotAction(b,cp(view)));
     assert.equal(validateBotDecision(b,view,d),true);
     assert.equal(view.legalActions.find(a=>a.actionId===d.actionId).kind,
       view.legalActions.some(a=>a.kind==='win')?'win':'pass');
     assert.throws(()=>chooseBotAction(b,{...view,wall:open.wall}));
   }
 }
 const pass=take(open,choose(open,2,'pass')),win=take(open,choose(open,2,'win'));
 const vp=createPlayerView(pass,3),vw=createPlayerView(win,3);
 assert.deepEqual(vp,vw);
 for(const difficulty of levels){
   const b=createBot({seat:3,difficulty,seed:'r7-rob-masked'});
   assert.deepEqual(chooseBotAction(b,vp),chooseBotAction(b,vw));
 }
 const forged=cp(createPlayerView(open,2));
 forged.legalActions[0].claimEventId='forged';
 assert.throws(()=>readBotView(forged),/WIN\/PASS/);
});
test('R7 actual robbery terminal and all-PASS commit are accepted by Bot adapters',gate,()=>{
 const {open}=prepared();
 let s=respond(open,{2:'win'});
 assert.equal(s.round.phase,'settled');
 assert.equal(readSettledBotView(createPlayerView(s,0)).view.round.phase,'settled');
 assert.deepEqual(replayGame(s),s);
 let noRob=respond(open);
 assert.equal(noRob.round.phase,'replacement');
 const v=createPlayerView(noRob,1);
 const b=createBot({seat:1,difficulty:'Beginner'});
 const d=chooseBotAction(b,v);
 assert.equal(validateBotDecision(b,v,d),true);
 assert.equal(v.legalActions.find(a=>a.actionId===d.actionId).kind,'draw');
 noRob=take(noRob,choose(noRob,1,'draw'));
 assert.deepEqual(replayGame(noRob),noRob);
});
