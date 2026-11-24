/** Independent AcademyDecisionRecord V1 family; never put these in v3 archives. */
import { CONTRACT_VERSION, SCHEMA_VERSION, assertContract, getErrorType, getSkillTag } from './registry.js';
import { verifiedScenarioFixture, validateScenarioQuestion } from './scenario-scorers.js';

const json=x=>JSON.stringify(x);
const clone=x=>JSON.parse(json(x));
function nonempty(v){return typeof v==='string'&&v.length>0;}
function utc(s){return nonempty(s)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s)&&
  Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;}
function assertScenarioSource(q) {
  assertContract(q);
  if(q.taskType!=='scenario'||q.source?.kind!=='player-view-snapshot'||
    q.status!=='validated'||q.answerKey?.correctnessBasis==='unverified')
    throw new RangeError('不具備可正式計分的情境題');
  const view=q.prompt?.playerView;
  if(!view || !nonempty(view.viewId) || !nonempty(view.gameId) ||
     !Number.isSafeInteger(view.asOfEventSeq)||view.asOfEventSeq<0||
     !Number.isInteger(view.audienceSeat)||view.audienceSeat<0||view.audienceSeat>3)
    throw new RangeError('情境題缺正式 PlayerView');
  return view;
}
function fixtureFor(q) {
  const f=verifiedScenarioFixture(q.generator?.fixtureId);
  if(!f || !f.verified || !nonempty(f.engineVersion) || !nonempty(f.scorerId) ||
     !nonempty(f.scoringVersion) || !nonempty(f.answerSnapshotDigest))
    throw new RangeError('沒有已驗證的情境 scorer，禁止建立正式成績');
  return f;
}
function scoreFixture(f,actionId) {
  if(!f.legalActionIds.includes(actionId))throw new RangeError('非合法的情境操作');
  const value=f.results[actionId];
  if(!value || !['perfect','acceptable','improve'].includes(value.grade) ||
     !Number.isFinite(value.score)||value.score<0||value.score>1 ||
     !Array.isArray(value.errorTypeIds))
    throw new RangeError('缺少經驗證的情境評分結果');
  return value;
}
export function createAcademyDecisionRecord(question,chosenActionId,{timestamp,durationMs,attemptId}={}) {
  const view=assertScenarioSource(question);
  const f=fixtureFor(question);
  validateScenarioQuestion(question);
  if(json(question)!==json(f.question))throw new RangeError('Immutable full scenario question required');
  if(!nonempty(chosenActionId) || !utc(timestamp) ||
     !Number.isSafeInteger(durationMs)||durationMs<0 || (attemptId!==undefined&&!nonempty(attemptId)))
    throw new RangeError('情境作答輸入無效');
  if(f.questionId!==question.questionId || f.questionVersion!==question.questionVersion ||
     json(f.ruleRef)!==json(question.ruleRef) ||
     json(f.sourceViewRef)!==json({gameId:view.gameId,viewId:view.viewId,
       asOfEventSeq:view.asOfEventSeq,audienceSeat:view.audienceSeat}) ||
     f.scorerId!==question.answerKey.scorerId ||
     f.scoringVersion!==question.answerKey.scoringVersion)
    throw new RangeError('情境 fixture 與題目不符');
  const scored=scoreFixture(f,chosenActionId);
  const rec={
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    id:attemptId??'academy-attempt-'+question.questionId+'-'+timestamp+'-'+chosenActionId,
    questionRef:{questionId:question.questionId,questionVersion:question.questionVersion},
    ruleRef:clone(question.ruleRef),scorerId:f.scorerId,scoringVersion:f.scoringVersion,
    engineVersion:f.engineVersion,sourceViewRef:clone(f.sourceViewRef),
    chosenActionId,legalActionIds:[...f.legalActionIds],timestamp,durationMs,
    grade:scored.grade,score:scored.score,
    errorTypeIds:[...scored.errorTypeIds],skillTagIds:[...question.skillTagIds],
    scoringEvidence:{basis:f.basis,fixtureId:question.generator.fixtureId,
      answerSnapshotDigest:f.answerSnapshotDigest},recordKind:'academy-scenario'
  };
  validateAcademyDecisionRecord(rec);
  return rec;
}
export function validateAcademyDecisionRecord(record,{question}={}) {
  assertContract(record);
  if(record.recordKind!=='academy-scenario'||!nonempty(record.id) ||
     !nonempty(record.questionRef?.questionId)||!nonempty(record.questionRef?.questionVersion)||
     !nonempty(record.ruleRef?.profileId)||!nonempty(record.ruleRef?.ruleVersion) ||
     !nonempty(record.scorerId)||!nonempty(record.scoringVersion)||!nonempty(record.engineVersion) ||
     !nonempty(record.sourceViewRef?.gameId)||!nonempty(record.sourceViewRef?.viewId)||
     !Number.isSafeInteger(record.sourceViewRef.asOfEventSeq)||
     !Number.isInteger(record.sourceViewRef.audienceSeat)||
     !nonempty(record.chosenActionId)||!Array.isArray(record.legalActionIds) ||
     !utc(record.timestamp)||!Number.isSafeInteger(record.durationMs)||record.durationMs<0 ||
     !['perfect','acceptable','improve'].includes(record.grade)||
     !Number.isFinite(record.score)||record.score<0||record.score>1||
     !Array.isArray(record.errorTypeIds)||record.errorTypeIds.some(id=>!getErrorType(id))||
     !Array.isArray(record.skillTagIds)||record.skillTagIds.some(id=>!getSkillTag(id))||
     !['exact','expert-reviewed'].includes(record.scoringEvidence?.basis) ||
     !nonempty(record.scoringEvidence.fixtureId)||
     !nonempty(record.scoringEvidence.answerSnapshotDigest))
    throw new RangeError('AcademyDecisionRecord 欄位無效');
  const f=verifiedScenarioFixture(record.scoringEvidence.fixtureId);
  if(!f || !f.verified)throw new RangeError('沒有原版 verified scorer，紀錄不可重算及計分');
  const allowed=['schemaVersion','contractVersion','id','questionRef','ruleRef','scorerId','scoringVersion','engineVersion',
    'sourceViewRef','chosenActionId','legalActionIds','timestamp','durationMs','grade','score','errorTypeIds','skillTagIds','scoringEvidence','recordKind'];
  if(Object.keys(record).some(k=>!allowed.includes(k))||Object.keys(record).length!==allowed.length||
     Object.keys(record.questionRef).sort().join(',')!=='questionId,questionVersion'||
     Object.keys(record.scoringEvidence).sort().join(',')!=='answerSnapshotDigest,basis,fixtureId')
    throw new RangeError('Unexpected scenario record fields');
  if(question!==undefined){
    validateScenarioQuestion(question,{publicOnly:true});
    if(json(question)!==json(f.publicQuestion))throw new RangeError('Scenario stored public snapshot mismatch');
  }
  const scored=scoreFixture(f,record.chosenActionId);
  if(f.questionId!==record.questionRef.questionId ||
     f.questionVersion!==record.questionRef.questionVersion ||
     f.scorerId!==record.scorerId || f.scoringVersion!==record.scoringVersion ||
     f.engineVersion!==record.engineVersion ||
     f.answerSnapshotDigest!==record.scoringEvidence.answerSnapshotDigest ||
     f.basis!==record.scoringEvidence.basis ||
     json(f.ruleRef)!==json(record.ruleRef) ||
     json(f.sourceViewRef)!==json(record.sourceViewRef) ||
     json(f.legalActionIds)!==json(record.legalActionIds) ||
     record.grade!==scored.grade || record.score!==scored.score ||
     json(record.errorTypeIds)!==json(scored.errorTypeIds) ||
     json(record.skillTagIds)!==json(f.skillTagIds))
    throw new RangeError('情境作答與原版評分 fixture 不一致');
  return true;
}
export function toRecordRef(record) {
  if(record?.recordKind==='academy-scenario'){
    validateAcademyDecisionRecord(record);
    return {kind:'academy-v1',id:record.id};
  }
  throw new RangeError('此方法只接受情境紀錄；legacy-v3 由正式 v3 validator 建立引用');
}
