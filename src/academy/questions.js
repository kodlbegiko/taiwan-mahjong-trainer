/** UI-safe public façade. Internal answer keys are never returned before grading. */
import { BANK_SPEC, QUESTION_REFS, getQuestionSpec } from './catalog.js';
import { getFullQuestion, getCanonicalExercise, validateAcademyQuestion } from './question-internal.js';
import { createDecisionRecord, validateDecisionRecord } from '../training/records.js';
import { tileLabel } from '../tiles.js';
import { getErrorType, CONTRACT_VERSION, SCHEMA_VERSION } from './registry.js';

const clone=x=>JSON.parse(JSON.stringify(x));
function resolve(ref) {
  if(typeof ref==='string')throw new TypeError('請提供 questionId 與 questionVersion');
  if(!ref || typeof ref.questionId!=='string' || typeof ref.questionVersion!=='string')
    throw new TypeError('QuestionRef 無效');
  const spec=getQuestionSpec(ref.questionId);
  if(!spec || ref.questionVersion!==spec.questionVersion)throw new RangeError('未知題目版本');
  return spec;
}
export function listQuestionRefs({lessonId,taskType}={}) {
  return QUESTION_REFS.filter((ref,i)=>
    (lessonId==null || BANK_SPEC[i].lessonId===lessonId) &&
    (taskType==null || BANK_SPEC[i].taskType===taskType)).map(clone);
}
export function toPublicQuestion(questionRef) {
  const spec=resolve(questionRef);
  const q=getFullQuestion(spec.questionId);
  // Construct exclusively from a strict allowlist; never spread internal objects.
  return {
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    questionId:q.questionId,questionVersion:q.questionVersion,
    lessonRef:clone(q.lessonRef),skillTagIds:[...q.skillTagIds],
    ruleRef:clone(q.ruleRef),taskType:q.taskType,
    generator:clone(q.generator),
    prompt:{
      legacyHand:[...q.prompt.legacyHand],
      visibleTiles:[...q.prompt.visibleTiles],
      options:[...q.prompt.options]
    },
    status:q.status,
    instructionsZhTW:q.taskType==='discard'?'選出最佳捨牌（有平手時全部視為正確）。':
      '選出所有加入後可形成五面子一將眼的牌種。'
  };
}
export function listPublicQuestions({lessonId,taskType}={}) {
  return listQuestionRefs({lessonId,taskType}).map(toPublicQuestion);
}
function normalizeChoice(q,choice) {
  if(q.taskType==='discard'){
    if(!Number.isInteger(choice) || !q.prompt.options.includes(String(choice)))throw new RangeError('不是合法捨牌候選');
    return choice;
  }
  if(!Array.isArray(choice) || new Set(choice).size!==choice.length ||
     choice.some(tile=>!Number.isInteger(tile) || !q.prompt.options.includes(String(tile))))
    throw new RangeError('聽張答案須為無重複的合法牌碼陣列');
  return [...choice].sort((a,b)=>a-b);
}
function explain(q,exercise,record,choice) {
  const name=tileLabel;
  const exact=['五面子一將眼結構','正式 v3 Exercise 評分及 seed 重播'];
  let answerSummary,primaryReason,alternatives;
  if(q.taskType==='discard') {
    const best=exercise.answer.ranking[0];
    const picked=exercise.answer.ranking.find(x=>x.tile===choice);
    answerSummary='最佳捨牌：'+exercise.answer.optimalTiles.map(name).join('、');
    primaryReason='先保留最低向聽 '+best.shanten+'，再最大化有效進張 '+best.copies+
      ' 張。所選 '+name(choice)+' 的向聽 '+picked.shanten+'、有效進張 '+picked.copies+' 張。';
    alternatives=exercise.answer.ranking.filter(x=>x.tile!==best.tile).slice(0,8).map(x=>({
      tile:x.tile,label:name(x.tile),shanten:x.shanten,ukeireCopies:x.copies,
      reason:x.shanten>best.shanten?'向聽高於最優解':
        x.copies<best.copies?'向聽相同，但有效進張較少':'與最佳選項同分'
    }));
    exact.push('捨牌後精確向聽數','扣除本張捨牌的有效進張副本數');
  } else {
    const winning=exercise.answer.winningTiles;
    const expected=exercise.answer.expectedTiles;
    answerSummary='全部可和牌牌種：'+expected.map(name).join('、');
    primaryReason='對 16 張手牌逐一加入可用牌種，使用獨立五面子一將眼和牌判定。'+
      '本題共有 '+expected.length+' 種和牌牌種，'+winning.reduce((s,x)=>s+x.copies,0)+' 張已知剩餘副本。';
    alternatives=[...new Set([...choice,...expected,...q.prompt.options.map(Number).filter(tile=>!expected.includes(tile)).slice(0,5)])].sort((a,b)=>a-b).map(tile=>({
      tile,label:name(tile),copies:winning.find(x=>x.tile===tile)?.copies??0,
      reason:expected.includes(tile)?'可完成合法五面子一將眼':'加入後仍不能完成合法五面子一將眼'
    }));
    exact.push('全部剩餘聽張及已知可用副本數');
  }
  const concepts={
    'higher-shanten':'不能只憑眼前搭子外觀選牌，必須檢查最低向聽。',
    'lower-ukeire':'向聽相同不代表進張枚數相同。',
    'missed-winning-tile':'不能只看最直觀的一組將眼拆法。',
    'false-winning-tile':'兩張搭子成面子，不代表整副牌已達五面子一將眼。'
  };
  return {
    answerSummary,primaryReason,alternatives,
    commonMisconceptions:record.errorTypes.length?
      record.errorTypes.map(id=>concepts[id]??getErrorType(id)?.descriptionZhTW):
      ['要分清結構牌效率與未知對手、牌壁條件。'],
    relatedSkillTagIds:[...q.skillTagIds],
    exactCalculations:exact,
    conditionalStrategy:[
      '本題的正式分數只針對未副露結構牌效，沒有估計放槍率、勝率或台數。',
      '已知可用副本數不是未公開牌壁中的實際抽中機率。',
      '吃碰槓、補花與地方桌規需由後續 Rules Engine 另行驗證。'
    ],
    correctnessBasis:'exact',
    evidence:{sourceKind:'legacy-exercise-v3',exerciseId:exercise.id,
      ruleVersion:exercise.ruleVersion,scoringVersion:exercise.answerRules.version}
  };
}
function grade(ref,choice,{durationMs=0,timestamp='2000-01-01T00:00:00.000Z',attemptId}={}){
  const spec=resolve(ref);
  const q=getFullQuestion(spec.questionId);
  validateAcademyQuestion(q);
  if(q.status!=='validated' || q.answerKey.correctnessBasis!=='exact')throw new RangeError('題目無正式 scorer');
  const chosen=normalizeChoice(q,choice);
  const exercise=getCanonicalExercise(q.questionId);
  const record=createDecisionRecord(exercise,chosen,{durationMs,timestamp,attemptId});
  validateDecisionRecord(record);
  if(record.errorTypes.some(id=>!getErrorType(id)))throw new RangeError('未知正式錯誤類型');
  const gradingResult={
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    questionRef:{questionId:q.questionId,questionVersion:q.questionVersion},
    scoringVersion:record.scoringVersion,scorerId:q.answerKey.scorerId,
    status:'graded',grade:record.grade,score:record.score,
    errorTypeIds:[...record.errorTypes],skillTagIds:[...q.skillTagIds],
    explanation:explain(q,exercise,record,chosen)
  };
  return {gradingResult,record};
}
export function gradeAcademyQuestion(ref,choice) {
  return grade(ref,choice).gradingResult;
}
/** The only official records created here are legacy-v3; scenarios use their own sidecar. */
export function submitAcademyAnswer(ref,choice,{durationMs,timestamp,attemptId}={}) {
  if(durationMs===undefined || timestamp===undefined)
    throw new TypeError('正式作答必須提供 durationMs 與 timestamp');
  const {gradingResult,record}=grade(ref,choice,{durationMs,timestamp,attemptId});
  return {gradingResult,record,recordRef:{kind:'legacy-v3',id:record.id}};
}
