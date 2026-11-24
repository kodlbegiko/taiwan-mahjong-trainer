/**
 * Trust boundary for the composed Master Academy (master-academy/1.0.0).
 * Learning owns QuestionPublic/official grading; Adaptive owns provenance and
 * all ability/review/session persistence. UI-only hints are NEVER evidence.
 */
import {
  SKILL_TAGS, LEGACY_ERROR_TO_SKILLS, VERIFIED_SCENARIO_SCORER_COUNT,
  listLessons, listQuestionRefs, toPublicQuestion, submitAcademyAnswer,
  getLessonPublic, validateAcademyDecisionRecord, validateTaxonomy,
  createAcademyProvenance, validateAcademyProvenance,
  listScenarioQuestionRefs, validateScenarioQuestion,
} from '../academy/index.js';
import {
  createAdaptiveLearningAdapter, validateLearningProvenance,
} from '../adaptive/index.js';
import {
  createGame, createPlayerView, getRuleProfile,
} from '../rules/index.js';
import { analyzePlayerView } from '../strategy/index.js';

export const INTEGRATION_CONTRACT_VERSION = 'master-academy/1.0.0';
const clone = value => JSON.parse(JSON.stringify(value));
const callbacks = Object.freeze({
  submitAcademyAnswer, toPublicQuestion, getLessonPublic, validateScenarioQuestion,
});
export const APPROVED_LEGACY_REGISTRY = Object.freeze({
  skills: SKILL_TAGS,
  legacyMappings: Object.freeze({
    taskTypes: Object.freeze({
      discard: Object.freeze(['efficiency.shanten','efficiency.discard']),
      tenpai: Object.freeze(['waits.enumeration']),
      multi_wait: Object.freeze(['waits.enumeration','waits.multi']),
    }),
    errorTypes: LEGACY_ERROR_TO_SKILLS,
  }),
});
function asOfUtc(input) {
  if (typeof input !== 'string' || !Number.isFinite(Date.parse(input)) ||
      !/(?:Z|[+-]\d\d:\d\d)$/.test(input)) {
    throw new TypeError('Explicit ISO asOf timestamp required');
  }
  return new Date(input).toISOString();
}
/**
 * Only certified Learning callbacks are passed to the Adaptive owner.
 * Historical v3 bytes remain in the original archive; pending and finalized
 * provenance live exclusively in Adaptive's versioned sidecar.
 */
export function createMasterAcademyFacade(storage) {
  validateTaxonomy();
  const adapter = createAdaptiveLearningAdapter(storage, {
    learning: callbacks,
    registry: APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord,
    timezone: 'Asia/Taipei',
  });

  function verifiedLinks() {
    const state = adapter.load();
    const {archive,hasCanonicalV3} = adapter.readLegacy();
    const records = new Map(archive.records.filter(r=>r.schemaVersion===3).map(r=>[r.id,r]));
    if (!hasCanonicalV3 && (state.provenanceLinks ?? []).length) {
      throw new RangeError('Provenance has no durable canonical v3 archive');
    }
    const seen = new Set();
    return (state.provenanceLinks ?? []).map(link => {
      const record = records.get(link.recordRef?.id);
      if (!record || seen.has(link.recordRef.id)) throw new RangeError('Invalid or duplicate provenance RecordRef');
      seen.add(link.recordRef.id);
      validateLearningProvenance(link,record,callbacks);
      // Independent Learning-owned source proof (not a UI-selected alias).
      const original = createAcademyProvenance(record,link.academyQuestionRef);
      validateAcademyProvenance(original,record);
      if (original.lessonRef.lessonId!==link.lessonRef.lessonId ||
          original.lessonRef.lessonVersion!==link.lessonRef.lessonVersion ||
          original.legacyExerciseId!==link.underlyingExerciseId ||
          original.scoringVersion!==link.scoringVersion ||
          JSON.stringify(original.skillTagIds)!==JSON.stringify(link.skillTagIds)) {
        throw new RangeError('Learning and Adaptive disagree on provenance');
      }
      return {
        questionId:link.academyQuestionRef.questionId,
        questionVersion:link.academyQuestionRef.questionVersion,
        lessonId:link.lessonRef.lessonId,
        recordRef:clone(link.recordRef),
        underlyingExerciseId:link.underlyingExerciseId,
      };
    });
  }

  return Object.freeze({
    contractVersion: INTEGRATION_CONTRACT_VERSION,
    capabilities: Object.freeze({
      structuralQuestionBank:true,validatedLegacyV3Submission:true,
      abilitySidecar:true,reviewPlan:true,durableAcademyProvenance:true,
      verifiedScenarioScorer:VERIFIED_SCENARIO_SCORER_COUNT>0,
      verifiedFourPlayerRules:false,verifiedSettlement:false,
      strategySandbox:true,academyBrowserLoop:false,
    }),
    getLessons: () => listLessons(),
    getQuestionRefs: filter => listQuestionRefs(filter),
    getPublicQuestion: ref => toPublicQuestion(ref),
    getScenarioQuestionRefs: filter=>listScenarioQuestionRefs(filter),

    submitStructuralAnswer(ref,choice,{timestamp,durationMs,attemptId,asOf,sessionId}={}) {
      const at=asOfUtc(asOf);
      const result=adapter.submitAnswer(ref,choice,{timestamp,durationMs,attemptId,asOf:at,sessionId});
      if (result.gradingResult?.status !== 'graded' ||
          result.recordRef?.kind !== 'legacy-v3') throw new RangeError('No official canonical v3 result');
      // Don't claim success based only on a durable raw record. Both validated
      // provenance and the reconstructed Adaptive evidence must be fresh.
      const verified = result.durable===true && result.provenanceDurable===true &&
        result.derivedFresh===true;
      if (verified) {
        const linked = verifiedLinks().find(x=>x.recordRef.id===result.recordRef.id);
        if (!linked || linked.questionId!==ref.questionId ||
            linked.questionVersion!==ref.questionVersion) {
          throw new RangeError('Durable Academy provenance readback failed');
        }
      }
      return {...result,provenanceDurable:result.provenanceDurable===true,
        derivedFresh:verified};
    },

    getDashboard({asOf}={}) {
      const at=asOfUtc(asOf);
      const state=adapter.rebuild({asOf:at});
      // Revalidate all finished links rather than consuming old UI link claims.
      verifiedLinks();
      return {
        contractVersion:INTEGRATION_CONTRACT_VERSION,
        source:'adaptive-verified-provenance',
        durable:state.durable===true,
        profile:state.profile,reviewPlan:state.reviewPlan,
        recommendation:state.recommendation,
        calibrationStatus:state.profile.calibrationStatus,
        pendingRecovery:state.pendingRecovery,
      };
    },

    getProvenanceLinks() { return verifiedLinks(); },
    getTrainingSession() {
      const sessions=adapter.load().trainingSessions;
      return sessions.length ? clone(sessions.at(-1)) : null;
    },
    resolveReviewQuestion(item) { return adapter.resolveReviewQuestion(item); },
    getRecordProvenance(recordRef) {
      if(recordRef?.kind==='academy-v1'){
        const state=adapter.load(),record=state.academyRecords.find(r=>r.id===recordRef.id);
        if(!record)return null;
        const question=state.academyQuestions.find(q=>q.questionId===record.questionRef.questionId&&
          q.questionVersion===record.questionRef.questionVersion);
        if(!question||validateAcademyDecisionRecord(record,{question})!==true)throw new RangeError('Scenario proof invalid');
        return {recordRef:clone(recordRef),questionRef:clone(record.questionRef),lessonRef:clone(question.lessonRef),
          scoringEvidence:clone(record.scoringEvidence),scoringVersion:record.scoringVersion,
          sourceViewRef:clone(record.sourceViewRef),skillTagIds:clone(record.skillTagIds),
          abilityEvidence:state.abilityProfile?.sourceRecordRefs.some(r=>r.kind==='academy-v1'&&r.id===record.id)===true,
          reviewEvidence:state.reviewPlan?.items.some(i=>i.questionId===record.questionRef.questionId&&
            i.questionVersion===record.questionRef.questionVersion&&i.sourceRecordRefs.some(r=>r.kind==='academy-v1'&&r.id===record.id))===true};
      }
      return verifiedLinks().find(x=>x.recordRef.kind===recordRef?.kind &&
        x.recordRef.id===recordRef?.id) ?? null;
    },

    /** Safe experimental example, NOT a four-player verified profile. */
    analyzeSandboxTurn({gameId='academy-public-sandbox',seed='academy-public-view-seed'}={}) {
      const rule=getRuleProfile('tw16-four-player-sandbox','experimental-move-v1');
      if (rule.status!=='experimental') throw new RangeError('Unsupported RuleProfile status');
      const full=createGame({gameId,seed,profileId:rule.profileId,ruleVersion:rule.ruleVersion});
      const playerView=createPlayerView(full,full.round.currentSeat);
      const analysis=analyzePlayerView(playerView,{seed:'academy-integration-strategy',samples:0});
      if (analysis.recommendations.some(x=>!playerView.legalActions.some(a=>a.actionId===x.actionId))) {
        throw new RangeError('Strategy offered an illegal action');
      }
      return {playerView,analysis,verificationScope:'experimental-draw-discard-only'};
    },

    submitScenarioAnswer(ref,choice,{timestamp,durationMs,attemptId,asOf,sessionId}={}) {
      if(!ref?.questionId?.startsWith('academy-scenario-'))throw new RangeError('Scenario scoring unavailable for unknown question');
      const at=asOfUtc(asOf);
      const result=adapter.submitAnswer(ref,choice,{timestamp,durationMs,attemptId,asOf:at,sessionId});
      if(result.recordRef?.kind!=='academy-v1'||result.gradingResult?.status!=='graded')
        throw new RangeError('No official AcademyDecisionRecord result');
      if(result.durable){
        const stored=adapter.load();
        const record=stored.academyRecords.find(r=>r.id===result.recordRef.id);
        const question=stored.academyQuestions.find(q=>q.questionId===ref.questionId&&q.questionVersion===ref.questionVersion);
        if(!record||!question||validateAcademyDecisionRecord(record,{question})!==true)
          throw new RangeError('Scenario durable readback failed');
      }
      return result;
    },
  });
}
