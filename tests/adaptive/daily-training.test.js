import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyTrainingController } from '../../src/adaptive/daily-training.js';
import * as academy from '../../src/academy/index.js';
import { APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';
import { ACADEMY_STORAGE_KEY } from '../../src/adaptive/storage.js';

class MemoryStorage {
  constructor() {this.m=new Map();}
  getItem(k){return this.m.has(k)?this.m.get(k):null;}
  setItem(k,v){this.m.set(k,String(v));}
  removeItem(k){this.m.delete(k);}
}
const A='2026-11-20T01:00:00.000Z';
const B='2026-11-20T11:00:00.000Z';
const ctrl=storage=>createDailyTrainingController(storage,{
  learning:academy,registry:APPROVED_LEGACY_REGISTRY,
  validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord,
});
test('new user gets a real durable DailySession and no duplicate session on Taiwan-local same day',()=>{
  const s=new MemoryStorage();
  const rawV1 = '[{"grade":"perfect","seconds":3.5,"difficulty":"beginner","date":"2026-11-19T00:00:00.000Z"}]';
  s.setItem(LEGACY_SESSION_KEY,rawV1);
  const a=ctrl(s).ensureToday({asOf:A,minutes:10});
  assert.ok(a.questionRefs.length>0);
  assert.equal(a.status,'planned');
  assert.equal(a.extensions['adaptive.daily'].dayKey,'2026-11-20');
  assert.equal(s.getItem(LEGACY_SESSION_KEY),rawV1);
  const b=ctrl(s).ensureToday({asOf:B,minutes:30});
  assert.deepEqual(a,b,'minutes choice must not create another same-day session');
  assert.equal(ctrl(s).readToday({asOf:B}).sessionId,a.sessionId);
  assert.equal(ctrl(s).progress({asOf:B}).completed,0);
  const q=ctrl(s).getQuestion(a.questionRefs[0],{asOf:B});
  assert.equal(q.status,'validated');
  assert.ok(['discard','tenpai','multi_wait'].includes(q.taskType));
  assert.ok(!Object.hasOwn(q,'answerKey'));
});
test('official question submission creates one durable v3 RecordRef and duplicate attempt does not double count',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:10});
  const ref=day.questionRefs[0],q=c.getQuestion(ref,{asOf:A});
  const choice=q.taskType==='discard'?Number(q.prompt.options[0]):[];
  const one=c.submit(ref,choice,{asOf:A,durationMs:1000,attemptId:'phase3-daily-attempt-01'});
  assert.equal(one.status,'saved',JSON.stringify({status:one.status,error:one.errorCode}));
  assert.equal(one.recordRef.kind,'legacy-v3');
  const savedArchive=s.getItem(ARCHIVE_STORAGE_KEY);
  assert.ok(savedArchive);
  const two=ctrl(s).submit(ref,choice,{asOf:B,durationMs:1000,attemptId:'phase3-daily-attempt-02'});
  assert.equal(two.status,'already-answered');
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),savedArchive,'duplicate must not rewrite canonical v3 archive');
  const resumed=ctrl(s).progress({asOf:B});
  assert.equal(resumed.completed,1);
  assert.equal(resumed.session.recordRefs.length,1);
  assert.equal(resumed.total,day.questionRefs.length);
});
test('no verified canonical grader means fail closed and does not persist new session',()=>{
 const s=new MemoryStorage();
 const bad={...academy,gradeAcademyQuestion:()=>({status:'unverified'})};
 const c=createDailyTrainingController(s,{learning:bad,
   registry:APPROVED_LEGACY_REGISTRY,validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord});
 assert.throws(()=>c.ensureToday({asOf:A}),/No formally scored/);
 assert.equal(c.readToday({asOf:B}),null);
});
test('bad session input is rejected without fabricating records',()=>{
 const s=new MemoryStorage(),c=ctrl(s);
 assert.throws(()=>c.ensureToday({asOf:'not-a-date'}));
 assert.throws(()=>c.ensureToday({asOf:A,minutes:7}));
 assert.equal(c.readToday({asOf:A}),null);
});

class QueueLocks {
  constructor() { this.waiting = new Map(); this.calls = 0; }
  request(key, options, callback) {
    assert.equal(options.mode, 'exclusive');
    this.calls++;
    const earlier = this.waiting.get(key) ?? Promise.resolve();
    const next = earlier.then(() => callback());
    this.waiting.set(key, next.catch(() => {}));
    return next;
  }
}
function choose(question) {
  return question.taskType === 'discard' ? Number(question.prompt.options[0]) : [];
}
test('Daily public DTO reports canonical progress, published source, and uncalibrated evidence',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const session=c.ensureToday({asOf:A,minutes:20});
  const before=c.getDailyProgress({asOf:A});
  assert.equal(before.sessionId,session.sessionId);
  assert.equal(before.total,session.questionRefs.length);
  assert.equal(before.completed,0);
  assert.equal(before.remainingQuestions.length,before.total);
  assert.equal(before.nextStep,'answer');
  assert.equal(before.minutes,20);
  assert.ok(before.sources.length>0);
  assert.ok(before.sources.every(source=>source.source==='academy-v1'));
  assert.equal(before.abilityProfile.calibrationStatus,'uncalibrated');
  assert.ok(before.abilityProfile.skills.every(skill=>skill.estimatedProficiency===null));
  const ref=before.nextQuestionRef,question=c.getQuestion(ref,{asOf:A});
  assert.ok(!Object.hasOwn(question,'answerKey'));
  const submitted=c.submitSessionAnswer({questionRef:ref,choice:choose(question),
    asOf:A,durationMs:1000,attemptId:'daily-dto-official'});
  assert.equal(submitted.status,'saved',submitted.message??submitted.errorCode);
  assert.ok(submitted.gradingResult);
  const after=c.resumeSession({asOf:B,sessionId:session.sessionId});
  assert.equal(after.sessionId,session.sessionId);
  assert.equal(after.completed,1);
  assert.equal(after.completedQuestions.length,1);
  assert.equal(after.recordRefs.length,1);
  assert.equal(after.completedQuestions[0].recordRef.id,submitted.recordRef.id);
  assert.equal(after.remainingQuestions.length,after.total-1);
});
test('active DailySession can durably append a second canonical answer without discarding first',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const session=c.ensureToday({asOf:A,minutes:30});
  assert.ok(session.questionRefs.length>=2);
  for(let i=0;i<2;i++){
    const ref=session.questionRefs[i];
    const result=c.submit(ref,choose(c.getQuestion(ref,{asOf:A})),{
      asOf:A,durationMs:1100,attemptId:'daily-multiple-'+i});
    assert.equal(result.status,'saved',result.message??result.errorCode);
  }
  const resumed=ctrl(s).getDailyProgress({asOf:B});
  assert.equal(resumed.completed,2);
  assert.equal(resumed.recordRefs.length,2);
  assert.equal(new Set(resumed.recordRefs.map(ref=>ref.id)).size,2);
});
test('Web Lock adapter serializes two tabs ensuring one daily identity and one scored answer',async()=>{
  const storage=new MemoryStorage(),locks=new QueueLocks();
  const make=()=>createDailyTrainingController(storage,{
    learning:academy,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord,locks});
  const a=make(),b=make();
  const [first,second]=await Promise.all([
    a.ensureTodayLocked({asOf:A,minutes:10}),
    b.ensureTodayLocked({asOf:B,minutes:30}),
  ]);
  assert.deepEqual(first,second);
  assert.equal(JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).trainingSessions.length,1);
  const ref=first.questionRefs[0],choice=choose(a.getQuestion(ref,{asOf:A}));
  const [r1,r2]=await Promise.all([
    a.submitSessionAnswerLocked({questionRef:ref,choice,asOf:A,durationMs:1000,
      attemptId:'daily-race-1'}),
    b.submitSessionAnswerLocked({questionRef:ref,choice,asOf:B,durationMs:1000,
      attemptId:'daily-race-2'}),
  ]);
  assert.deepEqual([r1.status,r2.status],['saved','already-answered']);
  assert.equal(a.getDailyProgress({asOf:B}).completed,1);
  assert.ok(locks.calls>=4);
  const archive=JSON.parse(storage.getItem(ARCHIVE_STORAGE_KEY));
  assert.equal(archive.records.filter(r=>r.schemaVersion===3).length,1);
});
test('locked API fails closed when browser lacks Web Locks rather than promising atomic localStorage',async()=>{
  const c=createDailyTrainingController(new MemoryStorage(),{
    learning:academy,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord,
    locks:{},
  });
  await assert.rejects(c.ensureTodayLocked({asOf:A}),error=>error.code==='LOCK_UNAVAILABLE');
});
test('pending write-ahead intent survives canonical-v3 quota failure and same-attempt retry',()=>{
  const storage=new MemoryStorage(),c=ctrl(storage);
  const session=c.ensureToday({asOf:A,minutes:10});
  const ref=session.questionRefs[0],choice=choose(c.getQuestion(ref,{asOf:A}));
  const prior=storage.getItem(ARCHIVE_STORAGE_KEY);
  const set=storage.setItem.bind(storage);
  storage.setItem=(key,value)=>{
    if(key===ARCHIVE_STORAGE_KEY){
      const e=new Error('QuotaExceededError');e.name='QuotaExceededError';throw e;
    }
    return set(key,value);
  };
  const broken=c.submit(ref,choice,{asOf:A,durationMs:1000,attemptId:'daily-quota-1'});
  assert.equal(broken.status,'recovery-required');
  assert.equal(storage.getItem(ARCHIVE_STORAGE_KEY),prior);
  const pending=JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).pendingProvenance;
  assert.equal(pending.length,1);
  const blocked=c.submit(ref,choice,{asOf:A,durationMs:1000,attemptId:'daily-quota-different'});
  assert.equal(blocked.status,'pending-recovery');
  storage.setItem=set;
  const fixed=c.submit(ref,choice,{asOf:A,durationMs:1000,attemptId:'daily-quota-1'});
  assert.equal(fixed.status,'saved',fixed.message??fixed.errorCode);
  assert.equal(c.getDailyProgress({asOf:A}).completed,1);
  assert.equal(JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).pendingProvenance.length,0);
});
test('completed and aborted Daily sessions reject further scoring and remain durable',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:10});
  assert.throws(()=>c.completeSession({asOf:A}),/Incomplete/);
  const a=c.abortSession({asOf:A,reason:'user-aborted'});
  assert.equal(a.status,'aborted');
  const abortedAgain=c.abortSession({asOf:B});
  assert.equal(abortedAgain.status,'aborted');
  assert.equal(abortedAgain.sessionId,a.sessionId);
  const ref=day.questionRefs[0];
  assert.throws(()=>c.submit(ref,choose(c.getQuestion(ref,{asOf:A})),{
    asOf:A,durationMs:1000,attemptId:'daily-terminal-1'}),/terminal/);
  assert.equal(ctrl(s).getDailyProgress({asOf:B}).status,'aborted');
});
test('new Taiwan day creates a different session at the precise IANA boundary',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const before='2026-11-20T15:59:59.000Z';
  const after='2026-11-20T16:00:00.000Z';
  const first=c.ensureToday({asOf:before,minutes:10});
  const second=c.ensureToday({asOf:after,minutes:20});
  assert.equal(first.extensions['adaptive.daily'].dayKey,'2026-11-20');
  assert.equal(second.extensions['adaptive.daily'].dayKey,'2026-11-21');
  assert.notEqual(first.sessionId,second.sessionId);
  assert.equal(c.getTodaySession({asOf:before}).sessionId,first.sessionId);
  assert.equal(c.getTodaySession({asOf:after}).sessionId,second.sessionId);
});
test('corrupt sidecar remains untouched and UI receives a recoverable error, not fake progress',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  s.setItem(ACADEMY_STORAGE_KEY,'{bad-json');
  const result=c.getDailyProgress({asOf:A});
  assert.equal(result.status,'error');
  assert.equal(result.error.code,'CORRUPT_JSON');
  assert.equal(result.nextStep,'recover');
  assert.throws(()=>c.ensureToday({asOf:A}));
  assert.equal(s.getItem(ACADEMY_STORAGE_KEY),'{bad-json');
});
test('quota during initial DailySession preparation is not reported as persisted',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const set=s.setItem.bind(s);
  s.setItem=(key,value)=>{
    if(key===ACADEMY_STORAGE_KEY)throw new Error('QuotaExceededError');
    return set(key,value);
  };
  assert.throws(()=>c.ensureToday({asOf:A}),error=>error.code==='WRITE_DENIED');
  assert.equal(s.getItem(ACADEMY_STORAGE_KEY),null);
});
test('unverified scenario and unpublished lessons never enter a DailySession',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:60});
  for(const ref of day.questionRefs){
    const q=c.getQuestion(ref,{asOf:A});
    assert.ok(['discard','tenpai','multi_wait'].includes(q.taskType));
    assert.equal(academy.getLessonPublic(q.lessonRef.lessonId).status,'published');
    assert.ok(!Object.hasOwn(q,'answerKey'));
  }
});

test('crash window after canonical v3 append recovers pending provenance and session on resume',()=>{
  const storage=new MemoryStorage(),c=ctrl(storage);
  const session=c.ensureToday({asOf:A,minutes:10});
  const ref=session.questionRefs[0],choice=choose(c.getQuestion(ref,{asOf:A}));
  const set=storage.setItem.bind(storage);
  let simulatedFailure=false;
  storage.setItem=(key,value)=>{
    if(!simulatedFailure && key===ACADEMY_STORAGE_KEY &&
      JSON.parse(value).provenanceLinks.length>0) {
      simulatedFailure=true;
      throw new Error('Injected crash immediately after canonical v3 append');
    }
    return set(key,value);
  };
  const interrupted=c.submit(ref,choice,{asOf:A,durationMs:1000,
    attemptId:'daily-interrupted-after-v3'});
  assert.equal(interrupted.status,'recovery-required');
  assert.ok(simulatedFailure);
  assert.ok(storage.getItem(ARCHIVE_STORAGE_KEY));
  assert.equal(JSON.parse(storage.getItem(ACADEMY_STORAGE_KEY)).pendingProvenance.length,1);
  storage.setItem=set;
  const healed=c.resumeSession({asOf:B,sessionId:session.sessionId});
  assert.equal(healed.status,'active');
  assert.equal(healed.completed,1);
  assert.equal(healed.pendingRecovery,0);
  assert.equal(healed.recordRefs.length,1);
  const duplicate=c.submit(ref,choice,{asOf:B,durationMs:1000,
    attemptId:'daily-after-healing-different'});
  assert.equal(duplicate.status,'already-answered');
});

test('saved status requires persisted v3, linked provenance, Session, ability and review proof across restart',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const legacy='[{"grade":"perfect","seconds":3.5,"difficulty":"beginner","date":"2026-11-19T00:00:00.000Z"}]';
  s.setItem(LEGACY_SESSION_KEY,legacy);
  const day=c.ensureToday({asOf:A,minutes:10});
  const ref=day.questionRefs[0];
  const result=c.submitSessionAnswer({questionRef:ref,
    choice:choose(c.getQuestion(ref,{asOf:A})),
    asOf:A,durationMs:1200,attemptId:'r4-durable-proof-01'});
  assert.equal(result.status,'saved',result.errorCode??result.message);
  assert.equal(result.durabilityProof.status,'verified');
  assert.equal(result.durabilityProof.recordRef.id,result.recordRef.id);
  const rawV3=s.getItem(ARCHIVE_STORAGE_KEY);
  const rawSidecar=s.getItem(ACADEMY_STORAGE_KEY);
  assert.ok(rawV3&&rawSidecar);
  const persisted=JSON.parse(rawSidecar);
  assert.ok(JSON.parse(rawV3).records.some(r=>r.schemaVersion===3&&r.id===result.recordRef.id));
  assert.ok(persisted.provenanceLinks.some(x=>x.recordRef.id===result.recordRef.id));
  assert.ok(persisted.trainingSessions.some(x=>x.sessionId===day.sessionId&&
    x.recordRefs.some(r=>r.id===result.recordRef.id)));
  assert.ok(persisted.abilityProfile.sourceRecordRefs.some(x=>x.id===result.recordRef.id));
  assert.equal(result.durabilityProof.reviewPlanId,persisted.reviewPlan.planId);
  assert.ok(Number.isSafeInteger(result.durabilityProof.sidecarRevision));
  const restored=ctrl(s).resumeSession({asOf:B,sessionId:day.sessionId});
  assert.equal(restored.completed,1);
  assert.equal(restored.completedQuestions[0].recordRef.id,result.recordRef.id);
  const duplicate=ctrl(s).submit(ref,choose(c.getQuestion(ref,{asOf:B})),
    {asOf:B,durationMs:1200,attemptId:'r4-duplicate-after-reload'});
  assert.equal(duplicate.status,'already-answered');
  assert.equal(duplicate.durabilityProof.status,'verified');
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),rawV3,'duplicate must not rewrite archive');
  assert.equal(s.getItem(LEGACY_SESSION_KEY),legacy,'v1 remains byte-identical');
});
test('existing v3 cannot be called saved when derived sidecar evidence vanished',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:10}),ref=day.questionRefs[0];
  const choice=choose(c.getQuestion(ref,{asOf:A}));
  const result=c.submit(ref,choice,{asOf:A,durationMs:1000,attemptId:'r4-missing-ability'});
  assert.equal(result.status,'saved');
  const v3=s.getItem(ARCHIVE_STORAGE_KEY);
  const broken=JSON.parse(s.getItem(ACADEMY_STORAGE_KEY));
  broken.abilityProfile=null;
  broken.reviewPlan=null;
  s.setItem(ACADEMY_STORAGE_KEY,JSON.stringify(broken));
  assert.throws(()=>ctrl(s).submit(ref,choice,{asOf:B,durationMs:1000,
    attemptId:'r4-would-fake-proof'}),error=>error.code==='DURABLE_PROOF_FAILED');
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),v3);
});
test('corrupt finalized provenance is refused without rewriting canonical archive',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:10}),ref=day.questionRefs[0];
  const result=c.submit(ref,choose(c.getQuestion(ref,{asOf:A})),{
    asOf:A,durationMs:1000,attemptId:'r4-corrupt-link'});
  assert.equal(result.status,'saved');
  const originalV3=s.getItem(ARCHIVE_STORAGE_KEY);
  const sidecar=JSON.parse(s.getItem(ACADEMY_STORAGE_KEY));
  sidecar.provenanceLinks[0].recordRef.id='missing-original-canonical-v3';
  const corrupt=JSON.stringify(sidecar);
  s.setItem(ACADEMY_STORAGE_KEY,corrupt);
  const error=ctrl(s).getDailyProgress({asOf:B});
  assert.equal(error.status,'error');
  assert.equal(error.nextStep,'recover');
  assert.ok(error.error?.message);
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),originalV3);
  assert.equal(s.getItem(ACADEMY_STORAGE_KEY),corrupt);
});
test('after official completion, replayed submit is terminal and no old record is rewritten',()=>{
  const s=new MemoryStorage(),c=ctrl(s);
  const day=c.ensureToday({asOf:A,minutes:10});
  for(let i=0;i<day.questionRefs.length;i++){
    const ref=day.questionRefs[i];
    const out=c.submit(ref,choose(c.getQuestion(ref,{asOf:A})),{
      asOf:A,durationMs:1500,attemptId:'r4-complete-'+i});
    assert.equal(out.status,'saved',out.errorCode??out.message);
    assert.equal(out.durabilityProof.status,'verified');
  }
  const state=ctrl(s).getDailyProgress({asOf:B});
  assert.equal(state.status,'completed');
  assert.equal(state.completed,state.total);
  const v3=s.getItem(ARCHIVE_STORAGE_KEY);
  const first=day.questionRefs[0];
  assert.throws(()=>ctrl(s).submit(first,choose(c.getQuestion(first,{asOf:B})),{
    asOf:B,durationMs:1500,attemptId:'r4-should-be-terminal'}),/terminal/);
  assert.equal(s.getItem(ARCHIVE_STORAGE_KEY),v3);
});
test('abortable Web Lock acquisition returns LOCK_TIMEOUT rather than hanging',async()=>{
  const s=new MemoryStorage();
  const blocking={request(_name,options) {
    return new Promise((resolve,reject)=>{
      options.signal.addEventListener('abort',()=>{
        const error=new Error('cancelled');error.name='AbortError';reject(error);
      },{once:true});
    });
  }};
  const c=createDailyTrainingController(s,{
    learning:academy,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord,
    locks:blocking,lockTimeoutMs:20
  });
  await assert.rejects(c.ensureTodayLocked({asOf:A}),e=>e.code==='LOCK_TIMEOUT');
  assert.equal(s.getItem(ACADEMY_STORAGE_KEY),null);
});
test('same instant but different IANA-local days must not share a Daily Session',()=>{
  const s=new MemoryStorage();
  const make=timezone=>createDailyTrainingController(s,{
    learning:academy,registry:APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:academy.validateAcademyDecisionRecord,timezone
  });
  const taiwan=make('Asia/Taipei').ensureToday({asOf:A,minutes:10});
  const pacific=make('America/Los_Angeles').ensureToday({asOf:A,minutes:10});
  assert.equal(taiwan.extensions['adaptive.daily'].dayKey,'2026-11-20');
  assert.equal(pacific.extensions['adaptive.daily'].dayKey,'2026-11-19');
  assert.notEqual(taiwan.sessionId,pacific.sessionId);
  assert.equal(make('Asia/Taipei').getTodaySession({asOf:A}).sessionId,taiwan.sessionId);
  assert.equal(make('America/Los_Angeles').getTodaySession({asOf:A}).sessionId,pacific.sessionId);
});
