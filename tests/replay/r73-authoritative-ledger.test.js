import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyAuthoritativeLedger,ReplayError} from '../../src/replay/internal.js';
const golden=JSON.parse(readFileSync(new URL('./fixtures/r73-authoritative-ledgers.json',import.meta.url),'utf8'));
const cp=x=>JSON.parse(JSON.stringify(x));
// Scorer-contract fixtures only. The event reference stand-ins deliberately
// do not claim actual Rules legality; the real source integration gate is separate.
function context(x){
  const e=x.envelope,events=e.evidenceEventIds.map(id=>({eventId:id,gameId:e.gameId,seq:Number(id.split(':').at(-1))}));
  if(e.winType==='rob-added-kong')Object.assign(events[0],{type:'kong_proposed',actorSeat:e.evidence.sourceSeat,payload:{tileId:e.winningTileId}});
  return {gameId:e.gameId,roundId:e.roundId,sourceRevision:e.sourceRevision,events,reason:e.reason,
    winnerSeat:e.evidence?.winnerSeat??null,sourceSeat:e.evidence?.sourceSeat??null,winType:e.winType,
    robAddedKong:e.evidence?.robAddedKong};
}
test('R7.3 immutable authoritative Scoring output contract: ron, self-draw, robbery and draw',()=>{
  for(const x of golden.fixtures){
    assert.equal(verifyAuthoritativeLedger(x.ledger,context(x)),true);
    assert.equal(verifyAuthoritativeLedger(cp(x.ledger),context(x)),true);
  }
  assert.deepEqual(golden.fixtures.map(x=>x.ledger.playerDeltas),[[-1,1,0,0],[-2,7,-2,-3],[-2,2,0,0],[0,0,0,0]]);
});
test('R7.3 authoritative ledger rejects version, breakdown, payer, event reference and conservation corruption',()=>{
  for(const x of golden.fixtures){
    const mutations=[
      a=>delete a.scoringVersion,a=>a.scoringVersion='latest',
      a=>delete a.preSettlementContractVersion,a=>a.publicEventContractVersion='unknown',
      a=>a.scoringRef.version='latest',a=>a.ruleRef.ruleVersion='future',
      a=>a.roundId='wrong',a=>a.sourceRevision++,a=>a.evidenceEventIds.reverse(),
      a=>a.evidenceEventIds.push(a.evidenceEventIds.at(-1)),
      a=>a.evidenceEventIds=['evt:unknown:5'],a=>a.playerDeltas[0]+=1,
      a=>a.houseDelta=-0,a=>a.fees.push({seat:0,points:1}),a=>a.playerTransferDeltas[0]=-0
    ];
    if(x.ledger.reason==='win')mutations.push(
      a=>a.score.tai++,a=>a.score.breakdown[0].tai++,
      a=>a.payments[0].payerSeat=1,a=>a.payments[0].points++,
      a=>a.payments[0].appliedTai++,a=>a.payments.push(cp(a.payments[0])));
    for(const mutate of mutations){
      const bad=cp(x.ledger);mutate(bad);
      assert.throws(()=>verifyAuthoritativeLedger(bad,context(x)),e=>e instanceof ReplayError&&e.code==='INVALID_SETTLEMENT',String(mutate));
    }
  }
});
