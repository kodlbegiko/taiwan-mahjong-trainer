import {
  ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, V2_ARCHIVE_STORAGE_KEY,
  importTrainingJSON, migrateArchive, emptyArchive, validateArchive,
} from '../storage/archive.js';
import {
  V1, requireV1, requireId, requireObject, requireUtc, cloneJson, canonicalJson,
} from './core.js';
import { validateScoredRecord, makeRecordRef, normalizeRecordEntries } from './records.js';
import { buildAbilityProfile } from './ability.js';
import { buildReviewPlan } from './review.js';
import { validateAbilityProfile, validateReviewPlan, validateTrainingSession } from './validate.js';

export const ACADEMY_STORAGE_KEY = 'tw-mahjong-master-academy:state:v1';
export const ACADEMY_STATE_FORMAT = 'taiwan-mahjong-master-academy-sidecar';
const MAX_RECORDS = 10000;
const MAX_SESSIONS = 10000;
const MAX_BYTES = 20 * 1024 * 1024;

export class AcademyStorageError extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'AcademyStorageError';
    this.code = code;
  }
}
export function emptyAcademyState() {
  return {
    ...V1, format: ACADEMY_STATE_FORMAT, revision: 0,
    academyRecords: [], academyQuestions: [], abilityProfile: null, reviewPlan: null, trainingSessions: [],
  };
}
export function validateAcademyState(state, { validateAcademyDecisionRecord } = {}) {
  requireV1(state, 'Academy sidecar');
  if (state.format !== ACADEMY_STATE_FORMAT || !Number.isSafeInteger(state.revision) || state.revision < 0) {
    throw new RangeError('Unknown Academy state format');
  }
  if (![state.academyRecords, state.academyQuestions, state.trainingSessions].every(Array.isArray) ||
    state.academyRecords.length > MAX_RECORDS || state.academyQuestions.length > MAX_RECORDS ||
    state.trainingSessions.length > MAX_SESSIONS) {
    throw new RangeError('Invalid Academy collection sizes');
  }
  const questions = new Map();
  for (const question of state.academyQuestions) {
    requireV1(question, 'AcademyQuestion snapshot');
    requireId(question.questionId, 'questionId');
    requireId(question.questionVersion, 'questionVersion');
    if (question.status !== 'validated' || question.taskType !== 'scenario' ||
      !Array.isArray(question.skillTagIds)) throw new RangeError('Unscorable question snapshot');
    const key = question.questionId + '@' + question.questionVersion;
    if (questions.has(key)) throw new RangeError('Duplicate Academy question snapshot');
    questions.set(key, question);
  }
  const recordIds = new Set();
  for (const record of state.academyRecords) {
    const ref = makeRecordRef('academy-v1', record);
    const question = questions.get(record.questionRef?.questionId + '@' + record.questionRef?.questionVersion);
    if (!question) throw new RangeError('Academy record has no immutable question snapshot');
    validateScoredRecord(ref, record, { validateAcademyDecisionRecord, question });
    if (recordIds.has(record.id)) throw new RangeError('Duplicate Academy record ID');
    recordIds.add(record.id);
  }
  if (state.abilityProfile !== null) validateAbilityProfile(state.abilityProfile);
  if (state.reviewPlan !== null) {
    validateReviewPlan(state.reviewPlan);
    if (state.abilityProfile && state.abilityProfile.profileId !== state.reviewPlan.profileId) {
      throw new RangeError('Inconsistent derived profile and review plan');
    }
  }
  const sessionIds = new Set();
  for (const session of state.trainingSessions) {
    validateTrainingSession(session);
    if (sessionIds.has(session.sessionId)) throw new RangeError('Duplicate TrainingSession ID');
    sessionIds.add(session.sessionId);
  }
  return true;
}
/** Known migration or fail closed. No guessing at future or previously undocumented schemas. */
export function migrateAcademyState(input, { migrations = {}, validateAcademyDecisionRecord } = {}) {
  requireObject(input, 'Academy state');
  let value = input;
  if (value.schemaVersion !== 1 || value.contractVersion !== V1.contractVersion) {
    const key = String(value.schemaVersion) + ':' + String(value.contractVersion);
    if (typeof migrations[key] !== 'function') throw new AcademyStorageError('UNKNOWN_SCHEMA', 'Unknown Academy state version: ' + key);
    value = migrations[key](cloneJson(value));
  }
  validateAcademyState(value, { validateAcademyDecisionRecord });
  return cloneJson(value);
}
/**
 * Sidecar writes never touch session:v1 or archive:v3. The legacy writer remains
 * createLocalTrainingStore.addDecision; a legacy RecordRef is only accepted after
 * that original archive is durably written and independently read back.
 */
export function createAcademyStore(storage, {
  key = ACADEMY_STORAGE_KEY, validateAcademyDecisionRecord,
  registry, validateAcademyQuestion, profileId = 'local-academy-profile', timezone = 'Asia/Taipei',
  migrations = {},
} = {}) {
  if (key === ARCHIVE_STORAGE_KEY || key === LEGACY_SESSION_KEY ||
    key === V2_ARCHIVE_STORAGE_KEY) throw new RangeError('Academy state key conflicts with a legacy key');
  requireId(key, 'storage key');
  let volatile = emptyAcademyState();
  const present = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
  function readKey(name) {
    if (!present) return null;
    try { return storage.getItem(name); }
    catch (cause) { throw new AcademyStorageError('READ_DENIED', 'Browser storage read denied', cause); }
  }
  function writeKey(name, bytes) {
    if (!present) throw new AcademyStorageError('STORAGE_UNAVAILABLE', 'No durable browser storage');
    try { storage.setItem(name, bytes); }
    catch (cause) { throw new AcademyStorageError('WRITE_DENIED', 'Storage quota or permission denied', cause); }
    if (readKey(name) !== bytes) throw new AcademyStorageError('READBACK_MISMATCH', 'Storage readback differs from written bytes');
  }
  function load() {
    if (!present) return cloneJson(volatile);
    const bytes = readKey(key);
    if (bytes === null) return emptyAcademyState();
    if (typeof bytes !== 'string' || bytes.length > MAX_BYTES) throw new AcademyStorageError('OVERSIZE', 'Academy state too large');
    let parsed;
    try { parsed = JSON.parse(bytes); }
    catch (cause) { throw new AcademyStorageError('CORRUPT_JSON', 'Academy JSON is corrupt; original bytes kept', cause); }
    return migrateAcademyState(parsed, { migrations, validateAcademyDecisionRecord });
  }
  function loadStatus() {
    try { return { ok: true, durable: present, state: load() }; }
    catch (error) { return { ok: false, durable: false, errorCode: error.code ?? 'INVALID_STATE', message: error.message }; }
  }
  function save(state) {
    const next = cloneJson(state);
    validateAcademyState(next, { validateAcademyDecisionRecord });
    const bytes = JSON.stringify(next);
    if (bytes.length > MAX_BYTES) throw new AcademyStorageError('OVERSIZE', 'Academy state too large');
    if (!present) {
      volatile = next;
      return { state: cloneJson(next), durable: false };
    }
    // Read current data before mutation: deny overwriting an invalid/unknown schema.
    load();
    writeKey(key, bytes);
    return { state: load(), durable: true };
  }
  function readLegacy() {
    const v3 = readKey(ARCHIVE_STORAGE_KEY);
    const v2 = v3 === null ? readKey(V2_ARCHIVE_STORAGE_KEY) : null;
    let archive = v3 !== null ? importTrainingJSON(v3) :
      v2 !== null ? importTrainingJSON(v2) : emptyArchive();
    const rawV1 = readKey(LEGACY_SESSION_KEY);
    if (rawV1 !== null && archive.legacySessions.length === 0) {
      const fromV1 = migrateArchive(JSON.parse(rawV1));
      archive = { ...archive, legacySessions: fromV1.legacySessions };
    }
    validateArchive(archive);
    return { archive, hasCanonicalV3: v3 !== null };
  }
  function verifiedEntries(academyState, legacy) {
    return [
      ...legacy.archive.records.filter(record => record.schemaVersion === 3)
        .map(record => ({ kind: 'legacy-v3', record })),
      ...academyState.academyRecords.map(record => ({
        kind: 'academy-v1', record,
        question: academyState.academyQuestions.find(q =>
          q.questionId === record.questionRef.questionId &&
          q.questionVersion === record.questionRef.questionVersion),
      })),
    ];
  }
  function derive(state, asOf, assessmentRefs = [], questionCatalog = []) {
    const legacy = readLegacy();
    const records = verifiedEntries(state, legacy);
    const profile = buildAbilityProfile({
      records, registry, asOf, profileId, legacySessions: legacy.archive.legacySessions,
      assessmentRefs, validateAcademyDecisionRecord,
    });
    const reviewPlan = buildReviewPlan({
      profile, records, asOf, timezone, questionCatalog, validateAcademyDecisionRecord,
      validateAcademyQuestion,
    });
    return { profile, reviewPlan, records };
  }
  function rebuild({ asOf, assessmentRefs = [], questionCatalog = [] } = {}) {
    requireUtc(asOf);
    const before = load();
    const { profile, reviewPlan } = derive(before, asOf, assessmentRefs, questionCatalog);
    return save({
      ...before, revision: before.revision + 1, abilityProfile: profile, reviewPlan,
    });
  }
  function persistScoredRecord(entry, { asOf, assessmentRefs = [], questionCatalog = [] } = {}) {
    requireUtc(asOf);
    const [validated] = normalizeRecordEntries([entry], { validateAcademyDecisionRecord });
    const ref = makeRecordRef(validated.kind, validated.record);
    let state = load();
    if (validated.kind === 'legacy-v3') {
      const legacy = readLegacy();
      const stored = legacy.archive.records.find(r => r.id === ref.id);
      if (!legacy.hasCanonicalV3 || !stored ||
        canonicalJson(stored) !== canonicalJson(validated.record)) {
        throw new AcademyStorageError('LEGACY_NOT_DURABLE', 'Persist legacy record through original v3 archive first');
      }
    } else {
      if (!validated.question) throw new RangeError('Academy question snapshot is required for durable replay');
      const question = validated.question;
      const storedQuestion = state.academyQuestions.find(q =>
        q.questionId === question.questionId && q.questionVersion === question.questionVersion);
      if (storedQuestion && canonicalJson(storedQuestion) !== canonicalJson(question)) {
        throw new RangeError('Conflicting immutable Academy question snapshot');
      }
      const stored = state.academyRecords.find(r => r.id === ref.id);
      if (stored && canonicalJson(stored) !== canonicalJson(validated.record)) {
        throw new RangeError('Conflicting Academy record ID');
      }
      if (!stored || !storedQuestion) {
        const result = save({
          ...state, revision: state.revision + 1,
          academyRecords: stored ? state.academyRecords : [...state.academyRecords, validated.record],
          academyQuestions: storedQuestion ? state.academyQuestions : [...state.academyQuestions, question],
        });
        if (!result.durable) {
          return { recordRef: ref, durable: false, derivedFresh: false, errorCode: 'STORAGE_UNAVAILABLE' };
        }
        state = result.state;
      }
    }
    // At this point the raw canonical record is durably committed and read back.
    // A later failure leaves it intact and recoverable by rebuild().
    try {
      const { profile, reviewPlan } = derive(state, asOf, assessmentRefs, questionCatalog);
      const result = save({
        ...state, revision: state.revision + 1,
        abilityProfile: profile, reviewPlan,
      });
      return { recordRef: ref, durable: result.durable, derivedFresh: result.durable,
        state: result.state, ...(!result.durable ? { errorCode: 'STORAGE_UNAVAILABLE' } : {}) };
    } catch (error) {
      return { recordRef: ref, durable: true, derivedFresh: false,
        errorCode: error.code ?? 'DERIVE_FAILED', message: error.message };
    }
  }
  function saveSession(session) {
    validateTrainingSession(session);
    const state = load();
    const legacy = readLegacy();
    const validRefs = new Set([
      ...legacy.archive.records.filter(r => r.schemaVersion === 3).map(r => 'legacy-v3:' + r.id),
      ...state.academyRecords.map(r => 'academy-v1:' + r.id),
    ]);
    if (!Array.isArray(session.recordRefs) || session.recordRefs.some(ref =>
      !validRefs.has(ref.kind + ':' + ref.id))) throw new RangeError('Session references a non-persisted record');
    const sessions = state.trainingSessions.filter(s => s.sessionId !== session.sessionId);
    const previous = state.trainingSessions.find(s => s.sessionId === session.sessionId);
    if (previous) {
      const oldBytes = canonicalJson(previous), newBytes = canonicalJson(session);
      if (oldBytes !== newBytes) {
        const allowed = { planned: ['active', 'aborted'], active: ['completed', 'aborted'],
          completed: [], aborted: [] };
        if (!allowed[previous.status].includes(session.status)) throw new RangeError('Illegal persisted status transition');
        if (previous.seed !== session.seed ||
          canonicalJson(previous.ruleRef) !== canonicalJson(session.ruleRef) ||
          canonicalJson(previous.questionRefs) !== canonicalJson(session.questionRefs) ||
          previous.recordRefs.some(ref => !session.recordRefs.some(next =>
            next.kind === ref.kind && next.id === ref.id))) {
          throw new RangeError('Session cannot rewrite question provenance or past attempts');
        }
      }
    }
    return save({ ...state, revision: state.revision + 1,
      trainingSessions: [...sessions, cloneJson(session)].sort((a,b) => a.sessionId.localeCompare(b.sessionId)) });
  }
  return { load, loadStatus, saveSession, persistScoredRecord, rebuild,
    readLegacy, exportJSON: () => JSON.stringify(load()),
    importJSON: json => save(migrateAcademyState(JSON.parse(json), { migrations, validateAcademyDecisionRecord })),
  };
}
