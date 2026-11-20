import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createDeck, createPlayerView, listLegalActions, applyAction,
  replayGame, validateGameState, getRuleProfile, listPendingClaimResponders,
  getClaimWindowPublic, RuleCapabilityError,
} from '../../src/rules/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const copy=x=>JSON.parse(JSON.stringify(x));
const legal=(s,seat,kind)=>listLegalActions(s,seat).filter(a=>!kind||a.kind===kind);
const submit=(s,action)=>applyAction(s,{
  actorSeat:action.actorSeat,actionId:action.actionId,
  expectedRevision:action.expectedRevision,
}).state;
function openedByDiscard(seed='r3-claim-private') {
  for(let n=0;n<90;n++) {
    let s=createGame({gameId:'claim-private',seed:seed+'-'+n,...REF});
    for(let i=0;i<50&&s.round.phase==='replacement';i++){
      const a=legal(s,s.round.currentSeat)[0];
      s=submit(s,a);
    }
    if(s.round.phase!=='await_discard')continue;
    for(const d of legal(s,s.round.currentSeat,'discard')){
      const opened=submit(s,d);
      for(const seat of listPendingClaimResponders(opened)){
        const pong=legal(opened,seat,'pong')[0];
        if(pong)return {opened,seat,pong};
      }
    }
  }
  throw new Error('No fixed-seed pong claim fixture');
}
function arranged(seatTiles){
  const profile=getRuleProfile(REF.profileId,REF.ruleVersion);
  const all=createDeck(profile),taken=new Set();
  const seats=Array.from({length:4},(_,seat)=>[...(seatTiles[seat]||[])]);
  for(const p of seats)for(const id of p){
    assert.ok(all.includes(id));assert.ok(!taken.has(id));taken.add(id);
  }
  const quotas=[17,16,16,16];
  for(let seat=0;seat<4;seat++){
    for(const id of all){
      if(seats[seat].length>=quotas[seat])break;
      if(taken.has(id)||id.startsWith('f:'))continue;
      taken.add(id);seats[seat].push(id);
    }
    assert.equal(seats[seat].length,quotas[seat]);
  }
  const dealer=seats[0].slice(),extra=dealer.pop();
  const deck=[...dealer,...seats[1],...seats[2],...seats[3],extra,
    ...all.filter(id=>!taken.has(id))];
  assert.equal(deck.length,144);assert.equal(new Set(deck).size,144);
  return deck;
}
const triplets=offset=>[0,1,2,3,4].flatMap(t=>
  [0,1,2].map(copy=>`t:${offset+t}:${copy}`));

test('claim metadata is stable, Rules-host-scheduled and does not include private decisions',()=>{
  const {opened,seat,pong}=openedByDiscard();
  const all=listPendingClaimResponders(opened);
  assert.equal(opened.round.phase,'claim_window');
  assert.equal(all.length,3);
  assert.deepEqual(all,[1,2,3].map(i=>(opened.extensions.tw16.window.fromSeat+i)%4));
  const summary=getClaimWindowPublic(opened);
  assert.deepEqual(summary.responders,all);
  assert.equal(summary.pendingCount,3);
  assert.equal(summary.expectedRevision,opened.revision);
  for(const forbidden of ['decisions','intent','kind','tileIds','winningTileId'])
    assert.ok(!Object.hasOwn(summary,forbidden));
  assert.equal(typeof summary.claimPolicyVersion,'string');

  const declined=submit(opened,legal(opened,seat,'pass')[0]);
  const committed=submit(opened,pong);
  const pending=all.filter(s=>s!==seat);
  assert.deepEqual(listPendingClaimResponders(committed),pending);
  assert.equal(getClaimWindowPublic(declined).pendingCount,2);
  assert.deepEqual(getClaimWindowPublic(committed),getClaimWindowPublic(declined));
  assert.equal(committed.round.phase,'claim_window');
  assert.equal(committed.events.at(-1).visibility,'seat-private');
  assert.equal(declined.events.at(-1).visibility,'seat-private');

  // Same public state, same observer seat, different private intent:
  // a pending third party cannot tell a PASS from an aggressive PONG.
  const observer=pending[0];
  const passView=createPlayerView(declined,observer);
  const pongView=createPlayerView(committed,observer);
  assert.deepEqual(pongView,passView);
  const redacted=pongView.publicEvents.at(-1);
  assert.equal(redacted.type,'claim');
  assert.deepEqual(redacted.payload,{});
  assert.ok(!Object.hasOwn(redacted,'actorSeat'));
  assert.ok(!Object.hasOwn(redacted,'causedByActionId'));
  assert.ok(!JSON.stringify(pongView).includes(pong.actionId));
  assert.ok(pongView.opponents.every(o=>!Object.hasOwn(o,'concealed')));

  assert.deepEqual(listLegalActions(committed,seat),[]);
  assert.throws(()=>submit(committed,pong),/Stale/);
  assert.throws(()=>applyAction(committed,{actorSeat:seat,actionId:pong.actionId,
    expectedRevision:committed.revision}),/illegal/);
  let end=committed;
  for(const respondent of pending){
    const pass=legal(end,respondent,'pass')[0];
    assert.ok(pass);end=submit(end,pass);
  }
  assert.equal(end.round.phase,'await_discard');
  assert.equal(end.round.currentSeat,seat);
  assert.equal(getClaimWindowPublic(end),null);
  assert.deepEqual(listPendingClaimResponders(end),[]);
  assert.equal(validateGameState(end),true);
  assert.deepEqual(replayGame(end),end);
});

test('two actual discard-win intents fail closed as unsupported multi-winner',()=>{
  // Two different complete five-triplet waiting hands claim the SAME tile.
  const deck=arranged({
    0:['t:5:1'],
    1:[...triplets(0),'t:5:0'],
    2:[...triplets(9),'t:5:2'],
  });
  let s=createGame({gameId:'claim-two-winners',seed:'multiwin-fixed-001',
    fixtureDeck:deck,...REF});
  assert.equal(s.round.phase,'await_discard');
  const discard=legal(s,0,'discard').find(a=>a.tileIds[0]==='t:5:1');
  assert.ok(discard);
  s=submit(s,discard);
  for(const seat of [1,2]){
    const win=legal(s,seat,'win')[0];
    assert.ok(win,'Seat '+seat+' should be able to win');
    s=submit(s,win);
  }
  assert.equal(s.round.phase,'claim_window');
  assert.deepEqual(listPendingClaimResponders(s),[3]);
  const before=copy(s);
  const pass=legal(s,3,'pass')[0];
  assert.throws(()=>submit(s,pass),e=>
    e instanceof RuleCapabilityError &&
    e.code==='UNSUPPORTED_RULE_CAPABILITY' &&
    e.capability==='multiple_winners');
  assert.deepEqual(s,before,'unsupported action must not mutate the authoritative state');
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
});

function seededRound(seed) {
  let s=createGame({gameId:'autoplay-'+seed,seed,...REF});
  let steps=0,claimResponses=0,floral=0,previous=s.revision;
  while(s.round.phase!=='settled'&&steps++<480){
    let seat,action;
    if(s.round.phase==='claim_window'){
      const pending=listPendingClaimResponders(s);
      assert.ok(pending.length>=1&&pending.length<=3);
      const pub=getClaimWindowPublic(s);
      assert.equal(pub.pendingCount,pending.length);
      seat=pending[0];
      action=legal(s,seat,'win')[0]||legal(s,seat,'pass')[0];
      claimResponses++;
    }else{
      assert.equal(getClaimWindowPublic(s),null);
      assert.deepEqual(listPendingClaimResponders(s),[]);
      seat=s.round.currentSeat;
      const actions=legal(s,seat);
      if(s.round.phase==='replacement'){
        action=actions.find(a=>a.kind==='replace_flower')||actions.find(a=>a.kind==='draw');
        floral++;
      }else if(s.round.phase==='await_draw')action=actions.find(a=>a.kind==='draw');
      else if(s.round.phase==='await_discard')
        action=actions.find(a=>a.kind==='win')||actions.find(a=>a.kind==='discard');
      else throw new Error('Unknown phase '+s.round.phase);
    }
    assert.ok(action,'Missing Rules-issued action for '+s.round.phase);
    const view=createPlayerView(s,seat);
    assert.deepEqual(view.legalActions,legal(s,seat));
    assert.equal(action.expectedRevision,s.revision);
    assert.ok(view.legalActions.some(a=>a.actionId===action.actionId));
    assert.ok(view.opponents.every(o=>!Object.hasOwn(o,'concealed')));
    s=submit(s,action);
    assert.ok(s.revision>previous);previous=s.revision;
    assert.equal(validateGameState(s,{replay:false}),true);
  }
  assert.ok(steps<480,'must reach a legally settled terminal state');
  assert.equal(s.round.phase,'settled');
  assert.ok(['win','exhaustive-draw'].includes(s.extensions.tw16.result.reason));
  assert.equal(s.extensions.tw16.result.delta.reduce((a,b)=>a+b,0),0);
  assert.deepEqual(s.round.scores,s.extensions.tw16.result.delta);
  assert.deepEqual(listLegalActions(s,0),[]);
  assert.deepEqual(listPendingClaimResponders(s),[]);
  assert.equal(getClaimWindowPublic(s),null);
  assert.throws(()=>applyAction(s,{actorSeat:0,actionId:'invalid',expectedRevision:s.revision}),/illegal/);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  return {state:s,steps,claimResponses,floral};
}

for(const seed of ['r3-round-001','r3-round-002','r3-round-003','r3-round-004']){
  test('fixed-seed Rules-only four-seat lifecycle ends with balanced settlement: '+seed,()=>{
    const a=seededRound(seed);
    const b=seededRound(seed);
    assert.ok(a.claimResponses>0);
    assert.deepEqual(a,b);
  });
}

test('zero-sum and terminal settlement are immutable replay invariants',()=>{
  const s=createGame({gameId:'terminal-scoring',seed:'terminal-win-001',
    fixtureDeck:arranged({0:[...triplets(0),'t:5:0','t:5:1']}),...REF});
  const win=legal(s,0,'win')[0];assert.ok(win);
  const settled=submit(s,win);
  assert.equal(settled.round.phase,'settled');
  assert.equal(settled.events.at(-1).type,'settle');
  const forged=copy(settled);
  forged.extensions.tw16.result.delta[0]+=1;
  assert.throws(()=>validateGameState(forged,{replay:false}),/non-zero-sum/);
  const forgedScores=copy(settled);
  forgedScores.round.scores[0]+=1;
  assert.throws(()=>validateGameState(forgedScores,{replay:false}),/settlement/);
  assert.equal(validateGameState(settled),true);
  assert.deepEqual(replayGame(settled),settled);
});
