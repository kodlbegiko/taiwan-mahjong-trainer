import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../../src/training/exercises.js';
import { createDecisionRecord } from '../../src/training/records.js';
import { createLocalTrainingStore } from '../../src/storage/local.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';
import {
  V1, ACADEMY_STORAGE_KEY, createAcademyStore, createAdaptiveLearningAdapter, createLearningProvenance,
  validateLearningProvenance, validateProvenanceShape,
  buildAbilityProfile, buildReviewPlan, planDailyTraining,
} from '../../src/adaptive/index.js';

const clone = x => JSON.parse(JSON.stringify(x));
const at = '2026-11-20T12:00:00.000Z';
const timestamp = '2026-11-18T08:00:00.000Z';
const ref = { questionId: 'academy-q-fixture-001', questionVersion: '1.0.0' };
const ex = createExercise({ seed: 'academy-provenance-test', index: 7, taskType: 'multi_wait', level: 'beginner' });
const ruleRef = { profileId: 'legacy-exercise-v3-structural', ruleVersion: ex.ruleVersion };
const lessonRef = { lessonId: 'academy-l1-04', lessonVersion: '1.0.0' };
const q = {
  ...V1, ...ref, lessonRef, skillTagIds: ['waits.enumeration'], ruleRef,
  taskType: ex.taskType, generator: {
    seed: ex.seed, index: ex.index, generatorVersion: ex.generatorVersion,
  },
  prompt: {
    legacyHand: ex.hand, visibleTiles: ex.visibleTiles,
    options: Array.from({length:34},(_,tile)=>tile).filter(tile =>
      ex.hand.filter(x=>x===tile).length +
      ex.visibleTiles.filter(x=>x===tile).length < 4).map(String),
  },
  status: 'validated',
};
const lesson = { ...V1, ...lessonRef, questionRefs: [ref], ruleRef,
  titleZhTW: '已驗證來源的聽張課', status: 'published' };
const tag = id => ({ ...V1, tagId: id, labelZhTW: id,
  scope: 'exact-structural', status: 'active', prerequisiteTagIds: [] });
const registry = {
  skills: [tag('waits.enumeration'), tag('waits.multi')],
  // Deliberately different from the question tag to prove curriculum provenance wins.
  legacyMappings: { taskTypes: { multi_wait: ['waits.multi'] }, errorTypes: {} },
};
function fixtureLearning({ missing = false, corrupt = false } = {}) {
  return {
    toPublicQuestion(input) {
      if (missing || input.questionId !== ref.questionId ||
        input.questionVersion !== ref.questionVersion) throw new RangeError('Unknown immutable question version');
      return clone(corrupt ? { ...q, lessonRef: { lessonId: 'forged-lesson', lessonVersion: '1.0.0' } } : q);
    },
    getLessonPublic(id) { return id === lessonRef.lessonId ? clone(lesson) : null; },
    submitAcademyAnswer(input, choice, { timestamp: stamp, durationMs, attemptId } = {}) {
      if (missing || input.questionId !== ref.questionId ||
        input.questionVersion !== ref.questionVersion) throw new RangeError('Question version unavailable');
      const record = createDecisionRecord(ex, choice, { timestamp: stamp, durationMs, attemptId });
      return { record, recordRef: { kind: 'legacy-v3', id: record.id },
        gradingResult: { ...V1, questionRef: clone(ref), score: record.score, grade: record.grade } };
    },
  };
}
function backing(initial = []) {
  const map = new Map(initial);
  let writes = 0, failAt = -1, corruptReadback = false;
  return {
    map,
    onAcademyWrite(n) { writes = 0; failAt = n; },
    setCorruptReadback(value) { corruptReadback = value; },
    getItem(key) {
      const value = map.get(key) ?? null;
      return key === ACADEMY_STORAGE_KEY && corruptReadback && value ? value + 'garbled' : value;
    },
    setItem(key, value) {
      if (key === ACADEMY_STORAGE_KEY && ++writes === failAt) throw new Error('QuotaExceededError');
      map.set(key, value);
    },
  };
}
const setup = (storage, learning = fixtureLearning()) =>
  createAdaptiveLearningAdapter(storage, { learning, registry });
function session() {
  return {
    ...V1, sessionId: 'academy-session-fixture', profileId: 'local-academy-profile',
    ruleRef: clone(ruleRef), status: 'planned', questionRefs: [clone(ref)],
    recordRefs: [], seed: 'daily-seed', generatorVersions: [ex.generatorVersion],
    source: 'academy',
  };
}
function submit(adapter, options = {}) {
  return adapter.submitAnswer(ref, ex.answer.expectedTiles, {
    asOf: at, timestamp, durationMs: 400, attemptId: 'academy-v3-attempt-fixture',
    ...options,
  });
}

test('REAL STORAGE restart: Academy question → v3 record → provenance → lesson → replayable review', () => {
  const oldV1 = JSON.stringify([{ grade: 'perfect', seconds: 2, date: timestamp, difficulty: 'beginner' }]);
  const storage = backing([[LEGACY_SESSION_KEY, oldV1]]);
  const old = createLocalTrainingStore(storage);
  const prior = createExercise({ seed: 'older-legacy-frozen', taskType: 'tenpai' });
  const priorRecord = old.addDecision(prior, prior.answer.expectedTiles, {
    timestamp: '2026-11-17T00:00:00Z', durationMs: 800, attemptId: 'old-record',
  });
  const archiveBefore = JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY));
  const first = setup(storage);
  first.saveSession(session());
  const result = submit(first, { sessionId: 'academy-session-fixture' });
  assert.equal(result.durable, true);
  assert.equal(result.provenanceDurable, true);
  assert.equal(result.derivedFresh, true);
  assert.equal(result.sessionFresh, true);
  assert.equal(first.getSession('academy-session-fixture').status, 'completed');
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), oldV1);
  assert.deepEqual(JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY)).records[0], priorRecord);
  const savedBytes = storage.getItem(ARCHIVE_STORAGE_KEY);
  const second = setup(storage);
  const state = second.load();
  assert.equal(state.provenanceLinks.length, 1);
  assert.deepEqual(state.provenanceLinks[0].academyQuestionRef, ref);
  assert.deepEqual(state.provenanceLinks[0].lessonRef, lessonRef);
  assert.deepEqual(state.provenanceLinks[0].skillTagIds, q.skillTagIds);
  assert.equal(second.getSession('academy-session-fixture').status, 'completed');
  const rebuilt = second.rebuild({ asOf: at });
  assert.equal(rebuilt.durable, true);
  const reviewed = rebuilt.reviewPlan.items.find(x => x.questionId === ref.questionId);
  assert(reviewed, 'ReviewPlan should contain the actual Academy question ID, not ex3-*');
  assert.equal(reviewed.questionVersion, ref.questionVersion);
  assert.equal(reviewed.reasonCodes.some(x => x.startsWith('unavailable:')), false);
  const recovered = second.resolveReviewQuestion(reviewed);
  assert.equal(recovered.available, true);
  assert.equal(recovered.source, 'academy');
  assert.deepEqual(recovered.question, q);
  assert.deepEqual(recovered.lesson, lesson);
  assert.deepEqual(recovered.question.prompt.options, q.prompt.options);
  assert.deepEqual(recovered.skillTagIds, q.skillTagIds);
  assert.equal(recovered.scoringVersion, ex.answerRules.version);
  assert.equal(rebuilt.profile.skills.find(x => x.tagId === 'waits.enumeration').attempts, 1);
  assert.equal(rebuilt.profile.skills.find(x => x.tagId === 'waits.multi').attempts, 0);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), savedBytes);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), oldV1);
  const stateAfter = second.load();
  assert.equal(stateAfter.provenanceLinks.length, 1);
  assert.equal(stateAfter.abilityProfile.calibrationStatus, 'uncalibrated');
  assert.equal(stateAfter.abilityProfile.skills.find(x=>x.tagId==='waits.enumeration').estimatedProficiency, null);
  assert.equal(archiveBefore.records[0].id, 'old-record');
});
test('same durable attempt submitted repeatedly is idempotent and session is still completed', () => {
  const storage = backing();
  const a = setup(storage);
  a.saveSession(session());
  submit(a, { sessionId: 'academy-session-fixture' });
  const baseline = a.rebuild({ asOf: at });
  const again = submit(setup(storage), { sessionId: 'academy-session-fixture' });
  assert.equal(again.durable, true);
  const b = setup(storage);
  const rerun = b.rebuild({ asOf: at });
  assert.deepEqual(rerun.profile.skills, baseline.profile.skills);
  assert.deepEqual(rerun.reviewPlan.items, baseline.reviewPlan.items);
  assert.equal(b.readLegacy().archive.records.length, 1);
  assert.equal(b.load().provenanceLinks.length, 1);
  assert.equal(b.getSession('academy-session-fixture').recordRefs.length, 1);
});
test('provenance shape rejects tampered Seed, scoring version and alias', () => {
  const storage = backing();
  const a = setup(storage);
  submit(a);
  const original = storage.getItem(ARCHIVE_STORAGE_KEY);
  const raw = JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY));
  const altered = clone(raw);
  altered.provenanceLinks[0].seed = 'forged-seed';
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(altered));
  assert.equal(setup(storage).loadStatus().ok, false);
  assert.throws(() => setup(storage).rebuild({ asOf: at }));
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), original);
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(raw));
  const corruptVersion = clone(raw);
  corruptVersion.provenanceLinks[0].scoringVersion = 'future-fake';
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(corruptVersion));
  assert.equal(setup(storage).loadStatus().ok, false);
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(raw));
  const forgedLesson = clone(raw);
  forgedLesson.provenanceLinks[0].lessonRef.lessonId = 'fraud';
  forgedLesson.provenanceLinks[0].publicQuestion.lessonRef.lessonId = 'fraud';
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(forgedLesson));
  assert.equal(setup(storage).loadStatus().ok, false);
  storage.map.set(ACADEMY_STORAGE_KEY, JSON.stringify(raw));
  assert.equal(setup(storage).loadStatus().ok, true);
});
test('wrong Academy question version/seed and an unauthenticated lookup are refused pre-persistence', () => {
  const storage = backing();
  const a = setup(storage);
  assert.throws(() => a.submitAnswer({ ...ref, questionVersion: 'future' }, ex.answer.expectedTiles, {
    timestamp, durationMs: 400, attemptId: 'future-attempt', asOf: at,
  }));
  assert.equal(storage.map.get(ARCHIVE_STORAGE_KEY), undefined);
  assert.equal(storage.map.get(ACADEMY_STORAGE_KEY), undefined);
  const record = createDecisionRecord(ex, ex.answer.expectedTiles, { timestamp, durationMs: 10, attemptId: 'proof' });
  const recordRef = { kind: 'legacy-v3', id: record.id };
  const link = createLearningProvenance({ record, recordRef, academyQuestionRef: ref, learning: fixtureLearning() });
  assert.equal(validateLearningProvenance(link, record, fixtureLearning()), true);
  assert.throws(() => validateProvenanceShape({ ...link, generatorIndex: 99 }, record), /generatorIndex|seed|source/i);
  assert.throws(() => validateLearningProvenance(link, record, fixtureLearning({corrupt:true})));
});
test('raw canonical record survives provenance QuotaExceeded; retry links without duplicate score', () => {
  const storage = backing();
  storage.onAcademyWrite(2); // prepared intent succeeds, canonical v3 appends, final sidecar fails
  const first = submit(setup(storage));
  assert.equal(first.durable, true);
  assert.equal(first.provenanceDurable, false);
  assert.equal(first.errorCode, 'WRITE_DENIED');
  assert.equal(storage.map.has(ARCHIVE_STORAGE_KEY), true);
  assert.equal(storage.map.has(ACADEMY_STORAGE_KEY), true);
  assert.equal(setup(storage).load().pendingProvenance.length, 1);
  assert.equal(setup(storage).load().provenanceLinks.length, 0);
  storage.onAcademyWrite(-1);
  const recovered = setup(storage).rebuild({ asOf: at });
  assert.equal(recovered.pendingRecovery.results[0].recovered, true);
  const state = setup(storage).load();
  assert.equal(state.provenanceLinks.length, 1);
  assert.equal(state.abilityProfile.skills.find(x=>x.tagId==='waits.enumeration').attempts, 1);
  assert.equal(setup(storage).readLegacy().archive.records.length, 1);
});
test('interrupted derived update leaves validated provenance and correct rebuild after restart', () => {
  const storage = backing();
  storage.onAcademyWrite(3); // intent + provenance succeed; derived snapshot write fails.
  const answer = submit(setup(storage));
  assert.equal(answer.durable, true);
  assert.equal(answer.provenanceDurable, true);
  assert.equal(answer.derivedFresh, false);
  const frozen = setup(storage).load();
  assert.equal(frozen.provenanceLinks.length, 1);
  assert.equal(frozen.reviewPlan, null);
  storage.onAcademyWrite(-1);
  const restored = setup(storage).rebuild({ asOf: at });
  assert.equal(restored.reviewPlan.items.find(x=>x.questionId===ref.questionId).questionVersion, '1.0.0');
  assert.equal(restored.profile.skills.find(x=>x.tagId==='waits.enumeration').attempts, 1);
});
test('interrupted Session write after canonical/provenance/derived is reconciled on startup', () => {
  const storage = backing();
  const first = setup(storage);
  first.saveSession(session());
  storage.onAcademyWrite(4); // prepared, provenance, profile then interrupted Session write
  const answer = submit(first, { sessionId: 'academy-session-fixture' });
  assert.equal(answer.provenanceDurable, true);
  assert.equal(answer.derivedFresh, true);
  assert.equal(answer.sessionFresh, false);
  assert.equal(setup(storage).getSession('academy-session-fixture').status, 'planned');
  storage.onAcademyWrite(-1);
  const recovered = setup(storage);
  recovered.rebuild({ asOf: at });
  const sessionAfter = recovered.getSession('academy-session-fixture');
  assert.equal(sessionAfter.status, 'completed');
  assert.equal(sessionAfter.recordRefs.length, 1);
  assert.equal(sessionAfter.recordRefs[0].id, 'academy-v3-attempt-fixture');
  assert.deepEqual(sessionAfter.questionRefs, [ref]);
});
test('missing historical Learning version is unavailable and never silently remapped to ex3', () => {
  const storage = backing();
  submit(setup(storage));
  const inaccessible = setup(storage, fixtureLearning({missing:true}));
  const status = inaccessible.loadStatus();
  assert.equal(status.ok, true, 'immutable state stays readable for a retired lookup');
  const result = inaccessible.rebuild({ asOf: at });
  const item = result.reviewPlan.items.find(i=>i.questionId===ref.questionId);
  assert(item.reasonCodes.includes('unavailable:source-lookup'));
  assert.equal(inaccessible.resolveReviewQuestion(item).available, false);
  assert.equal(result.profile.skills.find(s=>s.tagId==='waits.enumeration').attempts, 0);
  assert.equal(result.profile.skills.find(s=>s.tagId==='waits.multi').attempts, 1);
});
test('legacy-only v3 archive has no fabricated LessonRef', () => {
  const storage = backing();
  const old = createLocalTrainingStore(storage);
  old.addDecision(ex, ex.answer.expectedTiles, { timestamp, durationMs: 100, attemptId: 'legacy-standalone' });
  const a = setup(storage);
  const result = a.rebuild({ asOf: at });
  const item = result.reviewPlan.items.find(x=>x.questionId===ex.id);
  assert(item);
  assert.equal(item.questionVersion, 'legacy-exercise-v3');
  const looked = a.resolveReviewQuestion(item);
  assert.equal(looked.available, true);
  assert.equal(looked.lesson, null);
  assert.deepEqual(looked.question.prompt.legacyHand, ex.hand);
  assert.equal(a.load().provenanceLinks.length, 0);
});
test('Academy-linked reviews provide replay-safe TrainingSession questionRefs and stable ordering', () => {
  const storage = backing();
  submit(setup(storage));
  const a = setup(storage);
  const state = a.load();
  const records = a.readLegacy().archive.records.map(record=>({kind:'legacy-v3',record}));
  const options = {
    profile: state.abilityProfile, reviewPlan: state.reviewPlan, records,
    provenanceLinks: state.provenanceLinks, learning: fixtureLearning(), registry,
    seed: 'daily-resume', asOf: at, minutes: 10, ruleRef,
  };
  const planned = planDailyTraining(options);
  assert.equal(planned.availableQuestionCount, 1);
  assert.deepEqual(planned.session.questionRefs, [ref]);
  assert.deepEqual(planDailyTraining(options).session, planned.session);
  assert.equal(planned.session.extensions['adaptive.plan'].orderedSources[0].source, 'academy-linked-v3');
  const saved = a.saveSession(planned.session);
  assert.equal(saved.durable, true);
  assert.deepEqual(setup(storage).getSession(planned.session.sessionId).questionRefs, [ref]);
});

test('crash after canonical v3 append before provenance finalize is repaired without UI state', () => {
  const storage = backing();
  const learning = fixtureLearning();
  const canonical = createDecisionRecord(ex, ex.answer.expectedTiles, {
    timestamp, durationMs: 400, attemptId: 'prepared-crash-attempt',
  });
  const recordRef = { kind: 'legacy-v3', id: canonical.id };
  const sidecar = createAcademyStore(storage, { registry, learning });
  const pre = sidecar.prepareLearningProvenance({
    recordRef, record: canonical, academyQuestionRef: ref,
  });
  assert.equal(pre.durable, true);
  assert.equal(sidecar.load().pendingProvenance.length, 1);
  assert.equal(sidecar.load().provenanceLinks.length, 0);
  const saved = createLocalTrainingStore(storage).addDecision(ex, ex.answer.expectedTiles, {
    timestamp, durationMs: 400, attemptId: 'prepared-crash-attempt',
  });
  assert.deepEqual(saved, canonical);
  const oldBytes = storage.getItem(ARCHIVE_STORAGE_KEY);
  // Simulate a completely fresh browser start: no in-memory link or callback state.
  const reloaded = setup(storage);
  const result = reloaded.rebuild({ asOf: at });
  assert.equal(result.pendingRecovery.results[0].recovered, true);
  assert.equal(result.pendingRecovery.remaining, 0);
  assert.equal(reloaded.load().provenanceLinks.length, 1);
  assert.equal(reloaded.load().pendingProvenance.length, 0);
  const item = result.reviewPlan.items.find(q=>q.questionId===ref.questionId);
  assert.equal(reloaded.resolveReviewQuestion(item).lesson.lessonId, lessonRef.lessonId);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), oldBytes);
});
test('pending intent without a durable canonical record is never counted or fabricated', () => {
  const storage = backing();
  const raw = createDecisionRecord(ex, ex.answer.expectedTiles, {
    timestamp, durationMs: 400, attemptId: 'pending-without-record',
  });
  const draft = createAcademyStore(storage, { registry, learning: fixtureLearning() });
  draft.prepareLearningProvenance({ recordRef:{kind:'legacy-v3',id:raw.id},
    record:raw, academyQuestionRef:ref });
  const restart = setup(storage);
  const rebuilt = restart.rebuild({ asOf: at });
  assert.equal(rebuilt.pendingRecovery.results[0].errorCode, 'AWAIT_CANONICAL');
  assert.equal(restart.load().pendingProvenance.length, 1);
  assert.equal(restart.load().provenanceLinks.length, 0);
  assert.equal(rebuilt.profile.skills.find(s=>s.tagId==='waits.enumeration').attempts, 0);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), null);
});
test('no quota space for intent prevents an unrecoverable canonical append', () => {
  const storage = backing();
  storage.onAcademyWrite(1);
  const result = submit(setup(storage));
  assert.equal(result.durable, false);
  assert.equal(result.errorCode, 'WRITE_DENIED');
  assert.equal(storage.map.has(ARCHIVE_STORAGE_KEY), false);
  assert.equal(storage.map.has(ACADEMY_STORAGE_KEY), false);
});
