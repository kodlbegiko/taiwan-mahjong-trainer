import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,applyAction,listLegalActions,validateGameState,createPlayerView,
  replayGame,getRuleProfile,validateRuleProfile,createDeck,
  scoreWinningHand,settleWin,parsePhysicalTileId,
} from '../../src/rules/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const P=getRuleProfile(REF.profileId,REF.ruleVersion);
const cloned=x=>JSON.parse(JSON.stringify(x));
const pick=(state,seat,kind)=>listLegalActions(state,seat).find(a=>a.kind===kind);
const move=(state,seat,action)=>{
  assert.ok(action,'Expected real Rules LegalAction');
  return applyAction(state,{actorSeat:seat,actionId:action.actionId,
    expectedRevision:state.revision}).state;
};
function ready(seed='tw16-flowers-seed'){
  let s=createGame({gameId:'tw16-test',seed,...REF});
  for(let n=0;s.round.phase==='replacement'&&n<80;n++){
    const seat=s.round.currentSeat;
    const a=pick(s,seat,'replace_flower');
    assert.ok(a,'Initial flower must be replaceable');
    s=move(s,seat,a);
  }
  assert.equal(s.round.phase,'await_discard','initial flowers complete');
  return s;
}
function seekDiscardClaim(kind,maxSeeds=60){
  for(let seed=0;seed<maxSeeds;seed++){
    const initial=ready('seek-'+kind+'-'+seed);
    const discarder=initial.round.currentSeat;
    for(const discard of listLegalActions(initial,discarder).filter(a=>a.kind==='discard')){
      const opened=move(initial,discarder,discard);
      for(let seat=0;seat<4;seat++){
        const candidate=pick(opened,seat,kind);
        if(candidate)return {initial,opened,discarder,seat,candidate,discard};
      }
    }
  }
  throw new Error('Could not find deterministic '+kind+' claim fixture');
}
function finishClaim(opened,seat,candidate){
  let s=move(opened,seat,candidate);
  for(let other=0;other<4;other++){
    if(other===seat||other===opened.extensions.tw16.window.fromSeat)continue;
    s=move(s,other,pick(s,other,'pass'));
  }
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  return s;
}

test('R3 Profile V1 is explicit experimental, 144 physical unique tiles and no verified house claim',()=>{
  assert.equal(P.status,'experimental');
  assert.equal(P.scope,'four-player');
  assert.equal(P.turnPolicy.claimPriority,'configured');
  assert.equal(P.winningPolicy.mode,'configured');
  assert.equal(P.scoringPolicy.mode,'configured');
  assert.equal(P.extensions.tw16.housePolicyVersion,'tw16-table-experimental/1.0.0');
  assert.equal(validateRuleProfile(P),true);
  const deck=createDeck(P);
  assert.equal(deck.length,144);
  assert.equal(new Set(deck).size,144);
  const unsupported=cloned(P);
  unsupported.extensions.tw16.robAddedKong=true;
  assert.throws(()=>validateRuleProfile(unsupported),/experimental table policy/);
  const unversioned=cloned(P);
  unversioned.ruleVersion='unreviewed-change';
  assert.throws(()=>validateRuleProfile(unversioned),/experimental table policy/);
  assert.equal(deck.filter(id=>parsePhysicalTileId(id).kind==='flower').length,8);
});

test('R3-A initial 17/16, deterministic flower replacement, legal live draw, physical conservation',()=>{
  const first=createGame({gameId:'tw16-test',seed:'tw16-seed-1',...REF});
  assert.deepEqual(first.players.map(x=>x.concealed.length),[17,16,16,16]);
  assert.equal(first.wall.length,79);
  let current=cloned(first),flowers=0;
  for(let n=0;current.round.phase==='replacement'&&n<80;n++){
    const actor=current.round.currentSeat;
    const a=pick(current,actor,'replace_flower');
    assert.ok(a);
    const before=current.wall.length;
    current=move(current,actor,a);
    flowers++;
    assert.equal(current.wall.length,before-1);
    assert.equal(validateGameState(current),true);
  }
  assert.equal(current.round.phase,'await_discard');
  assert.deepEqual(replayGame(current),current);
  assert.ok(flowers>=0);
  const actor=current.round.currentSeat;
  assert.equal(actor,current.round.dealerSeat);
  assert.ok(listLegalActions(current,actor).some(a=>a.kind==='discard'));
  assert.deepEqual(listLegalActions(current,(actor+1)%4),[]);
  const next=move(current,actor,pick(current,actor,'discard'));
  assert.equal(next.round.phase,'claim_window');
  assert.equal(listLegalActions(next,actor).length,0);
  let passed=next;
  for(let i=1;i<=3;i++){
    const seat=(actor+i)%4;
    passed=move(passed,seat,pick(passed,seat,'pass'));
  }
  assert.equal(passed.round.phase,'await_draw');
  const drawer=passed.round.currentSeat;
  assert.equal(drawer,(actor+1)%4);
  const before=passed.wall.length;
  const after=move(passed,drawer,pick(passed,drawer,'draw'));
  assert.equal(after.wall.length,before-1);
  assert.ok(['await_discard','replacement'].includes(after.round.phase));
  assert.equal(validateGameState(after),true);
  assert.deepEqual(replayGame(after),after);
});

test('R3-A chi: next-seat only, real physical claim & third-party identity cannot be forged',()=>{
  const {opened,discarder,seat,candidate}=seekDiscardClaim('chi',20);
  assert.equal(seat,(discarder+1)%4);
  assert.equal(candidate.claimEventId,opened.extensions.tw16.window.discardEventId);
  const other=(seat+1)%4;
  assert.throws(()=>applyAction(opened,{
    actorSeat:other,actionId:candidate.actionId,expectedRevision:opened.revision,
  }),/illegal/);
  const result=finishClaim(opened,seat,candidate);
  assert.equal(result.round.currentSeat,seat);
  assert.equal(result.round.phase,'await_discard');
  const meld=result.players[seat].melds.at(-1);
  assert.equal(meld.kind,'sequence');
  assert.equal(meld.tileIds.length,3);
  assert.ok(result.players[discarder].river.at(-1).claimedByEventId);
  assert.equal(result.players[seat].concealed.length,14);
});

test('R3-A pong: any eligible other seat, physical ownership & replay',()=>{
  const {opened,discarder,seat,candidate}=seekDiscardClaim('pong',30);
  assert.notEqual(seat,discarder);
  const result=finishClaim(opened,seat,candidate);
  assert.equal(result.round.currentSeat,seat);
  assert.equal(result.round.phase,'await_discard');
  const meld=result.players[seat].melds.at(-1);
  assert.equal(meld.kind,'triplet');
  assert.equal(meld.open,true);
  assert.equal(meld.tileIds.length,3);
  assert.equal(result.players[seat].concealed.length,14);
  assert.ok(result.players[discarder].river.at(-1).claimedByEventId);
});

test('R3-A exposed kong: legal claim transitions to tail replacement',()=>{
  const {opened,seat,candidate}=seekDiscardClaim('kong',100);
  assert.equal(candidate.legalityBasis.reasonCodes[0],'OPEN_KONG');
  const result=finishClaim(opened,seat,candidate);
  assert.equal(result.round.phase,'replacement');
  assert.equal(result.round.currentSeat,seat);
  assert.equal(result.players[seat].melds.at(-1).kind,'kong');
  assert.equal(result.players[seat].melds.at(-1).tileIds.length,4);
  const before=result.wall.at(-1),size=result.wall.length;
  let next=move(result,seat,pick(result,seat,'draw'));
  assert.equal(next.wall.length,size-1);
  assert.ok(next.players[seat].concealed.includes(before));
  assert.ok(['replacement','await_discard'].includes(next.round.phase));
  assert.equal(validateGameState(next),true);
});

test('R3-A self/added kong are exclusively legal when physical ownership confirms them',()=>{
  for(let seed=0;seed<25;seed++){
    const game=ready('own-kong-'+seed),seat=game.round.currentSeat;
    const legal=listLegalActions(game,seat);
    for(const act of legal.filter(a=>a.kind==='kong')){
      assert.ok(['CONCEALED_KONG','ADDED_KONG'].includes(act.legalityBasis.reasonCodes[0]));
      const next=move(game,seat,act);
      assert.equal(next.round.phase,'replacement');
      assert.equal(next.players[seat].melds.at(-1).kind,'kong');
      assert.equal(validateGameState(next),true);
      assert.deepEqual(replayGame(next),next);
    }
    assert.deepEqual(listLegalActions(game,(seat+1)%4),[]);
  }
});

test('R3-A claim window collects three decisions without leaking private tile choices',()=>{
  const {opened,seat,candidate}=seekDiscardClaim('pong',30);
  const halfway=move(opened,seat,candidate);
  assert.equal(halfway.round.phase,'claim_window');
  const view=createPlayerView(halfway,(seat+1)%4);
  assert.ok(!JSON.stringify(view).includes(candidate.tileIds[0]) ||
    view.self.concealed.some(id=>id.id===candidate.tileIds[0]) ||
    view.opponents.some(p=>p.river.some(d=>d.tileId===candidate.tileIds[0])));
  assert.ok(view.publicEvents.every(e=>!('replacementTileId' in e.payload)));
  const result=finishClaim(opened,seat,candidate);
  assert.equal(result.events.at(-1).type,'claim');
});

test('R3-B minimal ScoringPolicy Golden positive and negative cases, zero-sum settlement',()=>{
  const concealed={melds:[]},opened={melds:[{kind:'sequence',open:true,tileIds:[]}]};
  const concealedRon=scoreWinningHand(P,concealed,{winnerSeat:1,sourceSeat:2,via:'discard',dealerSeat:0});
  assert.equal(concealedRon.tai,1);
  assert.deepEqual(concealedRon.breakdown.map(x=>x.code),['concealed']);
  const selfDraw=scoreWinningHand(P,concealed,{winnerSeat:1,sourceSeat:1,via:'self-draw',dealerSeat:0});
  assert.equal(selfDraw.tai,3);
  assert.deepEqual(selfDraw.breakdown.map(x=>x.code),
    ['concealed','self-draw','concealed-self-draw-bonus']);
  const openSelfDraw=scoreWinningHand(P,opened,{winnerSeat:1,sourceSeat:1,via:'self-draw',dealerSeat:0});
  assert.equal(openSelfDraw.tai,1);
  const payments=settleWin(P,selfDraw,{winnerSeat:1,sourceSeat:1,via:'self-draw',dealerSeat:0});
  assert.deepEqual(payments.delta,[-180,500,-160,-160]);
  assert.throws(()=>settleWin(P,selfDraw,{
    winnerSeat:1,sourceSeat:2,via:'discard',dealerSeat:0,
  }),/Missing scored winning hand/);
  assert.equal(payments.delta.reduce((x,y)=>x+y,0),0);
  const ron=settleWin(P,concealedRon,{winnerSeat:1,sourceSeat:2,via:'discard',dealerSeat:0});
  assert.deepEqual(ron.delta,[0,120,-120,0]);
  assert.throws(()=>scoreWinningHand(P,concealed,{winnerSeat:0,sourceSeat:1,via:'self-draw',dealerSeat:0}));
  const bad=cloned(P);bad.scoringPolicy.mode='undefined';
  assert.throws(()=>scoreWinningHand(bad,concealed,{winnerSeat:1,sourceSeat:2,via:'discard',dealerSeat:0}));
});

test('R3-C replay: fixed seed, actionId/revision, key order and hidden GameState rejection',()=>{
  let state=ready('replay-real-1');
  for(let i=0;i<28&&state.round.phase!=='settled';i++){
    const phase=state.round.phase,seat=state.round.currentSeat;
    if(phase==='await_discard')state=move(state,seat,pick(state,seat,'discard'));
    else if(phase==='claim_window'){
      const window=state.extensions.tw16.window;
      const next=[0,1,2,3].find(s=>s!==window.fromSeat&&
        !window.decisions.some(d=>d.seat===s));
      state=move(state,next,pick(state,next,'pass'));
    }else if(phase==='await_draw')state=move(state,seat,pick(state,seat,'draw'));
    else if(phase==='replacement')state=move(state,seat,
      pick(state,seat,'replace_flower')||pick(state,seat,'draw'));
    assert.equal(validateGameState(state),true);
  }
  assert.deepEqual(replayGame(state),state);
  assert.equal(state.events.at(-1).seq,state.revision);
  const tamper=cloned(state);
  tamper.events[1].payload={...tamper.events[1].payload,unknown:'tamper'};
  assert.throws(()=>replayGame(tamper),/mismatch/);
  const invalid=cloned(state);
  invalid.round.currentSeat=(invalid.round.currentSeat+1)%4;
  assert.throws(()=>validateGameState(invalid),/mismatch|Invalid/);
});

test('R3-C public projection excludes other concealed, wall and private replacement tile',()=>{
  const state=ready('public-privacy');
  const seat=state.round.currentSeat,view=createPlayerView(state,seat);
  assert.ok(!Object.hasOwn(view,'wall'));
  assert.ok(!Object.hasOwn(view,'rng'));
  assert.ok(!Object.hasOwn(view,'extensions'));
  assert.ok(view.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  assert.ok(view.publicEvents.every(x=>!Object.hasOwn(x.payload,'replacementTileId')));
  const hidden=cloned(state),opponent=(seat+1)%4;
  const oppTile=hidden.players[opponent].concealed.find(x=>x.startsWith('t:'));
  const wallTile=hidden.wall.find(x=>x.startsWith('t:'));
  const oi=hidden.players[opponent].concealed.indexOf(oppTile),wi=hidden.wall.indexOf(wallTile);
  hidden.players[opponent].concealed[oi]=wallTile;hidden.wall[wi]=oppTile;
  assert.equal(validateGameState(hidden,{replay:false}),true);
  assert.deepEqual(createPlayerView(state,seat),createPlayerView(hidden,seat));
  assert.throws(()=>validateGameState(hidden),/mismatch/);
});

test('R3-C invalid actions and unsupported special claims fail closed',()=>{
  const game=ready('malicious');
  assert.throws(()=>applyAction(game,{
    actorSeat:1,expectedRevision:game.revision,actionId:'forged:win',
  }),/illegal/);
  const act=pick(game,game.round.currentSeat,'discard');
  assert.throws(()=>applyAction(game,{
    actorSeat:game.round.currentSeat,expectedRevision:game.revision-1,actionId:act.actionId,
  }),/Stale/);
  assert.throws(()=>applyAction(game,{
    actorSeat:game.round.currentSeat,expectedRevision:game.revision,
    actionId:act.actionId,tileIds:['t:0:0'],
  }),/Forged/);
  const post=move(game,game.round.currentSeat,act);
  assert.ok(listLegalActions(post,game.round.currentSeat).every(a=>a.kind!=='chi'));
});


test('R3-A positive flower Golden for nonzero dealer: dealer-first clockwise replacement and private tail-redaction',()=>{
  let game;
  for(let i=0;i<12;i++){
    const candidate=createGame({gameId:'flower-dealer2',seed:'flower-dealer2-'+i,...REF,dealerSeat:2});
    if(candidate.round.phase==='replacement'){game=candidate;break;}
  }
  assert.ok(game,'must locate a reproducible seeded deal with at least one flower');
  const order=[2,3,0,1];
  const first=order.find(seat=>game.players[seat].concealed.some(id=>id.startsWith('f:')));
  assert.equal(game.round.currentSeat,first);
  let count=0;
  for(;game.round.phase==='replacement'&&count<50;count++){
    const actor=game.round.currentSeat;
    const flower=pick(game,actor,'replace_flower');
    assert.ok(flower);
    const before=game.wall.length;
    game=move(game,actor,flower);
    assert.equal(game.wall.length,before-1);
  }
  assert.ok(count>0);
  assert.equal(game.round.currentSeat,2);
  assert.equal(game.round.phase,'await_discard');
  assert.ok(game.players.some(p=>p.flowers.length>0));
  const outsider=createPlayerView(game,0);
  assert.ok(outsider.publicEvents.some(e=>e.type==='flower'));
  assert.ok(outsider.publicEvents.every(e=>!Object.hasOwn(e.payload,'replacementTileId')));
  assert.ok(outsider.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  assert.equal(validateGameState(game),true);
  assert.deepEqual(replayGame(game),game);
});

test('R3-C adversarial duplicate physical cards fail before an action can move them',()=>{
  const game=ready('duplicate-inventory-fixture');
  const forged=cloned(game);
  forged.players[0].concealed[0]=forged.wall[0];
  assert.throws(()=>validateGameState(forged,{replay:false}),/Physical tile duplication/);
  const actor=forged.round.currentSeat;
  const action=listLegalActions(game,actor).find(a=>a.kind==='discard');
  assert.throws(()=>applyAction(forged,{
    actorSeat:actor,actionId:action.actionId,expectedRevision:forged.revision,
  }),/Physical tile duplication/);
});
