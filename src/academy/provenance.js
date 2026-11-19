/**
 * Learning-owned immutable provenance bridge (NOT a storage adapter).
 *
 * A proven Exercise ID can identify a bank question; assigning an ATTEMPT to a
 * course additionally requires a separately durable, validated provenance
 * snapshot. Never infer course participation from an arbitrary legacy record.
 *
 * The full v3 DecisionRecord always remains in its original archive. AI4 stores
 * these small, JSON-safe links in its own versioned sidecar.
 */
import { getFullQuestion, getCanonicalExercise, validateAcademyQuestion } from './question-internal.js';
import { BANK_SPEC, getQuestionSpec } from './catalog.js';
import { LESSONS } from './lessons.js';
import { getSkillTag, assertContract, CONTRACT_VERSION, SCHEMA_VERSION } from './registry.js';
import { replayExercise } from '../training/exercises.js';
import { validateDecisionRecord } from '../training/records.js';

export const ACADEMY_PROVENANCE_VERSION = 'academy-provenance/1.0.0';

const clone = value => JSON.parse(JSON.stringify(value));
function freezeJson(value) {
  if(value && typeof value === 'object'){
    for(const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}
/** JSON-only, key-order-independent comparison; never trusts object property order. */
function stableJson(value) {
  if(value===null || typeof value==='string' || typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){
    if(!Number.isFinite(value)) throw new TypeError('非有限 JSON 數值');
    return JSON.stringify(value);
  }
  if(Array.isArray(value)){
    if(Object.keys(value).length!==value.length)throw new TypeError('不連續 JSON 陣列');
    return '['+value.map(stableJson).join(',')+']';
  }
  if(!value || typeof value!=='object' || Object.getPrototypeOf(value)!==Object.prototype)
    throw new TypeError('Provenance 僅接受純 JSON');
  const names=Object.keys(value).sort();
  return '{'+names.map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
}

function validRef(ref) {
  if(!ref || typeof ref!=='object' || Array.isArray(ref) ||
     typeof ref.questionId!=='string' || !ref.questionId ||
     typeof ref.questionVersion!=='string' || !ref.questionVersion)
    throw new TypeError('QuestionRef 必須有 questionId/questionVersion');
  const spec=getQuestionSpec(ref.questionId);
  if(!spec || spec.questionVersion!==ref.questionVersion)throw new RangeError('未知 Academy 題目或版本');
  return spec;
}

const mappingCache=new Map();
let reverseCache=null;

/** Stable per-question link to one canonical Exercise v3 (no answerKey). */
export function getAcademyExerciseMapping(questionRef) {
  const spec=validRef(questionRef);
  let mapping=mappingCache.get(spec.questionId);
  if(!mapping){
    const question=getFullQuestion(spec.questionId);
    validateAcademyQuestion(question);
    const exercise=getCanonicalExercise(spec.questionId);
    replayExercise(exercise);

    if(question.questionVersion!==spec.questionVersion ||
       question.source?.kind!=='legacy-exercise-v3' ||
       question.source.snapshotRef!==exercise.id ||
       question.taskType!==exercise.taskType ||
       question.generator.seed!==exercise.seed ||
       question.generator.index!==exercise.index ||
       question.generator.generatorVersion!==exercise.generatorVersion ||
       question.ruleRef.ruleVersion!==exercise.ruleVersion ||
       question.answerKey?.scoringVersion!==exercise.answerRules.version ||
       question.answerKey?.scorerId!=='legacy-exercise-v3' ||
       question.answerKey?.correctnessBasis!=='exact' ||
       question.status!=='validated')throw new RangeError('Academy ↔ Exercise 正式來源不一致');

    const lesson=LESSONS.find(l=>l.lessonId===question.lessonRef?.lessonId &&
      l.lessonVersion===question.lessonRef.lessonVersion);
    if(!lesson || lesson.ruleRef.profileId!==question.ruleRef.profileId ||
       lesson.ruleRef.ruleVersion!==question.ruleRef.ruleVersion ||
       !lesson.questionRefs.some(q=>q.questionId===question.questionId &&
         q.questionVersion===question.questionVersion))
      throw new RangeError('Lesson 未引用此題目或規則不一致');
    if(!Array.isArray(question.skillTagIds)||!question.skillTagIds.length ||
       new Set(question.skillTagIds).size!==question.skillTagIds.length ||
       question.skillTagIds.some(id=>!getSkillTag(id)))
      throw new RangeError('無效 SkillTag 對應');

    mapping=freezeJson({
      schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
      provenanceVersion:ACADEMY_PROVENANCE_VERSION,
      legacyExerciseId:exercise.id,
      questionRef:{questionId:question.questionId,questionVersion:question.questionVersion},
      lessonRef:clone(question.lessonRef),
      skillTagIds:[...question.skillTagIds],
      ruleRef:clone(question.ruleRef),
      generator:{seed:exercise.seed,index:exercise.index,generatorVersion:exercise.generatorVersion},
      scoringVersion:exercise.answerRules.version,
      scorerId:question.answerKey.scorerId,
      source:{kind:'legacy-exercise-v3',snapshotRef:exercise.id}
    });
    mappingCache.set(spec.questionId,mapping);
  }
  // Isolate caller-visible objects from the canonical cache.
  return freezeJson(clone(mapping));
}

/**
 * Reverse lookup is NOT a string-prefix guess: prove each original Exercise ID
 * with its exact seed/index, canonical replay and unique bank mapping.
 * Unknown historical Exercise IDs do not become Academy participation.
 */
export function findAcademyQuestionByExerciseId(legacyExerciseId) {
  if(typeof legacyExerciseId!=='string'||!legacyExerciseId)
    throw new TypeError('legacyExerciseId 無效');
  if(!reverseCache){
    const map=new Map();
    for(const spec of BANK_SPEC){
      const mapping=getAcademyExerciseMapping({
        questionId:spec.questionId,questionVersion:spec.questionVersion
      });
      const other=map.get(mapping.legacyExerciseId);
      if(other && stableJson(other.questionRef)!==stableJson(mapping.questionRef))
        throw new RangeError('同一 Exercise ID 被多道 Academy 題目共用');
      map.set(mapping.legacyExerciseId,mapping);
    }
    reverseCache=map;
  }
  const result=reverseCache.get(legacyExerciseId);
  return result?freezeJson(clone(result)):null;
}

/**
 * Build an immutable link ONLY after the official v3 grader has produced a
 * valid record for the explicitly chosen Academy question/version.
 * This does not persist anything and does not edit the record.
 */
export function createAcademyProvenance(record,questionRef) {
  const mapping=getAcademyExerciseMapping(questionRef);
  if(record?.schemaVersion!==3)throw new RangeError('Provenance 僅接受正式 DecisionRecord v3');
  validateDecisionRecord(record,{verifyAnswers:true});
  if(record.exerciseId!==mapping.legacyExerciseId ||
     record.exerciseSnapshot.id!==mapping.legacyExerciseId ||
     record.scoringVersion!==mapping.scoringVersion ||
     record.exerciseSnapshot.ruleVersion!==mapping.ruleRef.ruleVersion ||
     record.exerciseSnapshot.seed!==mapping.generator.seed ||
     record.exerciseSnapshot.index!==mapping.generator.index ||
     record.exerciseSnapshot.generatorVersion!==mapping.generator.generatorVersion)
    throw new RangeError('Record 與 Academy 題目來源或版本不符');

  const canonical=getCanonicalExercise(mapping.questionRef.questionId);
  replayExercise(canonical);
  if(stableJson(record.exerciseSnapshot)!==stableJson(canonical))
    throw new RangeError('Record 的 Exercise 快照不是 Academy 原題');

  return freezeJson({
    ...mapping,
    recordRef:{kind:'legacy-v3',id:record.id}
  });
}

/**
 * Validate after sidecar reload, against the ORIGINAL v3 record loaded
 * separately from archive:v3. No record => no trustworthy provenance.
 * Equality includes all fields, including the immutable seed and skill tags.
 */
export function validateAcademyProvenance(snapshot,record) {
  assertContract(snapshot);
  if(snapshot.provenanceVersion!==ACADEMY_PROVENANCE_VERSION)
    throw new RangeError('未知 Academy provenance 版本');
  if(!snapshot.recordRef || snapshot.recordRef.kind!=='legacy-v3' ||
     typeof snapshot.recordRef.id!=='string' || !snapshot.recordRef.id)
    throw new RangeError('RecordRef 必須指向 legacy-v3');
  if(!record)throw new RangeError('缺少已持久化的正式 v3 紀錄');
  const expected=createAcademyProvenance(record,snapshot.questionRef);
  if(stableJson(snapshot)!==stableJson(expected))
    throw new RangeError('Provenance 與正式紀錄／題庫不一致');
  return true;
}

/**
 * Sidecar readback helper: deduplicate identical links (idempotent), reject
 * conflicts and missing durable v3 records; order-independent by RecordRef.
 * records MUST come from the canonical archive, never from sidecar copies.
 */
export function validateAcademyProvenanceBatch(snapshots,records) {
  if(!Array.isArray(snapshots)||!Array.isArray(records))
    throw new TypeError('Provenance 與紀錄必須為陣列');
  const byRecord=new Map();
  for(const record of records){
    if(record?.schemaVersion!==3)throw new RangeError('Record 必須為 v3');
    validateDecisionRecord(record,{verifyAnswers:true});
    if(byRecord.has(record.id) &&
       stableJson(byRecord.get(record.id))!==stableJson(record))
      throw new RangeError('v3 archive 內 RecordRef 重複衝突');
    byRecord.set(record.id,record);
  }
  const seen=new Map();
  for(const snapshot of snapshots){
    const ref=snapshot?.recordRef;
    if(ref?.kind!=='legacy-v3'||!ref.id)
      throw new RangeError('Provenance RecordRef 無效');
    const record=byRecord.get(ref.id);
    validateAcademyProvenance(snapshot,record);
    const key=ref.kind+':'+ref.id;
    const serialized=stableJson(snapshot);
    if(seen.has(key)&&seen.get(key).serialized!==serialized)
      throw new RangeError('同一 RecordRef 的來源映射衝突');
    if(!seen.has(key))seen.set(key,{serialized,snapshot});
  }
  return [...seen.entries()].sort(([a],[b])=>a.localeCompare(b))
    .map(([,entry])=>freezeJson(clone(entry.snapshot)));
}

/** Safe readback facade for AI4/AI5: no answerKey or raw record snapshot. */
export function resolveAcademyProvenance(snapshot,record) {
  validateAcademyProvenance(snapshot,record);
  return freezeJson({
    recordRef:clone(snapshot.recordRef),
    legacyExerciseId:snapshot.legacyExerciseId,
    questionRef:clone(snapshot.questionRef),
    lessonRef:clone(snapshot.lessonRef),
    skillTagIds:[...snapshot.skillTagIds],
    ruleRef:clone(snapshot.ruleRef)
  });
}
