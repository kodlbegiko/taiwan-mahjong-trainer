/** Phase 3 Daily Session bridge. Canonical scoring stays with Learning and
 * canonical v3 / provenance/session durability stays with Adaptive V1.
 * No shadow UI score database; no speculative scenario questions.
 */
import { createAdaptiveLearningAdapter } from './learning-adapter.js';
import { localDayKey } from './core.js';
import { planDailyTraining } from './session.js';
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
  profileId='local-academy-profile', timezone='Asia/Taipei',
}={}) {
  validateLearningCallbacks(learning);
  if(typeof timezone!=='string' || !timezone.trim() ||
    typeof profileId!=='string' || !profileId.trim()) throw new TypeError('Missing profile/timezone');
  // Reject invalid time zones before any write.
  try { new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format(new Date()); }
  catch { throw new RangeError('Unknown IANA timezone'); }
  const adaptive=createAdaptiveLearningAdapter(storage,{learning,registry,
    validateAcademyDecisionRecord,profileId,timezone});

  function sourceVerified(q) {
    try {
      if(!q || q.status!=='validated' || !['discard','tenpai','multi_wait'].includes(q.taskType) ||
        !q.generator || !Array.isArray(q.prompt?.options) || !q.prompt.options.length ||
        !Array.isArray(q.skillTagIds) || !q.skillTagIds.length ||
        !q.lessonRef || typeof q.lessonRef.lessonId!=='string') return false;
      const ref={questionId:q.questionId,questionVersion:q.questionVersion};
      const authoritative=learning.toPublicQuestion(ref);
      if(!same(q,authoritative)) return false;
      const lesson=learning.getLessonPublic(q.lessonRef.lessonId);
      if(lesson?.status!=='published' ||
        !lesson.questionRefs.some(r=>id(r)===id(ref))) return false;
      const choice=q.taskType==='discard'?Number(q.prompt.options[0]):[];
      const grade=learning.gradeAcademyQuestion(ref,choice);
      return grade?.status==='graded' &&
        grade?.scoringVersion!==undefined && grade?.scoringVersion!==null;
    } catch { return false; }
  }

  function publishedCatalog() {
    const lessons=learning.listLessons().filter(l=>l.status==='published');
    const unique=new Map();
    for(const lesson of lessons)for(const ref of learning.listQuestionRefs({lessonId:lesson.lessonId})){
      if(!lesson.questionRefs.some(r=>id(r)===id(ref))) continue;
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

  function ensureToday({asOf,minutes=30}={}) {
    const at=utc(asOf);
    if(![10,20,30,60].includes(minutes)) throw new RangeError('Unsupported DailySession length');
    adaptive.rebuild({asOf:at});
    const {day,session:existing}=daySessions(at);
    if(existing) { validateTrainingSession(existing); return clone(existing); }
    const state=adaptive.load();
    if(!state.abilityProfile||!state.reviewPlan)throw new RangeError('Canonical ability/review not available');
    const catalog=publishedCatalog();
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
      timezone,dayKey:day,source:'canonical-learning-published-only',
    };
    // The V1 Adaptive sidecar is the sole persisted session authority.
    validateTrainingSession(session);
    if(daySessions(at).session) return readToday({asOf:at});
    adaptive.saveSession(session);
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
  function progress({asOf}={}) {
    const at=utc(asOf),session=readToday({asOf:at});
    if(!session)return null;
    adaptive.rebuild({asOf:at});
    const persisted=adaptive.getSession(session.sessionId);
    const state=adaptive.load();
    const linked=(state.provenanceLinks??[]).filter(x=>x.sessionId===session.sessionId);
    const seen=new Set(linked.map(x=>id(x.academyQuestionRef)));
    if(seen.size!==linked.length||linked.some(x=>!session.questionRefs.some(q=>id(q)===id(x.academyQuestionRef))))
      throw new RangeError('Corrupted DailySession provenance');
    return {session:clone(persisted),completed:seen.size,total:session.questionRefs.length,
      nextQuestionRef:clone(session.questionRefs.find(q=>!seen.has(id(q)))??null)};
  }
  function submit(ref,choice,{asOf,durationMs,attemptId}={}) {
    const at=utc(asOf),day=readToday({asOf:at});
    if(!day||!day.questionRefs.some(q=>id(q)===id(ref)))
      throw new RangeError('No active DailySession or unknown question');
    if(!['planned','active'].includes(day.status))throw new RangeError('DailySession is terminal');
    if(!Number.isSafeInteger(durationMs)||durationMs<0 || durationMs>86_400_000)
      throw new RangeError('Invalid answer duration');
    if(typeof attemptId!=='string'||!attemptId.trim())throw new TypeError('Stable attemptId required');
    // Refuse all duplicate answers BEFORE invoking the scorer: one source record
    // contributes exactly once to the session and to derived AbilityProfile.
    const existing=(adaptive.load().provenanceLinks??[]).find(p=>
      p.sessionId===day.sessionId&&id(p.academyQuestionRef)===id(ref));
    if(existing)return {status:'already-answered',recordRef:clone(existing.recordRef),session:day};
    getQuestion(ref,{asOf:at}); // verifies official source and current version
    const result=adaptive.submitAnswer(ref,choice,{timestamp:at,asOf:at,durationMs,attemptId,sessionId:day.sessionId});
    const durable=result.durable===true && result.provenanceDurable===true &&
      result.derivedFresh===true && result.sessionFresh===true;
    return {...result,status:durable?'saved':result.durable?'partial':'not-durable',
      session:readToday({asOf:at})};
  }
  return Object.freeze({version:DAILY_TRAINING_VERSION,readToday,ensureToday,getQuestion,progress,submit});
}
