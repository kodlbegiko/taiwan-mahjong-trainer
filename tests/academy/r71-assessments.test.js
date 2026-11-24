import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, getSkillTag, VERIFIED_SCENARIO_SCORER_COUNT,
  submitAcademyAnswer, validateAcademyDecisionRecord, createAcademyDecisionRecord } from '../../src/academy/index.js';
import { getCanonicalExercise } from '../../src/academy/question-internal.js';
import { R71_ASSESSMENT_VERSION, R71_QUESTION_REFS, listR71QuestionRefs,
  getR71Question, gradeR71Question, validateR71Question, getR71Coverage, getR71LessonPlan, R71_LESSON_PLAN_VERSION, buildR71ScenarioReviewBundle } from '../../src/academy/r71-assessments.js';
import { auditAcademyContent } from '../../src/academy/content-audit.js';
import { readPlayerView } from '../../src/strategy/view.js';
import { analyzeDiscards } from '../../src/core/efficiency.js';
import { validateScoredRecord } from '../../src/adaptive/records.js';
import { createDailyTrainingController } from '../../src/adaptive/daily-training.js';
import * as academy from '../../src/academy/index.js';
import { APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { ARCHIVE_STORAGE_KEY } from '../../src/storage/archive.js';

const ref=k=>({questionId:'academy-r71-'+k,questionVersion:'1.0.0'});
const clone=x=>JSON.parse(JSON.stringify(x));
function inspect(k) {
  const q=getR71Question(ref(k)), results=q.options.map(o=>gradeR71Question(ref(k),o.id));
  return {q,results,accepted:results.filter(r=>r.score===1)};
}
test('R7.1: 27 new versioned questions, 20 distinct lessons, every public question replay-valid',()=>{
  assert.equal(R71_QUESTION_REFS.length,27);
  assert.equal(new Set(R71_QUESTION_REFS.map(x=>x.questionId)).size,27);
  const rows=getR71Coverage();
  assert.equal(rows.length,20);
  assert.equal(rows.reduce((s,r)=>s+r.supplementalQuestionCount,0),27);
  assert.deepEqual(rows.map(r=>r.lessonRef.lessonId),LESSONS.map(l=>l.lessonId));
  for(const row of rows) {
    assert.ok(row.supplementalQuestionCount>0);
    assert.equal(row.formalCredit,false);
    assert.equal(row.legacyQuestionCount,5);
    assert.equal(row.status,LESSONS.find(l=>l.lessonId===row.lessonRef.lessonId).status);
    assert.ok(row.targetedSkillTagIds.every(id=>getSkillTag(id)));
  }
  for(const r of R71_QUESTION_REFS){
    const q=getR71Question(r);
    assert.equal(q.assessmentVersion,R71_ASSESSMENT_VERSION);
    assert.equal(validateR71Question(clone(q)),true);
    assert.equal(q.officialCredit,false);
    assert.equal(q.publicationStatus,'instructor-review');
    assert.equal(q.playerView.ruleRef.profileId,'tw16-configurable-table');
    assert.equal(q.playerView.capabilities.roundActions,false);
    assert.ok(!Object.hasOwn(q,'acceptedOptionIds'));
    assert.ok(!Object.hasOwn(q,'answerKey'));
    assert.ok(!JSON.stringify(q).includes('"fixtureDeck"'));
    assert.ok(!JSON.stringify(q).includes('"wall"'));
    assert.ok(q.playerView.opponents.every(o=>!Object.hasOwn(o,'concealed')));
    readPlayerView(q.playerView);
    assert.deepEqual(q,getR71Question(r));
    const grades=q.options.map(o=>gradeR71Question(r,o.id));
    assert.ok(grades.some(g=>g.score===1),r.questionId);
    assert.ok(grades.every(g=>g.officialCredit===false&&g.recordRef===null&&
      g.reasonZhTW.length>10&&g.evidence.viewId===q.playerView.viewId));
    assert.throws(()=>gradeR71Question(r,'illegal'),/illegal/);
    const changed=clone(q);changed.playerView.asOfEventSeq++;
    assert.throws(()=>validateR71Question(changed),/mismatch/);
    assert.throws(()=>getR71Question({...r,questionVersion:'9.0.0'}),/version/);
  }
});
test('R7.1: known exact introductory examples match independently checked values',()=>{
  assert.deepEqual(inspect('tile-label').accepted[0].acceptedOptionIds,['4']);
  assert.deepEqual(inspect('meld-class').accepted[0].acceptedOptionIds,['sequence']);
  assert.deepEqual(inspect('hand-shape').accepted[0].acceptedOptionIds,['17']);
  assert.deepEqual(inspect('winning-draw').accepted[0].acceptedOptionIds,['yes']);
  assert.deepEqual(inspect('shanten').accepted[0].acceptedOptionIds,['0']);
});
test('R7.1: actual Rules-issued CHI/PONG/open KONG/concealed KONG, all matching physical alternatives',()=>{
  for(const [k,kind,reason] of [['chi','chi','NEXT_SEAT_CHI'],['pong','pong','OPEN_PONG'],
    ['kong','kong','OPEN_KONG'],['concealed-kong','kong','CONCEALED_KONG']]){
    const {q,results,accepted}=inspect(k);
    assert.ok(accepted.length>0);
    assert.ok(results.some(r=>r.score===0),'must have real alternative');
    const actions=q.playerView.legalActions;
    for(const o of q.options){
      const a=actions.find(a=>a.actionId===o.id);
      assert.ok(a);
      const grade=gradeR71Question(q,o.id);
      assert.equal(grade.score,a.kind===kind?1:0);
      if(grade.score===1)assert.ok(a.legalityBasis.reasonCodes.includes(reason));
    }
  }
});
test('R7.1: independently recompute legal-only shanten/ukeire and all ties after open melds',()=>{
  for(const k of ['discard','structure-change','open-efficiency','tradeoff','near-tie-metric']){
    const {q,accepted}=inspect(k);
    const {hand,visible,fixedMelds}=readPlayerView(q.playerView);
    if(['structure-change','open-efficiency','tradeoff'].includes(k))assert.equal(fixedMelds,1);
    const ranking=analyzeDiscards(hand,{visible,fixedMelds});
    const legal=q.playerView.legalActions.filter(a=>a.kind==='discard');
    const ranked=legal.map(a=>({id:a.actionId,...ranking.find(r=>r.tile===Number(a.tileIds[0].split(':')[1]))}))
      .sort((a,b)=>a.shanten-b.shanten||b.copies-a.copies);
    const best=ranked[0];
    assert.deepEqual(accepted[0].acceptedOptionIds.slice().sort(),
      ranked.filter(x=>x.shanten===best.shanten&&x.copies===best.copies).map(x=>x.id).sort());
    assert.equal(accepted[0].observations.dealInRisk,null);
    assert.equal(accepted[0].observations.expectedTai,null);
  }
});
test('R7.1: public river practice and constrained tradeoff are explicit policies, not safety claims',()=>{
  const pure=inspect('public-river-policy'), conditional=inspect('constrained-tradeoff');
  for(const {q,accepted} of [pure,conditional]){
    assert.ok(accepted.length);
    const obs=accepted[0].observations;
    assert.equal(obs.dealInRisk,null);
    assert.equal(obs.expectedTai,null);
    const prior=new Set(q.playerView.opponents.find(p=>p.seat===0).river.map(d=>Number(d.tileId.split(':')[1])));
    for(const c of obs.candidates)assert.equal(c.previouslyDiscarded,prior.has(c.tile));
    let pool=obs.candidates;
    if(q.questionId.endsWith('constrained-tradeoff'))pool=pool.filter(c=>c.shanten===obs.minimumShanten);
    const matching=pool.filter(c=>c.previouslyDiscarded);
    if(matching.length)pool=matching;
    if(q.questionId.endsWith('constrained-tradeoff')){
      const copies=Math.max(...pool.map(c=>c.copies));pool=pool.filter(c=>c.copies===copies);
    }
    assert.deepEqual(accepted[0].acceptedOptionIds.slice().sort(),pool.map(c=>c.actionId).sort());
  }
});
test('R7.1: independent practice is not a second score store or legacy-v3 record; refresh/version fail closed',()=>{
  const ex=getCanonicalExercise('academy-q-001');
  const opts={timestamp:'2026-11-20T09:00:00.000Z',durationMs:100,attemptId:'r71-v3-baseline'};
  const old=submitAcademyAnswer({questionId:'academy-q-001',questionVersion:'1.0.0'},ex.answer.optimalTiles[0],opts);
  const bytes=JSON.stringify(old);
  const {q,accepted}=inspect('chi');
  const choice=accepted[0].acceptedOptionIds[0];
  const a=gradeR71Question(q,choice);
  assert.deepEqual(a,gradeR71Question(clone(q),choice));
  assert.equal(a.recordRef,null);
  assert.throws(()=>validateScoredRecord({kind:'academy-v1',id:'fake'},{...a,id:'fake'},
    {validateAcademyDecisionRecord}));
  assert.throws(()=>submitAcademyAnswer(ref('chi'),choice,opts),/版本/);
  assert.equal(JSON.stringify(submitAcademyAnswer({questionId:'academy-q-001',questionVersion:'1.0.0'},
    ex.answer.optimalTiles[0],opts)),bytes);
  assert.equal(VERIFIED_SCENARIO_SCORER_COUNT,0,'Do not register pending experimental scorer');
  assert.equal(auditAcademyContent().curriculum.fullyAssessedObjectives,10);
});

/** Noncryptographic deterministic regression fingerprints, NOT authenticated
 * evidence or a substitute for replay. Observed from the actual 19-module
 * isolated execution at d411cf6. Changes require a versioned fixture review. */
test('R7.1: freeze all 27 version-1 public snapshots and all 222 scoring outputs',()=>{
  const pins=[["tile-label","1f95c210"],["meld-class","434c66d5"],["hand-shape","e592c146"],["winning-draw","986708d3"],["shanten","b80c7f38"],["ukeire","cfe1284d"],["discard","964398e4"],["wait-count","90b69b0d"],["structure-change","114896f8"],["open-efficiency","9d8a339a"],["one-turn","2103b194"],["tie","1ad3f686"],["visible","2d1b51b3"],["chi","71908056"],["pong","9cc28d4a"],["kong","8fdd817e"],["concealed-kong","ef1f11f7"],["risk","3a35c93c"],["public-river-policy","24f252a5"],["tai","e516b6c0"],["tradeoff","2d90c254"],["constrained-tradeoff","9f153f28"],["speed","dbe6b610"],["near-tie-metric","8892c3d7"],["evidence","45c0caeb"],["evidence-shanten","ccd116eb"],["synthesis","5fde1277"]];
  assert.deepEqual(R71_QUESTION_REFS.map(r=>r.questionId),pins.map(([id])=>'academy-r71-'+id));
  let choices=0;
  for(const [id,pin] of pins){
    const r=ref(id),question=getR71Question(r);
    const grades=question.options.map(o=>gradeR71Question(r,o.id));
    choices+=grades.length;
    const snapshot=JSON.stringify({question,grades});
    let hash=2166136261;
    for(let i=0;i<snapshot.length;i++)hash=Math.imul(hash^snapshot.charCodeAt(i),16777619)>>>0;
    assert.equal(hash.toString(16).padStart(8,'0'),pin,'Versioned snapshot changed: '+id);
  }
  assert.equal(choices,222);
});

test('R7.1 lesson supplements preserve all prerequisites and do not mark a course complete',()=>{
  for(const lesson of LESSONS){
    const plan=getR71LessonPlan(lesson.lessonId);
    assert.equal(plan.supplementVersion,R71_LESSON_PLAN_VERSION);
    assert.deepEqual(plan.prerequisiteLessonIds,lesson.prerequisiteLessonIds);
    assert.deepEqual(plan.lessonRef,{lessonId:lesson.lessonId,lessonVersion:lesson.lessonVersion});
    assert.equal(plan.status,lesson.status);
    assert.equal(plan.officialCredit,false);
    assert.equal(plan.publicationStatus,'instructor-review');
    assert.ok(plan.teachingZhTW.length>20&&plan.practiceZhTW.length>20);
    assert.deepEqual(plan.questionRefs,listR71QuestionRefs({lessonId:lesson.lessonId}));
    assert.ok(plan.questionRefs.length>0);
  }
  const plan=getR71LessonPlan('academy-l1-01');plan.questionRefs.length=0;
  assert.equal(getR71LessonPlan('academy-l1-01').questionRefs.length,1);
  assert.throws(()=>getR71LessonPlan('unknown'));
});
test('R7.1 preview never enters Daily or creates a duplicate archive record after reload',()=>{
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
  const make=()=>createDailyTrainingController(storage,{learning:academy,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord});
  const at='2026-11-20T01:00:00.000Z',later='2026-11-20T11:00:00.000Z',controller=make();
  const day=controller.ensureToday({asOf:at,minutes:10});
  assert.ok(day.questionRefs.every(r=>!r.questionId.startsWith('academy-r71-')));
  const before=JSON.stringify([...map]);
  const candidate=getR71Question(ref('chi'));
  gradeR71Question(candidate,candidate.options[0].id);
  assert.equal(JSON.stringify([...map]),before);
  assert.throws(()=>controller.getQuestion(ref('chi'),{asOf:at}));
  const r=day.questionRefs[0],q=controller.getQuestion(r,{asOf:at});
  const choice=q.taskType==='discard'?Number(q.prompt.options[0]):[];
  const answer=controller.submit(r,choice,{asOf:at,durationMs:1000,attemptId:'r71-daily-first'});
  assert.equal(answer.status,'saved');
  const bytes=storage.getItem(ARCHIVE_STORAGE_KEY);
  const again=make().submit(r,choice,{asOf:later,durationMs:1000,attemptId:'r71-daily-retry'});
  assert.equal(again.status,'already-answered');
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),bytes);
  assert.equal(make().progress({asOf:later}).completed,1);
});

test('R7.1 review bundle is compatible with action-based scenario proposal but cannot mint records',()=>{
  let count=0;
  for(const r of R71_QUESTION_REFS){
    const q=getR71Question(r);
    if(q.taskType!=='legal-action'){
      assert.throws(()=>buildR71ScenarioReviewBundle(r),/not a LegalAction/);
      continue;
    }
    count++;
    const bundle=buildR71ScenarioReviewBundle(r);
    assert.equal(bundle.question.status,'draft');
    assert.equal(bundle.fixture.verified,false);
    assert.equal(bundle.question.answerKey.correctnessBasis,'unverified');
    assert.equal(bundle.reviewPolicy.officialCredit,false);
    assert.deepEqual(bundle.fixture.legalActionIds,q.options.map(o=>o.id));
    for(const id of bundle.fixture.legalActionIds){
      assert.ok(q.playerView.legalActions.some(a=>a.actionId===id));
      assert.equal(bundle.fixture.results[id].score,gradeR71Question(r,id).score);
    }
    assert.throws(()=>createAcademyDecisionRecord(bundle.question,bundle.fixture.legalActionIds[0],{
      timestamp:'2026-11-20T09:00:00.000Z',durationMs:100,attemptId:'r71-review-do-not-mint'
    }));
    const pretend=clone(bundle.question);
    pretend.status='validated';pretend.answerKey.correctnessBasis='exact';
    assert.throws(()=>createAcademyDecisionRecord(pretend,bundle.fixture.legalActionIds[0],{
      timestamp:'2026-11-20T09:00:00.000Z',durationMs:100,attemptId:'r71-unregistered-do-not-mint'
    }));
  }
  assert.equal(count,11);
});
