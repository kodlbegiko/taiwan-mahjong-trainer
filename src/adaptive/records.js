import { validateDecisionRecord } from '../training/records.js';
import { requireId, requireObject, requireUtc, requireV1, canonicalJson, uniqueRefs, recordKey } from './core.js';

/** A RecordRef is tagged data, not an ID prefix. The v3 validator is never used on scenarios. */
export function validateRecordRef(ref) {
  requireObject(ref, 'RecordRef');
  if (!['legacy-v3', 'academy-v1'].includes(ref.kind)) throw new RangeError('Unknown RecordRef family');
  requireId(ref.id, 'RecordRef.id');
  if (Object.keys(ref).sort().join(',') !== 'id,kind') throw new RangeError('Unexpected RecordRef fields');
  return true;
}
export function makeRecordRef(kind, record) {
  const ref = { kind, id: record?.id };
  validateRecordRef(ref);
  return ref;
}
const isStringArray = arr => Array.isArray(arr) && arr.every(x => typeof x === 'string' && x.length > 0) && new Set(arr).size === arr.length;

/** Structural gate; semantic scoring MUST additionally come from Learning Academy's validator. */
export function validateAcademyRecordShape(record) {
  requireV1(record, 'AcademyDecisionRecord');
  requireId(record.id);
  requireObject(record.questionRef, 'questionRef');
  requireId(record.questionRef.questionId);
  requireId(record.questionRef.questionVersion);
  requireObject(record.ruleRef, 'ruleRef');
  requireId(record.ruleRef.profileId);
  requireId(record.ruleRef.ruleVersion);
  for (const key of ['scorerId', 'scoringVersion', 'engineVersion', 'chosenActionId']) requireId(record[key], key);
  requireObject(record.sourceViewRef, 'sourceViewRef');
  for (const key of ['gameId', 'viewId']) requireId(record.sourceViewRef[key], key);
  if (!Number.isSafeInteger(record.sourceViewRef.asOfEventSeq) || record.sourceViewRef.asOfEventSeq < 0 ||
    !Number.isInteger(record.sourceViewRef.audienceSeat) || record.sourceViewRef.audienceSeat < 0 || record.sourceViewRef.audienceSeat > 3) {
    throw new RangeError('Invalid source view');
  }
  if (!isStringArray(record.legalActionIds) || !record.legalActionIds.includes(record.chosenActionId)) {
    throw new RangeError('Illegal or duplicate action');
  }
  requireUtc(record.timestamp, 'timestamp');
  if (!Number.isSafeInteger(record.durationMs) || record.durationMs < 0) throw new RangeError('Invalid duration');
  if (!['perfect', 'acceptable', 'improve'].includes(record.grade) ||
    !Number.isFinite(record.score) || record.score < 0 || record.score > 1) throw new RangeError('Invalid grade');
  if (!isStringArray(record.errorTypeIds) || !isStringArray(record.skillTagIds)) throw new RangeError('Invalid taxonomy IDs');
  requireObject(record.scoringEvidence, 'scoringEvidence');
  if (!['exact', 'expert-reviewed'].includes(record.scoringEvidence.basis)) throw new RangeError('Unverified scorer');
  requireId(record.scoringEvidence.fixtureId, 'fixtureId');
  requireId(record.scoringEvidence.answerSnapshotDigest, 'answerSnapshotDigest');
  if (record.recordKind !== 'academy-scenario') throw new RangeError('Not an Academy scenario');
  if (record.sourceAnalysisRef !== undefined) {
    requireObject(record.sourceAnalysisRef, 'sourceAnalysisRef');
    for (const key of ['analysisId', 'engineVersion', 'viewId']) requireId(record.sourceAnalysisRef[key], key);
    if (record.sourceAnalysisRef.engineVersion !== record.engineVersion ||
      record.sourceAnalysisRef.viewId !== record.sourceViewRef.viewId) throw new RangeError('Analysis reference version mismatch');
  }
  return true;
}
/**
 * validateAcademyDecisionRecord is injected by Learning Academy and MUST
 * independently replay/verify the exact immutable scorer+fixture+snapshot.
 * No injected scorer => no accepted academy-v1 evidence, even with a plausible score.
 */
export function validateScoredRecord(ref, record, {
  validateAcademyDecisionRecord,
  question,
} = {}) {
  validateRecordRef(ref);
  requireObject(record, 'record');
  if (ref.id !== record.id) throw new RangeError('RecordRef ID mismatch');
  if (ref.kind === 'legacy-v3') {
    if (record.schemaVersion !== 3) throw new RangeError('legacy-v3 requires a v3 record');
    validateDecisionRecord(record, { verifyAnswers: true });
    if (record.taskType === 'scenario') throw new RangeError('Scenario is not a legacy task');
  } else {
    validateAcademyRecordShape(record);
    if (typeof validateAcademyDecisionRecord !== 'function') throw new RangeError('Academy scorer validator unavailable');
    if (question !== undefined) {
      requireV1(question, 'AcademyQuestion');
      if (question.questionId !== record.questionRef.questionId ||
        question.questionVersion !== record.questionRef.questionVersion ||
        question.status !== 'validated' ||
        question.taskType !== 'scenario' ||
        canonicalJson(question.ruleRef) !== canonicalJson(record.ruleRef) ||
        !Array.isArray(question.skillTagIds) ||
        canonicalJson([...question.skillTagIds].sort()) !== canonicalJson([...record.skillTagIds].sort())) {
        throw new RangeError('Question/record evidence mismatch');
      }
    }
    if (validateAcademyDecisionRecord(record, { question }) !== true) {
      throw new RangeError('Academy scenario scoring was not independently verified');
    }
  }
  return true;
}
/**
 * Input: [{kind:'legacy-v3'|'academy-v1',record,question?},...].
 * Duplicated identical attempts are idempotent; conflicting duplicate IDs fail closed.
 */
export function normalizeRecordEntries(entries, options = {}) {
  if (!Array.isArray(entries)) throw new TypeError('records must be an array');
  const seen = new Map();
  for (const entry of entries) {
    requireObject(entry, 'record entry');
    const ref = makeRecordRef(entry.kind, entry.record);
    validateScoredRecord(ref, entry.record, { ...options, question: entry.question });
    const identity = recordKey(ref);
    const payload = canonicalJson({ record: entry.record, question: entry.question ?? null });
    const previous = seen.get(identity);
    if (previous && previous.payload !== payload) throw new RangeError('Conflicting duplicate record: ' + identity);
    if (!previous) seen.set(identity, { payload, entry: {
      kind: entry.kind, record: JSON.parse(JSON.stringify(entry.record)),
      ...(entry.question ? { question: JSON.parse(JSON.stringify(entry.question)) } : {}),
    } });
  }
  return [...seen.values()].map(x => x.entry).sort((a, b) =>
    Date.parse(a.record.timestamp) - Date.parse(b.record.timestamp) ||
    a.kind.localeCompare(b.kind) || a.record.id.localeCompare(b.record.id));
}
export function sourceRefs(entries) {
  return uniqueRefs(entries.map(entry => makeRecordRef(entry.kind, entry.record)));
}
