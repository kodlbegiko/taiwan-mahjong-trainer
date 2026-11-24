import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createGame,createDeck,getRuleProfile,getRuleCapabilities,listLegalActions,listPendingClaimResponders,
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
function fixtureDeck(tiles,live,ref=R7){
  const all=createDeck(getRuleProfile(ref.profileId,ref.ruleVersion)),seen=new Set();
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
function prepared(two=false,ref=R7){
  const live=['t:31:3','t:32:3','t:33:3','t:5:2'];
  const seats={0:['t:5:3'],1:['t:5:0','t:5:1'],2:robber(9,27)};
  if(two)seats[3]=robber(18,28,1);
  let s=createGame({gameId:'r7-rob-'+(two?'multi':'one'),seed:'r7-seed',
    fixtureDeck:fixtureDeck(seats,live,ref),...ref});
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
 assert.throws(()=>validateRobKongPublicEvent({...committed,causedByActionId:'private-pass-action'},[proposal,committed],R7),/private trigger/);
 const masked={...proposal,type:'claim',actorSeat:undefined,seq:5,eventId:'evt:fixture:5',payload:{}};
 delete masked.actorSeat;
 assert.equal(validateRobKongPublicEvent(masked,[proposal,masked],R7),false);
 assert.throws(()=>validateRobKongPublicEvent({...masked,causedByActionId:'private-win-action'},[proposal,masked],R7),/private trigger/);
 assert.throws(()=>validateRobKongPublicEvent({...masked,payload:{kind:'win'}},[proposal,masked],R7));
 assert.throws(()=>validateRobKongPublicEvent({...committed,payload:{...committed.payload,tileIds:['t:5:1']}},[proposal],R7));
 const win={...proposal,type:'win',actorSeat:2,seq:8,eventId:'evt:fixture:8',
  payload:{seat:2,sourceSeat:1,robAddedKong:{proposalEventId:proposal.eventId,fromSeat:1,tileId:'t:5:2'}}};
 assert.throws(()=>validateRobKongPublicEvent(win,[proposal,win],R7));
 assert.equal(validateRobKongPublicEvent(win,[proposal,win],R7,true),true);
 const settle={...win,type:'settle',seq:9,eventId:'evt:fixture:9',payload:{robAddedKong:win.payload.robAddedKong}};
 assert.equal(validateRobKongPublicEvent(settle,[proposal,win,settle],R7,true),true);
 assert.throws(()=>validateRobKongPublicEvent({...settle,payload:{robAddedKong:{...settle.payload.robAddedKong,privateClaimIntents:[1]}}},[proposal,win],R7,true));
});

test('R7 schema-only proposal projection counts fourth physical copy once and rejects non-WIN/PASS',()=>{
 // Existing R5 source prepares a real exposed triplet plus its fourth tile.
 // Retag and append an explicitly synthetic wire projection ONLY to exercise
 // the new parser before Rules #51 is integrated. No fake action is applied.
 const R5={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
 const {before,proposal}=prepared(false,R5);
 const make=seat=>{
   const v=cp(createPlayerView(before,seat));
   v.ruleRef=cp(R7);v.asOfEventSeq++;v.viewId+='-r7-schema-fixture';
   v.round.phase='claim_window';v.round.currentSeat=2;
   v.round.lastPublicEventSeq=v.asOfEventSeq;
   v.publicEvents=v.publicEvents.map(e=>{
     e.ruleRef=cp(R7);
     if(e.type==='claim'||(e.type==='kong'&&e.payload.claimEventId))
       delete e.causedByActionId;
     return e;
   });
   const q={schemaVersion:v.schemaVersion,contractVersion:v.contractVersion,
     eventId:'fixture-proposal-'+v.asOfEventSeq,gameId:v.gameId,
     seq:v.asOfEventSeq,ruleRef:cp(R7),actorSeat:1,type:'kong_proposed',
     visibility:'public',payload:{kind:'ADDED_KONG',tileId:'t:5:2'},
     previousEventId:v.publicEvents.at(-1).eventId,causedByActionId:proposal.actionId};
   v.publicEvents.push(q);
   v.knownUnavailableTypes=[...new Set([...v.knownUnavailableTypes,5])];
   const a={...cp(proposal),actorSeat:seat,expectedRevision:v.asOfEventSeq,
     ruleRef:cp(R7),claimEventId:q.eventId};
   v.legalActions=seat===1?[]:[
     {...a,actionId:'schema-pass',kind:'pass',tileIds:[],
       legalityBasis:{...a.legalityBasis,reasonCodes:['CLAIM_WINDOW_PASS']}},
     {...a,actionId:'schema-win',kind:'win',tileIds:['t:5:2'],
       legalityBasis:{...a.legalityBasis,reasonCodes:['ROB_ADDED_KONG_WIN']}},
   ];
   return v;
 };
 const responder=make(2),declarer=make(1);
 const authority={profileId:'tw16-authoritative-scoring',ruleVersion:'experimental-v1'};
 const retag=v=>{
   const x=cp(v);x.ruleRef=cp(authority);
   x.publicEvents.forEach(e=>e.ruleRef=cp(authority));
   x.legalActions.forEach(a=>a.ruleRef=cp(authority));return x;
 };
 const auth=retag(responder);
 assert.equal(isSupportedBotTableProfile(authority),true);
 assert.equal(isSupportedBotTableProfile({...authority,ruleVersion:'experimental-v2'}),false);
 assert.equal(readBotView(auth).counts[5],4);
 for(const difficulty of levels){
   const b=createBot({seat:2,difficulty,seed:'authority-schema-only'});
   const d=chooseBotAction(b,auth);
   assert.equal(d.actionId,'schema-win');
   assert.equal(validateBotDecision(b,auth,d),true);
 }
 const forgedAuthority=cp(auth);forgedAuthority.publicEvents.at(-1).payload.privateClaimIntents=[1];
 assert.throws(()=>readBotView(forgedAuthority));
 assert.equal(readBotView(responder).counts[5],4);
 assert.equal(readBotView(declarer).counts[5],4);
 for(const difficulty of levels){
   const b=createBot({seat:2,difficulty,seed:'schema-only'});
   const d=chooseBotAction(b,responder);
   assert.equal(d.actionId,'schema-win');
   assert.equal(validateBotDecision(b,responder,d),true);
 }
 const forged=cp(responder);forged.legalActions[1].kind='pong';
 assert.throws(()=>readBotView(forged),/WIN\/PASS/);
 const leaked=cp(responder);
 leaked.publicEvents.at(-1).payload.privateClaimIntents=[1];
 assert.throws(()=>readBotView(leaked));
});
test('R7 actual Rules proposal view, WIN/PASS and masked intent for every level',gate,()=>{
 assert.equal(getRuleCapabilities(R7).publicEventContractVersion,'tw16-rob-added-kong-public/1.0.0');
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

test('R7 actual controller accepts WIN/PASS and fails closed on competing robbers',gate,async()=>{
 let {open:state}=prepared(true);
 const bots=[1,2,3].map(seat=>createBot({seat,difficulty:'Intermediate',seed:'r7-rob-controller-'+seat}));
 const controller=createBotController({
   bots,humanSeat:0,getActingSeat:()=>listPendingClaimResponders(state)[0]??state.round.currentSeat,
   getPendingClaimResponders:()=>listPendingClaimResponders(state),
   getPlayerView:seat=>createPlayerView(state,seat),
   submitAction:submission=>{state=applyAction(state,submission).state;},
   yieldControl:async()=>{},
 });
 for(const seat of [2,3]){
   const next=await controller.tick();
   assert.equal(next.status,'acted');
   assert.equal(next.seat,seat);
   assert.equal(next.decision.reasonCodes[0],'ENGINE_LEGAL_WIN');
 }
 assert.equal((await controller.tick()).status,'human-turn');
 const pass=choose(state,0,'pass'),before=cp(state);
 const rejected=await controller.submitHumanAction({actionId:pass.actionId,expectedRevision:pass.expectedRevision});
 assert.equal(rejected.status,'unsupported');
 assert.equal(rejected.capability,'multiple_winners');
 assert.deepEqual(state,before);
 assert.equal((await controller.tick()).status,'unsupported');
 assert.deepEqual(replayGame(state),state);
});

// Synthetic terminal DTO exercises the wire allowlist, not Rules acceptance.
// The combined checkout must also pass the real Rules/Scoring archive gate.
test('R7.4 authority terminal accounting is accepted only without private data',()=>{
 const {before}=prepared(false,{profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'});
 const ref={profileId:'tw16-authoritative-scoring',ruleVersion:'experimental-v1'};
 const v=cp(createPlayerView(before,2));
 v.ruleRef=cp(ref);v.round.phase='settled';v.legalActions=[];
 v.publicEvents.forEach(e=>{e.ruleRef=cp(ref);if(e.type==='claim'||e.type==='kong')delete e.causedByActionId;});
 const last=v.publicEvents.at(-1),base={...last,ruleRef:cp(ref),visibility:'public'};
 delete base.causedByActionId;delete base.actorSeat;
 const draw={contractVersion:'tw16-pre-settlement/1.0.0',settlementId:v.round.roundId,
   scoringVersion:'tw16-gametower-authoritative@1.0.0-experimental',
   status:'experimental-not-rule-certified',unit:'abstract-points',reason:'exhaustive-draw',
   winType:null,winnerSeat:null,sourceSeat:null,payerSeats:[],publicEvidenceEventIds:[],
   tai:0,breakdown:[],payments:[],playerTransferDeltas:[0,0,0,0],playerDeltas:[0,0,0,0],fees:[],houseDelta:0};
 v.asOfEventSeq++;v.round.lastPublicEventSeq=v.asOfEventSeq;v.round.scores=[0,0,0,0];
 v.publicEvents.push({...base,eventId:'evt:fixture:terminal',seq:v.asOfEventSeq,type:'settle',payload:{settlement:draw}});
 assert.equal(readSettledBotView(v).view.round.phase,'settled');
 for(const mutate of [
   x=>{x.publicEvents.at(-1).payload.settlement.privateLedger={};},
   x=>{x.publicEvents.at(-1).payload.settlement.playerDeltas=[0,1,-1,0];},
   x=>{x.publicEvents.at(-1).payload.settlement.sourceSeat=0;},
   x=>{x.publicEvents.at(-1).payload.settlement.publicEvidenceEventIds=['private'];},
   x=>{x.legalActions=[{kind:'draw'}];},
   x=>{x.opponents[0].concealed=[];},
 ]){
   const x=cp(v);mutate(x);assert.throws(()=>readSettledBotView(x));
 }
});
