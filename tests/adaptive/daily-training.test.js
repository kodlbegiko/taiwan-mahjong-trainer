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
  assert.deepEqual(c.abortSession({asOf:B}),a);
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
