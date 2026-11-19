import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createDeck,getRuleProfile,createPlayerView,listLegalActions,
  applyAction,replayGame,validateGameState} from '../../src/rules/index.js';
import {createBot,chooseBotAction,validateBotDecision,
  createBotController} from '../../src/bots/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const bot=seat=>createBot({seat,seed:'claims-public-only-'+seat,difficulty:'Intermediate'});
const copies=(type,count)=>Array.from({length:count},(_,i)=>'t:'+type+':'+i);
const triplets=()=>[0,1,2,3,4].flatMap(t=>copies(t,3));
function arrangedDeck(seats) {
  const tiles=createDeck(getRuleProfile(REF.profileId,REF.ruleVersion));
  const standard=tiles.filter(id=>id.startsWith('t:'));
  const quotas=[17,16,16,16],specified=Array.from({length:4},(_,s)=>[...(seats[s]||[])]);
  const taken=new Set(specified.flat());
  assert.equal(taken.size,specified.flat().length);
  for(let s=0;s<4;s++){
    for(const id of standard){
      if(specified[s].length===quotas[s])break;
      if(!taken.has(id)){specified[s].push(id);taken.add(id);}
    }
    assert.equal(specified[s].length,quotas[s]);
  }
  const extra=specified[0].pop();
  return [...specified.flat(),extra,...tiles.filter(id=>!taken.has(id))];
}
const make=(tag,seats)=>createGame({gameId:'bot-golden-'+tag,seed:'private-fixture-'+tag,
  fixtureDeck:arrangedDeck(seats),...REF});
const pick=(state,seat,kind,tileId)=>listLegalActions(state,seat)
  .find(a=>a.kind===kind && (tileId===undefined||a.tileIds.includes(tileId)));
const submit=(state,seat,action)=>applyAction(state,{
  actorSeat:seat,actionId:action.actionId,
  expectedRevision:action.expectedRevision,
}).state;

test('R3 bot chooses authoritative legal self-draw WIN and gets real settlement',()=>{
  const s=make('selfwin',{0:[...triplets(),...copies(5,2)]});
  const v=createPlayerView(s,0),b=bot(0),d=chooseBotAction(b,v);
  assert.equal(validateBotDecision(b,v,d),true);
  const selected=v.legalActions.find(a=>a.actionId===d.actionId);
  assert.equal(selected.kind,'win');
  const settled=submit(s,0,selected);
  assert.equal(settled.round.phase,'settled');
  assert.equal(settled.extensions.tw16.result.reason,'win');
  assert.equal(settled.extensions.tw16.result.winnerSeat,0);
  assert.equal(validateGameState(settled),true);
  assert.deepEqual(replayGame(settled),settled);
});

test('R3 contested claims: one Bot wins over another declared pong; private intent remains hidden',async()=>{
  let state=make('contested',{
    0:['t:5:3'],1:[...triplets(),'t:5:0'],2:['t:5:1','t:5:2'],
  });
  assert.equal(state.round.phase,'await_discard');
  state=submit(state,0,pick(state,0,'discard','t:5:3'));
  assert.equal(state.round.phase,'claim_window');
  const initialSeat1=createPlayerView(state,1);
  assert.ok(initialSeat1.legalActions.some(a=>a.kind==='win'));
  assert.ok(listLegalActions(state,2).some(a=>a.kind==='pong'));
  // First declare the other seat's legitimate PONG. Its tileIds must stay
  // private until Rules resolves all three responses.
  state=submit(state,2,pick(state,2,'pong'));
  const waiting=createPlayerView(state,1);
  assert.ok(waiting.legalActions.some(a=>a.kind==='win'));
  assert.ok(!waiting.publicEvents.some(e=>e.type==='claim'&&
    e.payload?.tileIds?.includes('t:5:1')));
  const c=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:a=>{state=applyAction(state,a).state;},
    yieldControl:async()=>{},
  });
  const winner=await c.tick();
  assert.equal(winner.status,'acted');
  assert.equal(winner.seat,1);
  assert.equal(winner.decision.actionId,
    waiting.legalActions.find(a=>a.kind==='win').actionId);
  assert.equal(state.round.phase,'claim_window');
  const final=await c.tick();
  assert.equal(final.status,'acted');
  assert.equal(state.round.phase,'settled');
  assert.equal(state.extensions.tw16.result.winnerSeat,1);
  assert.equal(state.players[2].melds.length,0);
  assert.equal(validateGameState(state),true);
  assert.deepEqual(replayGame(state),state);
});
