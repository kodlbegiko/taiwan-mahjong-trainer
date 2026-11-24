import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SKILL_TAGS,ERROR_TYPES,validateTaxonomy,CONTRACT_VERSION,
  LESSONS,LEVELS,validateLessons,getLessonPublic,
  listQuestionRefs,toPublicQuestion,gradeAcademyQuestion,submitAcademyAnswer,
  createAcademyDecisionRecord,validateAcademyDecisionRecord,
  VERIFIED_SCENARIO_SCORER_COUNT
} from '../../src/academy/index.js';
import {getFullQuestion,validateAcademyQuestion,replayAcademyQuestion,auditBank,getCanonicalExercise} from '../../src/academy/question-internal.js';
import {BANK_SPEC} from '../../src/academy/catalog.js';
import {createDecisionRecord,validateDecisionRecord} from '../../src/training/records.js';
import {createExercise,replayExercise} from '../../src/training/exercises.js';
import {tileLabel} from '../../src/tiles.js';
import {readFileSync} from 'node:fs';
const ref=id=>({questionId:id,questionVersion:'1.0.0'});
const clone=x=>JSON.parse(JSON.stringify(x));

test('taxonomy: stable ids, legacy error meanings, DAG and version rejection',()=>{
 assert.equal(CONTRACT_VERSION,'master-academy/1.0.0');
 assert.equal(SKILL_TAGS.length,16);
 assert.equal(ERROR_TYPES.length,4);
 assert.deepEqual(ERROR_TYPES.map(x=>x.errorId).sort(),
   ['higher-shanten','lower-ukeire','missed-winning-tile','false-winning-tile'].sort());
 assert.equal(validateTaxonomy(),true);
 const bad=SKILL_TAGS.map(clone);
 bad[0].prerequisiteTagIds=[bad[1].tagId];
 assert.throws(()=>validateTaxonomy(bad),/循環/);
 bad[0].contractVersion='master-academy/2.0.0';
 assert.throws(()=>validateTaxonomy(bad),/版本/);
});

test('five curriculum levels, 20 lessons, complete references, DAG',()=>{
 assert.equal(LEVELS.length,5);
 assert.equal(LESSONS.length,20);
 assert.equal(new Set(LESSONS.map(l=>l.lessonId+'@'+l.lessonVersion)).size,20);
 const refs=new Set(listQuestionRefs().map(r=>r.questionId+'@'+r.questionVersion));
 assert.equal(validateLessons(LESSONS,refs),true);
 assert.equal(LESSONS.reduce((a,l)=>a+l.questionRefs.length,0),100);
 for(const lesson of LESSONS){
   assert.deepEqual(getLessonPublic(lesson.lessonId),lesson);
   assert.ok(lesson.objectives[0].length>10);
   assert.ok(lesson.contentBlocks.length>=3);
   assert.ok(lesson.evidenceRefs.length>0);
 }
 const cyclic=LESSONS.map(clone);
 cyclic[0].prerequisiteLessonIds=[cyclic[1].lessonId];
 assert.throws(()=>validateLessons(cyclic),/循環/);
});

test('100 actual unique hands: full seed replay, legality and official answers',()=>{
 const result=auditBank({verifyAnswers:true});
 assert.deepEqual(result.failures,[]);
 assert.equal(result.verified,100);
 assert.equal(result.duplicates,0);
 assert.equal(result.uniqueShapes,100);
 assert.deepEqual(result.byTaskType,{discard:40,tenpai:40,multi_wait:20});
 for(const s of BANK_SPEC){
   const q=getFullQuestion(s.questionId);
   assert.equal(validateAcademyQuestion(q),true);
   assert.deepEqual(replayAcademyQuestion(q),q);
   const ex=getCanonicalExercise(s.questionId);
   assert.deepEqual(replayExercise(ex),ex);
   assert.equal(q.source.snapshotRef,ex.id);
   assert.equal(q.generator.seed,s.seed);
   assert.equal(q.prompt.legacyHand.length,q.taskType==='discard'?17:16);
 }
});

test('100 formal scores and post-answer explanations agree with legacy v3 records',()=>{
 for(const s of BANK_SPEC){
   const q=getFullQuestion(s.questionId);
   const ex=getCanonicalExercise(s.questionId);
   const choice=q.taskType==='discard'?q.answerKey.acceptedTileTypes[0]:[...q.answerKey.acceptedTileTypes];
   const opts={durationMs:1250,timestamp:'2026-11-19T01:00:00.000Z',attemptId:'official-'+s.questionId};
   const expected=createDecisionRecord(ex,choice,opts);
   const actual=submitAcademyAnswer(ref(s.questionId),choice,opts);
   assert.deepEqual(actual.record,expected);
   assert.equal(actual.recordRef.kind,'legacy-v3');
   assert.equal(validateDecisionRecord(actual.record),true);
   assert.equal(actual.gradingResult.grade,'perfect');
   assert.equal(actual.gradingResult.score,expected.score);
   assert.deepEqual(actual.gradingResult.errorTypeIds,expected.errorTypes);
   const explanation=actual.gradingResult.explanation;
   assert.equal(explanation.correctnessBasis,'exact');
   assert.ok(explanation.answerSummary.includes(tileLabel(Array.isArray(choice)?choice[0]:choice)));
   assert.ok(explanation.primaryReason.length>20);
   assert.ok(explanation.alternatives.length>0);
   assert.ok(explanation.conditionalStrategy.length>0);
 }
});

test('public QuestionPublic excludes private answerKey, snapshots and hidden wall',()=>{
 for(const r of listQuestionRefs()){
   const p=toPublicQuestion(r);
   assert.equal(p.questionVersion,r.questionVersion);
   const data=JSON.stringify(p);
   for(const secret of ['answerKey','acceptedTileTypes','optimalTiles','answerMetadata',
     'ranking','exerciseSnapshot','wall','replacementWall','futureEvents']){
     assert.ok(!data.includes('"'+secret+'"'),secret+' leaked');
   }
 }
 assert.throws(()=>toPublicQuestion({questionId:'academy-q-001',questionVersion:'2.0.0'}),/未知題目版本/);
});

test('wrong choices, mutated answer and unknown contract versions fail closed',()=>{
 const q=getFullQuestion('academy-q-001');
 const wrong=clone(q);
 wrong.answerKey.acceptedTileTypes=[33];
 assert.throws(()=>validateAcademyQuestion(wrong),/不一致/);
 wrong.contractVersion='master-academy/999';
 assert.throws(()=>validateAcademyQuestion(wrong),/版本/);
 assert.throws(()=>gradeAcademyQuestion(ref(q.questionId),-1),/合法/);
 assert.throws(()=>submitAcademyAnswer(ref(q.questionId),q.answerKey.acceptedTileTypes[0]),/durationMs/);
 const spec=BANK_SPEC.find(s=>s.taskType==='tenpai');
 const x=getFullQuestion(spec.questionId).answerKey.acceptedTileTypes[0];
 assert.throws(()=>gradeAcademyQuestion(ref(spec.questionId),[x,x]),/無重複/);
});

test('scenario cannot use v3 and cannot score without verified Rules/Strategy fixtures',()=>{
 assert.equal(VERIFIED_SCENARIO_SCORER_COUNT,5);
 const ex=createExercise({seed:'scenario-deny',index:0,taskType:'discard',level:'beginner'});
 ex.taskType='scenario';
 assert.throws(()=>createDecisionRecord(ex,0,{durationMs:1,timestamp:'2026-11-19T01:00:00.000Z'}),/未知題型/);
 const q={
   schemaVersion:1,contractVersion:CONTRACT_VERSION,questionId:'scenario-1',questionVersion:'1',
   taskType:'scenario',status:'validated',source:{kind:'player-view-snapshot'},
   generator:{fixtureId:'not-yet-verified'},
   prompt:{playerView:{viewId:'v1',gameId:'g1',asOfEventSeq:0,audienceSeat:0}},
   answerKey:{correctnessBasis:'exact',scorerId:'none',scoringVersion:'none'},
   ruleRef:{profileId:'none',ruleVersion:'none'},skillTagIds:['strategy.risk-awareness']
 };
 assert.throws(()=>createAcademyDecisionRecord(q,'a1',{
   durationMs:1,timestamp:'2026-11-19T01:00:00.000Z'}),/沒有已驗證/);
 assert.throws(()=>validateAcademyDecisionRecord({schemaVersion:1,contractVersion:CONTRACT_VERSION,recordKind:'academy-scenario'}),/欄位無效/);
 assert.throws(()=>validateAcademyDecisionRecord({schemaVersion:1,contractVersion:'master-academy/2.0.0'}),/版本/);
});
test('manifest exactly matches the 100 immutable metadata specifications',()=>{
 const data=JSON.parse(readFileSync(new URL('../../data/academy/manifest-v1.json',import.meta.url),'utf8'));
 assert.equal(data.contractVersion,CONTRACT_VERSION);
 assert.deepEqual(data.questions,BANK_SPEC.map(x=>({...x})));
 assert.equal(new Set(data.questions.map(x=>x.seed)).size,100);
});

test('non-perfect answers use canonical partial-credit rules and explain wrong alternatives',()=>{
 let nonPerfect=0;
 for(const s of BANK_SPEC.slice(0,15)){
   const q=getFullQuestion(s.questionId);
   const ex=getCanonicalExercise(s.questionId);
   const choice=q.taskType==='discard'?ex.answer.ranking.at(-1).tile:[];
   const record=createDecisionRecord(ex,choice,{timestamp:'2026-11-19T01:00:00.000Z',durationMs:10});
   const result=gradeAcademyQuestion(ref(s.questionId),choice);
   assert.equal(result.grade,record.grade);
   assert.equal(result.score,record.score);
   assert.deepEqual(result.errorTypeIds,record.errorTypes);
   if(result.grade!=='perfect')nonPerfect++;
   if(q.taskType!=='discard'){
     assert.ok(result.explanation.alternatives.some(x=>x.reason.includes('仍不能完成')));
   }
 }
 assert.ok(nonPerfect>=10,'Need actually exercise non-perfect canonical grading paths');
});
