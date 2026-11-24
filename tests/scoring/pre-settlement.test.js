import test from 'node:test';
import assert from 'node:assert/strict';
import {getScoringProfile,getAuthoritativeScoringProfile,listScoringProfiles,
  PRE_SETTLEMENT_CONTRACT,PUBLIC_EVENT_CONTRACT,settlePreSettlement,
  assertLedgerConservation,ScoringCapabilityError} from '../../src/scoring/index.js';
const profile=getAuthoritativeScoringProfile();
const ruleRef={profileId:'tw16-authoritative-scoring',ruleVersion:'experimental-v1'};
const scoringRef={profileId:'tw16-gametower-authoritative',version:'1.0.0-experimental'};
const hand=[3,4,5,9,10,11,12,13,14,18,19,20,27].map(t=>'t:'+t+':0');
const winTile='t:27:1';
const fixture=(extra={})=>({
  contractVersion:PRE_SETTLEMENT_CONTRACT,ruleRef,scoringRef,
  publicEventContractVersion:PUBLIC_EVENT_CONTRACT,gameId:'auth',
  roundId:'auth-round-0',sourceRevision:5,settlementId:'auth-round-0',
  reason:'win',winType:'discard',payerSeats:[0],
  evidence:{ruleRef,winnerSeat:1,sourceSeat:0,via:'discard',dealerSeat:3,dealerStreak:0,
    concealed:hand,melds:[{kind:'sequence',open:true,tileIds:['t:0:0','t:1:0','t:2:0']}],
    flowers:[],winningTile:winTile,prevailingWindType:27},
  evidenceEventIds:['evt:auth:1','evt:auth:5'],winningTileId:winTile,...extra
});
const evalWin=x=>settlePreSettlement(profile,x);
const draw=()=>fixture({reason:'exhaustive-draw',winType:null,payerSeats:[],
  evidence:null,winningTileId:null});
test('A01 explicit authoritative registration preserves the two historical comparison presets',()=>{
  assert.equal(listScoringProfiles().length,2);
  assert.deepEqual(getScoringProfile(scoringRef.profileId,scoringRef.version),profile);
  assert.ok(Object.isFrozen(profile.tai));assert.ok(Object.isFrozen(profile.ruleRefs[0]));
});
test('A02 pre-settlement ron is immutable, deterministic, never requires committed scores',()=>{
  const x=fixture(),before=JSON.stringify(x);
  const l=evalWin(x);
  assert.equal(l.score.tai,1);
  assert.equal(l.score.breakdown.find(i=>i.code==='unique-wait')?.tai,1);
  assert.deepEqual(l.playerDeltas,[-1,1,0,0]);
  assert.deepEqual(l.payments.map(p=>p.payerSeat),[0]);
  assert.equal(l.settlementId,x.roundId);
  assert.equal(JSON.stringify(x),before);assert.ok(Object.isFrozen(l.score.breakdown));
  assert.deepEqual(evalWin(JSON.parse(before)),l);
  assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
  assert.ok(!Object.hasOwn(l,'evidence'));
  assert.equal(assertLedgerConservation(l),true);
});
test('A03 self-draw uses actual owned winning tile and exactly three other payers',()=>{
  const x=fixture();x.winType='self-draw';x.payerSeats=[0,2,3];
  x.evidence={...x.evidence,via:'self-draw',sourceSeat:1,concealed:[...hand,winTile]};
  delete x.evidence.winningTile;
  const l=evalWin(x);
  assert.deepEqual(l.playerDeltas,[-2,7,-2,-3]);
  assert.equal(l.score.tai,2);
  assert.equal(l.payments.find(p=>p.payerSeat===3).appliedTai,3);
  assert.equal(assertLedgerConservation(l),true);
});
test('A04 robbery requires explicit marker and sole declarer, never three payers',()=>{
  const x=fixture({winType:'rob-added-kong'});
  x.evidence={...x.evidence,robAddedKong:{proposalEventId:'evt:auth:1',fromSeat:0,tileId:winTile}};
  const l=evalWin(x);
  assert.equal(l.score.breakdown.find(i=>i.code==='rob-added-kong')?.tai,1);
  assert.deepEqual(l.playerDeltas,[-2,2,0,0]);
  assert.throws(()=>evalWin({...x,payerSeats:[0,2,3]}),/payer/);
  assert.throws(()=>evalWin({...x,evidence:{...x.evidence,robAddedKong:{...x.evidence.robAddedKong,proposalEventId:'evt:auth:2'}}}),/proof/);
});
test('A05 exhaustive draw returns strict positive zero and serializable empty ledger',()=>{
  const l=evalWin(draw());
  assert.deepEqual(l.playerDeltas,[0,0,0,0]);assert.equal(l.houseDelta,0);
  assert.ok(l.playerDeltas.every(x=>!Object.is(x,-0)));
  assert.deepEqual(l.payments,[]);assert.deepEqual(l.fees,[]);
  assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
  assert.equal(assertLedgerConservation(l),true);
});
test('A06 all versions, unknown/missing fields and altered profile fail closed',()=>{
  for(const x of [
    {...fixture(),contractVersion:'bad'},
    {...fixture(),publicEventContractVersion:'bad'},
    {...fixture(),ruleRef:{profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'}},
    {...fixture(),scoringRef:{...scoringRef,version:'latest'}},
  ])assert.throws(()=>evalWin(x),ScoringCapabilityError);
  const omitted=fixture();delete omitted.publicEventContractVersion;
  assert.throws(()=>evalWin(omitted),/fields/);
  assert.throws(()=>evalWin({...fixture(),scores:[0,0,0,0]}),/fields/);
  const tampered=structuredClone(profile);tampered.tai.dealer++;
  assert.throws(()=>settlePreSettlement(tampered,fixture()),ScoringCapabilityError);
  const fee=structuredClone(profile);fee.settlement.fee={mode:'fixed-per-player',points:7};
  assert.throws(()=>settlePreSettlement(fee,draw()),ScoringCapabilityError);
  assert.throws(()=>settlePreSettlement(getScoringProfile('tw16-gametower-comparative'),fixture()),ScoringCapabilityError);
});
test('A07 source binding rejects stale, duplicate, out-of-order, foreign and missing references',()=>{
  for(const evidenceEventIds of [
    [],['evt:other:5'],['evt:auth:1','evt:auth:1','evt:auth:5'],
    ['evt:auth:5','evt:auth:1'],['evt:auth:6'],['evt:auth:4'],
  ])assert.throws(()=>evalWin({...fixture(),evidenceEventIds}),/reference/);
  assert.throws(()=>evalWin({...fixture(),settlementId:'other'}),/identity/);
  assert.throws(()=>evalWin({...fixture(),winningTileId:'t:27:2'}),/tile mismatch/);
});
test('A08 dealer and verified continuing-dealer components are scoped per payment',()=>{
  const x=fixture();x.evidence={...x.evidence,dealerSeat:0,dealerStreak:2,
    streakEvidence:{roundRefs:['prior1','prior2']}};
  const l=evalWin(x);assert.deepEqual(l.playerDeltas,[-6,6,0,0]);
  assert.deepEqual(l.payments[0].dealerItems.map(i=>i.tai),[1,4]);
  assert.throws(()=>evalWin({...x,evidence:{...x.evidence,streakEvidence:undefined}}),/proof/);
});
test('A09 flower, unknown wait, and unsupported liability facts cannot silently disappear',()=>{
  const x=fixture();x.evidence={...x.evidence,flowers:['f:season-spring:0']};
  assert.throws(()=>evalWin(x),/seat wind/);
  x.evidence.seatWindType=27;
  assert.equal(evalWin(x).score.breakdown.find(i=>i.code==='correct-flower:season-spring')?.tai,1);
  for(const extra of [{waitShape:'pair'},{specialWin:'heaven'},{liability:{payerSeat:3}}])
    assert.throws(()=>evalWin({...x,evidence:{...x.evidence,...extra}}),ScoringCapabilityError);
});
test('A10 全求人 supersedes unique wait, physical types and duplicate ids are checked',()=>{
  const x=fixture();x.winningTileId='t:25:1';
  x.evidence={...x.evidence,concealed:['t:25:0'],winningTile:x.winningTileId,
    melds:[[0,1,2],[3,4,5],[9,10,11],[12,13,14],[21,22,23]].map(ts=>({
      kind:'sequence',open:true,tileIds:ts.map(t=>'t:'+t+':0')}))};
  const l=evalWin(x);
  assert.equal(l.score.breakdown.find(i=>i.code==='all-exposed')?.tai,2);
  assert.ok(!l.score.breakdown.some(i=>i.code==='unique-wait'));
  assert.throws(()=>evalWin({...x,evidence:{...x.evidence,concealed:[25]}}),/physical/);
  assert.throws(()=>evalWin({...x,winningTileId:'t:25:0',
    evidence:{...x.evidence,winningTile:'t:25:0'}}),/previously owned/);
});
