/** Persisted Learning Academy <-> canonical v3 provenance. No imports from AI3-owned code. */
import { createExercise, replayExercise } from '../training/exercises.js';
import { validateScoredRecord, validateRecordRef } from './records.js';
import { V1, requireV1, requireId, requireObject, canonicalJson, cloneJson, recordKey } from './core.js';

export const PROVENANCE_VERSION = 'academy-provenance/1.0.0';
const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const questionKey = ref => ref.questionId + '@' + ref.questionVersion;

function sourceCallbacks(learning) {
  if (!learning || typeof learning.toPublicQuestion !== 'function' ||
    typeof learning.getLessonPublic !== 'function') {
    throw new RangeError('Verified Learning public question/lesson lookup unavailable');
  }
}
function requiredFields(link) {
  requireV1(link, 'Learning provenance');
  if (link.provenanceVersion !== PROVENANCE_VERSION || link.recordRef?.kind !== 'legacy-v3') {
    throw new RangeError('Unsupported learning provenance version or record family');
  }
  validateRecordRef(link.recordRef);
  requireId(link.underlyingExerciseId, 'underlyingExerciseId');
  for (const [name, ref, fields] of [
    ['academyQuestionRef', link.academyQuestionRef, ['questionId', 'questionVersion']],
    ['lessonRef', link.lessonRef, ['lessonId', 'lessonVersion']],
    ['ruleRef', link.ruleRef, ['profileId', 'ruleVersion']],
  ]) {
    requireObject(ref, name);
    for (const field of fields) requireId(ref[field], name + '.' + field);
  }
  for (const field of ['generatorVersion', 'seed', 'scoringVersion', 'sourceSnapshotRef']) {
    requireId(link[field], field);
  }
  if (!Number.isSafeInteger(link.generatorIndex) || link.generatorIndex < 0)
    throw new RangeError('Invalid provenance generatorIndex');
  if (!Array.isArray(link.skillTagIds) || !link.skillTagIds.length ||
    new Set(link.skillTagIds).size !== link.skillTagIds.length ||
    link.skillTagIds.some(id => typeof id !== 'string' || !id)) {
    throw new RangeError('Invalid provenance SkillTag IDs');
  }
  if (link.sessionId !== undefined) requireId(link.sessionId, 'sessionId');
  requireV1(link.publicQuestion, 'QuestionPublic snapshot');
  if (Object.hasOwn(link.publicQuestion, 'answerKey') ||
    Object.hasOwn(link.publicQuestion, 'playerView') ||
    Object.hasOwn(link.publicQuestion, 'gameState')) {
    throw new RangeError('Private question fields cannot enter provenance');
  }
  if (!same({questionId:link.publicQuestion.questionId,questionVersion:link.publicQuestion.questionVersion},
    link.academyQuestionRef) ||
    !same(link.publicQuestion.lessonRef, link.lessonRef) ||
    !same(link.publicQuestion.ruleRef, link.ruleRef) ||
    !same(link.publicQuestion.skillTagIds, link.skillTagIds)) {
    throw new RangeError('Provenance snapshot references disagree');
  }
}
/** Validates all fields against the canonical v3 record, independent of the current UI. */
export function validateProvenanceShape(link, record) {
  requiredFields(link);
  const ref = link.recordRef;
  validateScoredRecord(ref, record);
  if (record.exerciseId !== link.underlyingExerciseId ||
    record.exerciseId !== link.sourceSnapshotRef ||
    record.scoringVersion !== link.scoringVersion ||
    record.exerciseSnapshot.generatorVersion !== link.generatorVersion ||
    record.exerciseSnapshot.seed !== link.seed ||
    record.exerciseSnapshot.index !== link.generatorIndex ||
    record.exerciseSnapshot.ruleVersion !== link.ruleRef.ruleVersion ||
    record.exerciseSnapshot.taskType !== link.publicQuestion.taskType ||
    link.publicQuestion.generator?.seed !== link.seed ||
    link.publicQuestion.generator?.index !== link.generatorIndex ||
    link.publicQuestion.generator?.generatorVersion !== link.generatorVersion ||
    !same(link.publicQuestion.prompt?.legacyHand, record.exerciseSnapshot.hand) ||
    !same(link.publicQuestion.prompt?.visibleTiles, record.exerciseSnapshot.visibleTiles)) {
    throw new RangeError('Provenance source/version/seed does not match canonical v3 record');
  }
  // A formal deterministic generator replays the original frozen scoring snapshot.
  const ex = record.exerciseSnapshot;
  replayExercise(ex);
  const replay = createExercise({ seed: link.seed, index: link.generatorIndex,
    taskType: link.publicQuestion.taskType, level: ex.requestedLevel,
    visibleTiles: ex.visibleTiles, schemaVersion: 3 });
  if (!same(replay, ex)) throw new RangeError('Provenance cannot replay exact canonical exercise');
  const expectedOptions = ex.taskType === 'discard'
    ? [...new Set(ex.hand)].sort((a,b)=>a-b).map(String)
    : Array.from({length:34},(_,tile)=>tile).filter(tile=>
      ex.hand.filter(x=>x===tile).length + ex.visibleTiles.filter(x=>x===tile).length < 4).map(String);
  if (!same(expectedOptions, link.publicQuestion.prompt?.options) ||
    link.publicQuestion.status !== 'validated') {
    throw new RangeError('QuestionPublic options do not replay or are unscorable');
  }
  return true;
}

/** Explicit AI3 resolver check; never trust a supplied lesson or SkillTag assertion. */
export function validateLearningProvenance(link, record, learning) {
  validateProvenanceShape(link, record);
  sourceCallbacks(learning);
  const question = learning.toPublicQuestion(cloneJson(link.academyQuestionRef));
  const lesson = learning.getLessonPublic(link.lessonRef.lessonId);
  if (!question || !lesson || !same(question, link.publicQuestion) ||
    lesson.lessonId !== link.lessonRef.lessonId ||
    lesson.lessonVersion !== link.lessonRef.lessonVersion ||
    !Array.isArray(lesson.questionRefs) ||
    !lesson.questionRefs.some(ref => same(ref, link.academyQuestionRef)) ||
    !same(lesson.ruleRef, link.ruleRef)) {
    throw new RangeError('Provenance not attested by Learning Academy versioned lookup');
  }
  return true;
}
export function createLearningProvenance({ record, recordRef, academyQuestionRef, learning, sessionId } = {}) {
  sourceCallbacks(learning);
  validateScoredRecord(recordRef, record);
  if (recordRef.kind !== 'legacy-v3') throw new RangeError('Legacy Academy question needs canonical v3 record');
  const publicQuestion = learning.toPublicQuestion(academyQuestionRef);
  requireV1(publicQuestion, 'QuestionPublic');
  if (!same({ questionId: publicQuestion.questionId, questionVersion: publicQuestion.questionVersion }, academyQuestionRef)) {
    throw new RangeError('Unknown AcademyQuestion version');
  }
  const link = {
    ...V1, provenanceVersion: PROVENANCE_VERSION,
    recordRef: cloneJson(recordRef), underlyingExerciseId: record.exerciseId,
    academyQuestionRef: cloneJson(academyQuestionRef),
    lessonRef: cloneJson(publicQuestion.lessonRef), skillTagIds: cloneJson(publicQuestion.skillTagIds),
    ruleRef: cloneJson(publicQuestion.ruleRef),
    generatorVersion: publicQuestion.generator.generatorVersion,
    seed: publicQuestion.generator.seed, generatorIndex: publicQuestion.generator.index,
    scoringVersion: record.scoringVersion, sourceSnapshotRef: record.exerciseId,
    publicQuestion: cloneJson(publicQuestion),
    ...(sessionId ? { sessionId } : {}),
  };
  validateLearningProvenance(link, record, learning);
  return link;
}
/** Structural validation always runs. When Learning exists, full lookup is mandatory. */
export function validateProvenanceLinks(links, records, { learning, verifyLookup = Boolean(learning) } = {}) {
  if (!Array.isArray(links)) throw new TypeError('Provenance sidecar must be an array');
  if (!Array.isArray(records)) throw new TypeError('Canonical records must be an array');
  const recordMap = new Map(records.map(record => [recordKey({kind:'legacy-v3',id:record.id}), record]));
  const seenRefs = new Map(), seenSources = new Map(), seenQuestions = new Map();
  for (const link of links) {
    const record = recordMap.get(recordKey(link.recordRef ?? {}));
    if (!record) throw new RangeError('Orphan learning provenance RecordRef');
    validateProvenanceShape(link, record);
    if (verifyLookup) validateLearningProvenance(link, record, learning);
    const refKey = recordKey(link.recordRef);
    const sourceKey = link.underlyingExerciseId;
    const qKey = questionKey(link.academyQuestionRef);
    if (seenRefs.has(refKey)) throw new RangeError('Duplicate provenance RecordRef');
    if (seenSources.has(sourceKey) && seenSources.get(sourceKey) !== qKey)
      throw new RangeError('Same exercise has conflicting Academy aliases');
    if (seenQuestions.has(qKey) && seenQuestions.get(qKey) !== sourceKey)
      throw new RangeError('Same Academy question aliases multiple exercises');
    seenRefs.set(refKey, link); seenSources.set(sourceKey, qKey); seenQuestions.set(qKey, sourceKey);
  }
  return true;
}
