/** AI6-facing adapter. AI3 owns all curriculum data and canonical grading.
 * Do NOT import Learning internals here; inject its public callbacks.
 */
import { createLocalTrainingStore } from '../storage/local.js';
import { replayExercise } from '../training/exercises.js';
import { V1, requireId, requireUtc, canonicalJson } from './core.js';
import { createAcademyStore, AcademyStorageError } from './storage.js';
import { createLearningProvenance, validateLearningProvenance } from './provenance.js';
import { validateScoredRecord } from './records.js';
import { transitionTrainingSession } from './session.js';
import { toAbilityPublic } from './ability.js';
import { getTodayRecommendation } from './review.js';

const same = (a, b) => canonicalJson(a) === canonicalJson(b);
function publicLegacy(record) {
  const exercise = replayExercise(record.exerciseSnapshot);
  const options = exercise.taskType === 'discard'
    ? [...new Set(exercise.hand)].sort((a,b)=>a-b).map(String)
    : Array.from({length:34},(_,tile)=>tile).filter(tile=>
      exercise.hand.filter(x=>x===tile).length +
      exercise.visibleTiles.filter(x=>x===tile).length < 4).map(String);
  return {
    ...V1, questionId: exercise.id, questionVersion: 'legacy-exercise-v3',
    taskType: exercise.taskType, lessonRef: null, skillTagIds: [],
    ruleRef: { profileId: 'legacy-exercise-v3', ruleVersion: exercise.ruleVersion },
    generator: { seed: exercise.seed, index: exercise.index,
      generatorVersion: exercise.generatorVersion },
    prompt: { legacyHand: [...exercise.hand], visibleTiles: [...exercise.visibleTiles], options },
    status: 'validated',
  };
}

export function createAdaptiveLearningAdapter(storage, {
  learning, registry, validateAcademyDecisionRecord, profileId, timezone,
} = {}) {
  if (!learning || typeof learning.submitAcademyAnswer !== 'function' ||
    typeof learning.toPublicQuestion !== 'function' ||
    typeof learning.getLessonPublic !== 'function') {
    throw new TypeError('AI3 public submit/lookup callbacks are required');
  }
  const legacy = createLocalTrainingStore(storage);
  const academy = createAcademyStore(storage, {
    learning, registry, validateAcademyDecisionRecord, profileId, timezone,
  });
  const persisted = ref => {
    const { archive, hasCanonicalV3 } = academy.readLegacy();
    if (!hasCanonicalV3 || ref?.kind !== 'legacy-v3') return null;
    return archive.records.find(r => r.schemaVersion === 3 && r.id === ref.id) ?? null;
  };
  function attachToSession(sessionId, link, at) {
    const session = academy.getSession(sessionId);
    if (!session) throw new RangeError('Unknown persisted TrainingSession');
    if (session.status === 'completed' || session.status === 'aborted') {
      if (session.recordRefs.some(ref => same(ref, link.recordRef))) return session;
      throw new RangeError('Cannot append to a terminal session');
    }
    if (!session.questionRefs.some(q => same(q, link.academyQuestionRef)))
      throw new RangeError('Answer is not in session question order');
    const state = academy.load();
    const existing = (state.provenanceLinks ?? []).filter(p =>
      p.sessionId === sessionId && same(p.academyQuestionRef, link.academyQuestionRef));
    if (existing.length !== 1 || existing[0].recordRef.id !== link.recordRef.id)
      throw new RangeError('Duplicate answer to same TrainingSession question');
    const has = session.recordRefs.some(ref => same(ref, link.recordRef));
    let next = session;
    if (session.status === 'planned') {
      next = transitionTrainingSession(session, 'active', { at, recordRefs: [link.recordRef] });
    } else if (!has) {
      next = { ...session, recordRefs: [...session.recordRefs, link.recordRef] };
    }
    if (!same(next, session)) academy.saveSession(next);
    const allAnswered = next.questionRefs.length > 0 &&
      next.questionRefs.every(q => (academy.load().provenanceLinks ?? []).some(p =>
        p.sessionId === sessionId && same(p.academyQuestionRef, q)));
    if (allAnswered && next.status === 'active') {
      next = transitionTrainingSession(next, 'completed', { at });
      academy.saveSession(next);
    }
    return next;
  }
  function reconcileSession(sessionId, { asOf } = {}) {
    const at = requireUtc(asOf);
    const state = academy.load();
    const session = academy.getSession(sessionId);
    if (!session) throw new RangeError('Unknown TrainingSession');
    const linked = (state.provenanceLinks ?? []).filter(p => p.sessionId === sessionId);
    if (session.status === 'completed' || session.status === 'aborted') {
      // Read only: a terminal session cannot be silently rewritten.
      if (linked.some(p => !session.recordRefs.some(ref => same(ref, p.recordRef))))
        throw new RangeError('Terminal session has unreconciled source records');
      return session;
    }
    for (const p of linked) {
      const record = persisted(p.recordRef);
      if (!record) throw new RangeError('Missing canonical answer for session provenance');
      validateLearningProvenance(p, record, learning);
    }
    const answered = new Set();
    for (const p of linked) {
      const key = p.academyQuestionRef.questionId + '@' + p.academyQuestionRef.questionVersion;
      if (answered.has(key)) throw new RangeError('Duplicate answer to one session question');
      answered.add(key);
    }
    // Re-apply in the immutable planned question order, not arbitrary persistence order.
    const ordered = session.questionRefs.flatMap(q =>
      linked.filter(p => same(q, p.academyQuestionRef)));
    let current = session;
    for (const link of ordered) current = attachToSession(sessionId, link, at);
    return current;
  }
  function resolveReviewQuestion(item) {
    if (!item?.sourceRecordRefs?.length) return { available: false, reason: 'missing-evidence' };
    const state = academy.load();
    const matching = (state.provenanceLinks ?? []).filter(p =>
      p.academyQuestionRef.questionId === item.questionId &&
      p.academyQuestionRef.questionVersion === item.questionVersion &&
      item.sourceRecordRefs.some(ref => same(ref, p.recordRef)));
    if (matching.length) {
      const link = matching[0];
      const record = persisted(link.recordRef);
      if (!record) return { available: false, reason: 'missing-canonical-record' };
      try {
        validateLearningProvenance(link, record, learning);
        const question = learning.toPublicQuestion(link.academyQuestionRef);
        const lesson = learning.getLessonPublic(link.lessonRef.lessonId);
        return { available: true, source: 'academy', question, lesson,
          questionRef: { ...link.academyQuestionRef }, recordRef: { ...link.recordRef },
          skillTagIds: [...link.skillTagIds], scoringVersion: link.scoringVersion };
      } catch {
        return { available: false, reason: 'source-version-unavailable',
          questionRef: { ...link.academyQuestionRef } };
      }
    }
    // Never fabricate an Academy lesson from an orphan ex3-* v3 record.
    if (item.questionVersion !== 'legacy-exercise-v3') {
      return { available: false, reason: 'unlinked-academy-question' };
    }
    const ref = item.sourceRecordRefs.find(r => r.kind === 'legacy-v3');
    const record = ref && persisted(ref);
    if (!record || record.exerciseId !== item.questionId) {
      return { available: false, reason: 'missing-legacy-replay' };
    }
    try {
      validateScoredRecord(ref, record);
      return { available: true, source: 'legacy-v3', question: publicLegacy(record),
        lesson: null, questionRef: { questionId: record.exerciseId, questionVersion: 'legacy-exercise-v3' },
        recordRef: ref, skillTagIds: [...item.skillTagIds],
        scoringVersion: record.scoringVersion };
    } catch {
      return { available: false, reason: 'legacy-replay-invalid' };
    }
  }
  function submitAnswer(ref, choice, {
    timestamp, durationMs, attemptId, asOf, sessionId,
  } = {}) {
    const at = requireUtc(asOf);
    const graded = learning.submitAcademyAnswer(ref, choice, { timestamp, durationMs, attemptId });
    if (graded.recordRef.kind !== 'legacy-v3') throw new RangeError('No verified scenario scorer installed');
    validateScoredRecord(graded.recordRef, graded.record);
    // Fully validate the trusted curriculum source BEFORE touching the old archive.
    const link = createLearningProvenance({ record: graded.record,
      recordRef: graded.recordRef, academyQuestionRef: ref, learning, sessionId });
    if (sessionId) {
      requireId(sessionId, 'sessionId');
      const session = academy.getSession(sessionId);
      if (!session || !session.questionRefs.some(q => same(q, ref))) {
        throw new RangeError('Invalid active session reference');
      }
      if (['completed', 'aborted'].includes(session.status)) {
        const prior = academy.getProvenance(graded.recordRef);
        if (!prior || !session.recordRefs.some(r => same(r, graded.recordRef)) ||
          !same(prior.academyQuestionRef, ref)) {
          throw new RangeError('Terminal Session rejects new answer');
        }
      }
      const existing = (academy.load().provenanceLinks ?? []).filter(p =>
        p.sessionId === sessionId && same(p.academyQuestionRef, ref));
      if (existing.length && !same(existing[0].recordRef, graded.recordRef)) {
        throw new RangeError('Question has already been submitted in this session');
      }
    }
    const existing = persisted(graded.recordRef);
    if (existing) {
      if (!same(existing, graded.record)) throw new RangeError('Conflicting canonical v3 attempt ID');
    } else {
      const saved = legacy.addDecision(graded.record.exerciseSnapshot, graded.record.chosen,
        { timestamp, durationMs, attemptId: graded.record.id });
      if (!same(saved, graded.record)) throw new RangeError('Official v3 grading mismatch');
    }
    const stored = persisted(graded.recordRef);
    if (!stored || !same(stored, graded.record)) {
      return { gradingResult: graded.gradingResult, recordRef: graded.recordRef,
        durable: false, derivedFresh: false, errorCode: 'LEGACY_NOT_DURABLE' };
    }
    let step;
    try {
      step = academy.persistLearningProvenance({
        recordRef: graded.recordRef, record: stored, academyQuestionRef: ref, sessionId,
      }, { asOf: at });
    } catch (error) {
      return { gradingResult: graded.gradingResult, recordRef: graded.recordRef,
        durable: true, provenanceDurable: false, derivedFresh: false,
        errorCode: error.code ?? 'PROVENANCE_WRITE_FAILED', message: error.message };
    }
    if (!step.provenanceDurable) return { ...step, gradingResult: graded.gradingResult };
    if (sessionId) {
      try { attachToSession(sessionId, link, at); }
      catch (error) {
        return { ...step, gradingResult: graded.gradingResult,
          sessionFresh: false, errorCode: error.code ?? 'SESSION_UPDATE_FAILED',
          message: error.message };
      }
    }
    return { ...step, gradingResult: graded.gradingResult,
      sessionFresh: true };
  }
  function rebuild({ asOf, ...options } = {}) {
    const result = academy.rebuild({ asOf, ...options });
    for (const session of result.state.trainingSessions) {
      if ((result.state.provenanceLinks ?? []).some(p => p.sessionId === session.sessionId)) {
        reconcileSession(session.sessionId, { asOf });
      }
    }
    const { abilityProfile, reviewPlan } = result.state;
    return {
      durable: result.durable, profile: toAbilityPublic(abilityProfile), reviewPlan,
      recommendation: getTodayRecommendation(abilityProfile, reviewPlan, asOf),
    };
  }
  return Object.freeze({
    contractVersion: V1.contractVersion,
    submitAnswer, rebuild, resolveReviewQuestion, reconcileSession,
    getSession: academy.getSession, saveSession: academy.saveSession,
    load: academy.load, loadStatus: academy.loadStatus,
    getProvenance: academy.getProvenance, readLegacy: academy.readLegacy,
  });
}
