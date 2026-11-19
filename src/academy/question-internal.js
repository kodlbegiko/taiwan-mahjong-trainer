/** PRIVATE: never import this module from the public UI. Browser files are inspectable. */
import { createExercise, validateExercise, replayExercise, RULESET_VERSION, SCORING_VERSION } from '../training/exercises.js';
import { BANK_SPEC, getQuestionSpec } from './catalog.js';
import { CONTRACT_VERSION, SCHEMA_VERSION, getSkillTag, assertContract } from './registry.js';
import { sortTiles, toCounts } from '../tiles.js';

const cache=new Map();
const clone=x=>JSON.parse(JSON.stringify(x));
const ref=s=>({questionId:s.questionId,questionVersion:s.questionVersion});
export function makeLegacyExercise(spec) {
  if(!spec || !BANK_SPEC.some(s=>s===spec))throw new RangeError('未知題庫來源');
  return createExercise({seed:spec.seed,index:spec.index,taskType:spec.taskType,level:spec.legacyLevel});
}
export function constructQuestion(spec) {
  const ex=makeLegacyExercise(spec);
  validateExercise(ex);
  const options=(ex.taskType==='discard'
    ?sortTiles([...new Set(ex.hand)])
    :Array.from({length:34},(_,tile)=>tile).filter(tile=>
      ex.hand.filter(t=>t===tile).length+ex.visibleTiles.filter(t=>t===tile).length<4))
    .map(String);
  const skillTagIds=ex.taskType==='discard'
    ?['efficiency.shanten','efficiency.ukeire','efficiency.discard',...(spec.level>=3?['efficiency.near-tie']:[])]
    :ex.taskType==='multi_wait'?['waits.enumeration','waits.multi']:['waits.enumeration'];
  const question={
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    questionId:spec.questionId,questionVersion:spec.questionVersion,
    lessonRef:{lessonId:spec.lessonId,lessonVersion:'1.0.0'},
    skillTagIds,
    ruleRef:{profileId:'legacy-exercise-v3-structural',ruleVersion:RULESET_VERSION},
    taskType:ex.taskType,
    generator:{seed:spec.seed,index:spec.index,generatorVersion:ex.generatorVersion,fixtureId:'academy-structural-bank-v1'},
    source:{kind:'legacy-exercise-v3',snapshotRef:ex.id},
    prompt:{legacyHand:[...ex.hand],visibleTiles:[...ex.visibleTiles],options},
    answerKey:{
      scorerId:'legacy-exercise-v3',
      scoringVersion:SCORING_VERSION,
      acceptedTileTypes:ex.taskType==='discard'?[...ex.answer.optimalTiles]:[...ex.answer.expectedTiles],
      correctnessBasis:'exact'
    },
    status:'validated'
  };
  return question;
}
export function getFullQuestion(questionId) {
  const spec=getQuestionSpec(questionId);
  if(!spec)throw new RangeError('未知題目');
  if(!cache.has(questionId))cache.set(questionId,constructQuestion(spec));
  return clone(cache.get(questionId));
}
export function getCanonicalExercise(questionId) {
  const spec=getQuestionSpec(questionId);
  if(!spec)throw new RangeError('未知題目');
  const q=getFullQuestion(questionId);
  const exercise=makeLegacyExercise(spec);
  if(exercise.id!==q.source.snapshotRef)throw new RangeError('來源快照不符');
  return exercise;
}
export function validateAcademyQuestion(question) {
  assertContract(question);
  if(typeof question.questionId!=='string' || typeof question.questionVersion!=='string')throw new RangeError('題目引用無效');
  const spec=getQuestionSpec(question.questionId);
  if(!spec || question.questionVersion!==spec.questionVersion)throw new RangeError('題目 ID 或版本不存在');
  const expected=getFullQuestion(question.questionId);
  if(JSON.stringify(question)!==JSON.stringify(expected))throw new RangeError('題目與重播的正式 fixture 不一致');
  if(question.skillTagIds.some(id=>!getSkillTag(id)))throw new RangeError('未知能力標籤');
  const ex=makeLegacyExercise(spec);
  replayExercise(ex);
  toCounts([...question.prompt.legacyHand,...question.prompt.visibleTiles]);
  if(question.answerKey.scoringVersion!==ex.answerRules.version ||
     question.status!=='validated')throw new RangeError('題目評分版本不一致');
  return true;
}
export function replayAcademyQuestion(question) {
  validateAcademyQuestion(question);
  return getFullQuestion(question.questionId);
}
export function auditBank({verifyAnswers=true}={}) {
  const idSet=new Set(),shapeSet=new Set(),taskCounts={};
  const failures=[];
  for(const spec of BANK_SPEC) {
    try{
      const question=getFullQuestion(spec.questionId);
      const key=question.questionId+'@'+question.questionVersion;
      if(idSet.has(key))throw new RangeError('重複題目 ID/版本');
      idSet.add(key);
      const signature=question.taskType+'|'+question.prompt.legacyHand.join(',')+'|'+question.prompt.visibleTiles.join(',');
      if(shapeSet.has(signature))throw new RangeError('重複題目牌型與題型');
      shapeSet.add(signature);
      if(verifyAnswers)validateAcademyQuestion(question);
      taskCounts[question.taskType]=(taskCounts[question.taskType]??0)+1;
    }catch(e){failures.push({questionId:spec.questionId,error:String(e.message)});}
  }
  return {
    total:BANK_SPEC.length,verified:verifyAnswers?BANK_SPEC.length-failures.length:0,
    unscorable:0,uniqueShapes:shapeSet.size,duplicates:BANK_SPEC.length-shapeSet.size,
    byTaskType:taskCounts,failures
  };
}
