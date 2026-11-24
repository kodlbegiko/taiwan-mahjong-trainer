// R7.4 integration-only gate. Deterministic fixture helpers copied from
// tests/rules/r73-authoritative-settlement.test.js (pinned Rules source).
// No synthetic PlayerView, fabricated LegalAction, or mocked scoring.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createDeck,getRuleProfile,listLegalActions,listPendingClaimResponders,
 applyAction,createPlayerView,replayGame,createSettlementRuntime,AUTHORITATIVE_RULE_REF} from '../../src/rules/index.js';
import * as Scoring from '../../src/scoring/index.js';
import {createBot,chooseBotAction,validateBotDecision,createBotController} from '../../src/bots/index.js';
import {readBotView,readSettledBotView} from '../../src/bots/view.js';
const activeRuntime=createSettlementRuntime(Scoring);
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

const levels=['Beginner','Intermediate','Advanced'];
const view=(s,seat)=>createPlayerView(s,seat,s.revision,opts());
function verifyTerminal(s,type){
  assert.equal(s.round.phase,'settled');
  assert.equal(s.extensions.tw16.result.settlement.winType,type);
  assert.deepEqual(replayGame(s,opts()),s);
  for(let seat=0;seat<4;seat++){
    const v=view(s,seat);
    assert.deepEqual(readSettledBotView(v).view.publicEvents.at(-1).payload.settlement,s.extensions.tw16.result.settlement);
    assert.equal(v.legalActions.length,0);
    assert.ok(v.opponents.every(p=>!Object.hasOwn(p,'concealed')));
    assert.doesNotMatch(JSON.stringify(v.publicEvents),/"(?:authoritativeSettlement|evidenceEventIds|decomposition|winningTileId)"/);
    const bad=cp(v);bad.publicEvents.at(-1).payload.settlement.playerDeltas[0]++;
    assert.throws(()=>readSettledBotView(bad));
  }
}
function host(initial,difficulty,humanSeat=0){
  let s=initial;
  const c=createBotController({
    bots:[0,1,2,3].filter(x=>x!==humanSeat).map(seat=>createBot({seat,difficulty,seed:'authority-gate-'+seat})),
    humanSeat,getActingSeat:()=>listPendingClaimResponders(s)[0]??s.round.currentSeat,
    getPendingClaimResponders:()=>listPendingClaimResponders(s),
    getPlayerView:seat=>view(s,seat),
    submitAction:a=>{s=applyAction(s,a,opts()).state;},
    yieldControl:async()=>{},
  });
  return {c,state:()=>s};
}
for(const difficulty of levels){
  test('authority robbery: actual three-Bot controller '+difficulty,async()=>{
    const {open}=prepared();
    const {c,state}=host(open,difficulty);
    const v=view(open,2),b=createBot({seat:2,difficulty});
    assert.equal(readBotView(v).counts[5],4);
    assert.equal(chooseBotAction(b,v).reasonCodes[0],'ENGINE_LEGAL_WIN');
    assert.equal(validateBotDecision(b,v,chooseBotAction(b,v)),true);
    for(let i=0;i<2;i++)assert.equal((await c.tick()).status,'acted');
    assert.equal((await c.tick()).status,'human-turn');
    assert.equal((await c.submitHumanAction(actionInput(choose(state(),0,'pass')))).status,'acted');
    assert.equal((await c.tick()).status,'settled');
    verifyTerminal(state(),'rob-added-kong');
    assert.equal(c.history().length,2);
  });
}
test('authority ordinary discard and self-draw real terminal views',async()=>{
  let s=createGame({gameId:'r74-discard',seed:'r73',fixtureDeck:fixtureDeck({0:['t:5:3'],2:robber(9,27)},firstOrbitLive),...R7},opts());
  s=advanceOrbit(s,'t:5:3');
  // Let actual Bot win; other responders use Rules-issued PASS.
  for(const seat of listPendingClaimResponders(s)){
    if(seat===2){
      const b=createBot({seat,difficulty:'Advanced'}),v=view(s,seat),d=chooseBotAction(b,v);
      assert.equal(d.reasonCodes[0],'ENGINE_LEGAL_WIN');validateBotDecision(b,v,d);
      s=applyAction(s,{actorSeat:seat,actionId:d.actionId,expectedRevision:d.expectedRevision},opts()).state;
    }else s=take(s,choose(s,seat,'pass'));
  }
  verifyTerminal(s,'discard');
  s=createGame({gameId:'r74-selfdraw',seed:'r73',fixtureDeck:fixtureDeck({1:robber(9,27)},[...firstOrbitLive,'t:5:2']),...R7},opts());
  s=advanceOrbit(s);
  const {c,state}=host(s,'Intermediate');
  assert.equal((await c.tick()).status,'acted'); // real draw
  const win=await c.tick();assert.equal(win.status,'acted');
  assert.equal(win.decision.reasonCodes[0],'ENGINE_LEGAL_WIN');
  assert.equal((await c.tick()).status,'settled');
  verifyTerminal(state(),'self-draw');
});
test('authority exhaustive draw: real Rules actions and all terminal projections',async()=>{
  let s=createGame({gameId:'r74-draw',seed:'r73',fixtureDeck:fixtureDeck({},[]),...R7},opts());
  let guard=0;
  while(s.round.phase!=='settled'&&guard++<500){
    if(s.round.phase==='claim_window')s=respond(s);
    else {
      const a=actions(s,s.round.currentSeat).find(a=>['discard','draw','replace_flower'].includes(a.kind));assert.ok(a);
      s=take(s,a);
    }
  }
  verifyTerminal(s,null);
  assert.equal((await host(s,'Beginner').c.tick()).status,'settled');
});
test('authority competing robbers preserve fail-closed state and controller checkpoint',async()=>{
  const {open}=prepared(true),{c,state}=host(open,'Intermediate');
  for(let i=0;i<2;i++){const r=await c.tick();assert.equal(r.status,'acted');assert.equal(r.decision.reasonCodes[0],'ENGINE_LEGAL_WIN');}
  const before=cp(state()),result=await c.submitHumanAction(actionInput(choose(state(),0,'pass')));
  assert.equal(result.status,'unsupported');assert.equal(result.capability,'multiple_winners');
  assert.deepEqual(state(),before);assert.equal(c.checkpoint().blocked.capability,'multiple_winners');
});
