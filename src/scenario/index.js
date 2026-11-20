/** Scenario handoff: structural replay exercises are NOT official scored Academy questions. */
import { readPlayerView } from '../strategy/view.js';
import { validateAcademyDecisionRecord } from '../academy/records.js';
import { getSkillTag } from '../academy/registry.js';
import { ReplayError, V1, clone, checksum, ANALYSIS_VERSION } from '../replay/internal.js';

export const SCENARIO_VERSION='tw16-replay-scenario/1.0.0';
export const ADAPTIVE_EVIDENCE_VERSION='tw16-replay-adaptive-evidence/1.0.0';

export function createUnscoredScenario({playerView,decisionAnalysis,source}) {
  const {view}=readPlayerView(playerView);
  if (!decisionAnalysis || decisionAnalysis.analysisVersion!==ANALYSIS_VERSION ||
      decisionAnalysis.sourceViewRef?.viewId!==view.viewId ||
      decisionAnalysis.sourceViewRef?.asOfEventSeq!==view.asOfEventSeq ||
      decisionAnalysis.sourceViewRef?.audienceSeat!==view.audienceSeat ||
      !view.legalActions.some(a=>a.actionId===decisionAnalysis.chosenActionId) ||
      source?.replayId!==decisionAnalysis.replayId ||
      source?.eventSeq!==decisionAnalysis.eventSeq) {
    throw new ReplayError('SCENARIO_PROVENANCE_MISMATCH','Scenario must refer to the exact PlayerView and replay decision');
  }
  const skillTagIds=[...new Set((decisionAnalysis.findings||[])
    .flatMap(f=>f.skillTagIds).filter(x=>!!getSkillTag(x)))];
  return {...V1,scenarioVersion:SCENARIO_VERSION,scenarioId:'replay-scenario:'+checksum({
    replayId:source.replayId,eventSeq:source.eventSeq,viewId:view.viewId}),
    taskType:'scenario',status:'unscorable',gradingMode:'none',
    verifiedScorer:null,canRecordOfficialAnswer:false,canScheduleReview:false,
    source:{kind:'player-view-snapshot',replayId:source.replayId,
      eventSeq:source.eventSeq,viewId:view.viewId,
      ruleRef:clone(view.ruleRef)},
    generator:{generatorVersion:SCENARIO_VERSION},
    prompt:{playerView:clone(view),legalActionIds:view.legalActions.map(a=>a.actionId)},
    skillTagIds,
    note:'No registered Academy scenario scorer. Strategy ranking is advisory, not a correct-answer key.'};
}

/**
 * Official Academy scoring remains owned by AcademyDecisionRecord V1.
 * The current Academy has ZERO registered scenario fixtures, so this fails closed.
 * Consumers must deduplicate evidenceId transactionally in their own sidecar.
 */
export function prepareVerifiedAdaptiveEvidence({record,question,finding}) {
  try { validateAcademyDecisionRecord(record); }
  catch(error) { throw new ReplayError('UNVERIFIED_SCORER','Official AcademyDecisionRecord validation failed',error); }
  if (!question || question.status!=='validated' ||
      !finding || finding.verificationStatus!=='verified' ||
      finding.replayId!==question.source?.replayId ||
      finding.eventSeq!==question.source?.eventSeq ||
      !record.skillTagIds.every(id=>finding.skillTagIds.includes(id) && !!getSkillTag(id)) ||
      record.sourceViewRef?.viewId!==question.prompt?.playerView?.viewId ||
      record.chosenActionId!==finding.chosenActionId) {
    throw new ReplayError('ADAPTIVE_PROVENANCE_MISMATCH','Record, finding and original view do not match');
  }
  return {...V1,evidenceVersion:ADAPTIVE_EVIDENCE_VERSION,
    evidenceId:'replay-evidence:'+record.recordKind+':'+record.id,
    recordRef:{kind:'academy-v1',id:record.id},replayId:finding.replayId,
    eventSeq:finding.eventSeq,chosenActionId:record.chosenActionId,
    scoringEvidence:clone(record.scoringEvidence),skillTagIds:[...record.skillTagIds],
    reviewable:true,requiresIdempotentInsert:true};
}
