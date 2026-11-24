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
import { transitionTrainingSession } from './session.js';
import { validateAbilityProfile, validateReviewPlan, validateTrainingSession } from './validate.js';
import { createLearningProvenance, validateProvenanceLinks, validateLearningProvenance,
  validateProvenanceShape } from './provenance.js';

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
    academyRecords: [], academyQuestions: [], provenanceLinks: [], pendingProvenance: [], abilityProfile: null, reviewPlan: null, trainingSessions: [],
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
  if (state.provenanceLinks !== undefined && (!Array.isArray(state.provenanceLinks) ||
    state.provenanceLinks.length > MAX_RECORDS)) throw new RangeError('Invalid provenance collection');
  if (state.pendingProvenance !== undefined && (!Array.isArray(state.pendingProvenance) ||
    state.pendingProvenance.length > MAX_RECORDS)) throw new RangeError('Invalid pending provenance collection');
  const pendingIds = new Set();
  for (const pending of state.pendingProvenance ?? []) {
    requireObject(pending, 'pendingProvenance');
    validateProvenanceShape(pending.link, pending.record);
    const key = pending.link.recordRef.kind + ':' + pending.link.recordRef.id;
    if (pendingIds.has(key)) throw new RangeError('Duplicate pending provenance');
    pendingIds.add(key);
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
  const sessionIds = new Set(), assignedScenarioRecords=new Set();
  for (const session of state.trainingSessions) {
    validateTrainingSession(session);
    if (sessionIds.has(session.sessionId)) throw new RangeError('Duplicate TrainingSession ID');
    sessionIds.add(session.sessionId);
    const scenarioQuestionKeys=new Set();
    for(const ref of session.recordRefs.filter(r=>r.kind==='academy-v1')){
      const record=state.academyRecords.find(r=>r.id===ref.id);
      if(!record||assignedScenarioRecords.has(ref.id)||
         canonicalJson(record.ruleRef)!==canonicalJson(session.ruleRef)||
         !session.questionRefs.some(q=>canonicalJson(q)===canonicalJson(record.questionRef)))
        throw new RangeError('Invalid or reused scenario session record');
      const qkey=record.questionRef.questionId+'@'+record.questionRef.questionVersion;
      if(scenarioQuestionKeys.has(qkey))throw new RangeError('Duplicate scenario session question');
      scenarioQuestionKeys.add(qkey);assignedScenarioRecords.add(ref.id);
    }
    if(session.extensions?.['adaptive.daily']?.mode==='scenario'&&
      (session.recordRefs.some(r=>r.kind!=='academy-v1')||
       session.status==='completed'&&scenarioQuestionKeys.size!==session.questionRefs.length))
      throw new RangeError('Incomplete or mixed scenario Daily session');
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
  registry, validateAcademyQuestion, learning, profileId = 'local-academy-profile', timezone = 'Asia/Taipei',
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
    const state = migrateAcademyState(parsed, { migrations, validateAcademyDecisionRecord });
    validatePersistedProvenance(state);
    return state;
  }
  function validatePersistedProvenance(state) {
    if (!(state.provenanceLinks?.length)) return true;
    const { archive, hasCanonicalV3 } = readLegacy();
    if (!hasCanonicalV3) throw new AcademyStorageError('ORPHAN_PROVENANCE', 'Missing canonical archive:v3');
    const records = archive.records.filter(r => r.schemaVersion === 3);
    validateProvenanceLinks(state.provenanceLinks, records);
    // An unavailable historical version remains frozen and unscorable; an
    // available official source that DISAGREES is corruption and must be denied.
    if (learning) for (const link of state.provenanceLinks) {
      let question;
      try { question = learning.toPublicQuestion(link.academyQuestionRef); }
      catch { continue; } // retired/missing version: reviewed as unavailable
      if (question == null) continue;
      const record = records.find(r => r.id === link.recordRef.id);
      validateLearningProvenance(link, record, learning);
    }
    return true;
  }
  function loadStatus() {
    try { return { ok: true, durable: present, state: load() }; }
    catch (error) { return { ok: false, durable: false, errorCode: error.code ?? 'INVALID_STATE', message: error.message }; }
  }
  function save(state) {
    const next = cloneJson(state);
    validateAcademyState(next, { validateAcademyDecisionRecord });
    validatePersistedProvenance(next);
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
  function derive(state, asOf, assessmentRefs = [], questionCatalog = [], reservedQuestionRefs = []) {
    const legacy = readLegacy();
    const records = verifiedEntries(state, legacy);
    const provenanceLinks = state.provenanceLinks ?? [];
    const verifiedLinks = [];
    for (const link of provenanceLinks) {
      if (!learning) continue;
      try {
        const record = legacy.archive.records.find(r => r.id === link.recordRef.id);
        validateLearningProvenance(link, record, learning);
        verifiedLinks.push(link);
      } catch { /* unavailable/moved Learning versions cannot count as verified curriculum evidence */ }
    }
    const profile = buildAbilityProfile({
      records, registry, asOf, profileId, legacySessions: legacy.archive.legacySessions,
      assessmentRefs, validateAcademyDecisionRecord, provenanceLinks: verifiedLinks,
    });
    // Restore historical scenario review from the immutable, revalidated stored
    // public question, not a UI hint. A retired/unavailable version fails closed.
    const catalog=new Map(questionCatalog.map(q=>[q.questionId+'@'+q.questionVersion,q]));
    if(typeof validateAcademyQuestion==='function')for(const q of state.academyQuestions){
      if(validateAcademyQuestion(q)!==true)continue;
      const key=q.questionId+'@'+q.questionVersion;
      if(!catalog.has(key))catalog.set(key,{questionId:q.questionId,questionVersion:q.questionVersion,
        taskType:'scenario',questionSnapshot:q,available:true});
    }
    const reviewPlan = buildReviewPlan({
      profile, records, asOf, timezone, questionCatalog:[...catalog.values()], reservedQuestionRefs,
      provenanceLinks, learning, validateAcademyDecisionRecord, validateAcademyQuestion,
    });
    return { profile, reviewPlan, records };
  }
  function rebuild({ asOf, assessmentRefs = [], questionCatalog = [], reservedQuestionRefs = [] } = {}) {
    requireUtc(asOf);
    const before = load();
    const { profile, reviewPlan } = derive(before, asOf, assessmentRefs, questionCatalog, reservedQuestionRefs);
    return save({
      ...before, revision: before.revision + 1, abilityProfile: profile, reviewPlan,
    });
  }
  function persistScoredRecord(entry, { asOf, assessmentRefs = [], questionCatalog = [], reservedQuestionRefs = [], sessionId } = {}) {
    requireUtc(asOf);
    const [validated] = normalizeRecordEntries([entry], { validateAcademyDecisionRecord });
    const ref = makeRecordRef(validated.kind, validated.record);
    let state = load();
    if (validated.kind === 'legacy-v3') {
      if(sessionId!==undefined)throw new RangeError('Legacy session must use canonical v3 provenance flow');
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
      // The raw scenario record, immutable question and its session reference
      // share one atomic sidecar write. No cross-store write-ahead is needed.
      let sessions=state.trainingSessions;
      if(sessionId!==undefined){
        requireId(sessionId,'sessionId');
        const session=sessions.find(s=>s.sessionId===sessionId);
        if(!session||session.extensions?.['adaptive.daily']?.mode!=='scenario'||
           canonicalJson(session.ruleRef)!==canonicalJson(validated.record.ruleRef)||
           !session.questionRefs.some(q=>canonicalJson(q)===canonicalJson(validated.record.questionRef)))
          throw new RangeError('Invalid scenario session reference');
        const has=session.recordRefs.some(r=>r.kind==='academy-v1'&&r.id===ref.id);
        if(stored&&!has)throw new RangeError('Cannot attach historical scenario attempt to a new session');
        if(!has){
          if(!['planned','active'].includes(session.status))throw new RangeError('Terminal scenario session');
          if(session.recordRefs.some(r=>r.kind==='academy-v1'&&
            canonicalJson(state.academyRecords.find(x=>x.id===r.id)?.questionRef)===canonicalJson(validated.record.questionRef)))
            throw new RangeError('Scenario question already submitted in session');
          let next=session.status==='planned'?transitionTrainingSession(session,'active',{at:asOf,recordRefs:[ref]}):
            {...session,recordRefs:[...session.recordRefs,ref]};
          if(next.recordRefs.length===next.questionRefs.length)next=transitionTrainingSession(next,'completed',{at:asOf});
          sessions=sessions.map(s=>s.sessionId===sessionId?next:s);
        }
      } else if(stored&&sessions.some(s=>s.recordRefs.some(r=>r.kind==='academy-v1'&&r.id===ref.id))){
        throw new RangeError('Scenario attempt already belongs to a session');
      }
      if (!stored || !storedQuestion || sessions!==state.trainingSessions) {
        const result = save({
          ...state, revision: state.revision + 1,trainingSessions:sessions,
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
      const { profile, reviewPlan } = derive(state, asOf, assessmentRefs, questionCatalog, reservedQuestionRefs);
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
  /**
   * Durable write-ahead INTENT (not scored evidence), needed because browser
   * localStorage cannot atomically commit the old v3 archive and new sidecar.
   * On crash after v3 append but before final provenance, recoverPending()
   * can link the official question without guessing from its geometry.
   */
  function prepareLearningProvenance({ recordRef, record, academyQuestionRef, sessionId }) {
    const link = createLearningProvenance({ record, recordRef, academyQuestionRef, learning, sessionId });
    const state = load();
    const pending = state.pendingProvenance ?? [];
    const old = pending.find(p => p.link.recordRef.id === recordRef.id &&
      p.link.recordRef.kind === recordRef.kind);
    if (old && (canonicalJson(old.record) !== canonicalJson(record) ||
      canonicalJson(old.link) !== canonicalJson(link))) {
      throw new RangeError('Conflicting prepared provenance intent');
    }
    const finalized = (state.provenanceLinks ?? []).find(p =>
      p.recordRef.id === recordRef.id && p.recordRef.kind === recordRef.kind);
    if (finalized) {
      if (canonicalJson(finalized) !== canonicalJson(link))
        throw new RangeError('Conflicting finalized provenance');
      return { durable: true, prepared: false, alreadyFinalized: true };
    }
    if (old) return { durable: true, prepared: true, alreadyFinalized: false };
    const saved = save({ ...state, revision: state.revision + 1,
      pendingProvenance: [...pending, { link, record }]
        .sort((a,b)=>a.link.recordRef.id.localeCompare(b.link.recordRef.id)) });
    return { durable: saved.durable, prepared: saved.durable, alreadyFinalized: false };
  }
  function recoverPending({ asOf, assessmentRefs = [], questionCatalog = [],
    reservedQuestionRefs = [] } = {}) {
    requireUtc(asOf);
    const initial = load();
    const results = [];
    for (const pending of initial.pendingProvenance ?? []) {
      const legacy = readLegacy();
      const stored = legacy.hasCanonicalV3 &&
        legacy.archive.records.find(r => r.schemaVersion === 3 &&
          r.id === pending.link.recordRef.id);
      if (!stored) {
        results.push({ recordRef: pending.link.recordRef,
          recovered: false, errorCode: 'AWAIT_CANONICAL' });
        continue;
      }
      if (canonicalJson(stored) !== canonicalJson(pending.record)) {
        throw new AcademyStorageError('PENDING_RECORD_CONFLICT',
          'Prepared source differs from official durable v3 record');
      }
      validateLearningProvenance(pending.link, stored, learning);
      const outcome = persistLearningProvenance({
        recordRef: pending.link.recordRef, record: stored,
        academyQuestionRef: pending.link.academyQuestionRef,
        ...(pending.link.sessionId ? { sessionId: pending.link.sessionId } : {}),
      }, { asOf, assessmentRefs, questionCatalog, reservedQuestionRefs });
      results.push({ recordRef: pending.link.recordRef,
        recovered: outcome.provenanceDurable === true,
        ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}) });
    }
    return { results, remaining: load().pendingProvenance?.length ?? 0 };
  }
  /**
   * Canonical v3 bytes must already be durable. Commit validated provenance to
   * the independent sidecar BEFORE rebuilding any derived abilities/review.
   * The raw record always survives a sidecar quota exception or crash.
   */
  function persistLearningProvenance({ recordRef, record, academyQuestionRef, sessionId },
    { asOf, assessmentRefs = [], questionCatalog = [], reservedQuestionRefs = [] } = {}) {
    requireUtc(asOf);
    const legacy = readLegacy();
    const stored = legacy.archive.records.find(r => r.schemaVersion === 3 && r.id === recordRef?.id);
    if (!legacy.hasCanonicalV3 || !stored || canonicalJson(stored) !== canonicalJson(record)) {
      throw new AcademyStorageError('LEGACY_NOT_DURABLE', 'Canonical v3 answer must be persisted and read back first');
    }
    const link = createLearningProvenance({ record: stored, recordRef, academyQuestionRef, learning, sessionId });
    let state = load();
    if (sessionId) {
      const session = state.trainingSessions.find(s => s.sessionId === sessionId);
      if (!session || !session.questionRefs.some(q =>
        canonicalJson(q) === canonicalJson(link.academyQuestionRef)) ||
        ['completed', 'aborted'].includes(session.status)) {
        throw new RangeError('Provenance cannot claim an invalid or terminal TrainingSession');
      }
      if ((state.provenanceLinks ?? []).some(p => p.sessionId === sessionId &&
        canonicalJson(p.academyQuestionRef) === canonicalJson(link.academyQuestionRef) &&
        p.recordRef.id !== link.recordRef.id)) {
        throw new RangeError('Duplicate Academy question submission in session');
      }
    }
    const links = state.provenanceLinks ?? [];
    const previous = links.find(p => p.recordRef.kind === recordRef.kind && p.recordRef.id === recordRef.id);
    if (previous && canonicalJson(previous) !== canonicalJson(link)) {
      throw new RangeError('Conflicting immutable provenance RecordRef');
    }
    const pending = (state.pendingProvenance ?? []).find(p =>
      p.link.recordRef.kind === recordRef.kind && p.link.recordRef.id === recordRef.id);
    if (pending && (canonicalJson(pending.link) !== canonicalJson(link) ||
      canonicalJson(pending.record) !== canonicalJson(stored))) {
      throw new RangeError('Canonical record/provenance conflicts with prepared intent');
    }
    if (!previous || pending) {
      const first = save({ ...state, revision: state.revision + 1,
        provenanceLinks: previous ? links :
          [...links, link].sort((a,b)=>a.recordRef.id.localeCompare(b.recordRef.id)),
        pendingProvenance: (state.pendingProvenance ?? []).filter(p =>
          p.link.recordRef.kind !== recordRef.kind || p.link.recordRef.id !== recordRef.id),
      });
      if (!first.durable) return { recordRef, durable: false, provenanceDurable: false,
        derivedFresh: false, errorCode: 'STORAGE_UNAVAILABLE' };
      state = first.state;
    }
    try {
      const { profile, reviewPlan } = derive(state, asOf, assessmentRefs, questionCatalog, reservedQuestionRefs);
      const next = save({ ...state, revision: state.revision + 1,
        abilityProfile: profile, reviewPlan });
      if (!next.durable) return { recordRef, durable: false,
        provenanceDurable: false, derivedFresh: false, errorCode: 'STORAGE_UNAVAILABLE' };
      return { recordRef, durable: true, provenanceDurable: true,
        derivedFresh: true, state: next.state };
    } catch (error) {
      return { recordRef, durable: true, provenanceDurable: true,
        derivedFresh: false, errorCode: error.code ?? 'DERIVE_FAILED', message: error.message };
    }
  }
  function getProvenance(recordRef) {
    const state = load();
    return state.provenanceLinks?.find(p => p.recordRef.kind === recordRef?.kind &&
      p.recordRef.id === recordRef?.id) ?? null;
  }
  function getSession(sessionId) {
    requireId(sessionId, 'sessionId');
    return load().trainingSessions.find(s => s.sessionId === sessionId) ?? null;
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
    const usedQuestions = new Set();
    for (const ref of session.recordRefs) {
      const p = (state.provenanceLinks ?? []).find(link =>
        link.recordRef.kind === ref.kind && link.recordRef.id === ref.id);
      const qref = p?.academyQuestionRef ??
        (ref.kind === 'legacy-v3'
          ? { questionId: legacy.archive.records.find(r => r.id === ref.id)?.exerciseId,
            questionVersion: 'legacy-exercise-v3' } :
            state.academyRecords.find(r=>r.id===ref.id)?.questionRef);
      if (!qref || !session.questionRefs.some(q => canonicalJson(q) === canonicalJson(qref))) {
        throw new RangeError('Session RecordRef is unrelated to planned question');
      }
      const qkey = qref.questionId + '@' + qref.questionVersion;
      if (usedQuestions.has(qkey)) throw new RangeError('Session has duplicate submitted question');
      usedQuestions.add(qkey);
      if (p?.sessionId && p.sessionId !== session.sessionId)
        throw new RangeError('RecordRef provenance belongs to another Session');
    }
    const sessions = state.trainingSessions.filter(s => s.sessionId !== session.sessionId);
    const previous = state.trainingSessions.find(s => s.sessionId === session.sessionId);
    // A daily identity is (profileId, IANA timezone, local day, algorithm version).
    // Reject a second session even when the two callers planned different IDs.
    const daily = session.extensions?.['adaptive.daily'];
    if (daily && sessions.some(other => {
      const ext = other.extensions?.['adaptive.daily'];
      return other.profileId === session.profileId && ext?.dayKey === daily.dayKey &&
        ext?.timezone === daily.timezone && ext?.algorithmVersion === daily.algorithmVersion;
    })) throw new AcademyStorageError('DAILY_CONFLICT', 'A DailySession already exists for this local day');
    if (previous) {
      const oldBytes = canonicalJson(previous), newBytes = canonicalJson(session);
      if (oldBytes === newBytes) return { state, durable: present };
      const allowed = { planned: ['active', 'aborted'],
        active: ['active', 'completed', 'aborted'], completed: [], aborted: [] };
      if (!allowed[previous.status].includes(session.status))
        throw new RangeError('Illegal persisted status transition');
      if (previous.profileId !== session.profileId ||
        previous.seed !== session.seed ||
        canonicalJson(previous.ruleRef) !== canonicalJson(session.ruleRef) ||
        canonicalJson(previous.questionRefs) !== canonicalJson(session.questionRefs) ||
        canonicalJson(previous.extensions?.['adaptive.daily'] ?? null) !==
          canonicalJson(session.extensions?.['adaptive.daily'] ?? null) ||
        previous.recordRefs.some(ref => !session.recordRefs.some(next =>
          next.kind === ref.kind && next.id === ref.id))) {
        throw new RangeError('Session cannot rewrite question provenance or past attempts');
      }
      if (session.status === 'active' && session.recordRefs.length === previous.recordRefs.length)
        throw new RangeError('Active Session update must append durable RecordRefs');
    }
    return save({ ...state, revision: state.revision + 1,
      trainingSessions: [...sessions, cloneJson(session)].sort((a,b) => a.sessionId.localeCompare(b.sessionId)) });
  }
  return { load, loadStatus, saveSession, getSession, getProvenance,
    persistScoredRecord, prepareLearningProvenance, persistLearningProvenance,
    recoverPending, rebuild,
    readLegacy, exportJSON: () => JSON.stringify(load()),
    importJSON: json => save(migrateAcademyState(JSON.parse(json), { migrations, validateAcademyDecisionRecord })),
  };
}
