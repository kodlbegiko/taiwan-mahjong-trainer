/**
 * Replay & Decision Coaching public service.
 * Only the owner's historical PlayerView may cross this boundary.
 * Full seed/event-ledger remains in the internal archive, never in frame APIs.
 */
import { createPlayerView } from '../rules/index.js';
import { analyzePlayerView, STRATEGY_ENGINE_VERSION } from '../strategy/index.js';
import { readPlayerView } from '../strategy/view.js';
import { getSkillTag } from '../academy/registry.js';
import { createUnscoredScenario } from '../scenario/index.js';
import { V1, clone, checksum, ReplayError, REPLAY_VERSION, FRAME_VERSION,
  DECISION_VERSION, ANALYSIS_VERSION, FINDING_VERSION,
  createReplayArchive, validateReplayArchive, replayStateAt, publicManifest } from './internal.js';

export { ReplayError, REPLAY_VERSION, FRAME_VERSION, DECISION_VERSION,
  ANALYSIS_VERSION, FINDING_VERSION, createReplayArchive, validateReplayArchive } from './internal.js';
export const REPLAY_API_VERSION='tw16-replay-api/1.0.0';
const INDEX_KEY='tw-mahjong-replay:index:v1';
const DATA_PREFIX='tw-mahjong-replay:archive:v1:';

function createStorage(storage) {
  const s=storage??new Map();
  const isWeb=typeof s.getItem==='function' && typeof s.setItem==='function';
  const isMap=typeof s.get==='function' && typeof s.set==='function';
  if (!isWeb && !isMap) throw new ReplayError('INVALID_STORAGE','Map or Web Storage adapter required');
  return {
    read(k) { try { return isWeb?s.getItem(k):s.get(k); }
      catch(e) { throw new ReplayError('STORAGE_READ_FAILED','Cannot read replay store',e); } },
    write(k,v) { try { if(isWeb)s.setItem(k,v); else s.set(k,v); }
      catch(e) { throw new ReplayError('STORAGE_WRITE_FAILED','Cannot write replay store',e); } },
  };
}
function indexFrom(store) {
  const raw=store.read(INDEX_KEY);
  if(raw===undefined || raw===null) return [];
  try {
    const ids=JSON.parse(raw);
    if(!Array.isArray(ids) || ids.some(x=>typeof x!=='string' || !/^replay:[A-Za-z0-9_-]+$/.test(x)) ||
       new Set(ids).size!==ids.length) throw new Error('bad index');
    return ids;
  } catch(e) { throw new ReplayError('STORAGE_CORRUPT','Replay index invalid',e); }
}
function readArchive(store,replayId) {
  if(typeof replayId!=='string'||!/^replay:[A-Za-z0-9_-]+$/.test(replayId))
    throw new ReplayError('INVALID_REPLAY_ID','Invalid replay identifier');
  const raw=store.read(DATA_PREFIX+replayId);
  if(raw===null || raw===undefined) throw new ReplayError('REPLAY_NOT_FOUND','Replay not present');
  let archive;
  try { archive=JSON.parse(raw); }
  catch(e) { throw new ReplayError('CORRUPT_REPLAY','Replay JSON invalid',e); }
  validateReplayArchive(archive);
  if(archive.manifest.replayId!==replayId) throw new ReplayError('CORRUPT_REPLAY','Replay ID mismatch');
  return archive;
}
function ownerOnly(m,viewerSeat) {
  if (viewerSeat!==m.ownerSeat) throw new ReplayError('VIEW_FORBIDDEN','Historical opponent concealed tiles are not accessible');
}
function frameFrom(archive,seq) {
  const m=archive.manifest;
  const state=replayStateAt(archive,seq);
  const view=createPlayerView(state,m.ownerSeat);
  readPlayerView(view); // recursively checks the PlayerView allowlist and known-tile consistency
  return {...V1,frameVersion:FRAME_VERSION,replayId:m.replayId,
    perspective:'player-at-time',asOfEventSeq:seq,
    playerView:clone(view),publicEvent:clone(view.publicEvents.at(-1)),
    informationBoundary:'own concealed + public information only',
    postgameDisclosure:null};
}
function metric(rec,name) { return rec?.metrics?.find(x=>x.name===name)??null; }
function exactValue(rec,name) {
  const m=metric(rec,name);
  return m?.epistemic==='exact'&&Number.isFinite(m.value)?m.value:null;
}
function findingsFor(analysis) {
  const chosen=analysis.candidates.find(c=>c.actionId===analysis.chosenActionId);
  const best=analysis.candidates[0];
  if(!chosen || !best || chosen.actionId===best.actionId) return [];
  let kind=null,tag=null;
  const cs=exactValue(chosen,'postDiscardShanten'),bs=exactValue(best,'postDiscardShanten');
  const cu=exactValue(chosen,'oneTurnEffectiveCopies'),bu=exactValue(best,'oneTurnEffectiveCopies');
  if(cs!==null && bs!==null && cs>bs) {
    kind='higher-shanten';tag='efficiency.shanten';
  } else if(cs!==null && bs===cs && cu!==null && bu!==null && cu<bu) {
    kind='lower-ukeire';tag='efficiency.ukeire';
  }
  if(!kind || !getSkillTag(tag)) return [];
  const evidence={epistemic:'exact',source:'canonical structural metrics via Strategy PlayerView',
    chosen:{shanten:cs,effectiveCopies:cu},
    alternative:{actionId:best.actionId,shanten:bs,effectiveCopies:bu}};
  const base={...V1,findingVersion:FINDING_VERSION,replayId:analysis.replayId,
    eventSeq:analysis.eventSeq,chosenActionId:analysis.chosenActionId,
    alternativeActionId:best.actionId,kind,skillTagIds:[tag,'efficiency.discard'],
    evidence,verificationStatus:'heuristic-recommendation',verifiedError:false,
    scorerRef:null,canCountAsWrong:false,canScheduleReview:false,
    rationale:'Exact structural efficiency disadvantage; not proof of a strategically incorrect discard.',
    limitations:['Defense, scoring, opponent tendencies and future wall are not verified.']};
  return [{...base,findingId:'finding:'+checksum(base)}];
}
/**
 * All methods are synchronous and use only new replay-prefixed storage keys.
 * No existing DecisionRecord v3 archive, Academy sidecar or Rules file is touched.
 */
export function createReplayService({storage=null}={}) {
  const store=createStorage(storage);
  function saveReplay(gameState,{ownerSeat=0}={}) {
    const archive=createReplayArchive(gameState,{ownerSeat});
    const id=archive.manifest.replayId;
    if(store.read(DATA_PREFIX+id)!==null && store.read(DATA_PREFIX+id)!==undefined) {
      const previous=readArchive(store,id);
      if(checksum(previous)!==checksum(archive))
        throw new ReplayError('REPLAY_ALREADY_EXISTS','Cannot overwrite a replay with a different event ledger');
      return publicManifest(previous);
    }
    store.write(DATA_PREFIX+id,JSON.stringify(archive));
    const ids=indexFrom(store);
    if(!ids.includes(id)) store.write(INDEX_KEY,JSON.stringify([...ids,id].sort()));
    return publicManifest(archive);
  }
  function listReplays() {
    return indexFrom(store).map(id=>publicManifest(readArchive(store,id)));
  }
  function loadReplay(replayId) { return publicManifest(readArchive(store,replayId)); }
  function getReplayFrame(replayId,eventSeq,{viewerSeat,perspective='player-at-time'}={}) {
    const archive=readArchive(store,replayId);
    const seat=viewerSeat??archive.manifest.ownerSeat;
    ownerOnly(archive.manifest,seat);
    if(perspective==='postgame') {
      throw new ReplayError('POSTGAME_UNAVAILABLE',
        'Full postgame disclosure requires a settled verified RuleProfile and an explicit disclosure policy; unavailable in current sandbox');
    }
    if(perspective!=='player-at-time') throw new ReplayError('INVALID_PERSPECTIVE','Unknown replay perspective');
    return frameFrom(archive,eventSeq);
  }
  function getDecisionAnalysis(replayId,eventSeq,{viewerSeat,actionId}={}) {
    const archive=readArchive(store,replayId);
    const m=archive.manifest;
    ownerOnly(m,viewerSeat??m.ownerSeat);
    const decision=archive.decisions.find(d=>d.eventSeq===eventSeq);
    if(!decision) throw new ReplayError('DECISION_NOT_FOUND','No decision at event sequence');
    if(decision.actorSeat!==m.ownerSeat) throw new ReplayError('VIEW_FORBIDDEN','Other players decisions have no authorized own-hand view');
    const frame=frameFrom(archive,decision.beforeEventSeq);
    const view=frame.playerView;
    const legal=view.legalActions.find(a=>a.actionId===decision.actionId);
    if(!legal || legal.kind!==decision.kind) throw new ReplayError('INVALID_ACTION_ID','Recorded action is not legal at the original decision point');
    if(actionId!==undefined && actionId!==decision.actionId)
      throw new ReplayError('INVALID_ACTION_ID','Requested action is not the recorded decision');
    const strategy=analyzePlayerView(view,{seed:'replay-coach-v1',samples:0,maxSimulatedRoutes:0});
    if(strategy.engineVersion!==STRATEGY_ENGINE_VERSION ||
       strategy.viewRef.viewId!==view.viewId ||
       strategy.legalActionIds.length!==view.legalActions.length ||
       strategy.legalActionIds.some((id,i)=>id!==view.legalActions[i].actionId) ||
       strategy.recommendations.some(rec=>!view.legalActions.some(a=>a.actionId===rec.actionId))) {
      throw new ReplayError('STRATEGY_VIEW_MISMATCH','Strategy evidence does not match legal PlayerView');
    }
    const candidates=clone(strategy.recommendations);
    const chosen=candidates.find(r=>r.actionId===decision.actionId);
    const best=candidates[0];
    const s=exactValue(chosen,'postDiscardShanten'),b=exactValue(best,'postDiscardShanten');
    const u=exactValue(chosen,'oneTurnEffectiveCopies'),v=exactValue(best,'oneTurnEffectiveCopies');
    const basic={...V1,analysisVersion:ANALYSIS_VERSION,replayId,eventSeq,
      decisionVersion:DECISION_VERSION,chosenActionId:decision.actionId,
      decisionKind:decision.kind,ruleRef:clone(m.ruleRef),engineVersion:m.engineVersion,
      strategyVersion:STRATEGY_ENGINE_VERSION,scoringVersion:'unavailable',
      sourceViewRef:{gameId:view.gameId,viewId:view.viewId,
        asOfEventSeq:view.asOfEventSeq,audienceSeat:view.audienceSeat},
      legalActionIds:view.legalActions.map(a=>a.actionId),candidates,
      exactComparison:{bestActionId:best?.actionId??null,
        chosenPostDiscardShanten:s,bestPostDiscardShanten:b,
        shantenDifference:s===null||b===null?null:s-b,
        chosenEffectiveCopies:u,bestEffectiveCopies:v,
        effectiveCopyDifference:u===null||v===null?null:v-u,
        epistemic:'exact',scope:'structural-only'},
      epistemic:{structural:'exact',shape:'heuristic',twoTurn:'unknown',
        dealInRisk:'unknown',winRate:'unknown',expectedTai:'unknown'},
      analysisStatus:chosen?'advisory-structural':'unavailable',
      limitations:clone(strategy.limitations)};
    const analysis={...basic,analysisId:'decision-analysis:'+checksum(basic)};
    return {...analysis,findings:findingsFor(analysis)};
  }
  function listCoachingFindings(replayId) {
    const archive=readArchive(store,replayId),owner=archive.manifest.ownerSeat;
    const findings=[];
    for(const d of archive.decisions) if(d.actorSeat===owner && d.kind==='discard')
      findings.push(...getDecisionAnalysis(replayId,d.eventSeq).findings);
    return findings;
  }
  function createReviewQuestion(replayId,eventSeq) {
    const analysis=getDecisionAnalysis(replayId,eventSeq);
    if(analysis.decisionKind!=='discard')
      throw new ReplayError('UNSCORABLE_DECISION','Only current supported discard decisions can produce review scenarios');
    const frame=getReplayFrame(replayId,eventSeq-1);
    return createUnscoredScenario({playerView:frame.playerView,decisionAnalysis:analysis,
      source:{replayId,eventSeq}});
  }
  return Object.freeze({apiVersion:REPLAY_API_VERSION,saveReplay,
    listReplays,loadReplay,getReplayFrame,getDecisionAnalysis,
    listCoachingFindings,createReviewQuestion});
}
