/**
 * Internal-only replay archive format. Never import this module from public UI.
 * A seeded event ledger is sensitive: it can reconstruct the future wall.
 */
import { createGame, replayGame, validateGameState, getRuleProfile, ENGINE_VERSION } from '../rules/index.js';

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
function replayConfig(manifest,events) {
  return {
    gameId:manifest.gameId,seed:manifest.initialSeed,
    dealerSeat:manifest.dealerSeat,ruleRef:manifest.ruleRef,
    events:events.map(e=>clone(e.turnEvent)),
  };
}
export function createReplayArchive(state,{ownerSeat=0}={}) {
  if (!Number.isInteger(ownerSeat)||ownerSeat<0||ownerSeat>3) throw new ReplayError('INVALID_SEAT','ownerSeat must be 0..3');
  const profile=assertProfile(state?.ruleRef);
  try { validateGameState(state); }
  catch (error) { throw new ReplayError('INVALID_GAME_STATE','Original game is not replayable',error); }
  if (typeof state.rng?.seed!=='string' || !state.rng.seed) throw new ReplayError('MISSING_SEED','Seed is mandatory');
  // Today's Rules Engine supports an experimental draw/discard sandbox only.
  // Never infer a completed match, settlement, or verified four-player rules.
  const events=state.events.map(turnEvent=>({...V1,replayEventVersion:REPLAY_VERSION,
    seq:turnEvent.seq,turnEvent:clone(turnEvent)}));
  const decisions=state.events.slice(1).map(e=>({...V1,
    decisionVersion:DECISION_VERSION,replayId:'replay:'+state.gameId,
    eventSeq:e.seq,beforeEventSeq:e.seq-1,actorSeat:e.actorSeat,
    actionId:e.causedByActionId,kind:e.type}));
  const manifest={...V1,replayVersion:REPLAY_VERSION,replayId:'replay:'+state.gameId,
    gameId:state.gameId,ownerSeat,ruleRef:clone(state.ruleRef),
    ruleProfileSnapshot:clone(profile),initialSeed:state.rng.seed,
    dealerSeat:state.round.dealerSeat,engineVersion:ENGINE_VERSION,
    strategyVersion:'advanced-strategy/1.0.0',scoringVersion:'unavailable',
    decisionVersion:DECISION_VERSION,completionStatus:'incomplete',
    verificationScope:'experimental-bounded-draw-discard',
    postgameDisclosurePolicy:'none',eventCount:events.length,
    integrity:{algorithm:'fnv1a-32-canonical-checksum-not-signature',
      eventsChecksum:checksum(events),decisionChecksum:checksum(decisions),
      finalStateChecksum:checksum(state)}};
  const archive={...V1,replayVersion:REPLAY_VERSION,manifest,events,decisions};
  validateReplayArchive(archive);
  return clone(archive);
}

/** Strict record verification; never apply saved TurnEvents as trusted mutations. */
export function validateReplayArchive(archive) {
  try {
    if (!archive || archive.schemaVersion!==1 || archive.contractVersion!==CONTRACT_VERSION ||
        archive.replayVersion!==REPLAY_VERSION || !archive.manifest ||
        !Array.isArray(archive.events) || !Array.isArray(archive.decisions)) throw new Error('archive shape/version');
    const m=archive.manifest;
    if (m.schemaVersion!==1 || m.contractVersion!==CONTRACT_VERSION ||
        m.replayVersion!==REPLAY_VERSION || m.replayId!=='replay:'+m.gameId ||
        !Number.isInteger(m.ownerSeat) || m.ownerSeat<0 || m.ownerSeat>3 ||
        !Number.isInteger(m.dealerSeat) || m.dealerSeat<0 || m.dealerSeat>3 ||
        typeof m.initialSeed!=='string' || !m.initialSeed ||
        m.engineVersion!==ENGINE_VERSION || m.strategyVersion!=='advanced-strategy/1.0.0' ||
        m.scoringVersion!=='unavailable' || m.decisionVersion!==DECISION_VERSION ||
        m.completionStatus!=='incomplete' || m.verificationScope!=='experimental-bounded-draw-discard' ||
        m.postgameDisclosurePolicy!=='none' || m.eventCount!==archive.events.length)
      throw new Error('unsupported manifest or invented completion');
    if (!same(m.ruleProfileSnapshot,assertProfile(m.ruleRef))) throw new Error('RuleProfile snapshot mismatch');
    const expectedEvents=archive.events.map((e,i)=>{
      if(e.schemaVersion!==1 || e.contractVersion!==CONTRACT_VERSION ||
         e.replayEventVersion!==REPLAY_VERSION || e.seq!==i+1 || !e.turnEvent)
        throw new Error('ReplayEvent shape/sequence');
      return e.turnEvent;
    });
    if (checksum(archive.events)!==m.integrity?.eventsChecksum ||
        checksum(archive.decisions)!==m.integrity?.decisionChecksum) throw new Error('event/decision checksum');
    const expectedDecisions=expectedEvents.slice(1).map(e=>({...V1,
      decisionVersion:DECISION_VERSION,replayId:m.replayId,
      eventSeq:e.seq,beforeEventSeq:e.seq-1,actorSeat:e.actorSeat,
      actionId:e.causedByActionId,kind:e.type}));
    if (!same(expectedDecisions,archive.decisions)) throw new Error('decision records mismatch');
    const state=replayGame(replayConfig(m,archive.events));
    validateGameState(state);
    if (checksum(state)!==m.integrity.finalStateChecksum) throw new Error('final state checksum');
    return true;
  } catch(error) {
    if (error instanceof ReplayError && error.code==='UNKNOWN_RULE_PROFILE') throw error;
    throw new ReplayError('CORRUPT_REPLAY','Replay record does not match canonical seeded Rules Engine',error);
  }
}
export function replayStateAt(archive,seq) {
  validateReplayArchive(archive);
  if (!Number.isInteger(seq)||seq<1||seq>archive.events.length)
    throw new ReplayError('INVALID_EVENT_SEQ','Event sequence is outside this replay');
  try { return replayGame(replayConfig(archive.manifest,archive.events.slice(0,seq))); }
  catch(error) { throw new ReplayError('REPLAY_MISMATCH','Unable to reconstruct event prefix',error); }
}
export function publicManifest(archive) {
  const {manifest:m}=archive;
  // Explicit allowlist: never serialize initialSeed, wall, internal TurnEvents or rng.
  return {...V1,replayVersion:REPLAY_VERSION,replayId:m.replayId,
    gameId:m.gameId,ownerSeat:m.ownerSeat,ruleRef:clone(m.ruleRef),
    ruleStatus:m.ruleProfileSnapshot.status,engineVersion:m.engineVersion,
    strategyVersion:m.strategyVersion,scoringVersion:m.scoringVersion,
    completionStatus:m.completionStatus,verificationScope:m.verificationScope,
    eventCount:m.eventCount,integrityStatus:'canonical-replay-verified',
    digestIsCryptographic:false,postgameAvailable:false};
}
