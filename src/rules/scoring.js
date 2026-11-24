/**
 * Explicit minimal experimental 16-tile table-scoring profile, NOT a claim that
 * these are the universal Taiwanese rules. Does not cover pattern fans, flower
 * fans, streaks, multi-winner settlement, special hands or liability penalties.
 * Uses abstract "points"; integration must not label them currency.
 */
const finiteNonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const source='docs/rules/TW16_TABLE_POLICY.md#minimal-scoring';
function configuration(profile){
  if(profile?.status!=='experimental'||profile?.scoringPolicy?.mode!=='configured'||profile?.scoringPolicy?.configRef!=='tw16-minimal-tai-v1')
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
    scoring.via!==via||!['self-draw','discard'].includes(via)||
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


/**
 * R7.3 Rules-owned host boundary. No scorer implementation, no UI callbacks,
 * no import of the post-settlement comparison adapter. The host binds Agent 3's
 * exact pure module; historical Rules never enter this path.
 */
export const AUTHORITATIVE_RULE_REF=Object.freeze({
  profileId:'tw16-authoritative-scoring',ruleVersion:'experimental-v1'});
export const AUTHORITATIVE_SCORING_REF=Object.freeze({
  profileId:'tw16-gametower-authoritative',version:'1.0.0-experimental'});
export const PRE_SETTLEMENT_CONTRACT='tw16-pre-settlement/1.0.0';
export const AUTHORITATIVE_SCORING_VERSION=AUTHORITATIVE_SCORING_REF.profileId+'@'+AUTHORITATIVE_SCORING_REF.version;
const SCORING_CONTRACT='tw16-scoring/1.0.0-experimental';
const PUBLIC_EVENT_CONTRACT='tw16-rob-added-kong-public/1.0.0';
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
const same=(a,b)=>{
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
const validInt=n=>Number.isSafeInteger(n)&&!Object.is(n,-0);
const seat=n=>Number.isInteger(n)&&n>=0&&n<4;
const fail=m=>{throw new RangeError('Invalid authoritative settlement: '+m)};
export const isAuthoritativeRule=ref=>same(ref,AUTHORITATIVE_RULE_REF);
const bindings=new WeakMap();

/** Only trusted host composition may construct this runtime. Never serialize it
 * or pass it to Bot/UI. Missing or mismatched scorer is an explicit failure.
 * Replay must bind the SAME reviewed scorer, not an archived callback.
 */
export function createSettlementRuntime(scoring){
  if(!scoring||scoring.SCORING_CONTRACT!==SCORING_CONTRACT||
    scoring.PRE_SETTLEMENT_CONTRACT!==PRE_SETTLEMENT_CONTRACT||scoring.PUBLIC_EVENT_CONTRACT!==PUBLIC_EVENT_CONTRACT||
    ['getScoringProfile','settlePreSettlement','assertLedgerConservation'].some(k=>typeof scoring[k]!=='function'))
    fail('missing compatible pure Scoring module');
  const profile=freeze(copy(scoring.getScoringProfile(AUTHORITATIVE_SCORING_REF.profileId,AUTHORITATIVE_SCORING_REF.version)));
  if(profile.profileId!==AUTHORITATIVE_SCORING_REF.profileId||
    profile.version!==AUTHORITATIVE_SCORING_REF.version||profile.contractVersion!==SCORING_CONTRACT||
    profile.status!=='experimental'||!profile.ruleRefs?.some(isAuthoritativeRule)||
    profile.settlement?.discard!=='discarder-only'||profile.settlement?.selfDraw!=='all-other-three'||
    profile.settlement?.liability!=='unsupported'||profile.settlement?.fee?.mode!=='none'||
    profile.settlement?.fee?.points!==0||profile.points?.unit!=='abstract-points')
    fail('unnegotiated profile/payer/fee policy');
  const runtime=Object.freeze({contractVersion:PRE_SETTLEMENT_CONTRACT,scoringVersion:AUTHORITATIVE_SCORING_VERSION});
  bindings.set(runtime,{profile,settle:scoring.settlePreSettlement,check:scoring.assertLedgerConservation});
  return runtime;
}
export function hasSettlementRuntime(runtime){return bindings.has(runtime)}
function binding(runtime){const b=bindings.get(runtime);if(!b)fail('missing trusted settlement runtime');return b}
function validateEnvelope(e){
  if(!e||e.contractVersion!==PRE_SETTLEMENT_CONTRACT||!isAuthoritativeRule(e.ruleRef)||
    !same(e.scoringRef,AUTHORITATIVE_SCORING_REF)||typeof e.gameId!=='string'||
    typeof e.roundId!=='string'||e.settlementId!==e.roundId||e.publicEventContractVersion!==PUBLIC_EVENT_CONTRACT||
    !validInt(e.sourceRevision)||e.sourceRevision<1||
    !Array.isArray(e.evidenceEventIds)||!e.evidenceEventIds.length||
    new Set(e.evidenceEventIds).size!==e.evidenceEventIds.length||
    e.evidenceEventIds.some(id=>typeof id!=='string'||!id.startsWith('evt:'+e.gameId+':'))||
    e.evidenceEventIds.at(-1)!=='evt:'+e.gameId+':'+e.sourceRevision)fail('evidence envelope');
  if(e.reason==='exhaustive-draw'){
    if(e.winType!==null||e.winningTileId!==null||e.evidence!==null||!same(e.payerSeats,[]))fail('draw evidence');
    return;
  }
  const x=e.evidence;
  if(e.reason!=='win'||!x||!same(x.ruleRef,e.ruleRef)||
    !seat(x.winnerSeat)||!seat(x.sourceSeat)||!seat(x.dealerSeat)||
    !['self-draw','discard','rob-added-kong'].includes(e.winType)||
    typeof e.winningTileId!=='string'||x.dealerStreak!==0||
    (e.winType==='self-draw'?(x.via!=='self-draw'||x.winnerSeat!==x.sourceSeat||x.winningTile!==undefined||x.robAddedKong!==undefined):
      (x.via!=='discard'||x.winnerSeat===x.sourceSeat||x.winningTile!==e.winningTileId))||
    (e.winType==='rob-added-kong'?!x.robAddedKong||x.robAddedKong.fromSeat!==x.sourceSeat||x.robAddedKong.tileId!==e.winningTileId:
      x.robAddedKong!==undefined))fail('winning evidence');
  const expected=e.winType==='self-draw'?[0,1,2,3].filter(s=>s!==x.winnerSeat):[x.sourceSeat];
  if(!same(e.payerSeats,expected))fail('payer authority');
}
export function validateSettlementLedger(runtime,envelope,ledger){
  const b=binding(runtime);validateEnvelope(envelope);
  if(!ledger||ledger.contractVersion!==SCORING_CONTRACT||
    ledger.scoringVersion!==AUTHORITATIVE_SCORING_VERSION||
    ledger.status!=='experimental-not-rule-certified'||ledger.unit!=='abstract-points'||
    ledger.reason!==envelope.reason||ledger.settlementId!==envelope.settlementId||
    ledger.gameId!==envelope.gameId||ledger.roundId!==envelope.roundId||ledger.sourceRevision!==envelope.sourceRevision||
    !same(ledger.ruleRef,envelope.ruleRef)||!same(ledger.scoringRef,envelope.scoringRef)||
    ledger.preSettlementContractVersion!==PRE_SETTLEMENT_CONTRACT||ledger.publicEventContractVersion!==PUBLIC_EVENT_CONTRACT||
    ledger.winType!==envelope.winType||!same(ledger.evidenceEventIds,envelope.evidenceEventIds)||!same(ledger.fees,[])||ledger.houseDelta!==0||
    !Array.isArray(ledger.payments)||!Array.isArray(ledger.playerDeltas)||
    !ledger.playerDeltas.every(validInt)||!same(ledger.playerDeltas,ledger.playerTransferDeltas))
    fail('ledger identity/zero-fee policy');
  if(b.check(ledger)!==true)fail('scorer conservation');
  const delta=[0,0,0,0],seen=new Set();
  if(envelope.reason==='win'){
    const x=envelope.evidence,score=ledger.score;
    if(ledger.winnerSeat!==x.winnerSeat||ledger.sourceSeat!==x.sourceSeat||
      !score||score.scoringVersion!==AUTHORITATIVE_SCORING_VERSION||
      !same(score.ruleRef,envelope.ruleRef)||score.winnerSeat!==x.winnerSeat||
      score.sourceSeat!==x.sourceSeat||score.via!==x.via||
      !validInt(score.tai)||score.tai<0||!Array.isArray(score.breakdown)||
      score.breakdown.some(i=>!validInt(i.tai)||i.tai<0)||
      score.breakdown.reduce((n,i)=>n+BigInt(i.tai),0n)!==BigInt(score.tai))
      fail('winner/score breakdown');
    for(const p of ledger.payments){
      if(!envelope.payerSeats.includes(p.payerSeat)||seen.has(p.payerSeat)||p.payeeSeat!==x.winnerSeat||
        !validInt(p.points)||p.points<0||p.handTai!==score.tai||
        !validInt(p.appliedTai)||!Array.isArray(p.dealerItems)||
        p.dealerItems.some(i=>!validInt(i.tai)||i.tai<0)||
        BigInt(p.appliedTai)!==BigInt(score.tai)+p.dealerItems.reduce((n,i)=>n+BigInt(i.tai),0n)||
        BigInt(p.points)!==BigInt(b.profile.points.base)+BigInt(p.appliedTai)*BigInt(b.profile.points.perTai))
        fail('payer ledger');
      seen.add(p.payerSeat);delta[p.payerSeat]-=p.points;delta[p.payeeSeat]+=p.points;
    }
    if(seen.size!==envelope.payerSeats.length)fail('missing payer');
  }else if(ledger.winnerSeat!==null||ledger.sourceSeat!==null||ledger.score!==null||ledger.payments.length)
    fail('draw must have no winner/payment');
  if(!delta.every(validInt)||!same(delta,ledger.playerDeltas)||delta.reduce((n,v)=>n+BigInt(v),0n)!==0n)
    fail('Rules independent zero-sum check');
  return true;
}
/** Evaluates the immutable, host-private snapshot BEFORE any WIN/SETTLE event
 * or score is committed. The scorer may throw; nothing is written here.
 */
export function evaluatePreSettlement(runtime,envelope,publicEvidenceEventIds){
  const b=binding(runtime),immutable=freeze(copy(envelope));
  validateEnvelope(immutable);
  const ledger=b.settle(b.profile,immutable);
  validateSettlementLedger(runtime,immutable,ledger);
  return freeze({evidence:immutable,ledger:copy(ledger),publicEvidenceEventIds:copy(publicEvidenceEventIds),scoringProfile:copy(b.profile)});
}
// Public attribution only. Never include scorer decomposition, evidence text,
// concealed tiles, private event IDs or private action IDs in the projection.
const publicItem=i=>({code:i.code,name:i.name,tai:i.tai,ruleVersion:i.ruleVersion,source:i.source,scope:i.scope});
export function publicSettlement(commit){
  const {evidence:e,ledger:l}=commit;
  return {contractVersion:PRE_SETTLEMENT_CONTRACT,settlementId:e.settlementId,
    scoringVersion:l.scoringVersion,status:l.status,unit:l.unit,reason:l.reason,
    winType:e.winType,winnerSeat:l.winnerSeat,sourceSeat:l.sourceSeat,
    payerSeats:[...e.payerSeats],publicEvidenceEventIds:[...commit.publicEvidenceEventIds],
    tai:l.score?.tai??0,breakdown:(l.score?.breakdown??[]).map(publicItem),
    payments:l.payments.map(p=>({payerSeat:p.payerSeat,payeeSeat:p.payeeSeat,
      points:p.points,handTai:p.handTai,appliedTai:p.appliedTai,dealerItems:p.dealerItems.map(publicItem)})),
    playerTransferDeltas:[...l.playerTransferDeltas],playerDeltas:[...l.playerDeltas],
    fees:[],houseDelta:0};
}
export function sameSettlement(a,b){return same(a,b)}

export function validateSettlementCommit(runtime,commit){
  if(!same(binding(runtime).profile,commit.scoringProfile))fail('scoring profile snapshot mismatch');
  return validateSettlementLedger(runtime,commit.evidence,commit.ledger);
}
