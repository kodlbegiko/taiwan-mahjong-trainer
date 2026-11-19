import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyTrainingController } from '../../src/adaptive/daily-training.js';
import * as academy from '../../src/academy/index.js';
import { APPROVED_LEGACY_REGISTRY } from '../../src/integration/master-academy-facade.js';
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY } from '../../src/storage/archive.js';

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
