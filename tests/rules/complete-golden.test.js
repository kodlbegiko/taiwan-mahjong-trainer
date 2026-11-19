import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,applyAction,listLegalActions,replayGame,createPlayerView,
  validateGameState,createDeck,getRuleProfile,startNextRound,COMPLETE_ENGINE_VERSION,
} from '../../src/rules/index.js';
import {calculateShanten} from '../../src/core/efficiency.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const profile=getRuleProfile(REF.profileId,REF.ruleVersion);
const byType=(t,n)=>Array.from({length:n},(_,i)=>'t:'+t+':'+i);
const triplets=()=>[0,1,2,3,4].flatMap(t=>byType(t,3));
const cloned=x=>JSON.parse(JSON.stringify(x));

/** Fully persisted private permutation, not random global state or a forged mutable GameState. */
function arrangedDeck(seats={},liveFirst=[]){
  const standard=createDeck(profile).filter(x=>x.startsWith('t:'));
  const all=createDeck(profile);
  const quotas=[17,16,16,16];
  const specified=Array.from({length:4},(_,i)=>[...(seats[i]||[])]);
  const reserved=[...specified.flat(),...liveFirst];
  assert.equal(new Set(reserved).size,reserved.length,'fixture owns every physical copy once');
  assert.ok(reserved.every(id=>all.includes(id)));
  const taken=new Set(reserved);
  for(let seat=0;seat<4;seat++){
    assert.ok(specified[seat].length<=quotas[seat]);
    for(const id of standard){
      if(specified[seat].length>=quotas[seat])break;
      if(taken.has(id))continue;
      taken.add(id);specified[seat].push(id);
    }
    assert.equal(specified[seat].length,quotas[seat]);
  }
  const dealer=[...specified[0]],extra=dealer.pop();
  const arranged=[...dealer,...specified[1],...specified[2],...specified[3],extra,
    ...liveFirst,...all.filter(id=>!taken.has(id))];
  assert.equal(arranged.length,all.length);
  assert.equal(new Set(arranged).size,all.length);
  return arranged;
}
function fixture(seats,liveFirst=[],tag='golden'){
  const s=createGame({gameId:'golden-'+tag,seed:'fixture-seed-'+tag,
    fixtureDeck:arrangedDeck(seats,liveFirst),dealerSeat:0,...REF});
  assert.equal(s.round.phase,'await_discard');
  assert.equal(s.round.prevailingWind,'east');
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  const view=createPlayerView(s,0);
  assert.ok(!JSON.stringify(view).includes('fixtureDeck'));
  assert.deepEqual(view.publicEvents[0].payload.countsBySeat,[17,16,16,16]);
  return s;
}
function selected(s,seat,kind,tile,reason){
  const found=listLegalActions(s,seat).find(a=>a.kind===kind&&
    (tile===undefined||a.tileIds.includes(tile))&&
    (reason===undefined||a.legalityBasis.reasonCodes.includes(reason)));
  assert.ok(found,'Expected confirmed '+kind+' / '+tile+' / '+reason+' legal action');
  return found;
}
const step=(s,seat,a)=>applyAction(s,{
  actorSeat:seat,actionId:a.actionId,expectedRevision:s.revision,
}).state;
const act=(s,seat,kind,tile,reason)=>step(s,seat,selected(s,seat,kind,tile,reason));
function resolve(s,decisions){
  const source=s.extensions.tw16.window.fromSeat;
  for(let seat=0;seat<4;seat++){
    if(seat===source)continue;
    const choice=decisions[seat];
    s=act(s,seat,choice?.kind||'pass',choice?.tile,choice?.reason);
  }
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  return s;
}

test('R3-B positive Golden: dealer has a real canonical 5-meld+eye self-win, settlement/replay',()=>{
  const seventeen=[...triplets(),...byType(5,2)];
  assert.equal(seventeen.length,17);
  assert.equal(calculateShanten(seventeen.map(x=>Number(x.split(':')[1]))),-1);
  const s=fixture({0:seventeen},[],'selfwin');
  const win=selected(s,0,'win',undefined,'SELF_DRAW_WIN');
  assert.equal(win.actorSeat,0);
  assert.equal(win.legalityBasis.engineVersion,COMPLETE_ENGINE_VERSION);
  const result=step(s,0,win);
  assert.equal(result.round.phase,'settled');
  assert.equal(result.extensions.tw16.result.winnerSeat,0);
  assert.equal(result.extensions.tw16.result.via,'self-draw');
  assert.equal(result.extensions.tw16.result.tai,3);
  assert.deepEqual(result.round.scores,[540,-180,-180,-180]);
  assert.equal(result.events.at(-2).type,'win');
  assert.equal(result.events.at(-1).type,'settle');
  assert.deepEqual(replayGame(result),result);
  assert.deepEqual(listLegalActions(result,0),[]);
});

test('R3-B positive Golden: discard win takes precedence and pays only discarder',()=>{
  const ready=[...triplets(),'t:5:0'];
  assert.equal(ready.length,16);
  const s=fixture({0:['t:5:1'],1:ready},[],'ron');
  // The dealer could also have an independent structural win; the scripted discard remains legal.
  const opened=act(s,0,'discard','t:5:1');
  const win=selected(opened,1,'win',undefined,'DISCARD_WIN');
  assert.equal(win.claimEventId,opened.extensions.tw16.window.discardEventId);
  const result=resolve(opened,{1:{kind:'win',tile:'t:5:1'}});
  assert.equal(result.round.phase,'settled');
  assert.equal(result.extensions.tw16.result.winnerSeat,1);
  assert.equal(result.extensions.tw16.result.via,'discard');
  assert.equal(result.extensions.tw16.result.tai,1);
  assert.deepEqual(result.round.scores,[-140,140,0,0]);
  assert.equal(result.events.at(-2).type,'win');
  assert.equal(result.events.at(-1).type,'settle');
  assert.equal(result.players[0].river.at(-1).claimedByEventId,undefined,
    'winning discard remains physical river owner for conservation');
});

test('R3-B Golden: skip-winner over-water blocks all wins through own next draw until discard',()=>{
  const ready=[...triplets(),'t:5:0'];
  const s=fixture({0:['t:5:1'],1:ready},['t:5:2'],'pass-lock');
  const opened=act(s,0,'discard','t:5:1');
  assert.ok(selected(opened,1,'win'));
  const pending=act(opened,1,'pass');
  assert.equal(pending.extensions.tw16.passLocks[1],true);
  let result=act(pending,2,'pass');
  result=act(result,3,'pass');
  assert.equal(result.round.phase,'await_draw');
  const drawn=act(result,1,'draw');
  assert.ok(drawn.players[1].concealed.includes('t:5:2'));
  assert.equal(calculateShanten(drawn.players[1].concealed.map(id=>Number(id.split(':')[1]))),-1);
  assert.ok(!listLegalActions(drawn,1).some(a=>a.kind==='win'),
    'passed win must not reappear just because next draw completes the hand');
  const discarded=act(drawn,1,'discard');
  assert.equal(discarded.extensions.tw16.passLocks[1],false);
  assert.deepEqual(replayGame(discarded),discarded);
});

test('R3-A positive Golden: priority resolves pong over next-seat chi regardless of response order',()=>{
  const s=fixture({
    0:['t:4:3'],1:['t:3:0','t:5:0'],2:['t:4:0','t:4:1'],
  },[],'claim-priority');
  const opened=act(s,0,'discard','t:4:3');
  assert.ok(selected(opened,1,'chi'));
  assert.ok(selected(opened,2,'pong'));
  let running=act(opened,1,'chi');
  running=act(running,2,'pong');
  running=act(running,3,'pass');
  assert.equal(running.round.phase,'await_discard');
  assert.equal(running.round.currentSeat,2,'pong overrides chi');
  assert.equal(running.players[2].melds.at(-1).kind,'triplet');
  assert.equal(running.players[1].melds.length,0,'losing chi intent does not move tiles');
  assert.deepEqual(replayGame(running),running);
});

test('R3-A positive Golden: priority resolves discard-win over concurrent pong',()=>{
  const s=fixture({
    0:['t:5:3'],1:[...triplets(),'t:5:0'],2:['t:5:1','t:5:2'],
  },[],'win-priority');
  const opened=act(s,0,'discard','t:5:3');
  assert.ok(selected(opened,1,'win'));
  assert.ok(selected(opened,2,'pong'));
  let running=act(opened,2,'pong');
  running=act(running,1,'win');
  running=act(running,3,'pass');
  assert.equal(running.round.phase,'settled');
  assert.equal(running.extensions.tw16.result.winnerSeat,1);
  assert.equal(running.players[2].melds.length,0);
  assert.deepEqual(replayGame(running),running);
});

test('R3-A positive Golden: owned concealed kong, tail replacement and full physical replay',()=>{
  const s=fixture({0:byType(6,4)},[],'concealed-kong');
  const kong=selected(s,0,'kong',undefined,'CONCEALED_KONG');
  assert.equal(kong.tileIds.length,4);
  let k=step(s,0,kong);
  assert.equal(k.round.phase,'replacement');
  assert.equal(k.players[0].melds.at(-1).open,false);
  assert.equal(k.players[0].melds.at(-1).tileIds.length,4);
  const tail=k.wall.at(-1);
  k=act(k,0,'draw',undefined,'TAIL_KONG_REPLACEMENT');
  assert.ok(k.players[0].concealed.includes(tail));
  assert.equal(validateGameState(k),true);
  assert.deepEqual(replayGame(k),k);
});

test('R3-A positive Golden: added kong requires prior pong and next turn, then tail replacement',()=>{
  const s=fixture({0:['t:4:3'],1:['t:4:0','t:4:1','t:4:2']},[],'added-kong');
  const opened=act(s,0,'discard','t:4:3');
  let k=resolve(opened,{1:{kind:'pong',tile:'t:4:3'}});
  assert.equal(k.round.currentSeat,1);
  assert.ok(!listLegalActions(k,1).some(a=>a.kind==='kong'),
    'post-pong cannot kong before first required discard');
  k=act(k,1,'discard'); // clears post-claim restriction
  for(let seat=2;seat<=3;seat++){
    k=resolve(k,{});
    assert.equal(k.round.currentSeat,seat);
    k=act(k,seat,'draw');
    if(k.round.phase==='replacement')throw new Error('Fixture live draw unexpectedly a flower');
    k=act(k,seat,'discard');
  }
  k=resolve(k,{});
  assert.equal(k.round.currentSeat,0);
  k=act(k,0,'draw');
  k=act(k,0,'discard');
  k=resolve(k,{});
  assert.equal(k.round.currentSeat,1);
  k=act(k,1,'draw');
  assert.equal(k.round.phase,'await_discard');
  const added=selected(k,1,'kong',undefined,'ADDED_KONG');
  const post=step(k,1,added);
  assert.equal(post.round.phase,'replacement');
  assert.equal(post.players[1].melds.at(-1).kind,'kong');
  assert.equal(post.players[1].melds.at(-1).tileIds.length,4);
  assert.equal(post.players[1].melds.at(-1).sourceSeat,0);
  assert.equal(validateGameState(post),true);
  assert.deepEqual(replayGame(post),post);
});

test('R3-C private Golden fixture is never present in PlayerView; forged deck rejected',()=>{
  const initial=fixture({0:byType(6,4)},[],'secret-deck');
  const visible=createPlayerView(initial,1);
  assert.ok(!JSON.stringify(visible).includes('fixtureDeck'));
  assert.ok(visible.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  assert.ok(visible.publicEvents.every(e=>!Object.hasOwn(e.payload,'tileIds')));
  assert.equal(initial.events[0].visibility,'system-private');
  assert.ok(Array.isArray(initial.events[0].payload.fixtureDeck));
  const duplicate=cloned(initial.events[0].payload.fixtureDeck);
  duplicate[0]=duplicate[1];
  assert.throws(()=>createGame({gameId:'invalid',seed:'xx',...REF,fixtureDeck:duplicate}),
    /Invalid private scripted/);
  const tampered=cloned(initial);
  tampered.events[0].payload.fixtureDeck.reverse();
  // The original full state no longer corresponds to its private deal ledger.
  // Replay by itself deterministically reconstructs the edited ledger; the
  // mandatory full-state validation is what detects the inconsistency.
  assert.throws(()=>validateGameState(tampered),/mismatch/);
});


test('R3-C next round: explicit linked seed/revision, dealer retains on self-win and rotates after discard-win',()=>{
  const s=fixture({0:[...triplets(),...byType(5,2)]},[],'next-hand-self');
  const settled=act(s,0,'win');
  const second=startNextRound(settled,{gameId:'tw16-next-hand',seed:'new-hand-seed'});
  assert.equal(second.round.handIndex,1);
  assert.equal(second.round.dealerSeat,0);
  assert.equal(second.round.roundId,'tw16-next-hand-round-1');
  assert.deepEqual(second.extensions.tw16.previousRoundRef,{
    gameId:settled.gameId,roundId:settled.round.roundId,revision:settled.revision,
  });
  assert.equal(validateGameState(second),true);
  assert.deepEqual(replayGame(second),second);
  assert.throws(()=>startNextRound(s,{gameId:'not-ended',seed:'x'}),/settled/);
  assert.throws(()=>startNextRound(settled,{gameId:settled.gameId,seed:'x'}),/distinct/);
  assert.throws(()=>startNextRound(settled,{gameId:'other'}),/seed/);

  const ron=fixture({0:['t:5:1'],1:[...triplets(),'t:5:0']},[],'next-hand-ron');
  const opened=act(ron,0,'discard','t:5:1');
  const winner=resolve(opened,{1:{kind:'win',tile:'t:5:1'}});
  const rotated=startNextRound(winner,{gameId:'next-hand-ron',seed:'next-hand-ron-seed'});
  assert.equal(rotated.round.handIndex,1);
  assert.equal(rotated.round.dealerSeat,1);
  assert.equal(validateGameState(rotated),true);
  assert.deepEqual(replayGame(rotated),rotated);
});


test('R3-B exhaustive draw Golden: reserve exactly 16 tail tiles, zero settlement, replay and dealer retention',()=>{
  let s=fixture({},[],'exhaustive-draw');
  let steps=0;
  while(s.round.phase!=='settled'&&steps++<400){
    const phase=s.round.phase,seat=s.round.currentSeat;
    if(phase==='await_discard'){
      s=act(s,seat,'discard');
    }else if(phase==='claim_window'){
      const window=s.extensions.tw16.window;
      const actor=[0,1,2,3].find(x=>x!==window.fromSeat&&
        !window.decisions.some(d=>d.seat===x));
      assert.notEqual(actor,undefined);
      s=act(s,actor,'pass');
    }else if(phase==='await_draw')s=act(s,seat,'draw');
    else if(phase==='replacement')
      s=act(s,seat,selected(s,seat,'replace_flower')?'replace_flower':'draw');
    else throw new Error('Unexpected phase '+phase);
  }
  assert.ok(steps<400,'must settle rather than loop forever');
  assert.equal(s.round.phase,'settled');
  assert.equal(s.extensions.tw16.result.reason,'exhaustive-draw');
  assert.equal(s.wall.length,16);
  assert.deepEqual(s.extensions.tw16.result.delta,[0,0,0,0]);
  assert.equal(s.events.at(-1).type,'settle');
  assert.equal(s.events.at(-1).payload.reason,'exhaustive-draw');
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  assert.ok(s.events.every((e,i)=>e.seq===i+1));
  const following=startNextRound(s,{gameId:'next-draw-hand',seed:'next-draw-seed',prevailingWind:'south'});
  assert.equal(following.round.dealerSeat,s.round.dealerSeat);
  assert.equal(following.round.handIndex,1);
  assert.equal(following.round.prevailingWind,'south');
  assert.equal(validateGameState(following),true);
});
