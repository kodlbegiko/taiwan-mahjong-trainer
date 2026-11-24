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
import { V1, clone, checksum, same, ReplayError, REPLAY_VERSION, FRAME_VERSION,
  DECISION_VERSION, ANALYSIS_VERSION, FINDING_VERSION,
  createReplayArchive, validateReplayArchive, replayStateAt, publicManifest, isRobAddedKong } from './internal.js';

export { ReplayError, REPLAY_VERSION, FRAME_VERSION, DECISION_VERSION,
  ANALYSIS_VERSION, FINDING_VERSION } from './internal.js';
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
function strategyUnavailableReason(view) {
  // Strategy V1 has no proposal/robbery event or visible-proposed-tile
  // semantics. Keep the Rules projection intact; never strip events to force
  // it through the old parser. All R7 robbery coaching is legal-only.
  if(isRobAddedKong(view.ruleRef))return 'R7 robbery PlayerView is outside the Strategy V1 contract; legal actions only.';
  if(['tw16-configurable-table','tw16-single-winner-interception'].includes(view.ruleRef.profileId) &&
     (view.self.concealed.some(x=>x.kind==='flower') ||
      view.legalActions.some(a=>a.kind==='replace_flower')))
    return 'Unreplaced flowers are outside the Strategy V1 standard-tile parser; legal actions only.';
  return null;
}
function frameFrom(archive,seq) {
  const m=archive.manifest;
  const state=replayStateAt(archive,seq);
  const view=createPlayerView(state,m.ownerSeat);
  // Rules R3 can expose an own concealed flower while awaiting replacement;
  // Strategy V1's standard-only view parser does not model that legal phase.
  // In that case the authoritative Rules projection above is used as-is,
  // with no Strategy access until flowers are resolved.
  if(view.audienceSeat!==m.ownerSeat||view.asOfEventSeq!==seq||
     view.opponents.some(p=>Object.hasOwn(p,'concealed'))||
     view.publicEvents.some(e=>e.visibility!=='public'||e.seq>seq)||
     view.legalActions.some(a=>a.actorSeat!==m.ownerSeat||a.expectedRevision!==seq)||
     Object.hasOwn(view,'wall')||Object.hasOwn(view,'rng'))
    throw new ReplayError('VIEW_FORBIDDEN','Rules historical view violates the replay disclosure boundary');
  if(isRobAddedKong(m.ruleRef)){
    // Rules v1 redacts anonymous replies and the private trigger provenance
    // of any public event derived from one. Check that boundary explicitly.
    const replies=state.events.filter(e=>e.visibility==='seat-private'&&
      (e.type==='claim'||e.type==='pass'));
    const privateIds=new Set(replies.map(e=>e.causedByActionId));
    const replySeqs=new Set(replies.map(e=>e.seq));
    if(view.publicEvents.some(e=>
      privateIds.has(e.causedByActionId)||
      (replySeqs.has(e.seq)&&(e.type!=='claim'||Object.hasOwn(e,'actorSeat')||
        Object.hasOwn(e,'causedByActionId')||Object.keys(e.payload).length!==0))))
      throw new ReplayError('VIEW_FORBIDDEN','Private claim provenance escaped R7 Rules projection');
  }
  if(!strategyUnavailableReason(view))readPlayerView(view);
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
  function indexVerifiedArchive(id,ids=indexFrom(store)) {
    if(!ids.includes(id)) store.write(INDEX_KEY,JSON.stringify([...ids,id].sort()));
  }
  function sameReplayHistory(previous,next) {
    if(same(previous,next)) return true;
    // R5 created legitimate Replay V1 archives before SHA-256 was added.
    // Preserve those original bytes, while permitting a retry that differs
    // solely in the new optional integrity digest. Never upgrade on read.
    if(previous.manifest?.integrity?.sha256!==undefined ||
       next.manifest?.integrity?.sha256===undefined) return false;
    const withoutNewDigest=clone(next);
    delete withoutNewDigest.manifest.integrity.sha256;
    return same(previous,withoutNewDigest);
  }
  function saveReplay(gameState,{ownerSeat=0,disclosurePolicy='none',unsupportedSubmission=null}={}) {
    const archive=createReplayArchive(gameState,{ownerSeat,disclosurePolicy,unsupportedSubmission});
    const id=archive.manifest.replayId;
    // Preflight the index BEFORE writing sensitive archive bytes. A damaged
    // index must not silently trigger a partially successful new save.
    const ids=indexFrom(store);
    const existing=store.read(DATA_PREFIX+id);
    if(existing!==null && existing!==undefined) {
      const previous=readArchive(store,id);
      if(!sameReplayHistory(previous,archive))
        throw new ReplayError('REPLAY_ALREADY_EXISTS','Cannot overwrite a replay with a different event ledger');
      // Repair only the index: a previously validated archive can exist even
      // when an earlier quota/IO failure prevented its index write.
      indexVerifiedArchive(id,ids);
      return publicManifest(previous);
    }
    store.write(DATA_PREFIX+id,JSON.stringify(archive));
    indexVerifiedArchive(id,ids);
    return publicManifest(archive);
  }
  function recoverReplay(replayId,{viewerSeat}={}) {
    // Caller supplies the exact replay ID. Do not fabricate missing events,
    // regenerate a seed, or auto-discover/accept unvalidated archive bytes.
    const archive=readArchive(store,replayId);
    ownerOnly(archive.manifest,viewerSeat??archive.manifest.ownerSeat);
    indexVerifiedArchive(replayId);
    return publicManifest(archive);
  }
  function listReplays() {
    return indexFrom(store).map(id=>publicManifest(readArchive(store,id)));
  }
  function loadReplay(replayId) { return publicManifest(readArchive(store,replayId)); }
  function getReplayFrame(replayId,eventSeq,{viewerSeat,perspective='player-at-time'}={}) {
    const archive=readArchive(store,replayId);
    const m=archive.manifest;
    ownerOnly(m,viewerSeat??m.ownerSeat);
    if(perspective!=='player-at-time'&&perspective!=='postgame')
      throw new ReplayError('INVALID_PERSPECTIVE','Unknown replay perspective');
    const frame=frameFrom(archive,eventSeq);
    if(perspective==='player-at-time')return frame;
    if(m.completionStatus!=='settled-experimental'&&m.completionStatus!=='settled-verified')
      throw new ReplayError('POSTGAME_UNAVAILABLE','Unsettled games have no postgame disclosure');
    if(m.disclosurePolicy!=='settled-public-only')
      throw new ReplayError('POSTGAME_UNAVAILABLE','Postgame disclosure was not explicitly authorized');
    // Final-state result is the Rules-authoritative settlement. Only an auditable
    // allowlist of public outcome fields is copied; never an opponent hand or wall.
    const final=replayStateAt(archive,archive.events.length);
    const result=final.extensions?.tw16?.result;
    if(!result||final.round.phase!=='settled')
      throw new ReplayError('POSTGAME_UNAVAILABLE','Missing settled Rules result');
    const outcome={reason:result.reason,
      winnerSeat:result.winnerSeat??null,
      delta:clone(result.delta),
      ...(Number.isInteger(result.tai)?{experimentalTai:result.tai}:{}),
      ...(isRobAddedKong(m.ruleRef)&&result.robAddedKong?{robAddedKong:{
        proposalEventId:result.robAddedKong.proposalEventId,
        fromSeat:result.robAddedKong.fromSeat,
        tileId:result.robAddedKong.tileId,
      }}:{}),
      ...(result.claimResolution?{singleWinnerArbitration:{
        selectedSeat:result.claimResolution.selectedSeat,
        declaredWinSeats:clone(result.claimResolution.declaredWinSeats),
        interceptedWinSeats:clone(result.claimResolution.interceptedWinSeats),
        status:'experimental',
      }}:{})};
    return {...frame,perspective:'postgame-public',
      informationBoundary:'historic PlayerView unchanged; end-of-game public result is separate',
      postgameDisclosure:{
        policy:'settled-public-only',status:'experimental-not-certified',
        asOfEventSeq:final.revision,outcome,
        originallyUnavailable:'Final settlement was not known at the historical decision time',
        withheld:['opponent concealed tiles','live wall','tail wall','fixture deck','private claims','seed'],
        allowedForDecisionScoring:false}};
  }
  // Public timeline navigation must use Rules-validated complete-action boundaries,
  // never raw TurnEvent increments (which can land between WIN and SETTLE).
  function listReplayFrameBoundaries(replayId,{viewerSeat}={}) {
    const archive=readArchive(store,replayId),m=archive.manifest;
    ownerOnly(m,viewerSeat??m.ownerSeat);
    const boundaries=[...new Set([1,...archive.decisions.map(d=>d.endEventSeq??d.eventSeq)])]
      .sort((a,b)=>a-b);
    if(boundaries.at(-1)!==m.eventCount)
      throw new ReplayError('CORRUPT_REPLAY','Timeline does not end at the canonical event boundary');
    return Object.freeze(boundaries);
  }
  function getPlayerDecision(replayId,eventSeq,{viewerSeat}={}) {
    const archive=readArchive(store,replayId),m=archive.manifest;
    ownerOnly(m,viewerSeat??m.ownerSeat);
    const d=archive.decisions.find(x=>x.eventSeq===eventSeq||x.endEventSeq===eventSeq);
    if(!d)throw new ReplayError('DECISION_NOT_FOUND','No complete LegalAction decision at event sequence');
    if(d.actorSeat!==m.ownerSeat)
      throw new ReplayError('VIEW_FORBIDDEN','Other players private decisions are not disclosed');
    const frame=frameFrom(archive,d.beforeEventSeq);
    const chosen=frame.playerView.legalActions.find(a=>a.actionId===d.actionId);
    if(!chosen||chosen.kind!==d.kind)
      throw new ReplayError('INVALID_ACTION_ID','Recorded LegalAction fails historical Rules validation');
    return {...V1,decisionVersion:DECISION_VERSION,replayId,
      eventSeq:d.eventSeq,endEventSeq:d.endEventSeq??d.eventSeq,
      beforeEventSeq:d.beforeEventSeq,actorSeat:d.actorSeat,kind:d.kind,
      actionId:d.actionId,sourceViewRef:{
        viewId:frame.playerView.viewId,asOfEventSeq:d.beforeEventSeq,
        audienceSeat:m.ownerSeat},legalActionIds:frame.playerView.legalActions.map(a=>a.actionId)};
  }
  function getDecisionAnalysis(replayId,eventSeq,{viewerSeat,actionId}={}) {
    const archive=readArchive(store,replayId);
    const m=archive.manifest;
    ownerOnly(m,viewerSeat??m.ownerSeat);
    const decision=archive.decisions.find(d=>d.eventSeq===eventSeq||d.endEventSeq===eventSeq);
    if(!decision) throw new ReplayError('DECISION_NOT_FOUND','No decision at event sequence');
    if(decision.actorSeat!==m.ownerSeat) throw new ReplayError('VIEW_FORBIDDEN','Other players decisions have no authorized own-hand view');
    const frame=frameFrom(archive,decision.beforeEventSeq);
    const view=frame.playerView;
    const legal=view.legalActions.find(a=>a.actionId===decision.actionId);
    if(!legal || legal.kind!==decision.kind) throw new ReplayError('INVALID_ACTION_ID','Recorded action is not legal at the original decision point');
    if(actionId!==undefined && actionId!==decision.actionId)
      throw new ReplayError('INVALID_ACTION_ID','Requested action is not the recorded decision');
    const unavailableReason=strategyUnavailableReason(view);
    const strategy=unavailableReason?{
      engineVersion:STRATEGY_ENGINE_VERSION,
      viewRef:{gameId:view.gameId,viewId:view.viewId,asOfEventSeq:view.asOfEventSeq,
        audienceSeat:view.audienceSeat},
      legalActionIds:view.legalActions.map(a=>a.actionId),
      recommendations:[],
      limitations:[unavailableReason],
    }:analyzePlayerView(view,{seed:'replay-coach-v1',samples:0,maxSimulatedRoutes:0});
    if(strategy.engineVersion!==STRATEGY_ENGINE_VERSION ||
       strategy.viewRef.viewId!==view.viewId ||
       strategy.legalActionIds.length!==view.legalActions.length ||
       strategy.legalActionIds.some((id,i)=>id!==view.legalActions[i].actionId) ||
       strategy.recommendations.some(rec=>!view.legalActions.some(a=>a.actionId===rec.actionId))) {
      throw new ReplayError('STRATEGY_VIEW_MISMATCH','Strategy evidence does not match legal PlayerView');
    }
    // StrategyAnalysis has a verified structural ranker for discards only.
    // Claims, passes, kongs, draws and wins get legal alternatives and public
    // factors, NEVER a fabricated recommendation or probability.
    const candidates=clone(strategy.recommendations);
    const openMelds=view.opponents.reduce((sum,p)=>
      sum+p.melds.filter(x=>x.open).length,0);
    for(const action of view.legalActions){
      if(candidates.some(c=>c.actionId===action.actionId))continue;
      candidates.push({actionId:action.actionId,kind:action.kind,rank:null,
        reasonCodes:['RULES_LEGAL_ONLY','NO_VERIFIED_ALTERNATIVE_SCORER'],
        metrics:[
          {name:'opponentOpenMeldCount',value:openMelds,unit:'melds',
            epistemic:'exact',method:'historical public melds',ruleRef:clone(m.ruleRef)},
          {name:'postClaimShanten',value:null,unit:'shanten',
            epistemic:'unknown',method:'no verified post-claim projection',ruleRef:clone(m.ruleRef)},
          {name:'scoringOpportunityCost',value:null,unit:'tai',
            epistemic:'unknown',method:'uncertified full-table scoring',ruleRef:clone(m.ruleRef)},
          {name:'dealInRisk',value:null,unit:'probability',
            epistemic:'unknown',method:'no calibrated danger model',ruleRef:clone(m.ruleRef)}
        ]});
    }
    const chosen=candidates.find(r=>r.actionId===decision.actionId);
    const structural=decision.kind==='discard'&&!unavailableReason;
    const best=structural?strategy.recommendations[0]:null;
    const s=exactValue(chosen,'postDiscardShanten'),b=exactValue(best,'postDiscardShanten');
    const u=exactValue(chosen,'oneTurnEffectiveCopies'),v=exactValue(best,'oneTurnEffectiveCopies');
    const basic={...V1,analysisVersion:ANALYSIS_VERSION,replayId,eventSeq,
      decisionVersion:DECISION_VERSION,chosenActionId:decision.actionId,
      endEventSeq:decision.endEventSeq??decision.eventSeq,
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
        epistemic:structural?'exact':'unknown',scope:'structural-only'},
      epistemic:{structural:structural?'exact':'unknown',shape:unavailableReason?'unknown':'heuristic',twoTurn:'unknown',
        dealInRisk:'unknown',winRate:'unknown',expectedTai:'unknown'},
      analysisStatus:chosen?(structural?'advisory-structural':'advisory-legal-only'):'unavailable',
      recommendationAuthority:'advisory',officialScorerVerified:false,
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
    if(analysis.decisionKind!=='discard'||analysis.analysisStatus!=='advisory-structural')
      throw new ReplayError('UNSCORABLE_DECISION','Only current supported discard decisions can produce review scenarios');
    const frame=getReplayFrame(replayId,eventSeq-1);
    return createUnscoredScenario({playerView:frame.playerView,decisionAnalysis:analysis,
      source:{replayId,eventSeq}});
  }
  return Object.freeze({apiVersion:REPLAY_API_VERSION,saveReplay,recoverReplay,
    listReplays,loadReplay,getReplayFrame,listReplayFrameBoundaries,getPlayerDecision,getDecisionAnalysis,
    listCoachingFindings,createReviewQuestion});
}
