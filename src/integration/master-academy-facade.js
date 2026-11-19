/**
 * Master Academy integration seam (Phase 2 candidate; NOT a complete UI).
 * Integrates real Learning Academy v3 structural questions with Adaptive V1.
 * No fake scenario scorer, Rule Engine state or realtime mobile proof.
 */
import {
  SKILL_TAGS, LEGACY_ERROR_TO_SKILLS, VERIFIED_SCENARIO_SCORER_COUNT,
  listLessons, listQuestionRefs, toPublicQuestion, submitAcademyAnswer,
  validateTaxonomy,
} from '../academy/index.js';
import {
  createAcademyStore, toAbilityPublic, getTodayRecommendation,
} from '../adaptive/index.js';
import { createLocalTrainingStore } from '../storage/local.js';
import { ARCHIVE_STORAGE_KEY, importTrainingJSON } from '../storage/archive.js';

export const INTEGRATION_CONTRACT_VERSION = 'master-academy/1.0.0';

export const APPROVED_LEGACY_REGISTRY = Object.freeze({
  skills: SKILL_TAGS,
  legacyMappings: Object.freeze({
    taskTypes: Object.freeze({
      discard: Object.freeze(['efficiency.shanten', 'efficiency.discard']),
      tenpai: Object.freeze(['waits.enumeration']),
      multi_wait: Object.freeze(['waits.enumeration', 'waits.multi']),
    }),
    errorTypes: LEGACY_ERROR_TO_SKILLS,
  }),
});

function validAsOf(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('A valid explicit asOf ISO timestamp is required');
  }
  return new Date(value).toISOString();
}

function readDurablyStoredV3(storage, id) {
  if (!storage || typeof storage.getItem !== 'function') return null;
  const bytes = storage.getItem(ARCHIVE_STORAGE_KEY);
  if (typeof bytes !== 'string') return null;
  const archive = importTrainingJSON(bytes);
  return archive.records.find(record => record.schemaVersion === 3 && record.id === id) ?? null;
}

export function createMasterAcademyFacade(storage) {
  validateTaxonomy();
  const legacy = createLocalTrainingStore(storage);
  const adaptive = createAcademyStore(storage, { registry: APPROVED_LEGACY_REGISTRY });
  return Object.freeze({
    contractVersion: INTEGRATION_CONTRACT_VERSION,
    capabilities: Object.freeze({
      structuralQuestionBank: true,
      validatedLegacyV3Submission: true,
      abilitySidecar: true,
      reviewPlan: true,
      verifiedScenarioScorer: VERIFIED_SCENARIO_SCORER_COUNT > 0,
      verifiedFourPlayerRules: false,
      strategyIntegration: false,
      academyBrowserLoop: false,
    }),
    getLessons: () => listLessons(),
    getQuestionRefs: filter => listQuestionRefs(filter),
    getPublicQuestion: ref => toPublicQuestion(ref),

    /**
     * Two-stage operation: Learning's official v3 grader -> original archive:v3
     * durable readback -> Adaptive's independently validated v1 sidecar.
     * On failure, leave existing historic keys and committed records intact.
     */
    submitStructuralAnswer(ref, choice, { timestamp, durationMs, attemptId, asOf } = {}) {
      const at = validAsOf(asOf);
      const result = submitAcademyAnswer(ref, choice, { timestamp, durationMs, attemptId });
      if (result.record.schemaVersion !== 3 || result.recordRef.kind !== 'legacy-v3') {
        throw new RangeError('Official structural question must produce a v3 record');
      }
      // Legacy persistence remains owned by the original v3 store.
      const actual = legacy.addDecision(result.record.exerciseSnapshot, result.record.chosen,
        { timestamp, durationMs, attemptId });
      if (JSON.stringify(actual) !== JSON.stringify(result.record)) {
        throw new Error('Canonical v3 grade/record mismatch');
      }
      const stored = readDurablyStoredV3(storage, actual.id);
      if (!stored || JSON.stringify(stored) !== JSON.stringify(actual)) {
        return { gradingResult: result.gradingResult, recordRef: result.recordRef,
          durable: false, derivedFresh: false, errorCode: 'LEGACY_NOT_DURABLE' };
      }
      const derived = adaptive.persistScoredRecord({ kind: 'legacy-v3', record: actual }, { asOf: at });
      return {
        gradingResult: result.gradingResult, recordRef: result.recordRef,
        durable: derived.durable === true,
        derivedFresh: derived.derivedFresh === true,
        ...(derived.errorCode ? { errorCode: derived.errorCode } : {}),
      };
    },

    getDashboard({ asOf } = {}) {
      const at = validAsOf(asOf);
      // On corrupted/newer schema, Adaptive's loader refuses to overwrite the sidecar.
      const result = adaptive.rebuild({ asOf: at });
      const { abilityProfile, reviewPlan } = result.state;
      return {
        contractVersion: INTEGRATION_CONTRACT_VERSION,
        source: 'validated-v3-records',
        durable: result.durable === true,
        profile: toAbilityPublic(abilityProfile),
        reviewPlan,
        recommendation: getTodayRecommendation(abilityProfile, reviewPlan, at),
        calibrationStatus: abilityProfile.calibrationStatus,
      };
    },

    /** No vetted scenario scorer exists. Explicitly fail closed, never fabricate ability. */
    submitScenarioAnswer() {
      throw new RangeError('Scenario scoring unavailable: no independently verified scorer');
    },
  });
}
