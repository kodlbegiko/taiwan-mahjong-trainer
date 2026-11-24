import test from 'node:test';
import assert from 'node:assert/strict';
import * as learning from '../../src/academy/index.js';
import { verifiedScenarioFixture,getScenarioFullQuestion } from '../../src/academy/scenario-scorers.js';
import { createMasterAcademyFacade, APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { createDailyTrainingController } from '../../src/adaptive/daily-training.js';
import { createAcademyStore, ACADEMY_STORAGE_KEY } from '../../src/adaptive/storage.js';
import { createAcademyBridge } from '../../src/academy-ui/academy-bridge.js';
import { renderLiveAcademy } from '../../src/academy-ui/academy-live.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';
import { auditAcademyContent } from '../../src/academy/content-audit.js';
import { getR71Question } from '../../src/academy/r71-assessments.js';
import { readFileSync } from 'node:fs';

const at='2026-11-24T01:00:00.000Z',later='2026-11-26T01:00:00.000Z';
const opts=id=>({timestamp:at,asOf:at,durationMs:1000,attemptId:id});
const copy=x=>JSON.parse(JSON.stringify(x));
const ref=k=>({questionId:'academy-scenario-'+k,questionVersion:'1.0.0'});
class MemoryStorage{
  m=new Map(); writes=0; failWrite=0;
  getItem(k){return this.m.get(k)??null;}
  setItem(k,v){if(k===ACADEMY_STORAGE_KEY&&++this.writes===this.failWrite)throw new Error('Injected quota');this.m.set(k,String(v));}
  removeItem(k){this.m.delete(k);}
}
const controller=s=>createDailyTrainingController(s,{learning,registry:APPROVED_LEGACY_REGISTRY,
  validateAcademyDecisionRecord:learning.validateAcademyDecisionRecord});
const fixture=r=>verifiedScenarioFixture(r.questionId+'@'+r.questionVersion);
const correct=r=>fixture(r).accepted[0];
const wrong=r=>fixture(r).legalActionIds.find(id=>!fixture(r).accepted.includes(id));
test('R7.3 five registered immutable exact scenarios: independently verify every accepted and rejected option',()=>{
  const refs=learning.listScenarioQuestionRefs();
  assert.equal(refs.length,5);
  assert.equal(learning.listQuestionRefs().length,100);
  let count=0,correctCount=0;
  for(const r of refs){
    const q=learning.toPublicQuestion(r),f=fixture(r);
    assert.equal(q.taskType,'scenario');
    assert.equal(q.status,'validated');
    assert.equal(learning.validateScenarioQuestion(q,{publicOnly:true}),true);
    assert.ok(!Object.hasOwn(q,'answerKey'));
    assert.ok(!JSON.stringify(q).includes('"fixtureDeck"'));
    assert.ok(!JSON.stringify(q).includes('"wall"'));
    assert.ok(q.prompt.playerView.opponents.every(o=>!Object.hasOwn(o,'concealed')));
    assert.ok(f.answerSnapshotDigest.startsWith('fnv1a32:'));
    for(const choice of q.prompt.options){
      assert.ok(q.prompt.playerView.legalActions.some(a=>a.actionId===choice));
      const result=learning.submitAcademyAnswer(r,choice,opts('r73-choice-'+count));
      assert.equal(result.recordRef.kind,'academy-v1');
      assert.equal(result.record.recordKind,'academy-scenario');
      assert.equal(result.record.score,f.accepted.includes(choice)?1:0);
      assert.equal(learning.validateAcademyDecisionRecord(result.record,{question:q}),true);
      assert.ok(result.gradingResult.explanation.primaryReason.length>10);
      assert.equal(result.gradingResult.explanation.evidence.answerSnapshotDigest,f.answerSnapshotDigest);
      const forged=copy(result.record);forged.score=1-forged.score;
      assert.throws(()=>learning.validateAcademyDecisionRecord(forged,{question:q}));
      correctCount+=result.record.score;count++;
    }
    assert.throws(()=>learning.submitAcademyAnswer(r,'invented-action',opts('forged')));
    assert.throws(()=>learning.toPublicQuestion({...r,questionVersion:'9.0.0'}));
    const mutated=copy(q);mutated.prompt.playerView.self.concealed[0].tileType=99;
    assert.throws(()=>learning.validateScenarioQuestion(mutated,{publicOnly:true}));
    const full=getScenarioFullQuestion(r);full.answerKey.acceptedActionIds=[];
    assert.throws(()=>learning.createAcademyDecisionRecord(full,correct(r),opts('forged-q')));
  }
  assert.equal(count,87);assert.equal(correctCount,21);
  assert.equal(learning.listLessons().filter(l=>l.status==='published').length,12);
  const preview=getR71Question({questionId:'academy-r71-chi',questionVersion:'1.0.0'});
  assert.throws(()=>learning.submitAcademyAnswer(preview,preview.options[0].id,opts('preview')));
});
test('R7.3 formal ability evidence and review survive reload; v3 and v1 bytes remain unchanged',()=>{
  const s=new MemoryStorage(),f=createMasterAcademyFacade(s),r=ref('tile-identity');
  const oldRef=learning.listQuestionRefs()[0],q=learning.toPublicQuestion(oldRef);
  const legacy=f.submitStructuralAnswer(oldRef,Number(q.prompt.options[0]),opts('r73-original-v3'));
  assert.equal(legacy.recordRef.kind,'legacy-v3');assert.equal(legacy.durable,true);
  const v3=s.getItem(ARCHIVE_STORAGE_KEY),v1=s.getItem(LEGACY_SESSION_KEY);
  const choice=wrong(r),result=f.submitScenarioAnswer(r,choice,opts('r73-scenario-wrong'));
  assert.equal(result.durable,true);assert.equal(result.derivedFresh,true);
  assert.equal(result.recordRef.kind,'academy-v1');assert.equal(result.gradingResult.score,0);
  const again=createMasterAcademyFacade(s);
  const repeated=again.submitScenarioAnswer(r,choice,opts('r73-scenario-wrong'));
  assert.equal(repeated.durable,true);
  assert.throws(()=>again.submitScenarioAnswer(r,correct(r),opts('r73-scenario-wrong')),/Conflicting/);
  const state=JSON.parse(s.getItem(ACADEMY_STORAGE_KEY));
  assert.equal(state.academyRecords.length,1);assert.equal(state.academyQuestions.length,1);
  assert.equal(state.provenanceLinks.length,1);assert.equal(state.pendingProvenance.length,0);
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),v3);assert.equal(s.getItem(LEGACY_SESSION_KEY),v1);
  const dash=again.getDashboard({asOf:later});
  const skill=dash.profile.skills.find(x=>x.tagId==='tiles.identity');
  assert.equal(skill.attempts,1);assert.equal(skill.evidenceRefs[0].kind,'academy-v1');
  const item=dash.reviewPlan.items.find(x=>x.questionId===r.questionId);
  assert.ok(item.reasonCodes.includes('recent-mistake'));
  assert.ok(!item.reasonCodes.some(x=>x.startsWith('unavailable:')));
  assert.equal(again.resolveReviewQuestion(item).available,true);
  const proof=again.getRecordProvenance(result.recordRef);
  assert.equal(proof.abilityEvidence,true);assert.equal(proof.reviewEvidence,true);
  assert.equal(proof.questionRef.questionVersion,'1.0.0');
  assert.throws(()=>again.submitScenarioAnswer(ref('meld-sequence'),correct(ref('meld-sequence')),opts('locked')),/prerequisites/);
});
test('R7.3 Daily scenario mode uses published unlocked questions, one canonical sidecar/session, and same-day resume',()=>{
  const s=new MemoryStorage(),c=controller(s),r=ref('tile-identity');
  const day=c.ensureToday({asOf:at,minutes:10,mode:'scenario'});
  assert.equal(day.extensions['adaptive.daily'].mode,'scenario');
  assert.deepEqual(day.questionRefs,[r]);
  assert.equal(c.getQuestion(r,{asOf:at}).taskType,'scenario');
  const answer=c.submit(r,correct(r),{asOf:at,durationMs:500,attemptId:'r73-daily'});
  assert.equal(answer.status,'saved',answer.message??answer.errorCode);
  assert.equal(answer.recordRef.kind,'academy-v1');assert.equal(answer.durabilityProof.archive,'academy-v1');
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),null);
  const reload=controller(s),progress=reload.getDailyProgress({asOf:at});
  assert.equal(progress.completed,1);assert.equal(progress.status,'completed');
  assert.equal(progress.recordRefs.length,1);assert.equal(progress.completedQuestions[0].recordRef.kind,'academy-v1');
  assert.throws(()=>reload.submit(r,correct(r),{asOf:at,durationMs:500,attemptId:'r73-other'}),/terminal/);
  assert.deepEqual(reload.ensureToday({asOf:at,mode:'structural'}),progress.session);
  const next=reload.ensureToday({asOf:later,minutes:10,mode:'scenario'});
  assert.notEqual(next.sessionId,day.sessionId);
  assert.ok(next.questionRefs.every(x=>x.questionId.startsWith('academy-scenario-')));
  assert.equal(JSON.parse(s.getItem(ACADEMY_STORAGE_KEY)).academyRecords.length,1);
});
test('R7.3 scenario session atomic raw write and derived interruption recover without double credit',()=>{
  const s=new MemoryStorage(),c=controller(s),r=ref('tile-identity');
  c.ensureToday({asOf:at,minutes:10,mode:'scenario'});
  // scenario submit first performs a rebuild, then a raw atomic write, then derive.
  s.failWrite=s.writes+3;
  const result=c.submit(r,wrong(r),{asOf:at,durationMs:500,attemptId:'r73-crash'});
  assert.equal(result.status,'recovery-required',JSON.stringify({status:result.status,error:result.errorCode}));
  const persisted=JSON.parse(s.getItem(ACADEMY_STORAGE_KEY));
  assert.equal(persisted.academyRecords.length,1);
  assert.equal(persisted.trainingSessions[0].recordRefs.length,1);
  s.failWrite=0;
  const recovered=controller(s).getDailyProgress({asOf:at});
  assert.equal(recovered.completed,1);assert.equal(recovered.status,'completed');
  assert.equal(recovered.abilityProfile.sourceRecordRefs.filter(r=>r.kind==='academy-v1').length,1);
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),null);
});
test('R7.3 forged sidecar snapshots and record evidence fail closed, preserving corrupt bytes',()=>{
  const s=new MemoryStorage(),f=createMasterAcademyFacade(s),r=ref('tile-identity');
  f.submitScenarioAnswer(r,correct(r),opts('r73-corruption'));
  const good=s.getItem(ACADEMY_STORAGE_KEY);
  for(const mutate of [state=>{state.academyRecords[0].score=0;},
    state=>{state.academyRecords[0].scoringEvidence.answerSnapshotDigest='forged';},
    state=>{state.academyQuestions[0].prompt.options.push('forged');},
    state=>{state.academyRecords[0].questionRef.questionVersion='2.0.0';}]){
    const value=JSON.parse(good);mutate(value);const bytes=JSON.stringify(value);s.setItem(ACADEMY_STORAGE_KEY,bytes);
    assert.throws(()=>createMasterAcademyFacade(s).getDashboard({asOf:at}));
    assert.equal(s.getItem(ACADEMY_STORAGE_KEY),bytes);
  }
});
test('R7.3 Academy UI starts actual scenario, selects legal action, saves and restores review',()=>{
  const s=new MemoryStorage(),facade=createMasterAcademyFacade(s);
  const bridge=createAcademyBridge(facade,s,{now:()=>at});
  assert.ok(renderLiveAcademy('lessons',{status:'ready',bridge}).includes('data-live-action="begin-scenario"'));
  const q=bridge.startScenario('academy-l1-01');
  assert.equal(q.taskType,'scenario');
  assert.ok(renderLiveAcademy('lessons',{status:'ready',bridge}).includes('data-live-action="choose-scenario"'));
  bridge.select(wrong(ref('tile-identity')));const result=bridge.submit();
  assert.equal(result.recordRef.kind,'academy-v1');
  assert.equal(bridge.phase,'saved');
  const html=renderLiveAcademy('lessons',{status:'ready',bridge});
  assert.ok(html.includes('Academy V1 情境紀錄'));
  const fresh=createAcademyBridge(createMasterAcademyFacade(s),s,{now:()=>later});
  assert.equal(fresh.progress(fresh.lessons[0]).completed,0,'new scenario is separate, not extra v3 lesson credit');
  const review=fresh.getDueItems().find(x=>x.questionId===q.questionId);
  assert.equal(fresh.reviewLink(review).scenario,true);
  assert.ok(renderLiveAcademy('today',{status:'ready',bridge:fresh}).includes('data-live-action="review-scenario"'));
});
test('R7.3 registry extends exact objective-tag coverage without status inflation and QA-only runtime imports',()=>{
  const report=auditAcademyContent();
  const old=new Set(report.lessonRows.filter(row=>row.unassessedObjectiveTagIds.length===0).map(row=>row.lessonRef.lessonId));
  assert.equal(old.size,10);
  for(const r of learning.listScenarioQuestionRefs()){
    const q=learning.toPublicQuestion(r),lesson=learning.getLessonPublic(q.lessonRef.lessonId);
    if(lesson.skillTagIds.every(tag=>q.skillTagIds.includes(tag)))old.add(lesson.lessonId);
  }
  assert.equal(old.size,15);
  assert.equal(learning.listLessons().filter(l=>l.status==='published'&&old.has(l.lessonId)).length,12);
  const sw=readFileSync(new URL('../../sw.js',import.meta.url),'utf8');
  assert.ok(sw.includes("'./src/academy/scenario-bank-v1.js'"));
  for(const name of ['content-audit.js','unpublished-guides.js','r71-assessments.js']){
    assert.ok(!sw.includes("'./src/academy/"+name+"'"));
    for(const module of ['index.js','questions.js','records.js','scenario-scorers.js']){
      const code=readFileSync(new URL('../../src/academy/'+module,import.meta.url),'utf8');
      assert.ok(!code.includes("'./"+name+"'"));
    }
  }
});
