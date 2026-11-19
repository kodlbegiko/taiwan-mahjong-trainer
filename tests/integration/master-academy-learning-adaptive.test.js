import test from 'node:test';
import assert from 'node:assert/strict';

import { createMasterAcademyFacade, APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { getCanonicalExercise } from '../../src/academy/question-internal.js';
import { createAcademyStore, ACADEMY_STORAGE_KEY, validateAbilityProfile, validateReviewPlan } from '../../src/adaptive/index.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';
import { validateDecisionRecord } from '../../src/training/records.js';

const earlier = '2026-11-17T03:00:00.000Z';
const asOf = '2026-11-19T03:00:00.000Z';
const oldV1 = JSON.stringify([{ grade: 'perfect', seconds: 3, date: '2026-11-01T00:00:00.000Z', difficulty: 'beginner' }]);
function fakeStorage(entries = [[LEGACY_SESSION_KEY, oldV1]]) {
  const data = new Map(entries);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function answerFor(q) {
  const ex = getCanonicalExercise(q.questionId);
  return ex.taskType === 'discard' ? ex.answer.optimalTiles[0] : [...ex.answer.expectedTiles];
}

test('Phase 2 seam: 20 true lessons, 100 deterministic question refs, no public answerKey', () => {
  const facade = createMasterAcademyFacade(fakeStorage());
  assert.equal(facade.contractVersion, 'master-academy/1.0.0');
  assert.equal(facade.getLessons().length, 20);
  assert.equal(facade.getQuestionRefs().length, 100);
  assert.equal(facade.capabilities.verifiedScenarioScorer, false);
  assert.equal(facade.capabilities.academyBrowserLoop, false);
  const q = facade.getPublicQuestion(facade.getQuestionRefs()[0]);
  assert.equal(q.status, 'validated');
  assert.ok(!Object.hasOwn(q, 'answerKey'));
  assert.ok(!Object.hasOwn(q, 'source'));
  assert.ok(!JSON.stringify(q).includes('answerSnapshotDigest'));
  assert.deepEqual(q.prompt.legacyHand, getCanonicalExercise(q.questionId).hand);
  assert.throws(() => facade.getPublicQuestion({questionId: q.questionId, questionVersion: 'next'}));
  assert.throws(() => facade.submitScenarioAnswer('fake-action'), /unavailable/);
});

test('Official v3 answer → durable old archive → typed RecordRef → Adaptive profile/review, deterministic', () => {
  const storage = fakeStorage();
  const app = createMasterAcademyFacade(storage);
  const ref = app.getQuestionRefs()[0];
  const q = app.getPublicQuestion(ref);
  const beforeV1 = storage.getItem(LEGACY_SESSION_KEY);
  const scored = app.submitStructuralAnswer(ref, answerFor(q), {
    timestamp: earlier, durationMs: 1800, attemptId: 'integration-legacy-record-1', asOf,
  });
  assert.equal(scored.gradingResult.grade, 'perfect');
  assert.equal(scored.gradingResult.score, 1);
  assert.deepEqual(scored.recordRef, {kind:'legacy-v3', id:'integration-legacy-record-1'});
  assert.equal(scored.durable, true);
  assert.equal(scored.derivedFresh, true);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), beforeV1);
  const v3Bytes = storage.getItem(ARCHIVE_STORAGE_KEY);
  assert.equal(typeof v3Bytes, 'string');
  const original = JSON.parse(v3Bytes).records[0];
  assert.equal(validateDecisionRecord(original), true);
  const dashboard = app.getDashboard({ asOf });
  assert.equal(dashboard.durable, true);
  assert.equal(dashboard.calibrationStatus, 'uncalibrated');
  const sidecar = createAcademyStore(storage, {registry:APPROVED_LEGACY_REGISTRY}).load();
  assert.equal(validateAbilityProfile(sidecar.abilityProfile), true);
  assert.equal(validateReviewPlan(sidecar.reviewPlan), true);
  assert.ok(sidecar.abilityProfile.sourceRecordRefs.some(x => x.kind==='legacy-v3' && x.id===original.id));
  assert.equal(sidecar.abilityProfile.skills.find(x=>x.tagId==='efficiency.discard').attempts, 1);
  assert.equal(sidecar.abilityProfile.skills.find(x=>x.tagId==='efficiency.discard').estimatedProficiency, null);
  assert.equal(dashboard.profile.calibrationStatus, 'uncalibrated');
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), v3Bytes);
  const dashboardAgain = createMasterAcademyFacade(storage).getDashboard({asOf});
  assert.deepEqual(dashboardAgain.profile, dashboard.profile);
  assert.deepEqual(dashboardAgain.recommendation, dashboard.recommendation);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), beforeV1);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), v3Bytes);
  assert.throws(() => app.submitStructuralAnswer(ref, answerFor(q), {
    timestamp: earlier, durationMs: 1800, attemptId: 'integration-legacy-record-1', asOf,
  }), /已存在/);
});

test('Unsupported scenario fails closed; corrupt Academy state never destroys v1/v3', () => {
  const storage = fakeStorage();
  const app = createMasterAcademyFacade(storage);
  const before = storage.getItem(LEGACY_SESSION_KEY);
  assert.throws(() => app.submitScenarioAnswer(), /unavailable/);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY), null);
  storage.setItem(ACADEMY_STORAGE_KEY, '{corrupted');
  assert.throws(() => app.getDashboard({asOf}), /corrupt|JSON|invalid/i);
  assert.equal(storage.getItem(ACADEMY_STORAGE_KEY), '{corrupted');
  assert.equal(storage.getItem(LEGACY_SESSION_KEY), before);
});

test('Unavailable durable storage may grade, but never claims persisted evidence', () => {
  const storage = {getItem:()=>null,setItem:()=>{throw Error('QuotaExceededError')}};
  const facade=createMasterAcademyFacade(storage);
  const ref=facade.getQuestionRefs()[0];
  const q=facade.getPublicQuestion(ref);
  const res=facade.submitStructuralAnswer(ref,answerFor(q),{
    timestamp:earlier,durationMs:1234,attemptId:'not-persisted',asOf,
  });
  assert.equal(res.gradingResult.grade,'perfect');
  assert.equal(res.durable,false);
  assert.equal(res.derivedFresh,false);
  assert.equal(res.errorCode,'LEGACY_NOT_DURABLE');
});
