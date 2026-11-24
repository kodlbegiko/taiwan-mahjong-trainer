/** Immutable source-owned exact-objective registry, not a strategy oracle.
 * Only reviewed code-owned v1 snapshots can enter this registry.
 * Fingerprints detect accidental drift, not hostile authentication.
 * Never accept a fixture or a scorer from a learner/UI/storage.
 */
import { SCENARIO_BANK_V1 } from './scenario-bank-v1.js';
import { CONTRACT_VERSION, SCHEMA_VERSION, getSkillTag } from './registry.js';
import { readPlayerView } from '../strategy/view.js';
import { analyzeDiscards, calculateShanten } from '../core/efficiency.js';
import { tileLabel } from '../tiles.js';

export const SCENARIO_SCORING_VERSION='academy-exact-action/1.0.0';
const SCORER_ID='academy-exact-public-action';
const V={schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION};
const clone=x=>JSON.parse(JSON.stringify(x));
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):Array.isArray(x)?
  '['+x.map(canonical).join(',')+']':'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const same=(a,b)=>canonical(a)===canonical(b);
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const digest=x=>{let h=2166136261;const s=canonical(x);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  return 'fnv1a32:'+h.toString(16).padStart(8,'0');};
const type=id=>Number(id.split(':')[1]);
const names=a=>a.tileIds.map(id=>tileLabel(type(id))).join('、');
const label=a=>({discard:'捨出',chi:'吃',pass:'過',win:'和牌'})[a.kind]+' '+names(a);
const ownedBank=freeze(clone(SCENARIO_BANK_V1));
const registry=new Map(),byQuestion=new Map();
function construct(spec){
  const {digest:pin,...source}=spec;
  if(digest(source)!==pin)throw new RangeError('Scenario immutable source fingerprint mismatch');
  const {view,hand,visible,counts,fixedMelds}=readPlayerView(spec.view);
  if(getSkillTag(spec.skill)?.scope!=='exact-structural')throw new RangeError('Unverified scenario skill');
  const actions=view.legalActions.filter(a=>spec.policy==='chi-sequence'?['chi','pass'].includes(a.kind):
    spec.policy==='structural-win'?['win','discard'].includes(a.kind):a.kind==='discard');
  if(!same(actions.map(a=>a.actionId),spec.actionIds))throw new RangeError('Scenario legal action inventory mismatch');
  const results={};let rationale;let best,ranking;
  if(spec.policy==='discard-efficiency'){
    ranking=analyzeDiscards(hand,{visible,fixedMelds});
    const legal=actions.map(a=>ranking.find(r=>r.tile===type(a.tileIds[0])));
    best=legal.slice().sort((a,b)=>a.shanten-b.shanten||b.copies-a.copies)[0];
  }
  for(const a of actions){
    let correct=false,reason;
    switch(spec.policy){
      case 'discard-type':
        correct=type(a.tileIds[0])===spec.arg;
        rationale='依牌種辨識，不比較實戰牌效。相同牌種的所有實體副本都接受。';
        reason='所選 '+names(a)+'；指定 '+tileLabel(spec.arg)+'。';break;
      case 'chi-sequence':
        correct=a.kind==='chi'&&same(a.tileIds.map(type).sort((a,b)=>a-b),spec.arg);
        rationale='只辨認指定同花色連續三張，且必須是此版本 Rules 提供的合法吃牌；不評價是否值得副露。';
        reason=a.kind==='chi'?'此吃牌組合：'+names(a)+'。':'過牌不會建立指定順子。';break;
      case 'structural-win':
        if(calculateShanten(hand,{fixedMelds})!==-1)throw new RangeError('Winning fixture not complete');
        correct=a.kind==='win';
        rationale='此局面可構成五面子一將眼，且 Rules 提供合法和牌動作。只檢查結構，不比較台數、風險或收益。';
        reason=correct?'合法和牌符合指定目標。':'捨牌不是題目要求的完成和牌操作。';break;
      case 'discard-efficiency':{
        const r=ranking.find(r=>r.tile===type(a.tileIds[0]));
        correct=r.shanten===best.shanten&&r.copies===best.copies;
        rationale='先最低向聽 '+best.shanten+'，再最多有效進張 '+best.copies+' 張；固定面子及已知牌已扣除，同分全部滿分。';
        reason=names(a)+'：向聽 '+r.shanten+'；有效進張 '+r.copies+' 張。';break;
      }
      case 'known-count':{
        const n=counts[type(a.tileIds[0])];correct=n===spec.arg;
        rationale='依自己暗牌、公開河牌及副露實體 ID 去重；恰好 '+spec.arg+' 張已知副本即符合。不是未來牌山或安全牌推論。';
        reason=names(a)+' 已知 '+n+' 張；未觀測 '+(4-n)+' 張。';break;
      }
      default:throw new RangeError('Unknown scenario policy');
    }
    results[a.actionId]={grade:correct?'perfect':'improve',score:correct?1:0,errorTypeIds:[],reason};
  }
  const accepted=actions.filter(a=>results[a.actionId].score===1).map(a=>a.actionId);
  if(!accepted.length||accepted.length===actions.length||!same(accepted,spec.acceptedIds))
    throw new RangeError('Scenario independently recomputed answer mismatch');
  const questionId='academy-scenario-'+spec.key,questionVersion='1.0.0',fixtureId=questionId+'@'+questionVersion;
  const sourceViewRef={gameId:view.gameId,viewId:view.viewId,asOfEventSeq:view.asOfEventSeq,audienceSeat:view.audienceSeat};
  const engineVersion=actions[0].legalityBasis.engineVersion;
  if(actions.some(a=>a.legalityBasis.engineVersion!==engineVersion))throw new RangeError('Mixed engine versions');
  const question={...V,questionId,questionVersion,lessonRef:{lessonId:spec.lessonId,lessonVersion:'1.0.0'},
    skillTagIds:[spec.skill],ruleRef:clone(view.ruleRef),taskType:'scenario',status:'validated',
    generator:{fixtureId,seed:view.gameId,index:0,generatorVersion:'academy-scenario-snapshot/1.0.0'},
    source:{kind:'player-view-snapshot',snapshotRef:view.viewId},
    instructionsZhTW:spec.instructions,
    prompt:{playerView:clone(view),legacyHand:[...hand],visibleTiles:[...visible],
      options:[...spec.actionIds],optionLabels:Object.fromEntries(actions.map(a=>[a.actionId,label(a)]))},
    answerKey:{scorerId:SCORER_ID,scoringVersion:SCENARIO_SCORING_VERSION,correctnessBasis:'exact',acceptedActionIds:accepted}};
  const {answerKey,...publicQuestion}=question;
  return freeze({fixtureId,verified:true,basis:'exact',questionId,questionVersion,engineVersion,
    scorerId:SCORER_ID,scoringVersion:SCENARIO_SCORING_VERSION,answerSnapshotDigest:pin,
    ruleRef:clone(view.ruleRef),sourceViewRef,skillTagIds:[spec.skill],legalActionIds:[...spec.actionIds],
    results,accepted,question,publicQuestion,rationale});
}
function get(ref){
  if(!ref||typeof ref.questionId!=='string'||typeof ref.questionVersion!=='string')throw new RangeError('未知情境題版本');
  const spec=byQuestion.get(ref.questionId+'@'+ref.questionVersion);
  if(!spec)throw new RangeError('未知情境題版本');
  const key=ref.questionId+'@'+ref.questionVersion;
  if(!registry.has(key))registry.set(key,construct(spec));
  return registry.get(key);
}
for(const spec of ownedBank){
  const k='academy-scenario-'+spec.key+'@1.0.0';
  if(byQuestion.has(k))throw new RangeError('Duplicate scenario version');
  byQuestion.set(k,spec);
}
export const VERIFIED_SCENARIO_SCORER_COUNT=byQuestion.size;
export function verifiedScenarioFixture(fixtureId){
  const spec=byQuestion.get(fixtureId);
  if(!spec)return null;
  return clone(get({questionId:'academy-scenario-'+spec.key,questionVersion:'1.0.0'}));
}
export function listScenarioQuestionRefs({lessonId}={}){
  return ownedBank.filter(s=>!lessonId||s.lessonId===lessonId).map(s=>({
    questionId:'academy-scenario-'+s.key,questionVersion:'1.0.0'}));
}
export function getScenarioPublicQuestion(ref){return clone(get(ref).publicQuestion);}
export function getScenarioFullQuestion(ref){return clone(get(ref).question);}
export function validateScenarioQuestion(q,{publicOnly=false}={}){
  const f=get(q);
  if(!same(q,f.publicQuestion)&&(publicOnly||!same(q,f.question)))
    throw new RangeError('Scenario question does not match immutable public snapshot');
  return true;
}
export function gradeScenarioQuestion(ref,actionId){
  const f=get(ref);
  if(typeof actionId!=='string'||!f.legalActionIds.includes(actionId))throw new RangeError('非合法的情境操作');
  const r=f.results[actionId];
  return {...V,questionRef:{questionId:f.questionId,questionVersion:f.questionVersion},
    status:'graded',scorerId:f.scorerId,scoringVersion:f.scoringVersion,grade:r.grade,score:r.score,
    skillTagIds:[...f.skillTagIds],errorTypeIds:[...r.errorTypeIds],
    explanation:{correctnessBasis:'exact',primaryReason:f.rationale+' '+r.reason,
      answerSummary:'符合指定目標的合法動作：'+[...new Set(f.accepted.map(id=>f.publicQuestion.prompt.optionLabels[id]))].join('；'),
      acceptedActionIds:[...f.accepted],
      alternatives:f.legalActionIds.map(id=>({actionId:id,label:f.publicQuestion.prompt.optionLabels[id],reason:f.results[id].reason,score:f.results[id].score})),
      commonMisconceptions:['合法動作不等同實戰最佳策略。未估計放槍率或台數。'],
      relatedSkillTagIds:[...f.skillTagIds],
      evidence:{sourceViewRef:clone(f.sourceViewRef),ruleRef:clone(f.ruleRef),engineVersion:f.engineVersion,
        answerSnapshotDigest:f.answerSnapshotDigest,fixtureId:f.fixtureId},
      limitations:['指定版本實驗桌規的公開動作及客觀結構；不是完整台灣規則認證。']}
  };
}
