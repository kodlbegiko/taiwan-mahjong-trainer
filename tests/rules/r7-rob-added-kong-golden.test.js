
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
    fixtureDeck:fixtureDeck(seats,live,{tail}),...R7});
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

test('R7.1 public contract version and fail-closed tail capability are profile-specific',()=>{
  const caps=getRuleCapabilities(R7);
  assert.equal(caps.publicEventContractVersion,'tw16-rob-added-kong-public/1.0.0');
  assert.deepEqual(caps.replacementTailExhaustion,
    {status:'unsupported',capability:'replacement_tail_exhausted'});
  const r5=getRuleCapabilities({profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'});
  assert.equal(r5.publicEventContractVersion,undefined);
  assert.equal(r5.replacementTailExhaustion,undefined);
});

function reply(s,seat,kind){return take(s,choose(s,seat,kind))}
const permutations=[[0,2,3],[0,3,2],[2,0,3],[2,3,0],[3,0,2],[3,2,0]];
test('R7.1 all response orders select the same sole robber; no private action IDs in public resolution',()=>{
  const {open}=prepared();
  const source=open.events.at(-1);
  const snapshot=cp(open);
  for(const order of permutations){
    let s=open;
    for(const seat of order)s=reply(s,seat,seat===2?'win':'pass');
    const r=s.extensions.tw16.result;
    assert.equal(r.winnerSeat,2);
    assert.deepEqual(r.delta,[0,-120,120,0]);
    assert.equal(s.events.at(-2).type,'win');
    assert.equal(s.events.at(-1).type,'settle');
    assert.deepEqual(s.events.at(-2).payload.robAddedKong,r.robAddedKong);
    assert.deepEqual(s.events.at(-1).payload.robAddedKong,r.robAddedKong);
    assert.equal(s.events.at(-1).causedByActionId,s.events.at(-3).causedByActionId);
    for(let seat=0;seat<4;seat++){
      const v=createPlayerView(s,seat);
      const privateReplies=s.events.slice(source.seq,source.seq+3);
      for(const event of v.publicEvents.slice(source.seq,source.seq+3)){
        assert.equal(event.type,'claim');
        assert.deepEqual(event.payload,{});
        assert.ok(!Object.hasOwn(event,'actorSeat'));
        assert.ok(!Object.hasOwn(event,'causedByActionId'));
      }
      for(const event of v.publicEvents.slice(-2)){
        assert.ok(!Object.hasOwn(event,'causedByActionId'));
        assert.deepEqual(event.payload.robAddedKong,r.robAddedKong);
      }
      for(const event of privateReplies)
        assert.ok(!JSON.stringify(v.publicEvents).includes(event.causedByActionId));
      const historical=createPlayerView(s,seat,source.seq);
      assert.deepEqual(historical,createPlayerView(open,seat));
      assert.ok(historical.knownUnavailableTypes.includes(5),'publicly proposed fourth copy');
    }
    assert.deepEqual(replayGame(s),s);
    assert.throws(()=>replayGame({...s,events:s.events.slice(0,-1)}),/atomic/);
    assert.throws(()=>createPlayerView(s,0,s.revision-1),/atomic/);
  }
  assert.deepEqual(open,snapshot);
});

test('R7.1 all PASS is atomic regardless of response order; commit has no private trigger in PlayerView',()=>{
  const {open}=prepared();
  for(const order of permutations){
    let s=open;
    for(const seat of order)s=reply(s,seat,'pass');
    const final=s.events.at(-1);
    assert.equal(final.type,'kong');
    assert.equal(final.payload.proposalEventId,open.events.at(-1).eventId);
    assert.equal(final.causedByActionId,s.events.at(-2).causedByActionId);
    assert.equal(s.players[1].melds.at(-1).kind,'kong');
    assert.equal(s.round.phase,'replacement');
    const publicCommit=createPlayerView(s,0).publicEvents.at(-1);
    assert.ok(!Object.hasOwn(publicCommit,'causedByActionId'));
    assert.deepEqual(publicCommit.payload,final.payload);
    assert.deepEqual(replayGame(s),s);
  }
});

test('R7.1 three robbers and every reply ordering reject final intent without mutation',()=>{
  const {open}=prepared(false,{three:true});
  assert.ok([0,2,3].every(seat=>actions(open,seat,'win').length===1));
  for(const order of permutations){
    let s=open;
    for(const seat of order.slice(0,2))s=reply(s,seat,'win');
    const before=cp(s);
    assert.throws(()=>reply(s,order[2],'win'),e=>
      e instanceof RuleCapabilityError&&e.capability==='multiple_winners');
    assert.deepEqual(s,before);
    assert.equal(validateGameState(s),true);
  }
});

test('R7.1 fast validation rejects missing/mismatched proposal, replies and resolution links',()=>{
  const {open}=prepared();
  const pending=reply(open,2,'win');
  const settled=reply(reply(pending,3,'pass'),0,'pass');
  const committed=respond(open);
  const variants=[
    [open,x=>{x.events.at(-1).payload.kind='CONCEALED_KONG'}],
    [pending,x=>{x.extensions.tw16.window.decisions[0].kind='pass'}],
    [pending,x=>{x.events.at(-1).payload.claimEventId='forged'}],
    [pending,x=>{x.events.at(-1).visibility='public';x.round.lastPublicEventSeq=x.revision}],
    [committed,x=>{x.events.at(-1).payload.proposalEventId='forged'}],
    [settled,x=>{x.events.at(-2).payload.robAddedKong.fromSeat=3}],
    [settled,x=>{x.extensions.tw16.result.winningTileId='t:5:0'}],
  ];
  for(const [source,mutate] of variants){
    const forged=cp(source);mutate(forged);
    assert.throws(()=>validateGameState(forged,{replay:false}),/Invalid|Forged/);
    const before=cp(forged);
    assert.throws(()=>applyAction(forged,{actorSeat:0,actionId:'forged',expectedRevision:forged.revision}));
    assert.deepEqual(forged,before);
  }
});

test('R7.1 chained tail flowers after confirmed kong redact replacement tile and replay',()=>{
  const flowers=createDeck(getRuleProfile(R7.profileId,R7.ruleVersion)).filter(x=>x.startsWith('f:'));
  const {open}=prepared(false,{tail:['t:30:3',flowers[1],flowers[0]]});
  let s=respond(open);
  const size=s.wall.length;
  s=take(s,choose(s,1,'draw'));
  assert.equal(s.round.phase,'replacement');
  assert.ok(s.players[1].concealed.includes(flowers[0]));
  assert.equal(s.extensions.tw16.pendingReplacement,false);
  assert.ok(!actions(s,1,'discard').length);
  for(const flower of flowers.slice(0,2)){
    s=take(s,choose(s,1,'replace_flower',flower));
    assert.ok(s.players[1].flowers.includes(flower));
    const publicFlower=createPlayerView(s,0).publicEvents.at(-1);
    assert.equal(publicFlower.payload.tileId,flower);
    assert.ok(!Object.hasOwn(publicFlower.payload,'replacementTileId'));
    assert.deepEqual(replayGame(s),s);
  }
  assert.equal(s.wall.length,size-3);
  assert.equal(s.round.phase,'await_discard');
  assert.ok(s.players[1].concealed.includes('t:30:3'));
});

test('R7.1 reachable exhausted replacement tail: nine successive open kongs, eight flowers, no fabricated settlement',()=>{
  const flowers=createDeck(getRuleProfile(R7.profileId,R7.ruleVersion)).filter(x=>x.startsWith('f:'));
  const seats={0:[],1:[],2:[],3:[]},drawOrder=[];
  for(let i=0;i<9;i++){
    seats[i%4].push('t:'+i+':0','t:'+i+':1','t:'+i+':2');
    if(i<7)drawOrder.push(flowers[i],'t:'+(i+1)+':3');
    else if(i===7)drawOrder.push('t:8:3');
    else drawOrder.push(flowers[7]);
  }
  let s=createGame({gameId:'r71-tail-exhaustion',seed:'r71-physical-deck',
    fixtureDeck:fixtureDeck(seats,[],{liveLast:['t:0:3'],tail:drawOrder.reverse()}),...R7});
  assert.equal(s.wall.length,79);
  const filler=s.players[0].concealed.find(id=>Number(id.split(':')[1])>=9);
  assert.ok(filler,'preserve all nine reserved triplets');
  s=take(s,choose(s,0,'discard',filler));
  for(let i=0;i<63;i++){
    s=respond(s);
    const seat=s.round.currentSeat,drawn=s.wall[0];
    s=take(s,choose(s,seat,'draw'));
    assert.equal(s.round.phase,'await_discard');
    s=take(s,choose(s,seat,'discard',drawn));
  }
  assert.equal(s.wall.length,16);
  assert.equal(s.events.at(-1).payload.tileId,'t:0:3');
  for(let i=0;i<9;i++){
    const seat=i%4;
    s=respond(s,{[seat]:'kong'});
    assert.equal(s.round.phase,'replacement');
    s=take(s,choose(s,seat,'draw'));
    if(i<7)s=take(s,choose(s,seat,'replace_flower',flowers[i]));
    if(i<8)s=take(s,choose(s,seat,'discard','t:'+(i+1)+':3'));
  }
  assert.equal(s.wall.length,0);
  assert.equal(s.round.phase,'replacement');
  assert.equal(s.extensions.tw16.result,null);
  assert.equal(s.players.flatMap(p=>p.flowers).length,7);
  assert.ok(s.players[0].concealed.includes(flowers[7]));
  assert.equal(s.players.flatMap(p=>p.melds).filter(m=>m.kind==='kong').length,9);
  assert.deepEqual(actions(s,0),[]);
  assert.deepEqual(createPlayerView(s,0).legalActions,[]);
  const before=cp(s);
  assert.throws(()=>applyAction(s,{actorSeat:0,expectedRevision:s.revision,
    actionId:'blocked-replacement'}),e=>e instanceof RuleCapabilityError&&
      e.capability==='replacement_tail_exhausted');
  assert.deepEqual(s,before);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  assert.ok(!s.events.some(e=>e.type==='settle'));
});

test('R7.1 ordinary claim priority stays WIN > open KONG > PONG > CHI in every response order',()=>{
  const seats={0:['t:5:3'],1:['t:4:0','t:6:0'],
    2:['t:5:0','t:5:1','t:5:2'],3:robber(18,28,1)};
  let open=createGame({gameId:'r71-priority',seed:'r71-priority',
    fixtureDeck:fixtureDeck(seats,[]),...R7});
  open=take(open,choose(open,0,'discard','t:5:3'));
  for(const order of [[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]){
    for(const [claims,expectedPhase,expectedSeat] of [
      [{1:'chi',2:'kong',3:'win'},'settled',3],
      [{1:'chi',2:'kong',3:'pass'},'replacement',2],
      [{1:'chi',2:'pong',3:'pass'},'await_discard',2],
      [{1:'chi',2:'pass',3:'pass'},'await_discard',1],
    ]){
      let s=open;
      for(const seat of order)s=reply(s,seat,claims[seat]);
      assert.equal(s.round.phase,expectedPhase);
      assert.equal(s.round.currentSeat,expectedSeat);
      assert.equal(validateGameState(s),true);
      assert.deepEqual(replayGame(s),s);
    }
  }
});
