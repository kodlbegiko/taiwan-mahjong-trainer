import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, listQuestionRefs, submitAcademyAnswer,
  validateAcademyProvenanceBatch, validateAcademyProvenance,
  toPublicQuestion } from '../../src/academy/index.js';
import { auditAcademyContent, ACADEMY_CONTENT_AUDIT_VERSION,
  validateCurriculumQuestionOwnership } from '../../src/academy/content-audit.js';
import { UNPUBLISHED_LESSON_GUIDES, LESSON_GUIDE_VERSION,
  getUnpublishedLessonGuide, validateUnpublishedLessonGuides } from '../../src/academy/unpublished-guides.js';
import { readFileSync } from 'node:fs';
import { BANK_SPEC } from '../../src/academy/catalog.js';
import { getCanonicalExercise } from '../../src/academy/question-internal.js';
import { createMasterAcademyFacade } from '../../src/integration/master-academy-facade.js';
import { ARCHIVE_STORAGE_KEY } from '../../src/storage/archive.js';
import { ACADEMY_STORAGE_KEY } from '../../src/adaptive/index.js';

const ref=id=>({questionId:id,questionVersion:'1.0.0'});
const clone=x=>JSON.parse(JSON.stringify(x));
const at='2026-11-20T09:00:00.000Z';
const report=auditAcademyContent();
const memory=()=>{
  const map=new Map();
  return { getItem:k=>map.get(k)??null, setItem:(k,v)=>map.set(k,String(v)) };
};

test('R7 content: all 20 states and 100 replayed structural scores are evidenced, no synthetic achievement',()=>{
  assert.equal(report.auditVersion,ACADEMY_CONTENT_AUDIT_VERSION);
  assert.equal(report.authority,'canonical-v3-decision-records-only');
  assert.equal(report.createsLearningEvidence,false);
  assert.equal(report.curriculum.totalLessons,20);
  assert.deepEqual([report.curriculum.published,report.curriculum.validated,report.curriculum.draft],[12,8,0]);
  assert.equal(report.curriculum.fullyAssessedObjectives,10);
  assert.equal(report.curriculum.publishedFullyAssessed,8);
  assert.equal(report.curriculum.validatedFullyAssessed,2);
  assert.equal(report.curriculum.objectiveTagCoverageMethod,
    'intersection-of-lesson-objectives-and-canonical-v3-question-tags');
  assert.equal(report.bank.totalQuestions,100);
  assert.equal(report.bank.structurallyVerified,100);
  assert.equal(report.bank.failed,0);
  assert.equal(report.bank.uniqueShapes,100);
  assert.deepEqual(report.bank.byTaskType,{discard:40,tenpai:40,multi_wait:20});
  assert.equal(report.bank.humanCalibratedQuestions,0);
  assert.equal(report.bank.withPublicVisibleTiles,0);
  assert.deepEqual(report.failures,[]);
  assert.equal(report.lessonRows.length,20);
  assert.equal(report.questionRows.length,100);
  assert.equal(report.lessonRows.reduce((n,x)=>n+x.questionCount,0),100);
  for(const lesson of report.lessonRows){
    assert.equal(lesson.status,LESSONS.find(x=>x.lessonId===lesson.lessonRef.lessonId).status);
    assert.equal(lesson.questionCount,5);
    assert.equal(lesson.verifiedQuestionCount,5);
    assert.equal(lesson.lessonShapeValidated,true);
    assert.equal(lesson.statusChangeApproved,false);
    assert.deepEqual(lesson.taskTypes,['discard','multi_wait','tenpai']);
  }
});

test('R7 release gates: 8 validated lessons remain blocked with concrete reasons',()=>{
  const pending=report.lessonRows.filter(x=>x.status!=='published');
  assert.equal(pending.length,8);
  for(const row of pending){
    assert.equal(row.status,'validated');
    assert.ok(row.publicationBlockers.length>0,row.lessonRef.lessonId);
    assert.equal(row.statusChangeApproved,false);
  }
  assert.ok(pending.find(x=>x.lessonRef.lessonId==='academy-l4-02')
    .publicationBlockers.includes('verified-open-meld-actions-missing'));
  assert.ok(pending.find(x=>x.lessonRef.lessonId==='academy-l4-04')
    .publicationBlockers.includes('verified-tai-scoring-profile-missing'));
  assert.ok(pending.find(x=>x.lessonRef.lessonId==='academy-l5-02')
    .publicationBlockers.includes('mastery-level-difficulty-calibration-missing'));
  // Existing published content is not equivalent to scoring all claimed skills.
  assert.ok(report.lessonRows.some(x=>x.status==='published'&&x.unassessedObjectiveTagIds.length>0));
});

test('R7 difficulty is sourced from original v3 sampling and estimates, never presented as human calibration',()=>{
  assert.equal(report.bank.bySamplingLevel.beginner,20);
  assert.equal(report.bank.bySamplingLevel.intermediate,20);
  assert.equal(report.bank.bySamplingLevel.advanced,60);
  for(const row of report.questionRows){
    const ex=getCanonicalExercise(row.questionRef.questionId);
    assert.deepEqual(row.estimatedDifficulty,ex.estimatedDifficulty);
    assert.equal(row.requestedSamplingLevel,ex.requestedLevel);
    assert.equal(row.scoringVersion,ex.answerRules.version);
    assert.equal(row.structuralValidation,'pass');
  }
  assert.ok(Object.keys(report.bank.byEstimatedDifficulty).every(x=>
    ['beginner','intermediate','advanced'].includes(x)));
});

test('R7 grading: every optimal discard, including equal-best alternatives, is treated as correct',()=>{
  for(const s of BANK_SPEC.filter(x=>x.taskType==='discard')){
    const ex=getCanonicalExercise(s.questionId);
    const best=ex.answer.ranking[0];
    const expected=ex.answer.ranking.filter(x=>
      x.shanten===best.shanten&&x.copies===best.copies).map(x=>x.tile);
    assert.deepEqual([...ex.answer.optimalTiles].sort((a,b)=>a-b),expected.sort((a,b)=>a-b));
    for(const tile of expected){
      const submitted=submitAcademyAnswer(ref(s.questionId),tile,{
        timestamp:at,durationMs:250,attemptId:'r7-opt-'+s.questionId+'-'+tile});
      assert.equal(submitted.record.schemaVersion,3);
      assert.equal(submitted.record.grade,'perfect');
      assert.equal(submitted.record.score,1);
      assert.equal(submitted.recordRef.kind,'legacy-v3');
    }
  }
});

test('R7 read-only audit exposes no hidden answer keys or training records',()=>{
  const dump=JSON.stringify(report);
  for(const forbidden of ['"answerKey"','"chosen"','"exerciseSnapshot"','"wall"',
    '"replacementWall"','"sourceViewRef"','"recordRef"'])
    assert.ok(!dump.includes(forbidden),forbidden);
  assert.deepEqual(listQuestionRefs(),BANK_SPEC.map(x=>ref(x.questionId)));
  for(const r of listQuestionRefs()){
    const publicQuestion=toPublicQuestion(r);
    assert.equal(publicQuestion.status,'validated');
    assert.ok(!Object.hasOwn(publicQuestion,'answerKey'));
  }
});

test('R7 provenance: duplicate replay cannot become two scores; stale versions are rejected',()=>{
  const ex=getCanonicalExercise('academy-q-001');
  const choice=ex.answer.optimalTiles[0];
  const options={timestamp:at,durationMs:1700,attemptId:'r7-idempotent-1'};
  const a=submitAcademyAnswer(ref('academy-q-001'),choice,options);
  const deduped=validateAcademyProvenanceBatch(
    [clone(a.provenance),clone(a.provenance)],[clone(a.record),clone(a.record)]);
  assert.equal(deduped.length,1);
  assert.throws(()=>validateAcademyProvenanceBatch(
    [a.provenance],[{...clone(a.record),id:'wrong'}]));
  assert.throws(()=>submitAcademyAnswer(
    {questionId:'academy-q-001',questionVersion:'stale'},choice,options),/版本/);
});

test('R7 refresh/retry: durable archive:v3 is authoritative and score evidence stays single',()=>{
  const storage=memory();
  const facade=createMasterAcademyFacade(storage);
  const questionRef=facade.getQuestionRefs()[0];
  const answer=getCanonicalExercise(questionRef.questionId).answer.optimalTiles[0];
  const options={timestamp:at,durationMs:1200,attemptId:'r7-retry-same',
    asOf:'2026-11-21T09:00:00.000Z'};
  const first=facade.submitStructuralAnswer(questionRef,answer,options);
  assert.equal(first.durable,true);
  assert.equal(first.derivedFresh,true);
  const original=storage.getItem(ARCHIVE_STORAGE_KEY);
  const sidecar=storage.getItem(ACADEMY_STORAGE_KEY);
  const refreshed=createMasterAcademyFacade(storage);
  const repeated=refreshed.submitStructuralAnswer(questionRef,answer,options);
  assert.equal(repeated.durable,true);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),original);
  assert.equal(JSON.parse(original).records.length,1);
  assert.equal(JSON.parse(sidecar).provenanceLinks.length,1);
  const rebuilt=refreshed.getDashboard({asOf:options.asOf});
  assert.equal(rebuilt.profile.calibrationStatus,'uncalibrated');
  assert.equal(rebuilt.reviewPlan.items.filter(x=>x.questionId===questionRef.questionId).length,1);
  assert.equal(rebuilt.profile.skills.find(x=>x.tagId==='efficiency.shanten').attempts,1);
  assert.equal(createMasterAcademyFacade(storage).getProvenanceLinks().length,1);
});

test('R7 unscored lesson supplements cover the eight held-back lessons without inventing grades',()=>{
  assert.equal(validateUnpublishedLessonGuides(),true);
  assert.equal(UNPUBLISHED_LESSON_GUIDES.length,8);
  const expected=new Set(report.lessonRows.filter(x=>x.status==='validated')
    .map(x=>x.lessonRef.lessonId));
  assert.deepEqual(new Set(UNPUBLISHED_LESSON_GUIDES.map(x=>x.lessonRef.lessonId)),expected);
  for(const guide of UNPUBLISHED_LESSON_GUIDES){
    assert.equal(guide.guideVersion,LESSON_GUIDE_VERSION);
    assert.equal(guide.officialCredit,false);
    assert.equal(guide.grading,'unscored');
    assert.deepEqual(getUnpublishedLessonGuide(guide.lessonRef.lessonId),guide);
    assert.ok(guide.workedReasoning.length>25);
    assert.ok(guide.acceptanceEvidence.length>25);
  }
  const altered=UNPUBLISHED_LESSON_GUIDES.map(clone);
  altered[0].officialCredit=true;
  assert.throws(()=>validateUnpublishedLessonGuides(altered),/false evidence/);
  assert.equal(getUnpublishedLessonGuide('academy-l1-01'),null);
});

test('R7 wrong-answer review: real canonical score leads to available review, not a second grade',()=>{
  const storage=memory();
  const facade=createMasterAcademyFacade(storage);
  const spec=BANK_SPEC.filter(x=>x.taskType==='discard').find(x=>{
    const ranking=getCanonicalExercise(x.questionId).answer.ranking;
    return ranking.some(r=>r.shanten>ranking[0].shanten);
  });
  assert.ok(spec,'At least one official fixture must contain a worse-shanten discard');
  const ex=getCanonicalExercise(spec.questionId);
  const choice=ex.answer.ranking.find(x=>x.shanten>ex.answer.ranking[0].shanten).tile;
  const attemptId='r7-actual-error';
  const answer=facade.submitStructuralAnswer(ref(spec.questionId),choice,{
    timestamp:'2026-11-20T09:00:00.000Z',durationMs:1000,attemptId,
    asOf:'2026-11-22T09:00:00.000Z'
  });
  assert.equal(answer.gradingResult.grade,'improve');
  assert.equal(answer.gradingResult.score,0);
  assert.equal(answer.recordRef.kind,'legacy-v3');
  const dashboard=facade.getDashboard({asOf:'2026-11-22T09:00:00.000Z'});
  const review=dashboard.reviewPlan.items.find(q=>q.questionId===spec.questionId);
  assert.ok(review);
  assert.ok(review.reasonCodes.includes('recent-mistake'));
  assert.ok(review.reasonCodes.includes('repeated-error'));
  assert.equal(facade.resolveReviewQuestion(review).available,true);
  assert.ok(dashboard.recommendation.dueQuestions.some(q=>q.questionId===spec.questionId));
  assert.equal(JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY)).records.length,1);
  assert.equal(createMasterAcademyFacade(storage).getProvenanceLinks().length,1);
});

test('R7 offline graph: Academy release entrypoint does not import QA-only modules missing from SW precache',()=>{
  const publicEntry=readFileSync(new URL('../../src/academy/index.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../../sw.js',import.meta.url),'utf8');
  for(const moduleName of ['content-audit.js','unpublished-guides.js','r71-assessments.js']){
    assert.ok(!publicEntry.includes(moduleName),moduleName+' is not a runtime dependency');
    assert.ok(!sw.includes("'./src/academy/"+moduleName+"'"),
      moduleName+' should remain a standalone QA-only module');
  }
});

test('R7 immutable curriculum: a lesson-version change cannot relabel past v3 achievements',()=>{
  const question='academy-q-061';
  const ex=getCanonicalExercise(question);
  const choice=ex.taskType==='discard'?ex.answer.optimalTiles[0]:[...ex.answer.expectedTiles];
  const answer=submitAcademyAnswer(ref(question),choice,{
    timestamp:at,durationMs:3000,attemptId:'r7-versioned-lesson-record'
  });
  const unchangedRecord=JSON.stringify(answer.record);
  const oldLink=clone(answer.provenance);
  assert.equal(validateAcademyProvenance(oldLink,answer.record),true);
  const changed=clone(oldLink);
  changed.lessonRef.lessonVersion='2.0.0';
  assert.throws(()=>validateAcademyProvenance(changed,answer.record),
    /不一致|不符|版本/);
  const wrongQuestion=clone(oldLink);
  wrongQuestion.questionRef.questionVersion='2.0.0';
  assert.throws(()=>validateAcademyProvenance(wrongQuestion,answer.record),
    /不一致|不符|版本/);
  const exact=validateAcademyProvenanceBatch([oldLink,clone(oldLink)],[answer.record]);
  assert.equal(exact.length,1);
  assert.equal(JSON.stringify(answer.record),unchangedRecord,'Old v3 attempt must not be migrated in place');
});

test('R7 ownership: each immutable question version is assigned once to its true lesson',()=>{
  assert.equal(validateCurriculumQuestionOwnership(),true);
  const badLesson=LESSONS.map(clone);
  badLesson[0].questionRefs[0]=clone(badLesson[1].questionRefs[0]);
  assert.throws(()=>validateCurriculumQuestionOwnership(badLesson,BANK_SPEC),/wrong lesson/);
  const duplicate=LESSONS.map(clone);
  duplicate[0].questionRefs.push(clone(duplicate[0].questionRefs[0]));
  assert.throws(()=>validateCurriculumQuestionOwnership(duplicate,BANK_SPEC),/more than once/);
  const missing=LESSONS.map(clone);
  missing[0].questionRefs.pop();
  assert.throws(()=>validateCurriculumQuestionOwnership(missing,BANK_SPEC),/exactly one lesson/);
});
