import {scoreWinningHand,ScoringCapabilityError} from './evaluate.js';
import {SCORING_CONTRACT,validateScoringProfile} from './profiles.js';
// Canonicalize signed zero at the accounting boundary, never in expected test values.
const canonical=x=>x===0?0:x;
const valid=x=>Number.isSafeInteger(x)&&!Object.is(x,-0);
const addSafe=(a,b)=>{const n=canonical(a+b);if(!valid(n))throw new RangeError('Settlement integer overflow');return n;};
export function assertLedgerConservation(ledger){
  if(!ledger||!Array.isArray(ledger.playerTransferDeltas)||
    ledger.playerTransferDeltas.length!==4||!ledger.playerTransferDeltas.every(valid)||
    !Array.isArray(ledger.playerDeltas)||ledger.playerDeltas.length!==4||
    !ledger.playerDeltas.every(valid)||!valid(ledger.houseDelta)||
    !Array.isArray(ledger.payments)||
    !ledger.payments.every(p=>Number.isInteger(p.payerSeat)&&
      p.payerSeat>=0&&p.payerSeat<4&&Number.isInteger(p.payeeSeat)&&
      p.payeeSeat>=0&&p.payeeSeat<4&&p.payerSeat!==p.payeeSeat&&valid(p.points)&&p.points>=0))
    throw new RangeError('Invalid ledger entries');
  const expected=[0,0,0,0];
  for(const pay of ledger.payments){
    expected[pay.payerSeat]=addSafe(expected[pay.payerSeat],-pay.points);
    expected[pay.payeeSeat]=addSafe(expected[pay.payeeSeat],pay.points);
  }
  if(expected.some((v,i)=>v!==ledger.playerTransferDeltas?.[i]))
    throw new RangeError('Mismatch between transfers and playerTransferDeltas');
  if(expected.reduce(addSafe,0)!==0)
    throw new RangeError('Player-only settlement not zero sum');
  const fees=ledger.fees||[];
  if(!Array.isArray(fees)||fees.some(f=>!Number.isInteger(f.seat)||f.seat<0||f.seat>3||
    !valid(f.points)||f.points<0))throw new RangeError('Invalid fee entries');
  const net=[...expected];let house=0;
  for(const f of fees){net[f.seat]=addSafe(net[f.seat],-f.points);
    house=addSafe(house,f.points);}
  if(net.some((n,i)=>n!==ledger.playerDeltas[i])||house!==ledger.houseDelta||
    addSafe(net.reduce(addSafe,0),house)!==0)
    throw new RangeError('Ledger/house conservation failed');
  return true;
}
function settle(profile,score,evidence){
  const payerSeats=score.via==='self-draw'
    ?[0,1,2,3].filter(x=>x!==score.winnerSeat):[score.sourceSeat];
  const points=profile.points,td=profile.tai;
  const payments=payerSeats.map(payerSeat=>{
    const dealerInvolved=score.winnerSeat===evidence.dealerSeat||
      payerSeat===evidence.dealerSeat;
    const dealerItems=dealerInvolved?[
      {code:'dealer',name:'莊家',tai:td.dealer,evidence:'dealer in this payment',
        ruleVersion:score.scoringVersion,source:profile.sourceRefs[0],scope:'payment'},
      ...(evidence.dealerStreak>0?[{code:'dealer-streak',
        name:'連莊',tai:td.dealerStreakEach*evidence.dealerStreak,
        evidence:'streak count '+evidence.dealerStreak+'; roundRefs '+evidence.streakEvidence.roundRefs.join(','),
        ruleVersion:score.scoringVersion,source:profile.sourceRefs[0],scope:'payment'}]:[]),
    ].filter(x=>x.tai>0):[];
    const appliedTai=addSafe(score.tai,dealerItems.reduce((n,x)=>addSafe(n,x.tai),0));
    const amount=addSafe(points.base,appliedTai*points.perTai);
    if(!valid(amount))throw new RangeError('Settlement integer overflow');
    return {payerSeat,payeeSeat:score.winnerSeat,points:amount,
      handTai:score.tai,appliedTai,dealerItems};
  });
  const playerTransferDeltas=[0,0,0,0];
  for(const x of payments){
    playerTransferDeltas[x.payerSeat]=addSafe(playerTransferDeltas[x.payerSeat],-x.points);
    playerTransferDeltas[x.payeeSeat]=addSafe(playerTransferDeltas[x.payeeSeat],x.points);
  }
  const fees=profile.settlement.fee.mode==='none'?[]:
    [0,1,2,3].map(seat=>({seat,points:canonical(profile.settlement.fee.points),
      reason:'independently-configured-table-fee'}));
  const playerDeltas=[...playerTransferDeltas];
  for(const fee of fees)playerDeltas[fee.seat]=addSafe(playerDeltas[fee.seat],-fee.points);
  const houseDelta=fees.reduce((s,x)=>addSafe(s,x.points),0);
  const result={contractVersion:SCORING_CONTRACT,scoringVersion:score.scoringVersion,
    status:'experimental-not-rule-certified',unit:'abstract-points',
    reason:'win',winnerSeat:score.winnerSeat,sourceSeat:score.sourceSeat,
    score,payments,playerTransferDeltas,fees,houseDelta,playerDeltas};
  assertLedgerConservation(result);return result;
}
export function settleWinningHand(profile,evidence){
  validateScoringProfile(profile);
  if(evidence?.liability!==undefined&&evidence.liability!==null)
    throw new ScoringCapabilityError('bao-pai-or-special-liability');
  return settle(profile,scoreWinningHand(profile,evidence),evidence);
}
export function settleExhaustiveDraw(profile){
  validateScoringProfile(profile);
  const fees=profile.settlement.fee.mode==='none'?[]:
    [0,1,2,3].map(seat=>({seat,points:canonical(profile.settlement.fee.points),
      reason:'independently-configured-table-fee'}));
  const result={contractVersion:SCORING_CONTRACT,
    scoringVersion:profile.profileId+'@'+profile.version,
    status:'experimental-not-rule-certified',unit:'abstract-points',
    reason:'exhaustive-draw',winnerSeat:null,sourceSeat:null,
    score:null,payments:[],playerTransferDeltas:[0,0,0,0],fees,
    houseDelta:fees.reduce((n,x)=>addSafe(n,x.points),0),
    playerDeltas:[0,1,2,3].map(()=>canonical(-profile.settlement.fee.points))};
  assertLedgerConservation(result);return result;
}
