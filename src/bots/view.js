/**
 * Bot-only extension for the experimental R3 initial-flower boundary.
 * The V1 Strategy validator expects 16/17 nonflower tiles and consequently
 * cannot read a dealer hand still holding physical flowers.  Never weaken
 * that canonical validator: use this narrow fail-closed replacement adapter.
 */
import { readPlayerView, isRobAddedKongRuleRef, isAuthoritativeRuleRef, validateRobKongPublicEvent } from '../strategy/view.js';

// Exact, versioned table profiles only. Never infer policy from a profile name
// prefix or accept an unreviewed future version.
export function isSupportedBotTableProfile(ref) {
  return (ref?.profileId === 'tw16-configurable-table' &&
    ref?.ruleVersion === 'experimental-full-v1') ||
    (ref?.profileId === 'tw16-single-winner-interception' &&
    ref?.ruleVersion === 'experimental-v1') || isRobAddedKongRuleRef(ref);
}

const rootKeys = ['schemaVersion','contractVersion','viewId','gameId','ruleRef',
  'audienceSeat','asOfEventSeq','round','self','opponents','publicEvents',
  'legalActions','knownUnavailableTypes','capabilities'];
const roundKeys = ['schemaVersion','contractVersion','roundId','handIndex',
  'dealerSeat','currentSeat','phase','prevailingWind','roundWind','scores','lastPublicEventSeq'];
const publicEventKeys = ['schemaVersion','contractVersion','eventId','gameId','seq',
  'ruleRef','actorSeat','type','visibility','payload','causedByActionId',
  'previousEventId','occurredAt'];
const publicPayloadKeys = ['seat','tileId','tileIds','kind','claimEventId',
  'concealedCount','reasonCode','sourceSeat','count','countsBySeat'];
const actionKeys = ['schemaVersion','contractVersion','actionId','kind',
  'actorSeat','expectedRevision','tileIds','claimEventId','ruleRef','legalityBasis'];
const allow = (obj, keys, label) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) ||
      Object.getPrototypeOf(obj) !== Object.prototype ||
      Object.keys(obj).some(key => !keys.includes(key)))
    throw new TypeError('Nonpublic '+label+' fields in Bot PlayerView');
};
const required = (cond, message) => {
  if (!cond) throw new RangeError('Invalid R3 flower PlayerView: '+message);
};
const validId = t => t && t.schemaVersion === 1 &&
  t.contractVersion === 'master-academy/1.0.0' &&
  typeof t.id === 'string' && Number.isInteger(t.copyIndex) &&
  (t.kind === 'flower' ?
    t.id === 'f:'+t.flowerCode+':'+t.copyIndex &&
      /^[a-z][a-z0-9-]*$/.test(t.flowerCode) && !('tileType' in t) :
    t.kind === 'standard' && Number.isInteger(t.tileType) &&
      t.tileType >= 0 && t.tileType <= 33 &&
      t.copyIndex >= 0 && t.copyIndex <= 3 &&
      t.id === 't:'+t.tileType+':'+t.copyIndex && !('flowerCode' in t));

/** Deep-detach, rejecting accessor properties, prototypes, symbols and cycles. */
function detached(input) {
  const seen = new WeakSet();
  const visit = (x, depth = 0) => {
    if (depth > 64) throw new RangeError('PlayerView nesting too deep');
    if (x === null || typeof x === 'string' || typeof x === 'boolean' ||
        (typeof x === 'number' && Number.isFinite(x))) return x;
    if (!x || typeof x !== 'object' ||
        (!Array.isArray(x) && Object.getPrototypeOf(x) !== Object.prototype) ||
        seen.has(x)) throw new TypeError('Non-JSON or cyclic PlayerView');
    seen.add(x);
    const out = Array.isArray(x) ? [] : {};
    const keys = Reflect.ownKeys(x);
    if (Array.isArray(x)) {
      required(keys.every(k => k === 'length' ||
        (typeof k === 'string' && /^(0|[1-9][0-9]*)$/.test(k))) &&
        keys.length === x.length + 1, 'array metadata');
      for (let i = 0; i < x.length; i++) {
        const d = Object.getOwnPropertyDescriptor(x, ''+i);
        required(d && 'value' in d, 'array accessor/hole');
        out.push(visit(d.value, depth+1));
      }
    } else for (const k of keys) {
      const d = Object.getOwnPropertyDescriptor(x, k);
      required(typeof k === 'string' && d?.enumerable && 'value' in d,
        'object accessor/hidden field');
      Object.defineProperty(out,k,{value:visit(d.value,depth+1),
        enumerable:true,configurable:true,writable:true});
    }
    seen.delete(x);
    return out;
  };
  return visit(input);
}
function checkPublicZones(p) {
  for (const meld of p.melds) {
    allow(meld,['kind','tileIds','open','sourceSeat','sourceEventId'],'meld');
    required(['sequence','triplet','kong'].includes(meld.kind) &&
      typeof meld.open==='boolean' && Array.isArray(meld.tileIds) &&
      meld.tileIds.length===(meld.kind==='kong'?4:3) &&
      meld.tileIds.every(id=>/^t:(?:[0-9]|[12][0-9]|3[0-3]):[0-3]$/.test(id)),
      'public meld');
  }
  for (const river of p.river) {
    allow(river,['tileId','seq','claimedByEventId'],'river');
    required(typeof river.tileId==='string' &&
      /^t:(?:[0-9]|[12][0-9]|3[0-3]):[0-3]$/.test(river.tileId) &&
      Number.isInteger(river.seq), 'river physical tile');
  }
  for (const t of p.flowers) {
    allow(t,['schemaVersion','contractVersion','id','kind',
      'flowerCode','copyIndex'],'public flower');
    required(validId(t)&&t.kind==='flower','public flower identity');
  }
}
function replacementView(input) {
  const v = detached(input);
  allow(v,rootKeys,'root');allow(v.round,roundKeys,'round');
  allow(v.ruleRef,['profileId','ruleVersion'],'ruleRef');
  required(v.schemaVersion===1 && v.contractVersion==='master-academy/1.0.0' &&
    isSupportedBotTableProfile(v.ruleRef) &&
    v.round.phase==='replacement', 'R3 profile/phase');
  required(typeof v.gameId==='string' && v.gameId.length>0 &&
    typeof v.viewId==='string' && Number.isInteger(v.asOfEventSeq) &&
    v.asOfEventSeq>=1 && Number.isInteger(v.audienceSeat) &&
    v.audienceSeat>=0 && v.audienceSeat<=3 &&
    v.round.currentSeat===v.audienceSeat &&
    v.round.schemaVersion===1 && v.round.contractVersion===v.contractVersion &&
    typeof v.round.roundId==='string', 'identity/actor/revision');
  allow(v.self,['seat','concealed','melds','river','flowers'],'self');
  required(v.self.seat===v.audienceSeat &&
    Array.isArray(v.self.concealed) &&
    v.self.concealed.some(t=>t?.kind==='flower') &&
    v.self.concealed.every(validId), 'own physical tiles');
  for(const t of v.self.concealed)
    allow(t,t.kind==='flower'?
      ['schemaVersion','contractVersion','id','kind','flowerCode','copyIndex']:
      ['schemaVersion','contractVersion','id','kind','tileType','copyIndex'],
      'own tile');
  const physicalIds = new Set(v.self.concealed.map(t=>t.id));
  required(physicalIds.size===v.self.concealed.length, 'duplicate own tile');
  required(Array.isArray(v.self.melds) && Array.isArray(v.self.river) &&
    Array.isArray(v.self.flowers) && v.self.flowers.every(validId),
    'self public zones');
  checkPublicZones(v.self);
  required(Array.isArray(v.opponents) && v.opponents.length===3, 'opponents');
  const seats=new Set([v.audienceSeat]);
  for (const p of v.opponents) {
    allow(p,['seat','concealedCount','melds','river','flowers'],'opponent');
    required(Number.isInteger(p.seat) && p.seat>=0 && p.seat<=3 &&
      Number.isInteger(p.concealedCount) && p.concealedCount>=0 &&
      Array.isArray(p.melds) && Array.isArray(p.river) &&
      Array.isArray(p.flowers) && !seats.has(p.seat), 'opponent redaction');
    checkPublicZones(p);
    seats.add(p.seat);
  }
  required(Array.isArray(v.publicEvents), 'public events');
  for (const e of v.publicEvents) {
    allow(e,publicEventKeys,'event');
    if(!validateRobKongPublicEvent(e,v.publicEvents,v.ruleRef))
      allow(e.payload,publicPayloadKeys,'event payload');
    allow(e.ruleRef,['profileId','ruleVersion'],'event ruleRef');
    required(e.visibility==='public' && e.gameId===v.gameId &&
      Number.isInteger(e.seq) && e.seq<=v.asOfEventSeq &&
      e.ruleRef?.profileId===v.ruleRef.profileId &&
      e.ruleRef?.ruleVersion===v.ruleRef.ruleVersion, 'event redaction');
  }
  required(Array.isArray(v.knownUnavailableTypes) &&
    v.knownUnavailableTypes.every(t=>Number.isInteger(t)&&t>=0&&t<=33),
    'known public tiles');
  allow(v.capabilities,['structuralScore','roundActions','settlement'],'capabilities');
  required(Object.values(v.capabilities).every(x=>typeof x==='boolean'),
    'capabilities');
  required(Array.isArray(v.legalActions) && v.legalActions.length>0,
    'replacement actions');
  for(const a of v.legalActions){
    allow(a,actionKeys,'legal action');
    allow(a.ruleRef,['profileId','ruleVersion'],'action ruleRef');
    allow(a.legalityBasis,['engineVersion','reasonCodes'],'legality basis');
    required(a.actorSeat===v.audienceSeat &&
      a.expectedRevision===v.asOfEventSeq &&
      a.ruleRef.profileId===v.ruleRef.profileId &&
      a.ruleRef.ruleVersion===v.ruleRef.ruleVersion &&
      typeof a.actionId==='string' && a.actionId.length>0 &&
      a.kind==='replace_flower' && Array.isArray(a.tileIds) &&
      a.tileIds.length===1 &&
      v.self.concealed.some(t=>t.kind==='flower' && t.id===a.tileIds[0]) &&
      Array.isArray(a.legalityBasis.reasonCodes),
      'untrusted replacement action');
  }
  return {view:v,hand:[],visible:[],fixedMelds:v.self.melds.length};
}

/** Always use strict Strategy validation, except a *current actor's* R3
 * initial flower replacement; never send special-case views to Strategy. */
export function readBotView(input) {
  const flower = isSupportedBotTableProfile(input?.ruleRef) &&
    input?.round?.phase==='replacement' &&
    Array.isArray(input?.self?.concealed) &&
    input.self.concealed.some(t=>t?.kind==='flower');
  return flower ? replacementView(input) : readPlayerView(input);
}

/**
 * Controller-only terminal check: no strategy call or BotDecision is made.
 * R5 publishes claimResolution in final public WIN/SETTLE payloads, which the
 * earlier Strategy pre-settlement schema intentionally does not recognize.
 * Accept only a detached, redacted Rules PlayerView; no GameState fallback.
 */
// Controller-only public accounting check. No scoring computation or private
// ledger is accepted. The Rules host remains responsible for canonical legality.
const safeNonnegative=n=>Number.isSafeInteger(n)&&n>=0&&!Object.is(n,-0);
const seat=n=>safeNonnegative(n)&&n<4;
const sameArray=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((n,i)=>n===b[i]);
const sum=a=>a.reduce((s,n)=>s+BigInt(n),0n);
function verifyAuthorityTerminal(v,event){
  const p=event.payload,s=p.settlement;
  allow(p,['settlement','robAddedKong'],'authority settle payload');
  allow(s,['contractVersion','settlementId','scoringVersion','status','unit','reason','winType',
    'winnerSeat','sourceSeat','payerSeats','publicEvidenceEventIds','tai','breakdown','payments',
    'playerTransferDeltas','playerDeltas','fees','houseDelta'],'public settlement');
  required(event===v.publicEvents.at(-1)&&event.seq===v.asOfEventSeq&&
    s.contractVersion==='tw16-pre-settlement/1.0.0'&&s.settlementId===v.round.roundId&&
    s.scoringVersion==='tw16-gametower-authoritative@1.0.0-experimental'&&
    s.status==='experimental-not-rule-certified'&&s.unit==='abstract-points'&&
    safeNonnegative(s.tai)&&s.houseDelta===0&&!Object.is(s.houseDelta,-0)&&
    Array.isArray(s.fees)&&s.fees.length===0&&Array.isArray(s.breakdown)&&
    Array.isArray(s.payments)&&Array.isArray(s.payerSeats)&&
    Array.isArray(s.playerDeltas)&&s.playerDeltas.length===4&&
    s.playerDeltas.every(n=>Number.isSafeInteger(n)&&!Object.is(n,-0))&&
    sameArray(s.playerTransferDeltas,s.playerDeltas)&&sameArray(v.round.scores,s.playerDeltas)&&
    sum(s.playerDeltas)===0n,'authority terminal accounting');
  const item=(x,scope)=>{
    allow(x,['code','name','tai','ruleVersion','source','scope'],'public tai item');
    required(['code','name','ruleVersion','source'].every(k=>typeof x[k]==='string'&&x[k].length>0)&&
      x.scope===scope&&x.ruleVersion===s.scoringVersion&&safeNonnegative(x.tai),'public tai item');
  };
  s.breakdown.forEach(x=>item(x,'hand'));
  required(sum(s.breakdown.map(x=>x.tai))===BigInt(s.tai),'hand tai total');
  const publicIds=new Set(v.publicEvents.filter(e=>e.seq<event.seq&&e.actorSeat!==undefined||
    e.seq<event.seq&&e.type==='deal').map(e=>e.eventId));
  required(Array.isArray(s.publicEvidenceEventIds)&&
    new Set(s.publicEvidenceEventIds).size===s.publicEvidenceEventIds.length&&
    s.publicEvidenceEventIds.every(id=>typeof id==='string'&&publicIds.has(id)),'public evidence references');
  if(s.reason==='exhaustive-draw'){
    required(s.winnerSeat===null&&s.sourceSeat===null&&s.winType===null&&
      event.actorSeat===undefined&&!Object.hasOwn(p,'robAddedKong')&&s.tai===0&&
      s.breakdown.length===0&&s.payments.length===0&&s.payerSeats.length===0&&
      s.playerDeltas.every(n=>n===0)&&!v.publicEvents.some(e=>e.type==='win'),'authority draw');
    return;
  }
  const w=v.publicEvents.at(-2);
  required(s.reason==='win'&&seat(s.winnerSeat)&&seat(s.sourceSeat)&&
    ['self-draw','discard','rob-added-kong'].includes(s.winType)&&
    (s.winType==='self-draw')===(s.winnerSeat===s.sourceSeat)&&
    event.actorSeat===s.winnerSeat&&w?.type==='win'&&w.seq===event.seq-1&&
    w.payload.seat===s.winnerSeat&&w.payload.sourceSeat===s.sourceSeat&&
    (s.winType==='rob-added-kong')===Object.hasOwn(p,'robAddedKong'),'authority win binding');
  const payers=s.winType==='self-draw'?[0,1,2,3].filter(n=>n!==s.winnerSeat):[s.sourceSeat];
  required(sameArray(s.payerSeats,payers)&&sameArray(s.payments.map(x=>x.payerSeat),payers),'authority payer set');
  const net=[0n,0n,0n,0n];
  for(const x of s.payments){
    allow(x,['payerSeat','payeeSeat','points','handTai','appliedTai','dealerItems'],'public payment');
    required(x.payeeSeat===s.winnerSeat&&safeNonnegative(x.points)&&
      x.handTai===s.tai&&safeNonnegative(x.appliedTai)&&Array.isArray(x.dealerItems),'authority payment');
    x.dealerItems.forEach(y=>item(y,'payment'));
    required(BigInt(x.appliedTai)===BigInt(s.tai)+sum(x.dealerItems.map(y=>y.tai)),'payment tai total');
    net[x.payerSeat]-=BigInt(x.points);net[x.payeeSeat]+=BigInt(x.points);
  }
  required(net.every((n,i)=>n===BigInt(s.playerDeltas[i])),'authority payment/delta mismatch');
}
export function readSettledBotView(input) {
  const v = detached(input);
  allow(v, rootKeys, 'settled root');
  allow(v.ruleRef, ['profileId','ruleVersion'], 'settled ruleRef');
  allow(v.round, roundKeys, 'settled round');
  required(isSupportedBotTableProfile(v.ruleRef) && v.round.phase === 'settled' &&
    Number.isInteger(v.audienceSeat) && v.audienceSeat >= 0 &&
    v.audienceSeat <= 3 && v.self?.seat === v.audienceSeat &&
    Array.isArray(v.legalActions) && v.legalActions.length === 0 &&
    Array.isArray(v.publicEvents) && Array.isArray(v.opponents) &&
    v.opponents.length === 3, 'settled Rules projection');
  allow(v.self, ['seat','concealed','melds','river','flowers'], 'settled self');
  const seats = new Set([v.audienceSeat]);
  for (const opp of v.opponents) {
    allow(opp, ['seat','concealedCount','melds','river','flowers'],
      'settled opponent');
    required(Number.isInteger(opp.seat) && opp.seat >= 0 && opp.seat <= 3 &&
      !seats.has(opp.seat) && Number.isInteger(opp.concealedCount),
      'settled opponent redaction');
    seats.add(opp.seat);
  }
  const authority=isAuthoritativeRuleRef(v.ruleRef);
  if(authority)required(v.publicEvents.filter(e=>e.type==='settle').length===1&&
    v.publicEvents.at(-1)?.type==='settle','authority terminal settlement');
  for (const event of v.publicEvents) {
    allow(event, publicEventKeys, 'settled event');
    const robEvent=validateRobKongPublicEvent(event,v.publicEvents,v.ruleRef,true);
    if(authority&&event.type==='settle')verifyAuthorityTerminal(v,event);
    else if(!robEvent)allow(event.payload, [...publicPayloadKeys, 'claimResolution'],
      'settled public payload');
    required(event.visibility === 'public' &&
      event.ruleRef?.profileId === v.ruleRef.profileId &&
      event.ruleRef?.ruleVersion === v.ruleRef.ruleVersion,
      'settled public event');
    if (event.payload.claimResolution !== undefined) {
      // All winning intents are disclosed only by the final public WIN.
      required(v.ruleRef.profileId === 'tw16-single-winner-interception' &&
        event.type === 'win', 'claim resolution disclosure phase');
      const resolution = event.payload.claimResolution;
      allow(resolution, ['schemaVersion','policyVersion','winPriority',
        'discardEventId','fromSeat','selectedSeat',
        'selectedClaimActionId','declaredWinSeats','interceptedWinSeats'],
        'public claim resolution');
      required(resolution.schemaVersion === 1 &&
        resolution.winPriority === 'nearest-clockwise-from-discarder' &&
        Number.isInteger(resolution.selectedSeat) &&
        Array.isArray(resolution.declaredWinSeats) &&
        Array.isArray(resolution.interceptedWinSeats) &&
        resolution.declaredWinSeats.every(s => Number.isInteger(s) &&
          s >= 0 && s <= 3) &&
        resolution.interceptedWinSeats.every(s => Number.isInteger(s) &&
          s >= 0 && s <= 3), 'public claim resolution schema');
    }
  }
  return {view:v};
}
