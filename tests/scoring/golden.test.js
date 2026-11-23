import test from 'node:test';
import assert from 'node:assert/strict';
import {getScoringProfile,listScoringProfiles,createScoringProfile,scoreWinningHand,
settleWinningHand,settleExhaustiveDraw,assertLedgerConservation,
evidenceFromSettledRulesState,ScoringCapabilityError} from '../../src/scoring/index.js';
import {getRuleProfile,scoreWinningHand as legacyScore,settleWin as legacySettle}
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
