import test from 'node:test';
import assert from 'node:assert/strict';
import { createMasterAcademyFacade, APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { getCanonicalExercise } from '../../src/academy/question-internal.js';
import {
  getAcademyExerciseMapping, createAcademyProvenance, validateAcademyProvenance,
} from '../../src/academy/index.js';
import { createAcademyStore, ACADEMY_STORAGE_KEY, validateAbilityProfile, validateReviewPlan } from '../../src/adaptive/index.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';
import { validateDecisionRecord } from '../../src/training/records.js';

const timestamp = '2026-11-17T03:00:00.000Z';
const asOf = '2026-11-19T03:00:00.000Z';
const oldV1 = JSON.stringify([{grade:'perfect',seconds:3,date:'2026-11-01T00:00:00.000Z',difficulty:'beginner'}]);
function memoryStorage(entries=[[LEGACY_SESSION_KEY,oldV1]]) {
  const data=new Map(entries);
  let failSidecarAt=null,sidecarWrites=0;
  return {
    data,
    getItem:key=>data.get(key)??null,
    setItem(key,value){
      if(key===ACADEMY_STORAGE_KEY && ++sidecarWrites===failSidecarAt) throw Error('QuotaExceededError');
      data.set(key,value);
    },
    failAt(n){failSidecarAt=n;sidecarWrites=0;},
  };
}
function answer(q) {
  const ex=getCanonicalExercise(q.questionId);
  return ex.taskType==='discard'?ex.answer.optimalTiles[0]:[...ex.answer.expectedTiles];
}
function submit(facade,id='academy-integrated-1'){
  const ref=facade.getQuestionRefs()[0];
  const q=facade.getPublicQuestion(ref);
  return facade.submitStructuralAnswer(ref,answer(q),{timestamp,durationMs:1800,attemptId:id,asOf});
}

test('L-01: real 20 lessons/100 seed-versioned QuestionPublic; no private answer before submission',()=>{
  const f=createMasterAcademyFacade(memoryStorage());
  assert.equal(f.contractVersion,'master-academy/1.0.0');
  assert.equal(f.getLessons().length,20);
  assert.equal(f.getQuestionRefs().length,100);
  assert.equal(f.capabilities.durableAcademyProvenance,true);
  assert.equal(f.capabilities.verifiedScenarioScorer,true);
  assert.equal(f.getScenarioQuestionRefs().length,5);
  const ref=f.getQuestionRefs()[0],q=f.getPublicQuestion(ref);
  assert.equal(q.questionId,ref.questionId);
  assert.equal(q.status,'validated');
  assert.ok(!Object.hasOwn(q,'answerKey'));
  assert.ok(!Object.hasOwn(q,'source'));
  assert.deepEqual(q.prompt.legacyHand,getCanonicalExercise(q.questionId).hand);
  assert.equal(getAcademyExerciseMapping(ref).legacyExerciseId,getCanonicalExercise(ref.questionId).id);
  assert.throws(()=>f.getPublicQuestion({...ref,questionVersion:'stale-version'}));
  assert.throws(()=>f.submitScenarioAnswer(),/unavailable/);
  assert.equal(f.getProvenanceLinks().length,0);
  assert.equal(f.getTrainingSession(),null);
});

test('L-01/A-01: real official score, two-phase provenance, curriculum review and idempotent reload',()=>{
  const storage=memoryStorage();
  const f=createMasterAcademyFacade(storage);
  const v1Before=storage.getItem(LEGACY_SESSION_KEY);
  const r=submit(f);
  assert.equal(r.gradingResult.status,'graded');
  assert.equal(r.gradingResult.grade,'perfect');
  assert.equal(r.durable,true);
  assert.equal(r.provenanceDurable,true);
  assert.equal(r.derivedFresh,true);
  assert.deepEqual(r.recordRef,{kind:'legacy-v3',id:'academy-integrated-1'});
  const originalBytes=storage.getItem(ARCHIVE_STORAGE_KEY);
  const original=JSON.parse(originalBytes).records[0];
  assert.equal(validateDecisionRecord(original,{verifyAnswers:true}),true);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY),v1Before);
  assert.equal(storage.getItem('tw-mahjong-master-academy:ui-links:v1'),null);
  const link=f.getProvenanceLinks()[0];
  assert.equal(link.questionId,'academy-q-001');
  assert.equal(link.recordRef.id,original.id);
  assert.equal(link.underlyingExerciseId,original.exerciseId);
  const learningProof=createAcademyProvenance(original,{questionId:link.questionId,questionVersion:link.questionVersion});
  assert.equal(validateAcademyProvenance(learningProof,original),true);
  assert.equal(link.lessonId,learningProof.lessonRef.lessonId);
  const dashboard=f.getDashboard({asOf});
  assert.equal(dashboard.durable,true);
  assert.equal(dashboard.profile.calibrationStatus,'uncalibrated');
  assert.ok(dashboard.reviewPlan.items.some(x=>x.questionId===link.questionId && x.questionVersion===link.questionVersion));
  const sidecar=createAcademyStore(storage,{registry:APPROVED_LEGACY_REGISTRY}).load();
  assert.equal(validateAbilityProfile(sidecar.abilityProfile),true);
  assert.equal(validateReviewPlan(sidecar.reviewPlan),true);
  assert.equal(sidecar.provenanceLinks.length,1);
  assert.equal(sidecar.pendingProvenance.length,0);
  assert.ok(sidecar.abilityProfile.sourceRecordRefs.some(x=>x.kind==='legacy-v3'&&x.id===original.id));
  const same=submit(f);
  assert.equal(same.durable,true);
  assert.equal(same.provenanceDurable,true);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),originalBytes);
  assert.equal(JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY)).records.length,1);
  assert.equal(createMasterAcademyFacade(storage).getProvenanceLinks().length,1);
  const reloaded=createMasterAcademyFacade(storage).getDashboard({asOf});
  assert.deepEqual(reloaded.profile,dashboard.profile);
  assert.deepEqual(reloaded.reviewPlan.items,dashboard.reviewPlan.items);
  const reviewItem=reloaded.reviewPlan.items.find(x=>x.questionId===link.questionId);
  const resolved=createMasterAcademyFacade(storage).resolveReviewQuestion(reviewItem);
  assert.equal(resolved.available,true);
  assert.equal(resolved.question.questionId,link.questionId);
  assert.equal(resolved.lesson.lessonId,link.lessonId);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY),v1Before);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),originalBytes);
});

test('R-01/R-02/S-01: real experimental Rules PlayerView to Strategy; never return full GameState',()=>{
  const f=createMasterAcademyFacade(memoryStorage());
  const result=f.analyzeSandboxTurn({seed:'combined-source-integration-seed'});
  assert.equal(result.verificationScope,'experimental-draw-discard-only');
  assert.equal(result.playerView.capabilities.settlement,false);
  assert.ok(result.playerView.opponents.every(x=>!Object.hasOwn(x,'concealed')));
  assert.ok(!Object.hasOwn(result.playerView,'wall'));
  assert.ok(!Object.hasOwn(result.playerView,'rng'));
  assert.ok(result.analysis.legalActionIds.every(id=>result.playerView.legalActions.some(x=>x.actionId===id)));
  assert.ok(result.analysis.recommendations.every(x=>x.metrics.some(m=>m.name==='dealInRisk'&&m.epistemic==='unknown'&&m.value===null)));
  assert.deepEqual(result,f.analyzeSandboxTurn({seed:'combined-source-integration-seed'}));
});

test('A-01 crash injection: durable v3 survives failed provenance commit; rebuild recovers by intent',()=>{
  const storage=memoryStorage();
  storage.failAt(2);
  const f=createMasterAcademyFacade(storage);
  const r=submit(f,'write-ahead-candidate');
  assert.equal(r.derivedFresh,false);
  assert.equal(r.provenanceDurable,false);
  const original=storage.getItem(ARCHIVE_STORAGE_KEY);
  assert.equal(JSON.parse(original).records.length,1);
  const early=JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY));
  assert.equal(early.provenanceLinks.length,0);
  assert.equal(early.pendingProvenance.length,1);
  storage.failAt(null);
  const reopened=createMasterAcademyFacade(storage);
  const restored=reopened.getDashboard({asOf});
  assert.equal(restored.durable,true);
  assert.equal(reopened.getProvenanceLinks().length,1);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),original);
  assert.equal(JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).pendingProvenance.length,0);
});

test('A-01 failures: quota before prepare never writes v3; corrupt provenance never gets trusted',()=>{
  const storage=memoryStorage();
  storage.failAt(1);
  const r=submit(createMasterAcademyFacade(storage),'quota-blocked');
  assert.equal(r.durable,false);
  assert.equal(r.derivedFresh,false);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),null);
  storage.failAt(null);
  const f=createMasterAcademyFacade(storage);
  submit(f,'valid');
  const rawV3=storage.getItem(ARCHIVE_STORAGE_KEY);
  const state=JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY));
  state.provenanceLinks[0].lessonRef.lessonId='tampered-lesson';
  const tampered=JSON.stringify(state);
  storage.setItem(ACADEMY_STORAGE_KEY,tampered);
  assert.throws(()=>createMasterAcademyFacade(storage).getDashboard({asOf}));
  assert.equal(storage.getItem(ACADEMY_STORAGE_KEY),tampered);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),rawV3);
});

test('Unknown question version and missing scenario scorer do not create formal v3 grades',()=>{
  const storage=memoryStorage();
  const f=createMasterAcademyFacade(storage);
  assert.throws(()=>f.submitStructuralAnswer({questionId:'academy-q-001',questionVersion:'99.0.0'},3,
    {timestamp,durationMs:123,attemptId:'bad',asOf}));
  assert.throws(()=>f.submitScenarioAnswer({actionId:'fake'}),/unavailable/);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),null);
});
