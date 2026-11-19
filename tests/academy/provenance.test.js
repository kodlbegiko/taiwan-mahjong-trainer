import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACADEMY_PROVENANCE_VERSION, CONTRACT_VERSION,
  getAcademyExerciseMapping, findAcademyQuestionByExerciseId,
  createAcademyProvenance, validateAcademyProvenance,
  validateAcademyProvenanceBatch, resolveAcademyProvenance,
  submitAcademyAnswer, toPublicQuestion, getLessonPublic,
  SKILL_TAGS, LESSONS
} from '../../src/academy/index.js';
import { BANK_SPEC } from '../../src/academy/catalog.js';
import { getCanonicalExercise, getFullQuestion } from '../../src/academy/question-internal.js';
import { createDecisionRecord,validateDecisionRecord } from '../../src/training/records.js';
import { createLocalTrainingStore } from '../../src/storage/local.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, importTrainingJSON } from '../../src/storage/archive.js';

const copy = x => JSON.parse(JSON.stringify(x));
const ref = id => ({questionId:id,questionVersion:'1.0.0'});
const opts = id => ({timestamp:'2026-11-19T08:23:31.000Z',durationMs:1700,attemptId:id});
const exactChoice = q => q.taskType==='discard'
  ? q.answerKey.acceptedTileTypes[0]:[...q.answerKey.acceptedTileTypes];
const submit = (id,attemptId='link-'+id) =>
  submitAcademyAnswer(ref(id),exactChoice(getFullQuestion(id)),opts(attemptId));
function tamper(x,mutate){ const y=copy(x);mutate(y);return y; }
function memoryStorage(initial={}) {
  const state=new Map(Object.entries(initial));
  return {
    getItem:key=>state.has(key)?state.get(key):null,
    setItem:(key,value)=>{state.set(key,String(value));},
    removeItem:key=>state.delete(key)
  };
}

test('AcademyQuestion → Exercise v3: 100 unique, strictly replayed mappings and immutable output',()=>{
  const mappings=BANK_SPEC.map(s=>getAcademyExerciseMapping(ref(s.questionId)));
  assert.equal(mappings.length,100);
  assert.equal(new Set(mappings.map(x=>x.legacyExerciseId)).size,100);
  assert.equal(new Set(mappings.map(x=>x.questionRef.questionId+'@'+x.questionRef.questionVersion)).size,100);
  for(let i=0;i<mappings.length;i++){
    const link=mappings[i],spec=BANK_SPEC[i];
    const exercise=getCanonicalExercise(spec.questionId);
    const question=getFullQuestion(spec.questionId);
    assert.equal(link.schemaVersion,1);
    assert.equal(link.contractVersion,CONTRACT_VERSION);
    assert.equal(link.provenanceVersion,ACADEMY_PROVENANCE_VERSION);
    assert.equal(link.legacyExerciseId,exercise.id);
    assert.equal(link.generator.seed,exercise.seed);
    assert.equal(link.generator.index,exercise.index);
    assert.equal(link.generator.generatorVersion,exercise.generatorVersion);
    assert.equal(link.ruleRef.ruleVersion,exercise.ruleVersion);
    assert.equal(link.scoringVersion,exercise.answerRules.version);
    assert.deepEqual(link.lessonRef,question.lessonRef);
    assert.deepEqual(link.skillTagIds,question.skillTagIds);
    const lesson=getLessonPublic(link.lessonRef.lessonId);
    assert.equal(lesson.lessonVersion,link.lessonRef.lessonVersion);
    assert.ok(lesson.questionRefs.some(r=>r.questionId===link.questionRef.questionId&&r.questionVersion===link.questionRef.questionVersion));
    assert.ok(Object.isFrozen(link)&&Object.isFrozen(link.generator));
    assert.throws(()=>{link.generator.seed='altered';},TypeError);
  }
  assert.equal(LESSONS.length,20);
  assert.equal(SKILL_TAGS.length,16);
});

test('Exercise v3 → AcademyQuestion reverse lookup checks real fixture identity, not ID prefix',()=>{
  for(const s of BANK_SPEC){
    const forward=getAcademyExerciseMapping(ref(s.questionId));
    const reverse=findAcademyQuestionByExerciseId(forward.legacyExerciseId);
    assert.deepEqual(reverse,forward);
  }
  assert.equal(findAcademyQuestionByExerciseId('ex3-fake-looking-prefix-001'),null);
  assert.throws(()=>findAcademyQuestionByExerciseId(''),/無效/);
});

test('Academy submission includes RecordRef-bound provenance but preserves canonical grading and original v3 bytes',()=>{
  const q=getFullQuestion('academy-q-001');
  const exercise=getCanonicalExercise(q.questionId);
  const choice=exactChoice(q);
  const expected=createDecisionRecord(exercise,choice,opts('official-identity'));
  const result=submitAcademyAnswer(ref(q.questionId),choice,opts('official-identity'));
  assert.deepEqual(result.record,expected);
  assert.equal(validateDecisionRecord(result.record),true);
  assert.equal(result.recordRef.kind,'legacy-v3');
  assert.deepEqual(result.provenance.recordRef,result.recordRef);
  assert.equal(result.provenance.legacyExerciseId,result.record.exerciseId);
  assert.equal(result.provenance.questionRef.questionId,q.questionId);
  assert.equal(validateAcademyProvenance(result.provenance,result.record),true);
  assert.equal(result.gradingResult.score,expected.score);
  assert.ok(!JSON.stringify(toPublicQuestion(ref(q.questionId))).includes('"answerKey"'));
  assert.ok(!JSON.stringify(result.provenance).includes('"answerKey"'));
});

test('sidecar JSON roundtrip + reload from canonical archive recovers exact Lesson and skills without rewriting legacy storage',()=>{
  const storage=memoryStorage();
  const questionId='academy-q-027';
  const raw=submit(questionId,'persisted-027');
  const officialStore=createLocalTrainingStore(storage);
  const exercise=getCanonicalExercise(questionId);
  assert.deepEqual(officialStore.addDecision(exercise,raw.record.chosen,opts('persisted-027')),raw.record);
  const originalV3=storage.getItem(ARCHIVE_STORAGE_KEY);
  storage.setItem(LEGACY_SESSION_KEY,'legacy-untouched-by-academy');
  const originalV1=storage.getItem(LEGACY_SESSION_KEY);
  // Simulate only the AI4 sidecar's JSON durability boundary. Not a second production storage engine.
  const sidecarKey='test-only:academy-provenance:roundtrip';
  storage.setItem(sidecarKey,JSON.stringify({schemaVersion:1,links:[raw.provenance]}));
  // New JS runtime/browser load: rebuild from two independently retained JSON sources.
  const persistedV3=importTrainingJSON(storage.getItem(ARCHIVE_STORAGE_KEY)).records.find(r=>r.id==='persisted-027');
  const reloaded=JSON.parse(storage.getItem(sidecarKey)).links[0];
  assert.equal(validateAcademyProvenance(reloaded,persistedV3),true);
  const resolved=resolveAcademyProvenance(reloaded,persistedV3);
  assert.deepEqual(resolved.questionRef,ref(questionId));
  assert.deepEqual(resolved.lessonRef,getFullQuestion(questionId).lessonRef);
  assert.deepEqual(resolved.skillTagIds,getFullQuestion(questionId).skillTagIds);
  assert.deepEqual(toPublicQuestion(resolved.questionRef).lessonRef,resolved.lessonRef);
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),originalV3);
  assert.equal(storage.getItem(LEGACY_SESSION_KEY),originalV1);
  assert.deepEqual(persistedV3,raw.record);
});

test('unknown/stale AcademyQuestion versions and altered seed/index/generatorVersion fail closed',()=>{
  const submission=submit('academy-q-006');
  const {record,provenance:p}=submission;
  assert.throws(()=>getAcademyExerciseMapping({questionId:'academy-q-006',questionVersion:'2.0.0'}),/版本/);
  assert.throws(()=>createAcademyProvenance(record,{questionId:'academy-q-006',questionVersion:'2.0.0'}),/版本/);
  for(const key of ['seed','index','generatorVersion']){
    assert.throws(()=>validateAcademyProvenance(tamper(p,x=>{x.generator[key]=key==='index'?777:'stale';}),record),/不一致/);
  }
  assert.throws(()=>validateAcademyProvenance(tamper(p,x=>{x.questionRef.questionVersion='0.1.0';}),record),/版本/);
  assert.throws(()=>validateAcademyProvenance(tamper(p,x=>{x.questionRef.questionId='academy-q-007';}),record),/不符|不一致/);
});

test('ruleRef, exerciseId, scoringVersion, lessonRef, SkillTag and source aliases are rejected',()=>{
  const {record,provenance:p}=submit('academy-q-011');
  const changes=[
    x=>{x.ruleRef.profileId='fabricated-rule-profile';},
    x=>{x.ruleRef.ruleVersion='fake-rule';},
    x=>{x.legacyExerciseId='ex3-not-original';},
    x=>{x.scoringVersion='fake-score-v5';},
    x=>{x.scorerId='unknown-scorer';},
    x=>{x.lessonRef.lessonId='academy-l5-04';},
    x=>{x.lessonRef.lessonVersion='0';},
    x=>{x.skillTagIds=['unregistered.tag'];},
    x=>{x.skillTagIds=[];},
    x=>{x.source.snapshotRef='fake-exercise';},
    x=>{x.source.kind='player-view-snapshot';},
    x=>{x.recordRef.kind='academy-v1';},
    x=>{x.recordRef.id='another-attempt';},
    x=>{x.contractVersion='master-academy/99.0.0';},
    x=>{x.provenanceVersion='academy-provenance/2.0.0';},
    x=>{x.schemaVersion=2;}
  ];
  for(const mutate of changes)assert.throws(()=>validateAcademyProvenance(tamper(p,mutate),record));
  assert.throws(()=>validateAcademyProvenance(p,null),/缺少/);
  assert.throws(()=>createAcademyProvenance(record,ref('academy-q-012')),/不符/);
});

test('record snapshot/attempt ID/score tampering rejected, no rewriting original v3 record',()=>{
  const {record,provenance}=submit('academy-q-021');
  const before=JSON.stringify(record);
  assert.throws(()=>createAcademyProvenance(tamper(record,r=>{r.exerciseId='ex3-forged';}),ref('academy-q-021')));
  assert.throws(()=>createAcademyProvenance(tamper(record,r=>{r.exerciseSnapshot.seed='different-seed';}),ref('academy-q-021')));
  assert.throws(()=>validateAcademyProvenance(provenance,tamper(record,r=>{r.scoringVersion='efficiency-v999';})));
  assert.throws(()=>validateAcademyProvenance(provenance,tamper(record,r=>{r.score=0.17;})));
  assert.throws(()=>validateAcademyProvenance(provenance,tamper(record,r=>{r.id='another-attempt';})));
  assert.equal(JSON.stringify(record),before);
});

test('idempotent duplicate links; two distinct attempts preserved; unknown record IDs rejected',()=>{
  const a=submit('academy-q-043','attempt-a');
  const b=submit('academy-q-043','attempt-b');
  const c=submit('academy-q-044','attempt-c');
  const links=validateAcademyProvenanceBatch([
    copy(b.provenance),copy(a.provenance),copy(a.provenance),copy(c.provenance)
  ],[c.record,a.record,b.record]);
  assert.equal(links.length,3);
  assert.deepEqual(links.map(x=>x.recordRef.id),['attempt-a','attempt-b','attempt-c']);
  assert.deepEqual(validateAcademyProvenanceBatch([...links].reverse(),[...([a.record,b.record,c.record])].reverse()),links);
  assert.throws(()=>validateAcademyProvenanceBatch(
    [a.provenance], [b.record]),/缺少|無效|不存在/);
  assert.throws(()=>validateAcademyProvenanceBatch(
    [a.provenance,tamper(a.provenance,x=>{x.questionRef.questionId='academy-q-044';})],
    [a.record]),/不符|不一致/);
  const conflictedRecord=tamper(a.record,x=>{x.score=0;});
  assert.throws(()=>validateAcademyProvenanceBatch([a.provenance],[a.record,conflictedRecord]));
});

test('provenance matches even after JSON object key reorder; unknown extension fields rejected',()=>{
  const {record,provenance}=submit('academy-q-056');
  const reordered=Object.fromEntries(Object.entries(copy(provenance)).reverse());
  reordered.generator=Object.fromEntries(Object.entries(reordered.generator).reverse());
  assert.equal(validateAcademyProvenance(reordered,record),true);
  assert.throws(()=>validateAcademyProvenance(tamper(provenance,x=>{x.hiddenAnswerKey={};}),record),/不一致/);
});
