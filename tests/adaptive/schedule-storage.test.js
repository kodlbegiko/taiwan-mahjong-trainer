import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../../src/training/exercises.js';
import { createDecisionRecord } from '../../src/training/records.js';
import { createLocalTrainingStore } from '../../src/storage/local.js';
import { LEGACY_SESSION_KEY, ARCHIVE_STORAGE_KEY } from '../../src/storage/archive.js';
import {
  ACADEMY_STORAGE_KEY, emptyAcademyState, buildAbilityProfile,
  buildReviewPlan, getTodayRecommendation, planDailyTraining,
  buildAnswerableCatalog, transitionTrainingSession, addLocalCalendarDays,
  createAcademyStore, migrateAcademyState,
} from '../../src/adaptive/index.js';

const clock = '2026-11-19T03:00:00Z';
const ruleRef = { profileId: 'legacy-exercise-v3', ruleVersion: 'taiwan-16-standard-v1' };
const skill = { schemaVersion: 1, contractVersion: 'master-academy/1.0.0',
  tagId: 'waits.enumeration', labelZhTW: '聽牌', scope: 'exact-structural',
  prerequisiteTagIds: [], status: 'active' };
const registry = { skills: [skill], legacyMappings: { taskTypes: { multi_wait: ['waits.enumeration'] } } };
const exercise = createExercise({ seed: 'adaptive-storage-fixture', taskType: 'multi_wait' });
const good = createDecisionRecord(exercise, exercise.answer.expectedTiles, {
  attemptId: 'v3-a', timestamp: '2026-11-17T03:00:00Z', durationMs: 1000,
});
const bad = createDecisionRecord(exercise, [], {
  attemptId: 'v3-b', timestamp: '2026-11-18T03:00:00Z', durationMs: 1000,
});
const entries = [good, bad].map(record => ({ kind: 'legacy-v3', record }));
const makeProfile = (records = entries) => buildAbilityProfile({ records, registry, asOf: clock });
const makePlan = (records = entries, timezone = 'Asia/Taipei') => buildReviewPlan({
  profile: makeProfile(records), records, asOf: clock, timezone,
});
function makeStorage(initial = []) {
  const data = new Map(initial);
  let writes = 0, failAt = -1;
  return {
    data, setFailAt(n) { failAt = n; writes = 0; },
    getItem: key => data.get(key) ?? null,
    setItem(key, value) {
      if (key === ACADEMY_STORAGE_KEY && ++writes === failAt) throw Error('QuotaExceededError');
      data.set(key, value);
    },
  };
}
function scenario() {
  return {
    schemaVersion: 1, contractVersion: 'master-academy/1.0.0', id: 'scored-scenario',
    questionRef: { questionId: 'scenario-a', questionVersion: 'v1' },
    ruleRef: { profileId: 'rules', ruleVersion: 'v1' }, scorerId: 'fixture',
    scoringVersion: 'fixture-v1', engineVersion: 'fixture-v1',
    sourceViewRef: { gameId: 'g1', viewId: 'v1', asOfEventSeq: 1, audienceSeat: 0 },
    chosenActionId: 'a', legalActionIds: ['a'],
    timestamp: clock, durationMs: 1000, grade: 'perfect', score: 1,
    errorTypeIds: [], skillTagIds: ['waits.enumeration'],
    scoringEvidence: { basis: 'exact', fixtureId: 'fixed', answerSnapshotDigest: 'sha256:d' },
    recordKind: 'academy-scenario',
  };
}
function scenarioQuestion() {
  return {
    schemaVersion: 1, contractVersion: 'master-academy/1.0.0',
    questionId: 'scenario-a', questionVersion: 'v1', taskType: 'scenario',
    status: 'validated', skillTagIds: ['waits.enumeration'],
    ruleRef: { profileId: 'rules', ruleVersion: 'v1' },
    generator: { seed: 'fixed', index: 0, generatorVersion: 'fixture-v1' },
    source: { kind: 'player-view-snapshot', snapshotRef: 'fixed' },
    prompt: { options: ['a'] },
    answerKey: { scorerId: 'fixture', scoringVersion: 'fixture-v1',
      correctnessBasis: 'exact', acceptedActionIds: ['a'] },
  };
}
// A deterministic mock of Learning Academy's independent scorer for adapter tests.
// Real production must inject AI3's actual scorer/fixture validator.
const validator = rec => rec.scorerId === 'fixture' && rec.scoringVersion === 'fixture-v1' &&
  rec.scoringEvidence.fixtureId === 'fixed' && rec.chosenActionId === 'a' &&
  rec.score === 1 && rec.grade === 'perfect';

test('rebuild same asOf: deterministic due dates, priority and source refs', () => {
  const a = makePlan(entries);
  const b = makePlan([...entries].reverse());
  assert.deepEqual(a, b);
  assert.equal(a.settings.timezone, 'Asia/Taipei');
  assert.equal(a.items.length, 1);
  assert.equal(a.items[0].sourceRecordRefs.length, 2);
  assert(a.items[0].reasonCodes.includes('recent-mistake'));
  assert(a.items[0].reasonCodes.includes('due'));
  assert.equal(getTodayRecommendation(makeProfile(), a, clock).dueQuestions.length, 1);
});
test('calendar days honor IANA zones and DST, rather than fixed UTC milliseconds', () => {
  const start = '2026-03-07T17:00:00Z'; // Noon in New York before DST starts.
  const dueNY = addLocalCalendarDays(start, 1, 'America/New_York');
  const dueTW = addLocalCalendarDays(start, 1, 'Asia/Taipei');
  assert.equal(dueNY, '2026-03-08T16:00:00.000Z');
  assert.equal(dueTW, '2026-03-08T17:00:00.000Z');
  assert.notEqual(dueNY, dueTW);
  assert.throws(() => makePlan(entries, 'Not/A_Timezone'));
});
test('daily 10/20/30/60 plans only schedule real replayable questions and preserve seed', () => {
  const profile = makeProfile();
  const reviewPlan = makePlan();
  for (const minutes of [10, 20, 30, 60]) {
    const options = { profile, reviewPlan, records: entries, minutes, seed: 'session-seed',
      asOf: clock, ruleRef };
    const a = planDailyTraining(options);
    assert.deepEqual(a, planDailyTraining(options));
    assert.equal(a.session.questionRefs.length, 1);
    assert.equal(a.session.recordRefs.length, 0);
    assert.equal(a.session.seed, 'session-seed');
    assert.equal(a.session.status, 'planned');
    assert.equal(a.session.extensions['adaptive.plan'].orderedSources[0].source, 'legacy-exercise-v3');
    assert.equal(a.session.questionRefs[0].questionId, exercise.id);
    assert(a.session.extensions['adaptive.plan'].unallocatedMinutes >= 0);
  }
  assert.throws(() => planDailyTraining({
    profile, reviewPlan, records: [], minutes: 30, seed: 'none', asOf: clock,
  }), /No known replayable/);
});
test('missing / unverified scenario question is unavailable and never scheduled', () => {
  const record = scenario();
  const input = [{ kind: 'academy-v1', record }];
  const profile = buildAbilityProfile({ records: input, registry, asOf: clock, validateAcademyDecisionRecord: validator });
  const reviewPlan = buildReviewPlan({
    profile, records: input, asOf: '2026-11-21T03:00:00Z',
    validateAcademyDecisionRecord: validator,
  });
  assert(reviewPlan.items[0].reasonCodes.includes('unavailable:question-catalog'));
  assert.equal(getTodayRecommendation(profile, reviewPlan, '2026-11-21T03:00:00Z').dueQuestions.length, 0);
  assert.equal(buildAnswerableCatalog({ records: input, validateAcademyDecisionRecord: validator }).length, 0);
});
test('session status is unidirectional; no phantom attempts on a planned session', () => {
  const { session } = planDailyTraining({
    profile: makeProfile(), reviewPlan: makePlan(), records: entries,
    minutes: 10, asOf: clock, seed: 'workflow', ruleRef,
  });
  assert.equal(session.recordRefs.length, 0);
  const active = transitionTrainingSession(session, 'active', { at: clock });
  const finished = transitionTrainingSession(active, 'completed', { at: '2026-11-19T03:10:00Z' });
  assert.equal(finished.status, 'completed');
  assert.throws(() => transitionTrainingSession(finished, 'active', { at: clock }));
  assert.throws(() => transitionTrainingSession(active, 'completed', { at: '2026-11-19T02:00:00Z' }));
});
test('legacy v1/v3 remain byte-identical and v3 must already be durably persisted', () => {
  const oldV1 = JSON.stringify([{ grade: 'perfect', seconds: 3, date: clock, difficulty: 'beginner' }]);
  const storage = makeStorage([[LEGACY_SESSION_KEY, oldV1]]);
  const canonicalStore = createLocalTrainingStore(storage);
  const archive = canonicalStore.load();
  archive.exercises = [exercise]; archive.records = [good];
  canonicalStore.save(archive);
  const oldV3 = storage.getItem(ARCHIVE_STORAGE_KEY);
  const academy = createAcademyStore(storage, { registry });
  assert.throws(() => academy.persistScoredRecord({ kind: 'legacy-v3', record: bad }, { asOf: clock }), /Persist legacy/);
  const result = academy.persistScoredRecord({ kind: 'legacy-v3', record: good }, { asOf: clock });
  assert.equal(result.durable, true);
  assert.equal(result.derivedFresh, true);
  assert.equal(academy.load().abilityProfile.skills[0].attempts, 1);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), oldV1);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), oldV3);
  assert.equal(createAcademyStore(storage, { registry }).load().abilityProfile.skills[0].attempts, 1);
});
test('Academy first write + readback survive second write failure; rebuild recovers', () => {
  const storage = makeStorage();
  const store = createAcademyStore(storage, { registry, validateAcademyDecisionRecord: validator });
  storage.setFailAt(2);
  const result = store.persistScoredRecord({ kind: 'academy-v1', record: scenario(), question: scenarioQuestion() }, { asOf: clock });
  assert.equal(result.durable, true);
  assert.equal(result.derivedFresh, false);
  assert.equal(result.errorCode, 'WRITE_DENIED');
  const before = store.load();
  assert.equal(before.academyRecords.length, 1);
  assert.equal(before.academyQuestions.length, 1);
  assert.deepEqual(before.academyQuestions[0], scenarioQuestion());
  assert.equal(before.abilityProfile, null);
  storage.setFailAt(-1);
  const recovered = store.rebuild({ asOf: clock });
  assert.equal(recovered.durable, true);
  assert.equal(store.load().academyRecords.length, 1);
  assert.equal(store.load().abilityProfile.skills[0].attempts, 1);
  const again = store.persistScoredRecord({ kind: 'academy-v1', record: scenario(), question: scenarioQuestion() }, { asOf: clock });
  assert.equal(again.derivedFresh, true);
  assert.equal(store.load().academyRecords.length, 1);
});
test('corrupt JSON, denied storage and unknown schema never overwrite existing bytes', () => {
  const corruption = makeStorage([[ACADEMY_STORAGE_KEY, '{bad']]);
  const store = createAcademyStore(corruption, { registry });
  assert.equal(store.loadStatus().errorCode, 'CORRUPT_JSON');
  assert.throws(() => store.rebuild({ asOf: clock }));
  assert.equal(corruption.getItem(ACADEMY_STORAGE_KEY), '{bad');
  const unknown = JSON.stringify({ ...emptyAcademyState(), schemaVersion: 200 });
  const future = makeStorage([[ACADEMY_STORAGE_KEY, unknown]]);
  assert.equal(createAcademyStore(future, { registry }).loadStatus().errorCode, 'UNKNOWN_SCHEMA');
  assert.equal(future.getItem(ACADEMY_STORAGE_KEY), unknown);
  const blocked = createAcademyStore({
    getItem() { throw Error('SecurityError'); }, setItem() { throw Error('QuotaExceededError'); },
  }, { registry });
  assert.equal(blocked.loadStatus().errorCode, 'READ_DENIED');
});
test('quota denied on raw record write reports failure without pretending success', () => {
  const storage = makeStorage();
  storage.setFailAt(1);
  const store = createAcademyStore(storage, { registry, validateAcademyDecisionRecord: validator });
  assert.throws(() => store.persistScoredRecord({ kind: 'academy-v1', record: scenario(), question: scenarioQuestion() }, { asOf: clock }),
    error => error.code === 'WRITE_DENIED');
  assert.equal(storage.getItem(ACADEMY_STORAGE_KEY), null);
});
test('explicit version migration rejects unknown by default and preserves old bytes', () => {
  const source = { schemaVersion: 0, contractVersion: 'academy-prototype/0', raw: true };
  assert.throws(() => migrateAcademyState(source), /Unknown Academy state/);
  const migration = { '0:academy-prototype/0': () => emptyAcademyState() };
  assert.deepEqual(migrateAcademyState(source, { migrations: migration }), emptyAcademyState());
  const bytes = JSON.stringify(source);
  const storage = makeStorage([[ACADEMY_STORAGE_KEY, bytes]]);
  const store = createAcademyStore(storage, { registry, migrations: migration });
  assert.deepEqual(store.load(), emptyAcademyState());
  assert.equal(storage.getItem(ACADEMY_STORAGE_KEY), bytes);
  store.rebuild({ asOf: clock });
  assert.equal(JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).schemaVersion, 1);
});
test('session can be saved only with already persisted record references', () => {
  const storage = makeStorage();
  const store = createAcademyStore(storage, { registry });
  const { session } = planDailyTraining({
    profile: makeProfile(), reviewPlan: makePlan(), records: entries,
    minutes: 10, seed: 'session-persist', asOf: clock, ruleRef,
  });
  assert.equal(store.saveSession(session).durable, true);
  assert.equal(store.load().trainingSessions.length, 1);
  assert.throws(() => store.saveSession({ ...session,
    recordRefs: [{ kind: 'legacy-v3', id: good.id }] }), /Planned session cannot claim attempts/);
  const attempted = transitionTrainingSession(session, 'active', {
    at: clock, recordRefs: [{ kind: 'legacy-v3', id: good.id }],
  });
  assert.throws(() => store.saveSession(attempted), /non-persisted/);
  assert.deepEqual(store.load().trainingSessions[0].questionRefs, session.questionRefs);
});

test('unverified scenario catalog flags are insufficient; only verified scenario questions become replayable', () => {
  const record = scenario();
  const input = [{ kind: 'academy-v1', record }];
  const profile = buildAbilityProfile({ records: input, registry, asOf: clock,
    validateAcademyDecisionRecord: validator });
  const asOf = '2026-11-21T03:00:00Z';
  const candidate = {
    questionId: 'scenario-a', questionVersion: 'v1', taskType: 'scenario',
    ruleRef: record.ruleRef, seed: 'verified-seed', generatorVersion: 'fixture-v1',
    source: 'academy-v1', available: true, estimatedMinutes: 3,
    questionSnapshot: { schemaVersion: 1, contractVersion: 'master-academy/1.0.0',
      questionId: 'scenario-a', questionVersion: 'v1', status: 'validated',
      taskType: 'scenario', answerKey: { correctnessBasis: 'exact' } },
  };
  const unknown = buildReviewPlan({ profile, records: input, asOf,
    validateAcademyDecisionRecord: validator, questionCatalog: [candidate] });
  assert(unknown.items[0].reasonCodes.includes('unavailable:question-catalog'));
  const plan = buildReviewPlan({ profile, records: input, asOf,
    validateAcademyDecisionRecord: validator, questionCatalog: [candidate],
    validateAcademyQuestion: () => true });
  assert.equal(plan.items[0].reasonCodes.includes('unavailable:question-catalog'), false);
  const task = planDailyTraining({ profile, reviewPlan: plan, records: input,
    questionCatalog: [candidate], validateAcademyDecisionRecord: validator,
    validateAcademyQuestion: () => true, minutes: 10, seed: 's', asOf, ruleRef: record.ruleRef });
  assert.equal(task.session.questionRefs[0].questionId, 'scenario-a');
  assert.equal(task.session.extensions['adaptive.plan'].orderedSources[0].seed, 'verified-seed');
});
test('future evidence is rejected rather than entering past ability or review snapshots', () => {
  assert.throws(() => buildAbilityProfile({
    records: [{ kind: 'legacy-v3', record: bad }], registry,
    asOf: '2026-11-17T00:00:00Z',
  }), /Future record/);
  assert.throws(() => buildReviewPlan({
    profile: makeProfile(), records: entries,
    asOf: '2026-11-17T00:00:00Z',
  }), /Future record/);
});
test('persisted v1 validators reject incomplete profile, review and session state', async () => {
  const { validateAbilityProfile, validateReviewPlan, validateTrainingSession } =
    await import('../../src/adaptive/index.js');
  assert.equal(validateAbilityProfile(makeProfile()), true);
  assert.equal(validateReviewPlan(makePlan()), true);
  assert.throws(() => validateAbilityProfile({ ...makeProfile(), skills: [{tagId: 'unknown'}] }));
  assert.throws(() => validateReviewPlan({ ...makePlan(), settings: { dailyLimit: -1, timezone: 'Asia/Taipei' } }));
  const { session } = planDailyTraining({
    profile: makeProfile(), reviewPlan: makePlan(), records: entries,
    minutes: 10, seed: 'schema', asOf: clock, ruleRef,
  });
  assert.equal(validateTrainingSession(session), true);
  assert.throws(() => validateTrainingSession({ ...session, questionRefs: [{ questionId: '' }] }));
});

test('Academy write refuses missing/modified immutable question snapshots', () => {
  const storage = makeStorage();
  const store = createAcademyStore(storage, { registry, validateAcademyDecisionRecord: validator });
  assert.throws(() => store.persistScoredRecord({
    kind: 'academy-v1', record: scenario(),
  }, { asOf: clock }), /question snapshot is required/);
  assert.equal(storage.getItem(ACADEMY_STORAGE_KEY), null);
  store.persistScoredRecord({
    kind: 'academy-v1', record: scenario(), question: scenarioQuestion(),
  }, { asOf: clock });
  assert.throws(() => store.persistScoredRecord({
    kind: 'academy-v1', record: scenario(), question: {
      ...scenarioQuestion(), generator: { ...scenarioQuestion().generator, seed: 'changed' },
    },
  }, { asOf: clock }), /Conflicting immutable/);
  assert.equal(store.load().academyQuestions.length, 1);
});

test('held-out unseen questions are excluded from practice and review, not invented as sessions', () => {
  const reservedQuestionRefs = [{ questionId: exercise.id, questionVersion: 'legacy-exercise-v3' }];
  const profile = makeProfile();
  const plan = buildReviewPlan({ profile, records: entries, asOf: clock, reservedQuestionRefs });
  assert(plan.items[0].reasonCodes.includes('unavailable:held-out'));
  assert.equal(getTodayRecommendation(profile, plan, clock).dueQuestions.length, 0);
  assert.equal(buildAnswerableCatalog({ records: entries, reservedQuestionRefs }).length, 0);
  const schedule = planDailyTraining({
    profile, reviewPlan: plan, records: entries, reservedQuestionRefs,
    minutes: 10, asOf: clock, seed: 'hold-out', ruleRef,
  });
  assert.equal(schedule.availableQuestionCount, 0);
  assert.deepEqual(schedule.session.questionRefs, []);
  assert.equal(schedule.session.extensions['adaptive.plan'].unallocatedMinutes, 10);
});
test('assessment provenance distinguishes first unseen test from practiced/repeated question', () => {
  const profile = buildAbilityProfile({
    records: entries, registry, asOf: clock,
    assessmentRefs: [{ kind: 'legacy-v3', id: bad.id }],
  });
  const evidence = profile.extensions['adaptive.evidence'].skillBreakdown[0];
  assert.equal(evidence.practiceAttempts, 1);
  assert.equal(evidence.assessmentAttempts, 1);
  assert.equal(evidence.unseenAssessmentAttempts, 0);
  assert.equal(evidence.contaminatedAssessmentAttempts, 1);
});

test('focused practice uses verified unseen same-skill variations, recap keeps its slot', () => {
  const variant = createExercise({ seed: 'adaptive-variation-2', taskType: 'multi_wait' });
  const catalogEntry = {
    questionId: variant.id, questionVersion: 'legacy-exercise-v3',
    taskType: variant.taskType, ruleRef, seed: variant.seed,
    generatorVersion: variant.generatorVersion,
    source: 'legacy-exercise-v3', available: true, estimatedMinutes: 3,
    questionSnapshot: variant,
  };
  const profile = makeProfile();
  const reviewPlan = makePlan();
  const scheduled = planDailyTraining({
    profile, reviewPlan, records: entries, questionCatalog: [catalogEntry], registry,
    minutes: 10, seed: 'variation', asOf: clock, ruleRef,
  });
  assert.equal(scheduled.availableQuestionCount, 2);
  assert(scheduled.sections.find(x => x.name === 'focused-practice')
    .questions.some(q => q.questionId === variant.id));
  assert(scheduled.sections.find(x => x.name === 'mistake-recap')
    .questions.some(q => q.questionId === exercise.id));
  assert(scheduled.session.questionRefs.every(q => q.questionVersion === 'legacy-exercise-v3'));
});
