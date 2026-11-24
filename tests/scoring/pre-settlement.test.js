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

test('A11 pinned authority seeded property: 150 physical legal hands, seat rotation and JSON equality',()=>{
  let rng=0x357a97f5;
  const next=n=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return (rng>>>8)%n;};
  for(let i=0;i<150;i++){
    const counts=Array(34).fill(0),groups=[];
    for(let g=0;g<5;g++){
      let placed=false;
      for(let retry=0;retry<300&&!placed;retry++){
        const t=next(34),seq=t<27&&t%9<=6&&next(2)===0;
        const ts=seq?[t,t+1,t+2]:[t,t,t];
        if(!ts.every(x=>counts[x]+ts.filter(y=>x===y).length<=4))continue;
        groups.push({kind:seq?'sequence':'triplet',open:true,tileIds:ts.map(x=>'t:'+x+':'+counts[x]++)});placed=true;
      }
      assert.ok(placed);
    }
    let pair;for(let tries=0;tries<100;tries++){let t=next(34);if(counts[t]<=2){pair=t;break;}}
    assert.ok(pair!==undefined);
    const fixed=next(4),melds=groups.slice(0,fixed);
    const concealed=[...groups.slice(fixed).flatMap(m=>m.tileIds),'t:'+pair+':'+counts[pair]++,'t:'+pair+':'+counts[pair]++];
    const via=next(2)===0?'self-draw':'discard';
    const tile=concealed.at(-1);
    if(via==='discard')concealed.pop();
    const winnerSeat=next(4),sourceSeat=via==='self-draw'?winnerSeat:(winnerSeat+1)%4, dealerSeat=next(4);
    const payers=(w,s)=>via==='self-draw'?[0,1,2,3].filter(x=>x!==w):[s];
    const evidence={ruleRef,winnerSeat,sourceSeat,dealerSeat,dealerStreak:0,via,
      concealed,melds,flowers:[],seatWindType:28,prevailingWindType:27,
      ...(via==='discard'?{winningTile:tile}:{})};
    const x=fixture({winType:via,payerSeats:payers(winnerSeat,sourceSeat),evidence,winningTileId:tile});
    const l=evalWin(x);
    assert.equal(assertLedgerConservation(l),true);
    assert.deepEqual(evalWin(JSON.parse(JSON.stringify(x))),l);
    assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
    assert.ok(l.playerDeltas.every(v=>!Object.is(v,-0)));
    const rotate=s=>(s+1)%4;
    const rotated=evalWin({...x,payerSeats:payers(rotate(winnerSeat),rotate(sourceSeat)),
      evidence:{...evidence,winnerSeat:rotate(winnerSeat),sourceSeat:rotate(sourceSeat),dealerSeat:rotate(dealerSeat)}});
    for(let s=0;s<4;s++)assert.equal(rotated.playerDeltas[rotate(s)],l.playerDeltas[s]);
  }
});
test('A12 actual winning tile structural two-sided Pinghu excludes the unique-wait bonus',()=>{
  const x=fixture();
  const ts=[0,1,2,3,4,5,9,10,11,12,13,14,21,22,25,25];
  const counts=Array(34).fill(0);
  x.evidence={...x.evidence,concealed:ts.map(t=>'t:'+t+':'+counts[t]++),
    melds:[],winningTile:'t:23:0'};
  x.winningTileId='t:23:0';
  const score=evalWin(x).score;
  assert.equal(score.breakdown.find(i=>i.code==='pinghu')?.tai,2);
  assert.ok(!score.breakdown.some(i=>i.code==='unique-wait'));
});
test('A13 special draw proof references must belong to the same pre-terminal prefix',()=>{
  const x=fixture();x.winType='self-draw';x.payerSeats=[0,2,3];
  x.evidence={...x.evidence,via:'self-draw',sourceSeat:1,concealed:[...hand,winTile],
    specialDraw:{kind:'kong-bloom',sourceEventId:'evt:auth:1',drawEventId:'evt:auth:5'}};
  delete x.evidence.winningTile;
  assert.equal(evalWin(x).score.breakdown.find(i=>i.code==='kong-bloom')?.tai,1);
  x.evidence.specialDraw={kind:'sea-bottom',sourceEventId:'evt:auth:5',drawEventId:'evt:auth:5'};
  assert.equal(evalWin(x).score.breakdown.find(i=>i.code==='sea-bottom')?.tai,1);
  x.evidence.specialDraw.drawEventId='evt:auth:4';
  assert.throws(()=>evalWin(x),/source links/);
});
test('A14 exposed dragon does not require nonexistent seat wind proof, but exposed wind does',()=>{
  const x=fixture();
  x.evidence={...x.evidence,melds:[{kind:'triplet',open:true,tileIds:['t:31:0','t:31:1','t:31:2']}]};
  const l=evalWin(x);
  assert.equal(l.score.breakdown.find(i=>i.code==='dragon:31')?.tai,1);
  x.evidence.melds=[{kind:'triplet',open:true,tileIds:['t:28:0','t:28:1','t:28:2']}];
  assert.throws(()=>evalWin(x),/wind proofs/);
});
