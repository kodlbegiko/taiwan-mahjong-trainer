/**
 * Internal-only replay archive format. Never import this module from public UI.
 * A seeded event ledger is sensitive: it can reconstruct the future wall.
 */
import { createGame, replayGame, validateGameState, getRuleProfile, ENGINE_VERSION, COMPLETE_ENGINE_VERSION } from '../rules/index.js';

export const CONTRACT_VERSION = 'master-academy/1.0.0';
export const REPLAY_VERSION = 'tw16-replay/1.0.0';
export const DECISION_VERSION = 'tw16-player-decision/1.0.0';
export const ANALYSIS_VERSION = 'tw16-decision-analysis/1.0.0';
export const FINDING_VERSION = 'tw16-coaching-finding/1.0.0';
export const FRAME_VERSION = 'tw16-replay-frame/1.0.0';
export const V1 = Object.freeze({schemaVersion:1,contractVersion:CONTRACT_VERSION});
export class ReplayError extends Error {
  constructor(code, message, cause) { super(message, cause === undefined ? undefined : {cause}); this.name='ReplayError'; this.code=code; }
}
export const clone = o => JSON.parse(JSON.stringify(o));
function canonical(v, visited=new Set()) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean' ||
      (typeof v === 'number' && Number.isFinite(v))) return JSON.stringify(v);
  if (!v || typeof v !== 'object' || visited.has(v)) throw new ReplayError('INVALID_JSON','Non-JSON or cyclic replay input');
  visited.add(v);
  let result;
  if (Array.isArray(v)) {
    if (Object.keys(v).length !== v.length) throw new ReplayError('INVALID_JSON','Sparse or extended array');
    result='['+v.map(x=>canonical(x,visited)).join(',')+']';
  } else {
    if (Object.getPrototypeOf(v)!==Object.prototype) throw new ReplayError('INVALID_JSON','Non-plain replay object');
    result='{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k],visited)).join(',')+'}';
  }
  visited.delete(v); return result;
}
/** FNV-1a is a corruption checksum, not a cryptographic signature. */
export function checksum(value) {
  const str=canonical(value); let n=2166136261;
  for (let i=0;i<str.length;i++) n=Math.imul(n^str.charCodeAt(i),16777619);
  return (n>>>0).toString(16).padStart(8,'0');
}
export const same = (a,b) => canonical(a)===canonical(b);

function assertProfile(ruleRef) {
  try { return getRuleProfile(ruleRef?.profileId,ruleRef?.ruleVersion); }
  catch (error) { throw new ReplayError('UNKNOWN_RULE_PROFILE','Replay RuleProfile is unavailable',error); }
}

const isR3 = ref => ref?.profileId==='tw16-configurable-table' &&
  ref?.ruleVersion==='experimental-full-v1';
const replayConfig = (manifest, events) => ({
  gameId:manifest.gameId,seed:manifest.initialSeed,
  dealerSeat:manifest.dealerSeat,ruleRef:manifest.ruleRef,
  ...(manifest.roundConfig?{round:clone(manifest.roundConfig)}:{}),
  events:events.map(e=>clone(e.turnEvent)),
});
function r3Kind(event) {
  if(event.type==='flower')return 'replace_flower';
  if(event.type==='claim' && event.visibility==='seat-private')return event.payload?.kind;
  return event.type;
}
function decisionsOf(events,m) {
  if(!isR3(m.ruleRef)) return events.slice(1).map(e=>({...V1,
    decisionVersion:DECISION_VERSION,replayId:m.replayId,eventSeq:e.seq,
    beforeEventSeq:e.seq-1,actorSeat:e.actorSeat,
    actionId:e.causedByActionId,kind:e.type}));
  const result=[];
  for(let i=1;i<events.length;){
    const first=events[i],id=first.causedByActionId;
    if(typeof id!=='string'||!id||!Number.isInteger(first.actorSeat))
      throw new Error('Missing R3 action start');
    let j=i+1;
    while(j<events.length && events[j].causedByActionId===id)j++;
    const kind=r3Kind(first);
    if(!['draw','discard','replace_flower','chi','pong','kong','win','pass'].includes(kind))
      throw new Error('Unknown R3 LegalAction kind');
    result.push({...V1,decisionVersion:DECISION_VERSION,replayId:m.replayId,
      eventSeq:first.seq,beforeEventSeq:first.seq-1,endEventSeq:events[j-1].seq,
      actorSeat:first.actorSeat,actionId:id,kind});
    i=j;
  }
  return result;
}
export function createReplayArchive(state,{ownerSeat=0,disclosurePolicy='none'}={}) {
  if(!Number.isInteger(ownerSeat)||ownerSeat<0||ownerSeat>3)
    throw new ReplayError('INVALID_SEAT','ownerSeat must be 0..3');
  const profile=assertProfile(state?.ruleRef),r3=isR3(state.ruleRef);
  try { validateGameState(state); }
  catch(error) { throw new ReplayError('INVALID_GAME_STATE','Original game is not replayable',error); }
  if(typeof state.rng?.seed!=='string'||!state.rng.seed)
    throw new ReplayError('MISSING_SEED','Seed is mandatory');
  if(!['none','settled-public-only'].includes(disclosurePolicy) ||
      (disclosurePolicy!=='none' && (!r3||state.round.phase!=='settled')))
    throw new ReplayError('INVALID_DISCLOSURE_POLICY','Only an explicitly settled R3 game permits public-only postgame disclosure');
  const events=state.events.map(turnEvent=>({...V1,replayEventVersion:REPLAY_VERSION,
    seq:turnEvent.seq,turnEvent:clone(turnEvent)}));
  const completionStatus=r3&&state.round.phase==='settled'?'settled-experimental':'incomplete';
  const settlement=r3&&state.round.phase==='settled'?state.extensions?.tw16?.result:null;
  if(completionStatus!=='incomplete' && !settlement)
    throw new ReplayError('INVALID_SETTLEMENT','Settled R3 game lacks SettlementResult');
  const m={...V1,replayVersion:REPLAY_VERSION,replayId:'replay:'+state.gameId,
    gameId:state.gameId,ownerSeat,ruleRef:clone(state.ruleRef),
    ruleProfileSnapshot:clone(profile),initialSeed:state.rng.seed,
    dealerSeat:state.round.dealerSeat,
    engineVersion:r3?COMPLETE_ENGINE_VERSION:ENGINE_VERSION,
    strategyVersion:'advanced-strategy/1.0.0',
    scoringVersion:r3?'tw16-minimal-tai-v1':'unavailable',
    decisionVersion:DECISION_VERSION,completionStatus,
    verificationScope:r3?'experimental-r3-full-round':'experimental-bounded-draw-discard',
    postgameDisclosurePolicy:disclosurePolicy,eventCount:events.length};
  if(r3) Object.assign(m,{
    gameRef:{gameId:state.gameId,roundId:state.round.roundId},
    ruleProfileVersion:profile.ruleVersion,
    initialSeedRef:'private:ReplayManifest.initialSeed',
    roundConfig:{handIndex:state.round.handIndex,prevailingWind:state.round.prevailingWind},
    settlementResultRef:settlement?{eventSeq:state.events.at(-1).seq,
      type:'SettlementResult',access:'private-storage'}:null,
    settlementResultChecksum:settlement?checksum(settlement):null,
    disclosurePolicy,
  });
  const decisions=decisionsOf(state.events,m);
  if(r3)m.actionCount=decisions.length;
  m.integrity={algorithm:'fnv1a-32-canonical-checksum-not-signature',
    eventsChecksum:checksum(events),decisionChecksum:checksum(decisions),
    finalStateChecksum:checksum(state)};
  const archive={...V1,replayVersion:REPLAY_VERSION,manifest:m,events,decisions};
  validateReplayArchive(archive);
  return clone(archive);
}

/** Strict record verification; never apply saved TurnEvents as trusted mutations. */
export function validateReplayArchive(archive) {
  try {
    if(!archive||archive.schemaVersion!==1||archive.contractVersion!==CONTRACT_VERSION||
       archive.replayVersion!==REPLAY_VERSION||!archive.manifest||
       !Array.isArray(archive.events)||!Array.isArray(archive.decisions))
      throw new Error('archive shape/version');
    const m=archive.manifest,r3=isR3(m.ruleRef);
    if(m.schemaVersion!==1||m.contractVersion!==CONTRACT_VERSION||
       m.replayVersion!==REPLAY_VERSION||m.replayId!=='replay:'+m.gameId||
       !Number.isInteger(m.ownerSeat)||m.ownerSeat<0||m.ownerSeat>3||
       !Number.isInteger(m.dealerSeat)||m.dealerSeat<0||m.dealerSeat>3||
       typeof m.initialSeed!=='string'||!m.initialSeed||
       m.engineVersion!==(r3?COMPLETE_ENGINE_VERSION:ENGINE_VERSION)||
       m.strategyVersion!=='advanced-strategy/1.0.0'||
       m.scoringVersion!==(r3?'tw16-minimal-tai-v1':'unavailable')||
       m.decisionVersion!==DECISION_VERSION||
       m.eventCount!==archive.events.length||
       m.verificationScope!==(r3?'experimental-r3-full-round':'experimental-bounded-draw-discard'))
      throw new Error('manifest version/identity');
    const profile=assertProfile(m.ruleRef);
    if(!same(m.ruleProfileSnapshot,profile))throw new Error('RuleProfile snapshot mismatch');
    if(r3){
      if(profile.status!=='experimental'||m.ruleProfileVersion!==profile.ruleVersion||
         m.initialSeedRef!=='private:ReplayManifest.initialSeed'||
         !same(m.gameRef,{gameId:m.gameId,roundId:m.gameId+'-round-'+m.roundConfig?.handIndex})||
         !Number.isInteger(m.roundConfig?.handIndex)||m.roundConfig.handIndex<0||
         !['east','south','west','north'].includes(m.roundConfig.prevailingWind)||
         !['none','settled-public-only'].includes(m.disclosurePolicy)||
         m.postgameDisclosurePolicy!==m.disclosurePolicy)
        throw new Error('R3 profile/round/disclosure mismatch');
    }else if(m.completionStatus!=='incomplete'||
       m.postgameDisclosurePolicy!=='none')throw new Error('sandbox cannot claim a settlement');
    const events=archive.events.map((e,i)=>{
      if(e.schemaVersion!==1||e.contractVersion!==CONTRACT_VERSION||
         e.replayEventVersion!==REPLAY_VERSION||e.seq!==i+1||
         e.turnEvent?.seq!==i+1)throw new Error('ReplayEvent seq/version');
      return e.turnEvent;
    });
    if(checksum(archive.events)!==m.integrity?.eventsChecksum||
       checksum(archive.decisions)!==m.integrity?.decisionChecksum)
      throw new Error('event/decision checksum');
    if(!same(decisionsOf(events,m),archive.decisions))
      throw new Error('decision group/event mismatch');
    const state=replayGame(replayConfig(m,archive.events));
    validateGameState(state);
    if(checksum(state)!==m.integrity?.finalStateChecksum)
      throw new Error('canonical final state mismatch');
    if(r3){
      const settled=state.round.phase==='settled',result=state.extensions?.tw16?.result;
      const expected=settled?'settled-experimental':'incomplete';
      if(m.completionStatus!==expected||m.actionCount!==archive.decisions.length||
         (m.disclosurePolicy==='settled-public-only'&&!settled)||
         (settled&&(!result||state.events.at(-1)?.type!=='settle'))||
         !same(m.settlementResultRef,settled?{eventSeq:state.revision,type:'SettlementResult',access:'private-storage'}:null)||
         m.settlementResultChecksum!==(settled?checksum(result):null))
        throw new Error('invalid R3 settlement/status/policy');
    }
    return true;
  } catch(error) {
    if(error instanceof ReplayError && error.code==='UNKNOWN_RULE_PROFILE')throw error;
    throw new ReplayError('CORRUPT_REPLAY','Replay record does not match canonical seeded Rules Engine',error);
  }
}
export function replayStateAt(archive,seq) {
  validateReplayArchive(archive);
  if(!Number.isInteger(seq)||seq<1||seq>archive.events.length)
    throw new ReplayError('INVALID_EVENT_SEQ','Event sequence is outside this replay');
  if(isR3(archive.manifest.ruleRef)&&seq!==1 &&
      !archive.decisions.some(d=>d.endEventSeq===seq))
    throw new ReplayError('NON_ATOMIC_EVENT_SEQ','R3 frames require a complete LegalAction event-group boundary');
  try {return replayGame(replayConfig(archive.manifest,archive.events.slice(0,seq)));}
  catch(error){throw new ReplayError('REPLAY_MISMATCH','Unable to reconstruct canonical event prefix',error);}
}
export function publicManifest(archive) {
  const {manifest:m}=archive,r3=isR3(m.ruleRef);
  // Explicit allowlist: no initialSeed, fixtureDeck, private TurnEvents or RNG.
  return {...V1,replayVersion:REPLAY_VERSION,replayId:m.replayId,
    gameId:m.gameId,ownerSeat:m.ownerSeat,ruleRef:clone(m.ruleRef),
    ruleStatus:m.ruleProfileSnapshot.status,engineVersion:m.engineVersion,
    strategyVersion:m.strategyVersion,scoringVersion:m.scoringVersion,
    completionStatus:m.completionStatus,verificationScope:m.verificationScope,
    eventCount:m.eventCount,integrityStatus:'canonical-replay-verified',
    digestIsCryptographic:false,
    ...(r3?{
      gameRef:clone(m.gameRef),ruleProfileVersion:m.ruleProfileVersion,
      actionCount:m.actionCount,settlementResultRef:clone(m.settlementResultRef),
      disclosurePolicy:m.disclosurePolicy,
    }:{}),
    postgameAvailable:r3&&m.completionStatus==='settled-experimental'&&
      m.disclosurePolicy==='settled-public-only'};
}
