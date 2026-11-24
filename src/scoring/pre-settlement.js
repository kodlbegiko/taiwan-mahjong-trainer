import {getAuthoritativeScoringProfile,AUTHORITATIVE_RULE_REF,AUTHORITATIVE_SCORING_REF} from './profiles.js';
import {ScoringCapabilityError} from './evaluate.js';
import {settleWinningHand,settleExhaustiveDraw,assertLedgerConservation} from './settlement.js';

export const PRE_SETTLEMENT_CONTRACT='tw16-pre-settlement/1.0.0';
export const PUBLIC_EVENT_CONTRACT='tw16-rob-added-kong-public/1.0.0';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const seat=x=>Number.isInteger(x)&&x>=0&&x<4&&!Object.is(x,-0);
// Array#every skips holes. Host evidence must be dense JSON-shaped data,
// with no extra enumerable properties that serialization could silently drop.
const dense=x=>Array.isArray(x)&&Object.keys(x).length===x.length&&
  Array.from({length:x.length},(_,i)=>Object.hasOwn(x,i)).every(Boolean);
const text=x=>typeof x==='string'&&x.length>0;
const phys=x=>typeof x==='string'&&/^t:(0|[1-9]|[12][0-9]|3[0-3]):[0-3]$/.test(x);
const fail=message=>{throw new RangeError('Invalid pre-settlement evidence: '+message);};
const require=(ok,message)=>{if(!ok)fail(message);};
const capability=name=>{throw new ScoringCapabilityError(name);};
const fields=(o,allowed,required=allowed)=>isObject(o)&&
  Object.keys(o).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(o,k));
function same(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||
    Array.isArray(a)!==Array.isArray(b)||Object.keys(a).length!==Object.keys(b).length)return false;
  if(Array.isArray(a)&&(!dense(a)||!dense(b)||a.length!==b.length))return false;
  return Object.keys(a).every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
}
const immutable=x=>{
  if(x&&typeof x==='object'){Object.values(x).forEach(immutable);Object.freeze(x);}
  return x;
};
const envelopeFields=['contractVersion','ruleRef','scoringRef','publicEventContractVersion',
  'gameId','roundId','sourceRevision','settlementId','reason','winType','payerSeats',
  'evidence','evidenceEventIds','winningTileId'];
const factsRequired=['ruleRef','winnerSeat','sourceSeat','via','dealerSeat','dealerStreak',
  'concealed','melds','flowers','prevailingWindType'];
const factsAllowed=[...factsRequired,'winningTile','seatWindType','streakEvidence',
  'robAddedKong','specialDraw','specialWin','liability'];

/**
 * Trusted Rules-host-only pure synchronous settlement. Rules owns legal-action
 * issuance, complete raw-prefix validation, event ancestry and atomic commit.
 * This API deliberately accepts no GameState, previous score or settled event.
 * Event IDs are binding references, not cryptographic proof of a legal action.
 * Never use a user/UI supplied envelope as authority.
 */
export function settlePreSettlement(profile,envelope){
  if(!fields(envelope,envelopeFields))fail('exact envelope fields');
  if(envelope.contractVersion!==PRE_SETTLEMENT_CONTRACT)
    capability('pre-settlement-contract-version');
  if(envelope.publicEventContractVersion!==PUBLIC_EVENT_CONTRACT)
    capability('public-event-contract-version');
  if(!same(envelope.ruleRef,AUTHORITATIVE_RULE_REF))capability('authoritative-rule-profile');
  if(!same(envelope.scoringRef,AUTHORITATIVE_SCORING_REF))
    capability('authoritative-scoring-profile');
  const pinned=getAuthoritativeScoringProfile();
  if(!same(profile,pinned))capability('immutable-scoring-profile-configuration');
  const {gameId,roundId,sourceRevision,settlementId,reason,winType,
    payerSeats,evidence,evidenceEventIds,winningTileId}=envelope;
  require(typeof gameId==='string'&&/^[A-Za-z0-9_-]+$/.test(gameId)&&
    typeof roundId==='string'&&roundId.startsWith(gameId+'-round-')&&
    /^(0|[1-9][0-9]*)$/.test(roundId.slice((gameId+'-round-').length))&&
    settlementId===roundId,'round and settlement identity');
  require(Number.isSafeInteger(sourceRevision)&&sourceRevision>=1,
    'source revision');
  require(dense(evidenceEventIds)&&evidenceEventIds.length>0,
    'nonempty ordered raw event references');
  let last=0;
  for(const id of evidenceEventIds){
    const prefix='evt:'+gameId+':';
    require(typeof id==='string'&&id.startsWith(prefix)&&
      /^[1-9][0-9]*$/.test(id.slice(prefix.length)),'event reference identity');
    const seq=Number(id.slice(prefix.length));
    require(Number.isSafeInteger(seq)&&seq>last&&seq<=sourceRevision,
      'ordered unique event references within source revision');
    last=seq;
  }
  require(last===sourceRevision,'terminal legal-action prefix reference');
  require(dense(payerSeats)&&payerSeats.every(seat)&&
    new Set(payerSeats).size===payerSeats.length,'payer seats');
  let ledger;
  if(reason==='exhaustive-draw'){
    require(winType===null&&winningTileId===null&&evidence===null&&payerSeats.length===0,
      'draw must not carry winning facts or payers');
    ledger=settleExhaustiveDraw(pinned);
  }else if(reason==='win'){
    if(!fields(evidence,factsAllowed,factsRequired)){
      if(isObject(evidence)&&Object.keys(evidence).some(k=>!factsAllowed.includes(k)))
        capability('unknown-or-unverified-winning-fact');
      fail('missing required winning evidence');
    }
    require(same(evidence.ruleRef,envelope.ruleRef),'evidence RuleProfile mismatch');
    require(seat(evidence.winnerSeat)&&seat(evidence.sourceSeat)&&seat(evidence.dealerSeat),
      'winner/source/dealer seats');
    require([27,28,29,30].includes(evidence.prevailingWindType)&&
      (evidence.seatWindType===undefined||[27,28,29,30].includes(evidence.seatWindType)),
      'wind evidence');
    require(phys(winningTileId)&&dense(evidence.concealed)&&
      evidence.concealed.every(phys)&&dense(evidence.melds)&&
      evidence.melds.every(m=>fields(m,['kind','open','tileIds'])&&
        dense(m.tileIds)&&m.tileIds.every(phys)&&
        (m.open===true||m.kind==='kong'))&&dense(evidence.flowers),
      'physical winning-hand inventory and claimed melds');
    if(evidence.specialWin!==undefined&&evidence.specialWin!=='ordinary')
      capability(evidence.specialWin);
    if(evidence.liability!==undefined&&evidence.liability!==null)
      capability('bao-pai-or-special-liability');
    if(evidence.flowers.length===8)capability('flower-only-win');
    require(Number.isSafeInteger(evidence.dealerStreak)&&evidence.dealerStreak>=0&&
      evidence.dealerStreak<=10&&!Object.is(evidence.dealerStreak,-0),'explicit dealer streak within pinned policy');
    if(evidence.streakEvidence!==undefined){
      require(fields(evidence.streakEvidence,['roundRefs'])&&
        dense(evidence.streakEvidence.roundRefs)&&
        evidence.streakEvidence.roundRefs.length===evidence.dealerStreak&&
        evidence.streakEvidence.roundRefs.every(text)&&
        new Set(evidence.streakEvidence.roundRefs).size===evidence.dealerStreak,
        'auditable dealer streak references');
    }else require(evidence.dealerStreak===0,'missing continuing-dealer proof');
    const isRon=winType==='discard'||winType==='rob-added-kong';
    if(winType!=='self-draw'&&!isRon)capability('win-type');
    require(evidence.via===(isRon?'discard':'self-draw')&&
      (isRon?evidence.sourceSeat!==evidence.winnerSeat:evidence.sourceSeat===evidence.winnerSeat),
      'win type/source mismatch');
    const expected=isRon?[evidence.sourceSeat]:[0,1,2,3].filter(s=>s!==evidence.winnerSeat);
    require(same(payerSeats,expected),'canonical payer responsibility');
    if(isRon)require(evidence.winningTile===winningTileId,'claimed physical tile mismatch');
    else require(!Object.hasOwn(evidence,'winningTile')&&evidence.concealed.includes(winningTileId),
      'self-draw physical tile ownership');
    if(winType==='rob-added-kong'){
      const m=evidence.robAddedKong;
      require(fields(m,['proposalEventId','fromSeat','tileId'])&&
        m.fromSeat===evidence.sourceSeat&&m.tileId===winningTileId&&
        evidenceEventIds.includes(m.proposalEventId),'rob-added-kong proof/payer');
    }else require(evidence.robAddedKong===undefined,'unexpected robbery marker');
    if(evidence.specialDraw!==undefined){
      const s=evidence.specialDraw;
      require(winType==='self-draw'&&fields(s,['kind','drawEventId','sourceEventId'])&&
        evidenceEventIds.includes(s.drawEventId)&&evidenceEventIds.includes(s.sourceEventId),
        'special draw source links');
    }
    // Missing seat wind must never silently lose a wind/flower award. The
    // existing evaluator checks applicable facts; Rules supplies or rejects.
    ledger=settleWinningHand(pinned,{...evidence,
      ...(winType==='self-draw'?{selfDrawTile:winningTileId}:{})});
    require(same(ledger.payments.map(p=>p.payerSeat),payerSeats),'ledger payer mismatch');
  }else capability('settlement-reason');
  assertLedgerConservation(ledger);
  // No evidence object or private raw ledger escapes this boundary.
  return immutable({...ledger,settlementId,gameId,roundId,sourceRevision,
    ruleRef:{...AUTHORITATIVE_RULE_REF},scoringRef:{...AUTHORITATIVE_SCORING_REF},
    preSettlementContractVersion:PRE_SETTLEMENT_CONTRACT,
    publicEventContractVersion:PUBLIC_EVENT_CONTRACT,winType,
    evidenceEventIds:[...evidenceEventIds]});
}
