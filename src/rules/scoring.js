/**
 * Explicit minimal experimental 16-tile table-scoring profile, NOT a claim that
 * these are the universal Taiwanese rules. Does not cover pattern fans, flower
 * fans, streaks, multi-winner settlement, special hands or liability penalties.
 * Uses abstract "points"; integration must not label them currency.
 */
const finiteNonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const source='docs/rules/TW16_TABLE_POLICY.md#minimal-scoring';
function configuration(profile){
  if(profile?.status!=='experimental'||profile?.scoringPolicy?.configRef!=='tw16-minimal-tai-v1')
    throw new RangeError('Unsupported or unverified ScoringPolicy');
  const s=profile.extensions?.tw16?.scoring;
  if(!s||Object.values(s).some(v=>!finiteNonnegative(v)))
    throw new RangeError('Invalid scoring configuration');
  return s;
}
export function scoreWinningHand(profile,player,{winnerSeat,sourceSeat,via,dealerSeat}={}){
  const s=configuration(profile);
  if(!player||!Array.isArray(player.melds)||
    ![0,1,2,3].includes(winnerSeat)||![0,1,2,3].includes(sourceSeat)||
    ![0,1,2,3].includes(dealerSeat)||!['self-draw','discard'].includes(via)||
    (via==='discard'&&winnerSeat===sourceSeat)||
    (via==='self-draw'&&winnerSeat!==sourceSeat))
    throw new RangeError('Invalid winner or scoring context');
  const concealed=player.melds.every(m=>!m.open);
  const breakdown=[];
  if(concealed)breakdown.push({code:'concealed',tai:s.concealedTai,source});
  if(via==='self-draw'){
    breakdown.push({code:'self-draw',tai:s.selfDrawTai,source});
    if(concealed)breakdown.push({code:'concealed-self-draw-bonus',
      tai:s.concealedSelfDrawBonusTai,source});
  }
  const codes=breakdown.map(x=>x.code);
  if(new Set(codes).size!==codes.length||
    (codes.includes('concealed-self-draw-bonus')&&
      (!codes.includes('concealed')||!codes.includes('self-draw'))))
    throw new RangeError('Scoring conflict or illegal stacking');
  return {scoringVersion:profile.scoringPolicy.configRef,via,
    tai:breakdown.reduce((sum,item)=>sum+item.tai,0),
    breakdown,calibration:'experimental-table-profile',limitations:[
      'Only concealed, self-draw, and their explicit stacking bonus are counted.',
      'No wind, dragon, flower, sequence, pong-pong, special hand, rob-kong or dealer streak tai.',
    ]};
}
export function settleWin(profile,scoring,{winnerSeat,sourceSeat,via,dealerSeat}={}){
  const s=configuration(profile);
  if(!scoring||scoring.scoringVersion!==profile.scoringPolicy.configRef||
    !finiteNonnegative(scoring.tai))throw new RangeError('Missing scored winning hand');
  const payers=via==='self-draw'?[0,1,2,3].filter(x=>x!==winnerSeat):[sourceSeat];
  if(![0,1,2,3].includes(winnerSeat)||!payers.every(x=>[0,1,2,3].includes(x)&&x!==winnerSeat))
    throw new RangeError('Invalid payment seats');
  const delta=[0,0,0,0],payments=[];
  for(const payer of payers){
    const dealerTai=(winnerSeat===dealerSeat||payer===dealerSeat)
      ?s.dealerInteractionTai:0;
    const value=s.basePoints+(scoring.tai+dealerTai)*s.pointsPerTai;
    if(!finiteNonnegative(value))throw new RangeError('Invalid settlement amount');
    delta[payer]-=value;delta[winnerSeat]+=value;
    payments.push({payerSeat:payer,payeeSeat:winnerSeat,points:value,
      appliedTai:scoring.tai,dealerInteractionTai:dealerTai});
  }
  if(delta.reduce((n,v)=>n+v,0)!==0)throw new RangeError('Settlement is not zero sum');
  return {scoringVersion:profile.scoringPolicy.configRef,unit:'abstract-points',
    delta,payments,limitations:['Experimental house score; no real-money interpretation.']};
}
