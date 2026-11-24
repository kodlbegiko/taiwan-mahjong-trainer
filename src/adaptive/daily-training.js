/** Phase 3 Daily Session bridge. Canonical scoring stays with Learning and
 * canonical v3 / provenance/session durability stays with Adaptive V1.
 * No shadow UI score database; no speculative scenario questions.
 */
import { createAdaptiveLearningAdapter } from './learning-adapter.js';
import { localDayKey } from './core.js';
import { planDailyTraining, transitionTrainingSession } from './session.js';
import { AcademyStorageError } from './storage.js';
import { validateTrainingSession } from './validate.js';

export const DAILY_TRAINING_VERSION = 'academy-daily/1.0.0';
const clone = x => JSON.parse(JSON.stringify(x));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const id = ref => ref.questionId+'@'+ref.questionVersion;
function utc(value) {
  if(typeof value!=='string' || !/(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
      !Number.isFinite(Date.parse(value))) throw new TypeError('Explicit ISO timestamp required');
  return new Date(value).toISOString();
}
function validateLearningCallbacks(learning) {
  for(const name of ['submitAcademyAnswer','listLessons','listQuestionRefs',
    'toPublicQuestion','getLessonPublic','gradeAcademyQuestion']) {
    if(typeof learning?.[name]!=='function') throw new TypeError('Missing canonical Learning callback: '+name);
  }
}
export function createDailyTrainingController(storage, {
  learning, registry, validateAcademyDecisionRecord,
  profileId='local-academy-profile', timezone='Asia/Taipei', locks, lockTimeoutMs=15000,
}={}) {
  validateLearningCallbacks(learning);
  if(typeof timezone!=='string' || !timezone.trim() ||
    typeof profileId!=='string' || !profileId.trim()) throw new TypeError('Missing profile/timezone');
  // Reject invalid time zones before any write.
  try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date()); }
  catch { throw new RangeError('Unknown IANA timezone'); }
  const adaptive=createAdaptiveLearningAdapter(storage,{learning,registry,
    validateAcademyDecisionRecord,profileId,timezone});
  // Web Locks serializes the entire legacy-v3 -> sidecar -> derived-profile
  // critical section across same-origin tabs. localStorage alone has no CAS.
  const lockManager = locks ?? globalThis.navigator?.locks;
  if(!Number.isSafeInteger(lockTimeoutMs)||lockTimeoutMs<10||lockTimeoutMs>60000)
    throw new RangeError('Invalid Daily Web Lock timeout');
  const lockName = 'tw-mahjong-master-academy:daily:' + profileId;
  async function exclusive(op) {
    if (!lockManager || typeof lockManager.request !== 'function' ||
      typeof AbortController !== 'function') {
      throw new AcademyStorageError('LOCK_UNAVAILABLE',
        'Safe concurrent Daily writes require same-origin abortable Web Locks');
    }
    const abort=new AbortController();
    let entered=false;
    const timer=setTimeout(()=>abort.abort(),lockTimeoutMs);
    try {
      return await lockManager.request(lockName, {mode:'exclusive',signal:abort.signal},
        ()=>{entered=true;return op();});
    } catch(error) {
      if(abort.signal.aborted&&!entered)
        throw new AcademyStorageError('LOCK_TIMEOUT','Daily Web Lock acquisition timed out',error);
      throw error;
    } finally {clearTimeout(timer);}
  }

  function sourceVerified(q) {
    try {
      if(!q || Object.hasOwn(q,'answerKey') || q.status!=='validated' || !['discard','tenpai','multi_wait','scenario'].includes(q.taskType) ||
        !q.generator || !Array.isArray(q.prompt?.options) || !q.prompt.options.length ||
        !Array.isArray(q.skillTagIds) || !q.skillTagIds.length ||
        !q.lessonRef || typeof q.lessonRef.lessonId!=='string') return false;
      const ref={questionId:q.questionId,questionVersion:q.questionVersion};
      const authoritative=learning.toPublicQuestion(ref);
      if(!same(q,authoritative)) return false;
      const lesson=learning.getLessonPublic(q.lessonRef.lessonId);
      if(lesson?.status!=='published')return false;
      if(q.taskType==='scenario'){
        if(typeof learning.listScenarioQuestionRefs!=='function'||typeof learning.validateScenarioQuestion!=='function'||
           !learning.listScenarioQuestionRefs({lessonId:lesson.lessonId}).some(r=>id(r)===id(ref))||
           learning.validateScenarioQuestion(q,{publicOnly:true})!==true)return false;
      }else if(!lesson.questionRefs.some(r=>id(r)===id(ref)))return false;
      const choice=q.taskType==='scenario'?q.prompt.options[0]:q.taskType==='discard'?Number(q.prompt.options[0]):[];
      const grade=learning.gradeAcademyQuestion(ref,choice);
      return grade?.status==='graded' &&
        grade?.scoringVersion!==undefined && grade?.scoringVersion!==null;
    } catch { return false; }
  }

  function publishedCatalog(mode='structural') {
    const lessons=learning.listLessons().filter(l=>l.status==='published');
    // A published lesson is not automatically unlocked. Do not infer
    // completion from quiz scores: use durable canonical provenance only.
    const answered=new Set((adaptive.load().provenanceLinks??[])
      .map(link=>id(link.academyQuestionRef)));
    const completedLessons=new Set(lessons.filter(lesson=>
      lesson.questionRefs.length>0 && lesson.questionRefs.every(ref=>answered.has(id(ref))))
      .map(lesson=>lesson.lessonId));
    const unlocked=lessons.filter(lesson=>
      (lesson.prerequisiteLessonIds??[]).every(dep=>completedLessons.has(dep)));
    const unique=new Map();
    for(const lesson of unlocked)for(const ref of (mode==='scenario'?
      (learning.listScenarioQuestionRefs?.({lessonId:lesson.lessonId})??[]):learning.listQuestionRefs({lessonId:lesson.lessonId}))){
      if(mode==='structural'&&!lesson.questionRefs.some(r=>id(r)===id(ref))) continue;
      const q=learning.toPublicQuestion(ref);
      if(!sourceVerified(q)) continue;
      unique.set(id(ref),{
        questionId:ref.questionId,questionVersion:ref.questionVersion,
        taskType:q.taskType,ruleRef:q.ruleRef,seed:q.generator.seed,
        generatorVersion:q.generator.generatorVersion,source:'academy-v1',
        questionSnapshot:q,available:true,estimatedMinutes:3,
      });
    }
    if(!unique.size) throw new RangeError('No formally scored, published Academy question is available');
    return [...unique.values()].sort((a,b)=>id(a).localeCompare(id(b)));
  }

  function daySessions(at) {
    const day=localDayKey(at,timezone);
    const sessions=adaptive.load().trainingSessions.filter(s=>
      s.profileId===profileId && s.extensions?.['adaptive.daily']?.dayKey===day &&
      s.extensions['adaptive.daily'].timezone===timezone);
    if(sessions.length>1) throw new RangeError('More than one DailySession for the same local day');
    return {day,session:sessions[0]??null};
  }
  function readToday({asOf}={}) {
    const at=utc(asOf),{session}=daySessions(at);
    if(!session) return null;
    validateTrainingSession(session);
    return clone(session);
  }

  function ensureToday({asOf,minutes=30,mode='structural'}={}) {
    const at=utc(asOf);
    if(![10,20,30,60].includes(minutes)) throw new RangeError('Unsupported DailySession length');
    if(!['structural','scenario'].includes(mode))throw new RangeError('Unsupported DailySession mode');
    const {day,session:existing}=daySessions(at);
    if(existing) { validateTrainingSession(existing); return clone(existing); }
    const initial=adaptive.rebuild({asOf:at});
    if(initial.durable!==true) throw new AcademyStorageError('STORAGE_UNAVAILABLE',
      'Cannot create a DailySession without durable storage');
    const state=adaptive.load();
    if(!state.abilityProfile||!state.reviewPlan)throw new RangeError('Canonical ability/review not available');
    const catalog=publishedCatalog(mode);
    const {session}=planDailyTraining({
      profile:state.abilityProfile,reviewPlan:state.reviewPlan,
      records:adaptive.readLegacy().archive.records,
      provenanceLinks:state.provenanceLinks??[],learning,registry,
      validateAcademyDecisionRecord,
      validateAcademyQuestion:sourceVerified,
      questionCatalog:catalog,minutes,asOf:at,
      seed:'daily-'+day+'-'+profileId,
      ruleRef:clone(catalog[0].ruleRef),
    });
    if(!session.questionRefs.length)throw new RangeError('No verified questions selected; session refused');
    session.extensions['adaptive.daily']={
      schemaVersion:1,algorithmVersion:DAILY_TRAINING_VERSION,
      timezone,dayKey:day,source:'canonical-learning-published-only',...(mode==='scenario'?{mode}:{}),
    };
    // The V1 Adaptive sidecar is the sole persisted session authority.
    validateTrainingSession(session);
    if(daySessions(at).session) return readToday({asOf:at});
    const saved=adaptive.saveSession(session);
    if(saved.durable!==true) throw new AcademyStorageError('STORAGE_UNAVAILABLE',
      'DailySession could not be persisted');
    const durable=readToday({asOf:at});
    if(!durable||!same(durable,session))throw new RangeError('DailySession durable readback mismatch');
    return durable;
  }
  function getQuestion(ref,{asOf}={}) {
    const at=utc(asOf),session=readToday({asOf:at});
    if(!session||!session.questionRefs.some(q=>id(q)===id(ref)))
      throw new RangeError('Question not in an existing DailySession');
    const q=learning.toPublicQuestion(ref);
    if(!sourceVerified(q))throw new RangeError('Question version/scorer no longer verified');
    return clone(q);
  }
  function completedRows(state,session){
    const links=(state.provenanceLinks??[]).filter(x=>x.sessionId===session.sessionId)
      .map(p=>({questionRef:clone(p.academyQuestionRef),recordRef:clone(p.recordRef)}));
    for(const ref of session.recordRefs.filter(r=>r.kind==='academy-v1')){
      const record=state.academyRecords.find(r=>r.id===ref.id);
      if(!record)throw new RangeError('Missing scenario session record');
      links.push({questionRef:clone(record.questionRef),recordRef:clone(ref)});
    }
    const keys=new Set(links.map(x=>id(x.questionRef)));
    if(keys.size!==links.length||links.some(x=>!session.questionRefs.some(q=>id(q)===id(x.questionRef))))
      throw new RangeError('Corrupted DailySession provenance');
    return links;
  }
  function progress({asOf}={}) {
    const at=utc(asOf),session=readToday({asOf:at});
    if(!session)return null;
    adaptive.rebuild({asOf:at});
    const persisted=adaptive.getSession(session.sessionId);
    const state=adaptive.load();
    const linked=completedRows(state,persisted);
    const seen=new Set(linked.map(x=>id(x.questionRef)));
    return {session:clone(persisted),completed:seen.size,total:session.questionRefs.length,
      nextQuestionRef:clone(session.questionRefs.find(q=>!seen.has(id(q)))??null)};
  }
  // Independent proof after every reported successful write: no in-memory
  // writer state or optimistic success flag can substitute for archive:v3.
  // Sidecar load also validates persisted Learning provenance against v3.
  function proveDurableAnswer(sessionId,questionRef,recordRef) {
    const fail=reason=>{ throw new AcademyStorageError('DURABLE_PROOF_FAILED',
      'Canonical Daily durability evidence is incomplete: '+reason); };
    if(recordRef?.kind==='academy-v1'){
      const state=adaptive.load(),session=state.trainingSessions.find(s=>s.sessionId===sessionId);
      const record=state.academyRecords.find(r=>r.id===recordRef.id);
      const q=state.academyQuestions.find(x=>id(x)===id(questionRef));
      if(!record||!q||id(record.questionRef)!==id(questionRef)||
        validateAcademyDecisionRecord(record,{question:q})!==true||
        !session||session.extensions?.['adaptive.daily']?.mode!=='scenario'||
        session.recordRefs.filter(r=>r.kind==='academy-v1'&&r.id===recordRef.id).length!==1||
        !session.questionRefs.some(r=>id(r)===id(questionRef)))fail('scenario-record-proof');
      if(!state.abilityProfile?.sourceRecordRefs?.some(r=>r.kind==='academy-v1'&&r.id===recordRef.id)||
        !state.reviewPlan?.items?.some(item=>id(item)===id(questionRef)&&
          item.sourceRecordRefs.some(r=>r.kind==='academy-v1'&&r.id===recordRef.id)))
        fail('scenario-derived-proof');
      return {status:'verified',archive:'academy-v1',recordRef:clone(recordRef),
        sessionId,sidecarRevision:state.revision,abilityEvidence:true,reviewPlanId:state.reviewPlan.planId};
    }
    if(recordRef?.kind!=='legacy-v3' || typeof recordRef.id!=='string')fail('record-ref');
    const {archive,hasCanonicalV3}=adaptive.readLegacy();
    if(!hasCanonicalV3)fail('archive-v3-missing');
    const records=archive.records.filter(r=>r.schemaVersion===3&&r.id===recordRef.id);
    if(records.length!==1)fail('canonical-record-not-unique');
    const state=adaptive.load();
    const links=(state.provenanceLinks??[]).filter(p=>
      p.recordRef.kind===recordRef.kind&&p.recordRef.id===recordRef.id);
    if(links.length!==1||links[0].sessionId!==sessionId ||
      id(links[0].academyQuestionRef)!==id(questionRef))fail('provenance-ref');
    const session=state.trainingSessions.find(s=>s.sessionId===sessionId);
    if(!session||!session.questionRefs.some(q=>id(q)===id(questionRef)) ||
      session.recordRefs.filter(r=>r.kind===recordRef.kind&&r.id===recordRef.id).length!==1)
      fail('session-record-ref');
    if(!state.abilityProfile?.sourceRecordRefs?.some(r=>
      r.kind===recordRef.kind&&r.id===recordRef.id))fail('ability-evidence');
    if(!state.reviewPlan?.planId ||
      state.reviewPlan.profileId!==state.abilityProfile.profileId)fail('review-plan');
    return {status:'verified',archive:'legacy-v3',recordRef:clone(recordRef),
      sessionId,sidecarRevision:state.revision,
      abilityEvidence:true,reviewPlanId:state.reviewPlan.planId};
  }

  function submit(ref,choice,{asOf,durationMs,attemptId}={}) {
    const at=utc(asOf),day=readToday({asOf:at});
    if(!day||!day.questionRefs.some(q=>id(q)===id(ref)))
      throw new RangeError('No active DailySession or unknown question');
    if(!Number.isSafeInteger(durationMs)||durationMs<0 || durationMs>86_400_000)
      throw new RangeError('Invalid answer duration');
    if(typeof attemptId!=='string'||!attemptId.trim())throw new TypeError('Stable attemptId required');
    // Terminal means no submissions, including retries of already-answered
    // questions. Resume/review must use the read-only API instead.
    if(!['planned','active'].includes(day.status))throw new RangeError('DailySession is terminal');
    if(day.extensions?.['adaptive.daily']?.mode==='scenario'){
      try{
        adaptive.rebuild({asOf:at});
        const state=adaptive.load(),session=adaptive.getSession(day.sessionId);
        const prior=completedRows(state,session).find(p=>id(p.questionRef)===id(ref));
        if(prior)return {status:'already-answered',recordRef:clone(prior.recordRef),
          durabilityProof:proveDurableAnswer(day.sessionId,ref,prior.recordRef),session};
      }catch(error){return {status:'recovery-required',errorCode:error.code??'RECOVERY_FAILED',message:error.message,session:day};}
    }
    const existing=(adaptive.load().provenanceLinks??[]).find(p=>
      p.sessionId===day.sessionId&&id(p.academyQuestionRef)===id(ref));
    if(existing)return {status:'already-answered',
      recordRef:clone(existing.recordRef),
      durabilityProof:proveDurableAnswer(day.sessionId,ref,existing.recordRef),
      session:day};
    // If a crash occurred after the prepare write, recover the original v3
    // attempt first. Do not create a competing RecordRef with a new attempt ID.
    const queued=(adaptive.load().pendingProvenance??[]).find(p=>
      p.link.sessionId===day.sessionId&&id(p.link.academyQuestionRef)===id(ref));
    if(queued) {
      try { adaptive.rebuild({asOf:at}); }
      catch(error) { return {status:'recovery-required',
        errorCode:error.code??'RECOVERY_FAILED',message:error.message,session:day}; }
      const recovered=(adaptive.load().provenanceLinks??[]).find(p=>
        p.sessionId===day.sessionId&&id(p.academyQuestionRef)===id(ref));
      if(recovered) return {status:'already-answered',recordRef:clone(recovered.recordRef),
        durabilityProof:proveDurableAnswer(day.sessionId,ref,recovered.recordRef),
        session:readToday({asOf:at})};
      if(queued.link.recordRef.id!==attemptId) return {status:'pending-recovery',
        errorCode:'PENDING_ATTEMPT',recordRef:clone(queued.link.recordRef),session:day};
    }
    getQuestion(ref,{asOf:at}); // verifies official source and current version
    let result;
    try {
      result=adaptive.submitAnswer(ref,choice,{timestamp:at,asOf:at,durationMs,attemptId,sessionId:day.sessionId});
    } catch(error) {
      // The v3 and sidecar writes are two separate stores. On an exception the
      // caller must resume/recover before attempting another answer.
      return {status:'recovery-required',errorCode:error.code??'SUBMIT_FAILED',
        message:error.message,session:readToday({asOf:at})};
    }
    const durable=result.durable===true && result.provenanceDurable===true &&
      result.derivedFresh===true && result.sessionFresh===true;
    if(!durable)return {...result,status:'recovery-required',session:readToday({asOf:at})};
    let durabilityProof;
    try {
      durabilityProof=proveDurableAnswer(day.sessionId,ref,result.recordRef);
    } catch(error) {
      // A corrupt sidecar can make readToday fail as well. Preserve the error
      // result, never throw away evidence or accidentally label it 'saved'.
      let lastKnownSession=day;
      try { lastKnownSession=readToday({asOf:at})??day; } catch {}
      return {...result,status:'recovery-required',
        durabilityProof:null,errorCode:error.code??'DURABLE_PROOF_FAILED',
        message:error.message,session:lastKnownSession};
    }
    return {...result,status:'saved',durabilityProof,
      session:readToday({asOf:at})};
  }
  function getDailyProgress({asOf}={}) {
    let at,day;
    try {
      at=utc(asOf);
      day=localDayKey(at,timezone);
      const current=progress({asOf:at});
      if(!current) return {version:DAILY_TRAINING_VERSION,dayKey:day,timezone,
        status:'not-started',sessionId:null,completed:0,total:0,
        completedQuestions:[],remainingQuestions:[],recordRefs:[],nextQuestionRef:null,
        nextStep:'start',abilityProfile:null,reviewPlan:null,error:null};
      const state=adaptive.load();
      const session=current.session;
      const completed=completedRows(state,session);
      const answered=new Set(completed.map(p=>id(p.questionRef)));
      const remaining=session.questionRefs.filter(q=>!answered.has(id(q)));
      const ability=state.abilityProfile;
      const review=state.reviewPlan;
      const due=(review?.items??[]).filter(item=>
        localDayKey(item.dueAt,timezone)<=day &&
        !item.reasonCodes.some(reason=>reason.startsWith('unavailable:'))).length;
      return {
        version:DAILY_TRAINING_VERSION,sessionId:session.sessionId,
        dayKey:day,timezone,status:session.status,session:clone(session),
        revision:state.revision,minutes:session.extensions?.['adaptive.plan']?.minutes??30,
        sources:clone(session.extensions?.['adaptive.plan']?.orderedSources??[]),
        completed:completed.length,total:session.questionRefs.length,
        completedQuestions:completed,remainingQuestions:clone(remaining),
        recordRefs:clone(session.recordRefs),
        nextQuestionRef:clone(current.nextQuestionRef),
        nextStep:session.status==='completed'?'done':session.status==='aborted'?'aborted':
          remaining.length?'answer':'complete',
        abilityProfile:ability?{
          profileId:ability.profileId,calibrationStatus:ability.calibrationStatus,
          legacyImported:ability.legacyImported,
          sourceRecordRefs:clone(ability.sourceRecordRefs),
          skills:ability.skills.map(skill=>({
            tagId:skill.tagId,attempts:skill.attempts,
            estimatedProficiency:ability.calibrationStatus==='human-calibrated'?
              skill.estimatedProficiency:null,
          })),
        }:null,
        reviewPlan:review?{planId:review.planId,calibrationStatus:review.calibrationStatus,
          total:review.items.length,due,method:review.method}:null,
        pendingRecovery:(state.pendingProvenance??[]).filter(p=>
          p.link.sessionId===session.sessionId).length,
        error:null,
      };
    } catch(error) {
      return {version:DAILY_TRAINING_VERSION,dayKey:day??null,timezone,
        status:'error',error:{code:error.code??'INVALID_STATE',message:error.message},
        sessionId:null,completed:null,total:null,nextStep:'recover'};
    }
  }
  function resumeSession({asOf,sessionId}={}) {
    const session=readToday({asOf});
    if(!session) return getDailyProgress({asOf});
    if(sessionId!==undefined && sessionId!==session.sessionId)
      throw new RangeError('Session ID does not match today');
    return getDailyProgress({asOf});
  }
  function completeSession({asOf}={}) {
    const at=utc(asOf),current=progress({asOf:at});
    if(!current) throw new RangeError('No DailySession to complete');
    if(current.session.status==='completed') return getDailyProgress({asOf:at});
    if(current.session.status!=='active'||current.completed!==current.total)
      throw new RangeError('Incomplete DailySession cannot be completed');
    const next=transitionTrainingSession(current.session,'completed',{at});
    const saved=adaptive.saveSession(next);
    if(saved.durable!==true)throw new AcademyStorageError('STORAGE_UNAVAILABLE','Completion not durable');
    return getDailyProgress({asOf:at});
  }
  function abortSession({asOf,reason='user-aborted'}={}) {
    const at=utc(asOf),current=readToday({asOf:at});
    if(!current) throw new RangeError('No DailySession to abort');
    if(current.status==='aborted') return getDailyProgress({asOf:at});
    if(current.status==='completed') throw new RangeError('Completed DailySession cannot be aborted');
    const next=transitionTrainingSession(current,'aborted',{at,reason});
    const saved=adaptive.saveSession(next);
    if(saved.durable!==true)throw new AcademyStorageError('STORAGE_UNAVAILABLE','Abort not durable');
    return getDailyProgress({asOf:at});
  }
  function submitSessionAnswer({questionRef,choice,asOf,durationMs,attemptId}={}) {
    return submit(questionRef,choice,{asOf,durationMs,attemptId});
  }
  // The *Locked methods are the supported multi-tab UI mutation protocol.
  // Synchronous V1-compatible methods remain available for single-context use,
  // but cannot make cross-tab localStorage sequences atomic.
  return Object.freeze({
    version:DAILY_TRAINING_VERSION,
    readToday,ensureToday,getQuestion,progress,submit,
    getTodaySession:readToday,getDailyProgress,resumeSession,
    submitSessionAnswer,completeSession,abortSession,
    ensureTodayLocked:options=>exclusive(()=>ensureToday(options)),
    resumeSessionLocked:options=>exclusive(()=>resumeSession(options)),
    submitSessionAnswerLocked:options=>exclusive(()=>submitSessionAnswer(options)),
    completeSessionLocked:options=>exclusive(()=>completeSession(options)),
    abortSessionLocked:options=>exclusive(()=>abortSession(options)),
    getDailyProgressLocked:options=>exclusive(()=>getDailyProgress(options)),
  });
}
