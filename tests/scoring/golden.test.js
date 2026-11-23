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
