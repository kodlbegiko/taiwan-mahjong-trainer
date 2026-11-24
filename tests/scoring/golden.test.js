import test from 'node:test';
import assert from 'node:assert/strict';
import {getScoringProfile,listScoringProfiles,createScoringProfile,scoreWinningHand,
settleWinningHand,settleExhaustiveDraw,assertLedgerConservation,
evidenceFromSettledRulesState,scoreRulesState,settleRulesState,ScoringCapabilityError} from '../../src/scoring/index.js';
import {getRuleProfile,createGame,createDeck,listLegalActions,applyAction,validateGameState,replayGame,
scoreWinningHand as legacyScore,settleWin as legacySettle}
from '../../src/rules/index.js';
const p=getScoringProfile('tw16-gametower-comparative');
const see=getScoringProfile('tw16-gametower-see-flower-wind');
const ref={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const fixture=(extra={})=>({ruleRef:ref,winnerSeat:1,sourceSeat:0,via:'discard',
dealerSeat:3,dealerStreak:0,concealed:[3,4,5,9,10,11,12,13,14,18,19,20,27],
winningTile:27,melds:[{kind:'sequence',open:true,tileIds:[0,1,2]}],flowers:[],...extra});
const f=x=>'f:'+x+':0';
const triplets=[0,0,0,1,1,1,2,2,2,31,31,31,32,32,32,33,33];
const dragons=[31,31,31,32,32,32,33,33,33,0,1,2,9,10,11,18,18];
const score=e=>scoreWinningHand(p,e);
const settle=e=>settleWinningHand(p,e);
test('S00 opt-in profile and legacy R5 scorer remain independent',()=>{
assert.equal(p.status,'experimental');
assert.equal(listScoringProfiles().length,2);
assert.ok(Object.isFrozen(p));
assert.ok(p.sourceRefs.every(x=>x.startsWith('https://')));
const old=getRuleProfile('tw16-single-winner-interception','experimental-v1');
assert.equal(old.scoringPolicy.configRef,'tw16-minimal-tai-v1');
const e={winnerSeat:1,sourceSeat:0,via:'discard',dealerSeat:3};
const oldScore=legacyScore(old,{melds:[]},e);
assert.equal(oldScore.tai,1);
assert.deepEqual(legacySettle(old,oldScore,e).delta,[-120,120,0,0]);
});
test('S01 zero tai and zero-sum payout are valid',()=>{
const s=score(fixture());assert.equal(s.tai,0);assert.deepEqual(s.breakdown,[]);
const l=settle(fixture());assert.deepEqual(l.playerDeltas,[0,0,0,0]);
assert.equal(assertLedgerConservation(l),true);
});
test('S02 composite hand, mutually-exclusive dragons and flower sets',()=>{
const s=score(fixture({via:'self-draw',sourceSeat:1,concealed:triplets,
winningTile:undefined,melds:[],seatWindType:27,prevailingWindType:27,
flowers:['season-spring','season-summer','season-autumn','season-winter','plant-plum'].map(f)}));
const codes=s.breakdown.map(x=>x.code);
for(const x of ['concealed-self-draw','small-dragons','all-pongs','concealed-triplets:5',
'flower-set:0','correct-flower:plant-plum','mixed-suit'])assert.ok(codes.includes(x),x);
assert.ok(!codes.some(x=>x.startsWith('dragon:')||x==='correct-flower:season-spring'));
assert.equal(s.tai,26);
assert.ok(s.breakdown.every(x=>x.name&&x.evidence&&x.ruleVersion&&x.source&&x.scope==='hand'));
});
test('S03 big dragons replaces individual dragon / small dragon',()=>{
const s=score(fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[]}));
const codes=s.breakdown.map(x=>x.code);
assert.ok(codes.includes('big-dragons'));
assert.ok(!codes.some(x=>x.startsWith('dragon:')||x==='small-dragons'));
assert.equal(s.tai,13);
});
test('S04 dealer + 連二拉二 per transfer only',()=>{
const l=settle(fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[],dealerStreak:2,
streakEvidence:{roundRefs:['prior-1','prior-2']}}));
assert.equal(l.payments.length,3);
assert.equal(l.payments.find(x=>x.payerSeat===3).appliedTai,l.score.tai+5);
assert.ok(l.payments.filter(x=>x.payerSeat!==3).every(x=>x.appliedTai===l.score.tai));
assert.equal(l.playerDeltas.reduce((a,b)=>a+b,0),0);
});
test('S05 discard paid only by discarder; dealer seat payer increment',()=>{
const l=settle(fixture({dealerSeat:0}));
assert.deepEqual(l.playerTransferDeltas,[-1,1,0,0]);
assert.equal(l.payments.length,1);
assert.equal(l.payments[0].appliedTai,1);
});
test('S06 alternative 見花見字 adds flower and kong tai, normal mode does not',()=>{
const e=fixture({via:'self-draw',sourceSeat:1,concealed:
[0,1,2,9,10,11,18,19,20,27,27],winningTile:undefined,
melds:[{kind:'kong',open:true,tileIds:[3,3,3,3]},
{kind:'kong',open:false,tileIds:[31,31,31,31]}],
flowers:[f('season-winter')],seatWindType:27,prevailingWindType:27});
const standard=scoreWinningHand(p,e),variant=scoreWinningHand(see,e);
assert.ok(!standard.breakdown.some(x=>x.code.startsWith('kong:')));
for(const code of ['kong:0','kong:1','flower:season-winter'])
assert.ok(variant.breakdown.some(x=>x.code===code));
assert.ok(!standard.breakdown.some(x=>x.code==='correct-flower:season-winter'));
});
test('S07 independent fee ledger includes house and rejects corrupted balances',()=>{
const q=JSON.parse(JSON.stringify(p));q.settlement.fee={mode:'fixed-per-player',points:2};
const l=settleWinningHand(createScoringProfile(q),fixture());
assert.deepEqual(l.playerTransferDeltas,[0,0,0,0]);
assert.deepEqual(l.playerDeltas,[-2,-2,-2,-2]);assert.equal(l.houseDelta,8);
assert.equal(assertLedgerConservation(l),true);
const bad=structuredClone(l);bad.playerDeltas[0]--;
assert.throws(()=>assertLedgerConservation(bad),/conservation|Mismatch/);
});
test('S08 exhaustive draw has no player transfers',()=>{
const l=settleExhaustiveDraw(p);
assert.deepEqual(l.playerDeltas,[0,0,0,0]);assert.equal(l.houseDelta,0);
});
test('S09 fail-closed missing/invalid evidence',()=>{
assert.throws(()=>score(fixture({winningTile:undefined})),/winning tile/);
assert.throws(()=>score(fixture({dealerStreak:undefined})),/dealerStreak/);
assert.throws(()=>score(fixture({dealerStreak:2})),/streak/);
assert.throws(()=>score(fixture({sourceSeat:1})),/win source/);
assert.throws(()=>score(fixture({ruleRef:{profileId:'foo',ruleVersion:'bar'}})),/RuleProfile/);
assert.throws(()=>score(fixture({concealed:[3,4,5]})),/count/);
assert.throws(()=>score(fixture({flowers:[f('season-spring'),f('season-spring')],seatWindType:27})),/duplicate flower/);
assert.throws(()=>score(fixture({specialWin:'rob-kong'})),ScoringCapabilityError);
assert.throws(()=>settle(fixture({liability:{payerSeat:2}})),ScoringCapabilityError);
assert.throws(()=>score(fixture({melds:[{kind:'kong',open:true,tileIds:[1,2,3,4]}]})),/triplet|meld|count/);
});
test('S10 wind/flower seat evidence cannot be assumed from dealer',()=>{
const e=fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[],flowers:[f('season-spring')]});
assert.throws(()=>score(e),/seat wind proof/);
const x=fixture({via:'self-draw',sourceSeat:1,concealed:
[27,27,27,0,0,0,1,1,1,2,2,2,3,3,3,31,31],
winningTile:undefined,melds:[]});
assert.throws(()=>score(x),/wind proofs/);
});
test('S11 adapter rejects non-authoritative or missing win/settle linkage',()=>{
assert.throws(()=>evidenceFromSettledRulesState({}),/settled Rules/);
assert.throws(()=>evidenceFromSettledRulesState({round:{phase:'settled'},
extensions:{tw16:{result:{reason:'win'}}},events:[]}),/linkage/);
});
test('S12 unsupported configuration is not silently accepted',()=>{
for(const mutate of [x=>{x.sourceRefs=[]},x=>{x.points.perTai=0},
x=>{x.variants.wind='auto'},x=>{x.settlement.liability='bao'},
x=>{x.tai.allPongs=-1},x=>{x.status='verified'}]){
const q=JSON.parse(JSON.stringify(p));mutate(q);
assert.throws(()=>createScoringProfile(q),/Invalid|Unsupported/);
}
});

test('S13 ron completion of a triplet is not an extra concealed pung',()=>{
const concealed=[3,3,12,12,12,21,21,21,6,7,8,9,9];
const ron=fixture({concealed,winningTile:3});
const x=score(ron);
assert.ok(!x.breakdown.some(e=>e.code==='concealed-triplets:3'));
const y=score(fixture({concealed:[3,3,3,12,12,12,21,21,21,6,7,8,9],
winningTile:9}));
assert.ok(y.breakdown.some(e=>e.code==='concealed-triplets:3'));
assert.ok(y.tai>x.tai);
});
test('S14 big four winds supersede per-wind tai',()=>{
const hand=[27,27,27,28,28,28,29,29,29,30,30,30,0,0,0,1,1];
const x=score(fixture({via:'self-draw',sourceSeat:1,concealed:hand,
winningTile:undefined,melds:[],seatWindType:27,prevailingWindType:27}));
assert.ok(x.breakdown.some(e=>e.code==='big-winds'));
assert.ok(!x.breakdown.some(e=>e.code.startsWith('seat-wind:')||
e.code.startsWith('round-wind:')));
});
test('S15 concealed kong retains the closed-hand status',()=>{
const hand=[0,0,0,1,1,1,2,2,2,3,3,3,4,4];
const e=fixture({via:'self-draw',sourceSeat:1,concealed:hand,
winningTile:undefined,melds:[{kind:'kong',open:false,tileIds:[6,6,6,6]}]});
assert.ok(score(e).breakdown.some(x=>x.code==='concealed-self-draw'));
assert.ok(!score(e).breakdown.some(x=>x.code.startsWith('kong:')));
assert.ok(scoreWinningHand(see,e).breakdown.some(x=>x.code==='kong:0'));
});
test('S16 pure suit excludes mixed suit, honors-only implicit all-pongs configurable',()=>{
const mono=[0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5];
const m=score(fixture({via:'self-draw',sourceSeat:1,concealed:mono,
winningTile:undefined,melds:[]}));
assert.ok(m.breakdown.some(x=>x.code==='pure-suit'));
assert.ok(!m.breakdown.some(x=>x.code==='mixed-suit'));
const honor=[27,27,27,28,28,28,29,29,29,30,30,30,31,31,31,32,32];
const evidence=fixture({via:'self-draw',sourceSeat:1,concealed:honor,
winningTile:undefined,melds:[],seatWindType:27,prevailingWindType:27});
const h=score(evidence);
assert.ok(h.breakdown.some(x=>x.code==='all-honors'));
assert.ok(!h.breakdown.some(x=>x.code==='all-pongs'));
const q=JSON.parse(JSON.stringify(p));q.variants.allHonorsSuppressAllPongs=false;
assert.ok(scoreWinningHand(createScoringProfile(q),evidence).breakdown.some(x=>x.code==='all-pongs'));
});
test('S17 fixed external table fees also apply to an exhaustive draw',()=>{
const q=JSON.parse(JSON.stringify(p));q.settlement.fee={mode:'fixed-per-player',points:4};
const l=settleExhaustiveDraw(createScoringProfile(q));
assert.deepEqual(l.playerTransferDeltas,[0,0,0,0]);
assert.deepEqual(l.playerDeltas,[-4,-4,-4,-4]);
assert.equal(l.houseDelta,16);
assert.equal(assertLedgerConservation(l),true);
});
test('S18 settlement refuses numeric overflow and fabricated duplicate streak references',()=>{
const q=JSON.parse(JSON.stringify(p));q.points.perTai=Number.MAX_SAFE_INTEGER;
const e=fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[]});
assert.throws(()=>settleWinningHand(createScoringProfile(q),e),/overflow/);
assert.throws(()=>score(fixture({dealerStreak:2,
streakEvidence:{roundRefs:['same','same']}})),/streak/);
});
test('S19 payment item and breakdown entries have unique rule codes and sources',()=>{
const e=fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[],dealerStreak:2,
streakEvidence:{roundRefs:['round1','round2']}});
const l=settle(e);
const codes=l.score.breakdown.map(x=>x.code);
assert.equal(new Set(codes).size,codes.length);
assert.ok(l.payments.flatMap(x=>x.dealerItems).every(x=>x.ruleVersion===l.scoringVersion&&
x.source&&x.scope==='payment'));
});
test('S20 ledger detects tampering with payments, missing transfers and negative fee',()=>{
const l=settle(fixture({dealerSeat:0}));
const corrupted=structuredClone(l);
corrupted.payments[0].points++;
assert.throws(()=>assertLedgerConservation(corrupted),/Mismatch/);
const missing=structuredClone(l);missing.payments=[];
assert.throws(()=>assertLedgerConservation(missing),/Mismatch/);
const fee=structuredClone(l);fee.fees=[{seat:1,points:-1}];
assert.throws(()=>assertLedgerConservation(fee),/Invalid fee/);
});

test('S21 genuine R5 Rules win/settle public-event adapter works without mutating R5',()=>{
const r5=getRuleProfile('tw16-single-winner-interception','experimental-v1');
const deck=createDeck(r5),standard=deck.filter(id=>id.startsWith('t:'));
const seventeen=[0,1,2,3,4].flatMap(t=>[0,1,2].map(copy=>'t:'+t+':'+copy))
.concat(['t:5:0','t:5:1']);
const seats=[[...seventeen],[],[],[]],taken=new Set(seventeen);
for(let seat=1;seat<4;seat++){
for(const id of standard){if(seats[seat].length>=16)break;
if(!taken.has(id)){seats[seat].push(id);taken.add(id);}}
assert.equal(seats[seat].length,16);
}
const dealer=[...seats[0]],extra=dealer.pop();
const fixtureDeck=[...dealer,...seats[1],...seats[2],...seats[3],extra,
...deck.filter(id=>!taken.has(id))];
assert.equal(fixtureDeck.length,144);
assert.equal(new Set(fixtureDeck).size,144);
const start=createGame({gameId:'scoring-r7-real-win',seed:'scoring-r7-seed',
fixtureDeck,dealerSeat:0,profileId:'tw16-single-winner-interception',
ruleVersion:'experimental-v1'});
const action=listLegalActions(start,0).find(x=>x.kind==='win');
assert.ok(action);
const result=applyAction(start,{actorSeat:0,actionId:action.actionId,
expectedRevision:start.revision}).state;
assert.equal(validateGameState(result),true);
assert.deepEqual(replayGame(result),result);
assert.deepEqual(result.round.scores,[540,-180,-180,-180]);
const snapshot=JSON.stringify(result);
const evidence=evidenceFromSettledRulesState(result);
assert.equal(evidence.dealerStreak,0);
assert.equal(evidence.prevailingWindType,27);
const score=scoreRulesState(p,result);
assert.equal(score.tai,23);
const l=settleRulesState(p,result);
assert.deepEqual(l.playerTransferDeltas,[72,-24,-24,-24]);
assert.equal(assertLedgerConservation(l),true);
assert.equal(JSON.stringify(result),snapshot);

const corrupt=structuredClone(result);
corrupt.events.at(-1).payload.delta=[-180,540,-180,-180];
assert.throws(()=>evidenceFromSettledRulesState(corrupt),/linkage/);
assert.throws(()=>evidenceFromSettledRulesState(result,{prevailingWindType:28}),/prevailing wind mismatch/);
const incomplete=structuredClone(result);
incomplete.round.handIndex=1;
assert.throws(()=>evidenceFromSettledRulesState(incomplete),/Dealer streak/);
});

test('S22 seeded property golden: 150 legal ordinary hands preserve payout under seat permutation',()=>{
let state=0x9ac0f112;
const next=max=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%max};
for(let n=0;n<150;n++){
const counts=Array(34).fill(0),groups=[];
for(let g=0;g<5;g++){
let found=false;
for(let retry=0;retry<200&&!found;retry++){
const t=next(34),seq=t<27&&t%9<=6&&next(2)===0;
const types=seq?[t,t+1,t+2]:[t,t,t];
if(types.every(x=>counts[x]+types.filter(y=>y===x).length<=4)){
for(const x of types)counts[x]++;
groups.push({kind:seq?'sequence':'triplet',tiles:types});found=true;
}
}
assert.ok(found);
}
let pairType;
for(let retry=0;retry<200;retry++){const t=next(34);
if(counts[t]<=2){pairType=t;break}}
assert.ok(pairType!==undefined);
const fixed=next(3);
const melds=groups.slice(0,fixed).map(g=>({kind:g.kind,open:true,tileIds:g.tiles}));
const concealed=[...groups.slice(fixed).flatMap(g=>g.tiles),pairType,pairType];
const selfDraw=next(2)===0;
const winningTile=selfDraw?undefined:concealed.pop();
const e=fixture({via:selfDraw?'self-draw':'discard',sourceSeat:selfDraw?1:0,
dealerSeat:3,seatWindType:28,prevailingWindType:27,
concealed,melds,winningTile,flowers:[]});
const l=settle(e);
assert.equal(assertLedgerConservation(l),true);
const copy=settle(e);
assert.deepEqual(copy,l);
const permutation=fixture({...e,winnerSeat:2,sourceSeat:selfDraw?2:1,
dealerSeat:0});
const shifted=settle(permutation);
for(let seat=0;seat<4;seat++)
assert.equal(shifted.playerTransferDeltas[(seat+1)%4],l.playerTransferDeltas[seat]);
}
});

test('S23 見花見字 no honor/no flower award is opt-in and not assumed for default',()=>{
const e=fixture({concealed:[3,4,5,9,10,11,12,13,14,18,19,20,23],
winningTile:23});
const normal=scoreWinningHand(p,e);
const alternative=scoreWinningHand(see,e);
assert.ok(!normal.breakdown.some(x=>x.code==='no-honors-no-flowers'));
const special=alternative.breakdown.find(x=>x.code==='no-honors-no-flowers');
assert.ok(special);assert.equal(special.tai,2);
assert.equal(alternative.tai,normal.tai+2);
const withFlower={...e,flowers:[f('season-spring')]};
assert.ok(!scoreWinningHand(see,withFlower).breakdown.some(x=>x.code==='no-honors-no-flowers'));
});
test('S24 unsupported scoring evidence flags are not silently discarded',()=>{
for(const field of ['waitShape','firstTurnWin','readyDeclaration',
'liabilityPolicy','winReason']){
assert.throws(()=>score(fixture({[field]:'requires Rules event evidence'})),
ScoringCapabilityError);
}
assert.throws(()=>score(fixture({via:'self-draw',sourceSeat:1,
concealed:dragons,winningTile:27,melds:[]})),/winningTile/);
});

test('S25 見花見字 retains two tai for a complete flower family, plus each flower',()=>{
const withFamily=fixture({via:'self-draw',sourceSeat:1,concealed:dragons,
winningTile:undefined,melds:[],flowers:[
f('season-spring'),f('season-summer'),f('season-autumn'),f('season-winter')]});
const normal=scoreWinningHand(p,{...withFamily,seatWindType:27});
const alternative=scoreWinningHand(see,withFamily);
assert.equal(normal.breakdown.find(x=>x.code==='flower-set:0')?.tai,2);
assert.equal(alternative.breakdown.find(x=>x.code==='flower-set:0')?.tai,2);
assert.equal(alternative.breakdown.filter(x=>x.code.startsWith('flower:')).length,4);
assert.equal(alternative.breakdown.filter(x=>x.code.startsWith('flower:')).reduce((n,x)=>n+x.tai,0),4);
assert.ok(!alternative.breakdown.some(x=>x.code.startsWith('correct-flower:')));
});


test('R7-001 exhaustive zero-fee settlement never emits signed negative zero',()=>{
  const ledger=settleExhaustiveDraw(p);
  assert.deepEqual(ledger.playerDeltas,[0,0,0,0]); // strict Object.is
  assert.deepEqual(ledger.playerTransferDeltas,[0,0,0,0]);
  assert.equal(ledger.houseDelta,0);
  assert.ok(ledger.playerDeltas.every(value=>!Object.is(value,-0)));
  assert.ok(ledger.playerTransferDeltas.every(value=>!Object.is(value,-0)));
  assert.equal(assertLedgerConservation(ledger),true);
  const hydrated=JSON.parse(JSON.stringify(ledger));
  assert.deepEqual(hydrated,ledger);
  assert.equal(assertLedgerConservation(hydrated),true);
});
test('R7-001 explicitly configured zero fee, including input -0, normalizes every account',()=>{
  for(const fee of [0,-0]){
    const definition=structuredClone(p);
    definition.settlement.fee={mode:'fixed-per-player',points:fee};
    const custom=createScoringProfile(definition);
    for(const ledger of [settleExhaustiveDraw(custom),settleWinningHand(custom,fixture())]){
      assert.deepEqual(ledger.playerDeltas,[0,0,0,0]);
      assert.deepEqual(ledger.playerTransferDeltas,[0,0,0,0]);
      assert.deepEqual(ledger.fees.map(f=>f.points),[0,0,0,0]);
      assert.equal(ledger.houseDelta,0);
      assert.ok(!ledger.fees.some(f=>Object.is(f.points,-0)));
      assert.ok(!ledger.playerDeltas.some(x=>Object.is(x,-0)));
      assert.equal(assertLedgerConservation(ledger),true);
      assert.deepEqual(JSON.parse(JSON.stringify(ledger)),ledger);
    }
  }
});
test('R7-001 nonzero table fee: exhaustive and winner-ledger balance including JSON roundtrip',()=>{
  const definition=structuredClone(p);
  definition.settlement.fee={mode:'fixed-per-player',points:7};
  const custom=createScoringProfile(definition);
  for(const ledger of [settleExhaustiveDraw(custom),settleWinningHand(custom,fixture())]){
    assert.deepEqual(ledger.playerTransferDeltas,[0,0,0,0]);
    assert.deepEqual(ledger.playerDeltas,[-7,-7,-7,-7]);
    assert.equal(ledger.houseDelta,28);
    assert.equal(ledger.playerDeltas.reduce((n,x)=>n+x,0)+ledger.houseDelta,0);
    assert.equal(assertLedgerConservation(ledger),true);
    const hydrated=JSON.parse(JSON.stringify(ledger));
    assert.deepEqual(hydrated,ledger);
    assert.equal(assertLedgerConservation(hydrated),true);
  }
});
test('R7-001 ledger rejects forged signed-zero amounts rather than hiding them in JSON',()=>{
  const baseline=settleExhaustiveDraw(p);
  for(const path of [
    ledger=>ledger.playerDeltas[0]=-0,
    ledger=>ledger.playerTransferDeltas[2]=-0,
    ledger=>ledger.houseDelta=-0,
  ]){
    const ledger=structuredClone(baseline);
    path(ledger);
    assert.throws(()=>assertLedgerConservation(ledger),/Invalid ledger|Ledger/);
  }
  const definition=structuredClone(p);
  definition.settlement.fee={mode:'fixed-per-player',points:3};
  const ledger=settleExhaustiveDraw(createScoringProfile(definition));
  ledger.fees[0].points=-0;
  assert.throws(()=>assertLedgerConservation(ledger),/Invalid fee/);
});


const ROB_REF={profileId:'tw16-rob-added-kong',ruleVersion:'experimental-v1'};
const R7_CAPS={publicEventContractVersion:'tw16-rob-added-kong-public/1.0.0'};
function robAddedKongEvidence(){
  return fixture({ruleRef:ROB_REF,winningTile:'t:27:3',
    robAddedKong:{proposalEventId:'evt:r7-rob:5',fromSeat:0,tileId:'t:27:3'}});
}
function robAddedKongSettledSnapshot(){
  const marker={proposalEventId:'evt:r7-rob:5',fromSeat:0,tileId:'t:27:3'};
  const events=[
    {eventId:marker.proposalEventId,seq:5,type:'kong_proposed',
      visibility:'public',actorSeat:0,payload:{kind:'ADDED_KONG',tileId:marker.tileId}},
    {eventId:'evt:r7-rob:6',seq:6,type:'claim',visibility:'seat-private',
      actorSeat:1,payload:{kind:'win',claimEventId:marker.proposalEventId,
        tileIds:[marker.tileId]}},
    {eventId:'evt:r7-rob:7',seq:7,type:'pass',visibility:'seat-private',
      actorSeat:2,payload:{kind:'pass',claimEventId:marker.proposalEventId}},
    {eventId:'evt:r7-rob:8',seq:8,type:'pass',visibility:'seat-private',
      actorSeat:3,payload:{kind:'pass',claimEventId:marker.proposalEventId}},
    {eventId:'evt:r7-rob:9',seq:9,type:'win',visibility:'public',
      payload:{winnerSeat:1,sourceSeat:0,via:'discard',robAddedKong:structuredClone(marker)}},
    {eventId:'evt:r7-rob:10',seq:10,type:'settle',visibility:'public',
      payload:{reason:'win',winnerSeat:1,delta:[-120,120,0,0],
        robAddedKong:structuredClone(marker)}},
  ];
  return {ruleRef:ROB_REF,round:{phase:'settled',prevailingWind:'east',
      dealerSeat:3,handIndex:0,scores:[-120,120,0,0]},
    extensions:{tw16:{result:{reason:'win',winnerSeat:1,sourceSeat:0,via:'discard',
      winningTileId:marker.tileId,robAddedKong:structuredClone(marker),delta:[-120,120,0,0]}}},
    players:[
      {concealed:[],flowers:[],river:[{tileId:marker.tileId,seq:5}],
       melds:[{kind:'triplet',open:true,
         tileIds:['t:27:0','t:27:1','t:27:2']}]},
      {concealed:[3,4,5,9,10,11,12,13,14,18,19,20,27],
       flowers:[],melds:[{kind:'sequence',open:true,tileIds:[0,1,2]}]},
      {concealed:[],flowers:[],river:[],melds:[]},
      {concealed:[],flowers:[],river:[],melds:[]},
    ],events};
}
test('R7.1 rob-added-kong 1 tai: exclusively the kong declarer pays, not self-draw',()=>{
  const e=robAddedKongEvidence();
  const result=scoreWinningHand(p,e);
  assert.equal(result.tai,1);
  assert.deepEqual(result.breakdown.map(x=>x.code),['rob-added-kong']);
  assert.ok(result.breakdown[0].evidence.includes('evt:r7-rob:5'));
  for(const profile of [p,see]){
    const ledger=settleWinningHand(profile,e);
    assert.equal(ledger.payments.length,1);
    assert.deepEqual(ledger.playerTransferDeltas,[-1,1,0,0]);
    assert.equal(ledger.score.via,'discard');
    assert.equal(ledger.score.breakdown.find(x=>x.code==='rob-added-kong')?.tai,1);
    assert.equal(assertLedgerConservation(ledger),true);
    assert.deepEqual(JSON.parse(JSON.stringify(ledger)),ledger);
  }
});
test('R7.1 robbery is opt-in: forged/unsupported markers cannot alter R5 settlement',()=>{
  const e=robAddedKongEvidence();
  assert.throws(()=>scoreWinningHand(p,{...e,ruleRef:ref}),/rob-added-kong profile pin/);
  assert.throws(()=>scoreWinningHand(p,{...e,via:'self-draw',sourceSeat:1}),/rob-added-kong/);
  assert.throws(()=>scoreWinningHand(p,{...e,robAddedKong:{...e.robAddedKong,fromSeat:2}}),/provenance/);
  assert.throws(()=>scoreWinningHand(p,{...e,robAddedKong:{...e.robAddedKong,tileId:'t:27:2'}}),/provenance/);
  assert.throws(()=>scoreWinningHand(p,{...e,specialWin:'rob-kong'}),ScoringCapabilityError);
});
test('R7.1 real Rules Agent marker contract: ordered public proposal and single private winner',()=>{
  const snapshot=robAddedKongSettledSnapshot(),before=JSON.stringify(snapshot);
  assert.throws(()=>evidenceFromSettledRulesState(snapshot),ScoringCapabilityError);
  const evidence=evidenceFromSettledRulesState(snapshot,R7_CAPS);
  assert.deepEqual(evidence.robAddedKong,{proposalEventId:'evt:r7-rob:5',
    fromSeat:0,tileId:'t:27:3'});
  assert.equal(evidence.winningTile,'t:27:3');
  assert.equal(evidence.via,'discard');
  const ledger=settleRulesState(p,snapshot,R7_CAPS);
  assert.deepEqual(ledger.playerTransferDeltas,[-1,1,0,0]);
  assert.equal(assertLedgerConservation(ledger),true);
  assert.equal(JSON.stringify(snapshot),before,'read-only adapter must not change Rules state');
});
test('R7.1 robbery adapter rejects missing/tampered proposal, claim, marker, tile or payer',()=>{
  const attacks=[
    s=>{s.events[0].type='discard';},
    s=>{s.events[0].actorSeat=2;},
    s=>{s.events[0].payload.tileId='t:27:2';},
    s=>{s.events[1].visibility='public';},
    s=>{s.events[1].actorSeat=2;},
    s=>{s.events[1].payload.claimEventId='evt:other:3';},
    s=>{s.events[1].payload.tileIds=['t:27:2'];},
    s=>{s.events[1].payload.tileIds=[];},
    s=>{s.events[2].actorSeat=1;},
    s=>{s.events[2].visibility='public';},
    s=>{s.events[3].payload.claimEventId='evt:other:3';},
    s=>{s.events.splice(3,1);},
    s=>{s.events[2].payload.kind='win';},
    s=>{s.events[4].payload.robAddedKong.tileId='t:27:2';},
    s=>{s.events[5].payload.robAddedKong.fromSeat=2;},
    s=>{s.extensions.tw16.result.robAddedKong.tileId='t:27:2';},
    s=>{s.players[0].river=[];},
    s=>{s.players[0].melds[0].open=false;},
    s=>{s.players[0].concealed=['t:27:3'];},
    s=>{s.events.push({type:'kong',payload:{proposalEventId:'evt:r7-rob:5'}});},
    s=>{s.ruleRef=ref;},
  ];
  for(const attack of attacks){
    const snapshot=robAddedKongSettledSnapshot();attack(snapshot);
    assert.throws(()=>evidenceFromSettledRulesState(snapshot,R7_CAPS),
      /provenance|linkage|payer|terminal/i);
  }
});


test('R7.1 strict 平胡 requires five sequences, suited eye, no flowers/honor, discard and provable two-sided wait',()=>{
  const pre=[0,1,2,3,4,5,9,10,11,12,13,14,21,22,25,25];
  const e=fixture({concealed:pre,winningTile:23,melds:[]});
  const s=scoreWinningHand(p,e);
  assert.equal(s.breakdown.find(x=>x.code==='pinghu')?.tai,2);
  assert.ok(s.breakdown.some(x=>x.code==='concealed'));
  const alt=scoreWinningHand(see,e);
  assert.equal(alt.breakdown.find(x=>x.code==='pinghu')?.tai,2);
  assert.ok(!alt.breakdown.some(x=>x.code==='no-honors-no-flowers'));
  assert.ok(!scoreWinningHand(p,{...e,flowers:[f('season-spring')],seatWindType:27})
    .breakdown.some(x=>x.code==='pinghu'));
  const edge=fixture({concealed:[0,1,2,3,4,5,9,10,11,12,13,14,18,19,25,25],
    winningTile:20,melds:[]});
  assert.ok(!scoreWinningHand(p,edge).breakdown.some(x=>x.code==='pinghu'),
    '1-2 awaiting 3 is an edge wait, not two-sided');
  assert.ok(!scoreWinningHand(p,{...e,via:'self-draw',sourceSeat:1,
    winningTile:undefined,concealed:[...pre,23]}).breakdown.some(x=>x.code==='pinghu'));
});
test('R7.1 全求人 five open melds adds 2 tai without duplicating pair-wait tai',()=>{
  const melds=[[0,1,2],[3,4,5],[9,10,11],[12,13,14],[21,22,23]]
    .map(tileIds=>({kind:'sequence',open:true,tileIds}));
  const e=fixture({concealed:[25],winningTile:25,melds});
  const s=scoreWinningHand(p,e);
  assert.equal(s.breakdown.find(x=>x.code==='all-exposed')?.tai,2);
  assert.ok(!s.breakdown.some(x=>x.code==='pinghu'));
  const l=settleWinningHand(p,e);
  assert.equal(l.payments.length,1);
  assert.equal(l.playerTransferDeltas.reduce((n,x)=>n+x,0),0);
});


function supplementalWinSnapshot(kind){
  const flower=kind==='flower',kong=kind==='kong'||kind==='open-kong';
  const winningTile='t:18:0';
  const meld=kong?[{kind:'kong',open:kind==='open-kong',
    tileIds:['t:6:0','t:6:1','t:6:2','t:6:3']}]:[];
  const concealed=kong?[31,31,31,32,32,32,33,33,33,9,10,11,18,18]:dragons;
  const sourceEvent=kong?{
    eventId:'evt:supplement:1',seq:1,type:'kong',visibility:'public',actorSeat:1,
    payload:{kind:kind==='open-kong'?'kong':'CONCEALED_KONG',tileIds:meld[0].tileIds}
  }:flower?{
    eventId:'evt:supplement:1',seq:1,type:'flower',visibility:'seat-private',actorSeat:1,
    payload:{tileId:f('season-spring'),replacementTileId:winningTile}
  }:null;
  const drawEvent={eventId:'evt:supplement:2',seq:2,type:'draw',
    visibility:'seat-private',actorSeat:1,payload:{tileId:winningTile,
      source:kong?'tail':'live'}};
  const prior=flower?[{eventId:'evt:supplement:0',seq:0,type:'discard',actorSeat:0,
    visibility:'public',payload:{tileId:'t:2:0'}},sourceEvent]:
    kong?[sourceEvent]:[];
  const events=[...prior,...(flower?[]:[drawEvent]),
    {eventId:'evt:supplement:3',seq:3,type:'win',visibility:'public',
      payload:{winnerSeat:1,sourceSeat:1,via:'self-draw'}},
    {eventId:'evt:supplement:4',seq:4,type:'settle',visibility:'public',
      payload:{reason:'win',winnerSeat:1,delta:[0,0,0,0]}}];
  return {ruleRef:ref,round:{phase:'settled',prevailingWind:'east',dealerSeat:3,
    handIndex:0,scores:[0,0,0,0]},wall:Array(16).fill('reserved'),
    players:[{concealed:[],melds:[],flowers:[]},
      {concealed,flowers:flower?[f('season-spring')]:[],melds:meld},
      {concealed:[],melds:[],flowers:[]},{concealed:[],melds:[],flowers:[]}],
    events,extensions:{tw16:{lastDraw:{seat:1,tileId:winningTile,
      source:kong?'replacement':flower?'flower':'live'},
      result:{reason:'win',winnerSeat:1,sourceSeat:1,via:'self-draw',
        winningTileId:winningTile}}}};
}
test('R7.1 valid private concealed-kong supplement gives 槓上開花 1 and selfdraw payer three',()=>{
  const state=supplementalWinSnapshot('kong');
  const e=evidenceFromSettledRulesState(state);
  assert.equal(e.specialDraw?.kind,'kong-bloom');
  assert.equal(e.specialDraw?.drawEventId,'evt:supplement:2');
  const score=scoreRulesState(p,state);
  assert.equal(score.breakdown.find(x=>x.code==='kong-bloom')?.tai,1);
  const ledger=settleRulesState(p,state);
  assert.equal(ledger.payments.length,3);
  assert.equal(assertLedgerConservation(ledger),true);
});
test('R7.1 live last-draw 海底 1 needs authoritative reserve size and exact draw',()=>{
  const state=supplementalWinSnapshot('live');
  assert.equal(evidenceFromSettledRulesState(state).specialDraw?.kind,'sea-bottom');
  assert.equal(scoreRulesState(p,state).breakdown.find(x=>x.code==='sea-bottom')?.tai,1);
  state.wall.push('one more live tile');
  assert.equal(evidenceFromSettledRulesState(state).specialDraw,undefined);
  assert.ok(!scoreRulesState(p,state).breakdown.some(x=>x.code==='sea-bottom'));
});
test('R7.1 flower replacement wins after a discard can qualify, but initial setup remains unsupported',()=>{
  const state=supplementalWinSnapshot('flower');
  const e=evidenceFromSettledRulesState(state);
  assert.equal(e.specialDraw?.kind,'kong-bloom');
  assert.equal(scoreRulesState(p,state,{seatWindType:27}).breakdown.find(x=>x.code==='kong-bloom')?.tai,1);
  const initial=structuredClone(state);
  initial.events=initial.events.filter(x=>x.type!=='discard');
  assert.throws(()=>evidenceFromSettledRulesState(initial),ScoringCapabilityError);
});
test('R7.1 unreviewed open-kong selfdraw and corrupted draw provenance reject explicitly',()=>{
  assert.throws(()=>evidenceFromSettledRulesState(supplementalWinSnapshot('open-kong')),
    ScoringCapabilityError);
  const malformed=supplementalWinSnapshot('live');
  malformed.events[0].payload.source='unknown';
  assert.throws(()=>evidenceFromSettledRulesState(malformed),ScoringCapabilityError);
  const forged=supplementalWinSnapshot('kong');
  forged.events[1].payload.tileId='t:18:1';
  assert.throws(()=>evidenceFromSettledRulesState(forged),
    /Winning draw lacks matching private Rules event/);
});
