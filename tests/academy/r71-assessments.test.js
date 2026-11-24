import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, getSkillTag, VERIFIED_SCENARIO_SCORER_COUNT,
  submitAcademyAnswer, validateAcademyDecisionRecord } from '../../src/academy/index.js';
import { getCanonicalExercise } from '../../src/academy/question-internal.js';
import { R71_ASSESSMENT_VERSION, R71_QUESTION_REFS, listR71QuestionRefs,
  getR71Question, gradeR71Question, validateR71Question, getR71Coverage } from '../../src/academy/r71-assessments.js';
import { auditAcademyContent } from '../../src/academy/content-audit.js';
import { readPlayerView } from '../../src/strategy/view.js';
import { analyzeDiscards } from '../../src/core/efficiency.js';
import { validateScoredRecord } from '../../src/adaptive/records.js';

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
