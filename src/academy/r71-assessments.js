/**
 * R7.1 independent, versioned assessment bank.
 * Scope: exact facts and explicitly constrained goals in the existing
 * experimental table profile. No official credit, risk estimate, or tai model.
 * This module is intentionally not imported by the shipped Academy entrypoint.
 */
import { createGame, createDeck, getRuleProfile, applyAction, listLegalActions,
  createPlayerView, replayGame, validateGameState, COMPLETE_ENGINE_VERSION } from '../rules/index.js';
import { readPlayerView } from '../strategy/view.js';
import { calculateShanten, analyzeDraws, analyzeDiscards } from '../core/efficiency.js';
import { tileLabel } from '../tiles.js';
import { LESSONS } from './lessons.js';
import { SCHEMA_VERSION, CONTRACT_VERSION } from './registry.js';

export const R71_ASSESSMENT_VERSION='academy-r71-assessment/1.0.0';
export const R71_SCORER_ID='academy-r71-exact-and-conditional';
export const R71_QUESTION_VERSION='1.0.0';
const REF=Object.freeze({profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'});
const clone=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const V={schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION};
const profile=getRuleProfile(REF.profileId,REF.ruleVersion);
const physical=(type,count)=>Array.from({length:count},(_,i)=>'t:'+type+':'+i);
const triplets=[0,1,2,3,4].flatMap(t=>physical(t,3));
function arranged(seats) {
  const all=createDeck(profile), hands=Array.from({length:4},(_,i)=>[...(seats[i]??[])]);
  const specified=hands.flat(), used=new Set(specified);
  if(used.size!==specified.length||specified.some(id=>!all.includes(id)))
    throw new RangeError('Invalid fixture physical ownership');
  for(let seat=0;seat<4;seat++){
    const quota=seat===0?17:16;
    if(hands[seat].length>quota)throw new RangeError('Fixture quota exceeded');
    for(const id of all){
      if(hands[seat].length===quota)break;
      if(id.startsWith('t:')&&!used.has(id)){hands[seat].push(id);used.add(id);}
    }
    if(hands[seat].length!==quota)throw new RangeError('Incomplete fixture hand');
  }
  const extra=hands[0].pop();
  const deck=[...hands.flat(),extra,...all.filter(id=>!used.has(id))];
  if(deck.length!==all.length||new Set(deck).size!==all.length)
    throw new RangeError('Invalid fixture deck');
  return deck;
}
function start(id,seats){
  return createGame({gameId:'r71-academy-'+id,seed:'r71-fixture-'+id,
    dealerSeat:0,fixtureDeck:arranged(seats),...REF});
}
function find(s,seat,kind,tileId){
  const action=listLegalActions(s,seat).find(a=>a.kind===kind&&
    (tileId===undefined||a.tileIds.includes(tileId)));
  if(!action)throw new RangeError('Missing Rules-issued '+kind);
  return action;
}
function act(s,seat,kind,tileId){
  const a=find(s,seat,kind,tileId);
  return applyAction(s,{actorSeat:seat,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
}
function resolved(s,seat,kind){
  for(const responder of [1,2,3])s=act(s,responder,responder===seat?kind:'pass');
  return s;
}
const views=new Map();
function scenario(name){
  if(views.has(name))return clone(views.get(name));
  let s,seat;
  switch(name){
    case 'winning':
      s=start(name,{0:[...triplets,...physical(5,2)]});seat=0;break;
    case 'chi':
    case 'chi-open':
    case 'pong':
    case 'pong-open':
    case 'kong':
      s=start(name,{0:['t:4:3'],1:['t:3:0','t:5:0'],2:['t:4:0','t:4:1',
        ...(name==='kong'?['t:4:2']:[])]});
      s=act(s,0,'discard','t:4:3');
      seat=name.startsWith('chi')?1:2;
      if(name.endsWith('-open'))s=resolved(s,seat,name.startsWith('chi')?'chi':'pong');
      break;
    case 'river-discard':
      s=start(name,{0:['t:4:3'],1:['t:4:0'],2:['t:4:1','t:4:2']});
      s=act(s,0,'discard','t:4:3');s=resolved(s,-1,'pass');
      s=act(s,1,'draw');seat=1;break;
    case 'concealed-kong':
      s=start(name,{0:physical(6,4)});seat=0;break;
    default:throw new RangeError('Unknown scenario');
  }
  if(validateGameState(s)!==true||!same(replayGame(s),s))throw new RangeError('Scenario replay mismatch');
  const view=createPlayerView(s,seat);
  readPlayerView(view); // strict detached projection, no wall/other hidden hand
  if(!same(createPlayerView(replayGame(s),seat),view))
    throw new RangeError('Scenario view replay mismatch');
  if(!same(view.legalActions,listLegalActions(s,seat)))throw new RangeError('Action projection mismatch');
  views.set(name,clone(view));
  return clone(view);
}
const parsed=name=>readPlayerView(scenario(name));
const numberOptions=(target,alternatives)=>{
  const nums=[...new Set([target,...alternatives])].sort((a,b)=>a-b);
  if(nums.length<2)throw new RangeError('Insufficient numeric alternatives');
  return nums.map(n=>({id:String(n),labelZhTW:String(n)}));
};
const option=(id,labelZhTW)=>({id,labelZhTW});
function textTask(f,view,options,accepted,reason,observations={}){
  return {f,view,options,accepted,reason,observations,kind:'knowledge-choice'};
}
function numeric(f,v,target,alternatives,reason,observations={}){
  return textTask(f,v,numberOptions(target,alternatives),[String(target)],reason,observations);
}
function actionTask(f,view,targetKind,reason){
  const options=view.legalActions.map(a=>option(a.actionId,
    a.kind+' '+a.tileIds.map(id=>tileLabel(Number(id.split(':')[1]))+' ('+id+')').join(' ')));
  const accepted=view.legalActions.filter(a=>a.kind===targetKind).map(a=>a.actionId);
  if(!accepted.length||accepted.length===options.length)throw new RangeError('No meaningful legal alternatives');
  return {f,view,options,accepted,reason,observations:{requiredActionKind:targetKind},
    kind:'legal-action'};
}
function efficiency(f,name,reason){
  const {view,hand,visible,fixedMelds}=parsed(name);
  const ranked=analyzeDiscards(hand,{visible,fixedMelds});
  const actions=view.legalActions.filter(a=>a.kind==='discard');
  const byTile=new Map(ranked.map(x=>[x.tile,x]));
  const available=actions.map(a=>({a,metric:byTile.get(Number(a.tileIds[0].split(':')[1]))}));
  available.sort((a,b)=>a.metric.shanten-b.metric.shanten||b.metric.copies-a.metric.copies);
  if(!available.length)throw new RangeError('No legal discard candidates');
  const best=available[0].metric;
  const accepted=available.filter(x=>x.metric.shanten===best.shanten&&x.metric.copies===best.copies).map(x=>x.a.actionId);
  return {f,view,kind:'legal-action',options:actions.map(a=>option(a.actionId,tileLabel(Number(a.tileIds[0].split(':')[1]))+' ('+a.tileIds[0]+')')),
    accepted,reason,observations:{minimumShanten:best.shanten,maximumCopiesAtMinimum:best.copies,
      candidates:available.map(({a,metric})=>({actionId:a.actionId,shanten:metric.shanten,copies:metric.copies})),
      dealInRisk:null,expectedTai:null}};
}
function riverPolicy(f,tradeoff){
  const {view,hand,visible,fixedMelds}=parsed('river-discard');
  const observed=new Set(view.opponents.find(p=>p.seat===0).river.map(d=>Number(d.tileId.split(':')[1])));
  const ranking=analyzeDiscards(hand,{visible,fixedMelds});
  const bestShanten=Math.min(...view.legalActions.filter(a=>a.kind==='discard').map(a=>
    ranking.find(r=>r.tile===Number(a.tileIds[0].split(':')[1])).shanten));
  const actions=view.legalActions.filter(a=>a.kind==='discard');
  const rows=actions.map(a=>{
    const tile=Number(a.tileIds[0].split(':')[1]),r=ranking.find(r=>r.tile===tile);
    return {actionId:a.actionId,tile,previouslyDiscarded:observed.has(tile),shanten:r.shanten,copies:r.copies};
  });
  const minimum=tradeoff?rows.filter(r=>r.shanten===bestShanten):rows;
  const matching=minimum.filter(r=>r.previouslyDiscarded);
  const eligible=matching.length?matching:minimum;
  const top=tradeoff?Math.max(...eligible.map(r=>r.copies)):null;
  const accepted=eligible.filter(r=>!tradeoff||r.copies===top).map(r=>r.actionId);
  if(!matching.length&&!tradeoff)throw new RangeError('River policy fixture lacks observed candidate');
  return {f,view,kind:'legal-action',options:actions.map(a=>option(a.actionId,tileLabel(Number(a.tileIds[0].split(':')[1]))+' ('+a.tileIds[0]+')')),
    accepted,reason:tradeoff?'先保留最低向聽；只在該組內偏好指定對手曾捨的牌種，再最大化進張；同分全接受。這是指定練習規則，不是風險模型。':'只辨識指定對手河牌中曾出現的牌種。曾出現不代表不會放槍；不評估實際安全性。',
    observations:{minimumShanten:bestShanten,candidates:rows,dealInRisk:null,expectedTai:null}};
}
const cases=[
 ['l1-01','tile-label','tiles.identity','exact','牌河剛出現的 t:4:3 是哪一種牌？'],
 ['l1-02','meld-class','structure.melds','exact','本情境自己的已完成吃牌面子是哪一類？'],
 ['l1-03','hand-shape','structure.hand16','exact','這副已完成的封閉標準牌型有幾張暗牌？'],
 ['l1-04','winning-draw','waits.enumeration','exact','按五面子一將眼結構，這副手牌加上題示六萬能否和牌？'],
 ['l2-01','shanten','efficiency.shanten','exact','目前 16 張暗牌的結構向聽數是多少？'],
 ['l2-02','ukeire','efficiency.ukeire','exact','依已知實體副本扣除後，改善向聽的總副本數是多少？'],
 ['l2-03','discard','efficiency.discard','exact','只比較最低向聽、再比較最多有效進張，哪個合法捨牌最佳？'],
 ['l2-04','wait-count','waits.multi','exact','目前手牌的可用和牌牌種有幾種？'],
 ['l3-01','structure-change','efficiency.structure-change','exact','開門後只比較最低向聽與最多有效進張，選出合法最優捨牌。'],
 ['l3-02','open-efficiency','efficiency.discard','exact','已有一組公開刻子，按最低向聽與最多有效進張選擇捨牌。'],
 ['l3-03','one-turn','efficiency.ukeire','exact','在已知牌數下，一巡改善枚數代表什麼？'],
 ['l3-04','tie','efficiency.near-tie','exact','同向聽且同有效進張的合法棄牌如何給分？'],
 ['l4-01','visible','public.visible-count','exact','含自己暗牌及公開河牌／副露，五萬還有幾張未觀測副本？'],
 ['l4-02','chi','strategy.open-meld','conditional','指定教學目標：執行一個合法吃牌，並非判斷吃牌是否最有利。'],
 ['l4-02','pong','strategy.open-meld','conditional','指定教學目標：執行一個合法碰牌。'],
 ['l4-02','kong','strategy.open-meld','conditional','指定教學目標：執行一個合法明槓。'],
 ['l4-02','concealed-kong','strategy.open-meld','conditional','指定教學目標：執行一個合法暗槓；不是宣稱槓牌最優。'],
 ['l4-03','risk','strategy.round-timing','conditional','對此公開副露局面，哪個攻守風險結論有證據？'],
 ['l4-03','public-river-policy','strategy.round-timing','conditional','指定練習：捨出與 0 號座公開河牌曾出現的相同牌種（不代表安全）。'],
 ['l4-04','tai','strategy.scoring-tradeoff','conditional','未有認證台數與風險模型時，能否從牌效唯一決定最高預期得分？'],
 ['l5-01','tradeoff','strategy.synthesis','conditional','本題明定只優化結構牌效、不估放槍及台數：選擇合法最優捨牌。'],
 ['l5-01','constrained-tradeoff','strategy.synthesis','conditional','指定練習：先最低向聽，再偏好 0 號座曾捨的牌種（若有），最後最多進張；不是實戰最優。'],
 ['l5-02','speed','efficiency.near-tie','conditional','限時做完相同題目更快，何者是可支持的解讀？'],
 ['l5-02','near-tie-metric','efficiency.near-tie','exact','在這個合法捨牌局面中，選擇最低向聽且最多有效進張的選項；不考慮答題速度。'],
 ['l5-03','evidence','efficiency.shanten','conditional','哪一項理由能以當前視角與版本重播核對？'],
 ['l5-03','evidence-shanten','efficiency.shanten','exact','計算這個聽牌情境的精確向聽數，作為可重播理由的第一項證據。'],
 ['l5-04','synthesis','strategy.synthesis','conditional','選擇符合當前資訊界線的綜合判斷。']
];
const specs=cases.map(([lesson,key,skillTagId,basis,promptZhTW])=>Object.freeze({
  questionId:'academy-r71-'+key,questionVersion:R71_QUESTION_VERSION,
  lessonId:'academy-'+lesson,skillTagId,basis,promptZhTW,key}));
export const R71_QUESTION_REFS=Object.freeze(specs.map(({questionId,questionVersion})=>Object.freeze({questionId,questionVersion})));
function specFor(ref){
  const f=specs.find(x=>x.questionId===ref?.questionId&&x.questionVersion===ref?.questionVersion);
  if(!f)throw new RangeError('Unknown R7.1 question version');
  return f;
}
function knownWait(f,kind){
  // Independently constructed 16-tile tenpai from a fixed winning shape.
  const s=start('ready-'+kind,{0:['t:5:1'],1:[...triplets,'t:5:0']});
  const opened=act(s,0,'discard','t:5:1');
  if(validateGameState(opened)!==true||!same(replayGame(opened),opened))throw new RangeError('Ready replay mismatch');
  return readPlayerView(createPlayerView(opened,1));
}
const choice3=(f,v,a,b,c,reason)=>{
  const offset=[...f.key].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%3;
  const options=[a,b,c].map((label,i)=>option(String((i+offset)%3),label)).sort((x,y)=>x.id.localeCompare(y.id));
  return textTask(f,v,options,[String(offset)],reason);
};
function construct(f){
  let p,v,n;
  switch(f.key){
    case 'tile-label':
      v=scenario('chi');
      n=Number(v.opponents.find(o=>o.seat===0).river.at(-1).tileId.split(':')[1]);
      return textTask(f,v,[option('4',tileLabel(4)),option('5',tileLabel(5)),option('13',tileLabel(13))],[String(n)],
        '牌碼 0–8 為萬，牌碼 4 是五萬；copyIndex 不改變牌種。');
    case 'meld-class':
      v=scenario('chi-open');
      return textTask(f,v,[option('sequence','順子'),option('triplet','刻子'),option('pair','將眼')],[v.self.melds.at(-1).kind],
        '吃牌建立同花色連續三張的順子，不是刻子或將眼。');
    case 'hand-shape':
      p=parsed('winning');
      if(calculateShanten(p.hand)!==-1)throw new RangeError('Expected completed shape');
      return numeric(f,p.view,p.hand.length,[14,16,18],'五組三張面子與兩張將眼，共 17 張。');
    case 'winning-draw':
      p=knownWait(f,f.key);
      return textTask(f,p.view,[option('yes','可完成結構'),option('no','不能完成結構')],
        [calculateShanten([...p.hand,5])===-1?'yes':'no'],'五組面子加上六萬作將眼，結構完整；不宣稱所有桌規均允許和牌。');
    case 'evidence-shanten':
    case 'shanten':
      p=knownWait(f,f.key);n=calculateShanten(p.hand);
      return numeric(f,p.view,n,[-1,0,1,2],'向聽 0 表示再加入一張可完成標準和牌結構。');
    case 'ukeire':
    case 'wait-count': {
      p=knownWait(f,f.key);
      const x=analyzeDraws(p.hand,{visible:p.visible});
      n=f.key==='ukeire'?x.copies:x.kinds;
      return numeric(f,p.view,n,[0,1,2,3,4,8,12],
        '依五面子一將眼改善判定，並扣除自己暗牌與已知公開牌；種類與副本數不可混為一談。',{kinds:x.kinds,copies:x.copies});
    }
    case 'discard':return efficiency(f,'concealed-kong','以最低向聽、最多有效進張判分；所有物理牌副本同分均接受。');
    case 'structure-change':return efficiency(f,'chi-open','固定面子數增加後，依剩餘暗牌重算；不以拆搭外觀取代整手向聽。');
    case 'open-efficiency':return efficiency(f,'pong-open','公開刻子計入固定面子及已知副本；只比較 Rules 允許的捨牌。');
    case 'one-turn':return choice3(f,scenario('pong-open'),'在已知副本限制下能改善向聽的牌張數','實際下一摸的確定機率','預測下一巡的台數','改善副本是可計算數量，未公開牌牆及對手暗牌仍未知。');
    case 'tie':return choice3(f,scenario('concealed-kong'),'在指定兩項指標下全部接受為最佳','只接受第一個排序結果','依未驗證放槍率決勝','同向聽、同有效進張沒有指定第三個實戰效用指標。');
    case 'visible':
      p=parsed('pong-open');n=4-p.counts[4];
      return numeric(f,p.view,n,[0,1,2,3,4],'已被領取的河牌與公開刻子是同一實體，不可重複計數；未觀測位置不明。',{tileType:4,knownCopies:p.counts[4]});
    case 'chi':return actionTask(f,scenario('chi'),'chi','下一家可依當前 LegalAction 宣告合法吃牌；所有合法組合都接受。');
    case 'pong':return actionTask(f,scenario('pong'),'pong','同牌兩張加上公開牌可依當前 LegalAction 宣告碰；不比較風險或得分。');
    case 'kong':return actionTask(f,scenario('kong'),'kong','同牌三張加公開牌形成明槓；是否可宣告由指定版本 Rules 決定。');
    case 'concealed-kong':return actionTask(f,scenario('concealed-kong'),'kong','此回合的合法槓是暗槓，按當前 Rules-issued LegalAction 判分；不估算補牌收益。');
    case 'risk':return choice3(f,scenario('pong-open'),'公開副露可觀測，但沒有校準模型便不能報放槍率','公開副露後放槍機率必然是 50%','所有已出現的牌必然安全','公開牌面不揭露暗牌，風險未知；這不是防守最佳行動評分。');
    case 'public-river-policy':return riverPolicy(f,false);
    case 'constrained-tradeoff':return riverPolicy(f,true);
    case 'tai':return choice3(f,scenario('pong-open'),'不能，須先定義計台版本與效用模型','有效進張最多必然台數最高','門清必然比任何副露有利','本題固定實驗桌規；不使用未驗證台數或勝率來唯一排序。');
    case 'tradeoff':return efficiency(f,'pong-open','題目只要求結構牌效；相同指標全部滿分。未比較真實攻守得失。');
    case 'near-tie-metric':return efficiency(f,'concealed-kong','比較所有合法捨牌的向聽及有效進張；同分全接受，不以耗時或未知風險決勝。');
    case 'speed':return choice3(f,scenario('winning'),'可能更熟悉題型或記住答案，需獨立測驗才可推論能力','必然達大師級','作答時間可替代正確率','計時並非經真人校準的能力量尺。');
    case 'evidence':return choice3(f,scenario('pong-open'),'原題版本、PlayerView 及合法捨牌的向聽／進張','對手完整暗牌及未來摸牌','只憑速度與結果推斷實力','可重播的公開資料及明示結構計算能被核查；未知資訊不可當作證據。');
    case 'synthesis':return choice3(f,scenario('kong'),'先核對合法行動，分開列出結構牌效、未知風險與未認證台數','槓牌一定能提高期望收益','用未知對手牌型直接決定唯一最佳行動','僅合法性及明確結構指標可被核查，未校準因素僅供討論。');
    default:throw new RangeError('Unknown assessment');
  }
}
const cache=new Map();
function internal(ref){
  const f=specFor(ref);
  if(!cache.has(f.questionId)){
    const item=construct(f);
    if(!item.accepted.length||new Set(item.options.map(o=>o.id)).size!==item.options.length||
       item.accepted.some(id=>!item.options.some(o=>o.id===id)))throw new RangeError('Invalid answer domain');
    cache.set(f.questionId,clone(item));
  }
  return clone(cache.get(f.questionId));
}
export function listR71QuestionRefs({lessonId}={}){
  return specs.filter(s=>!lessonId||s.lessonId===lessonId).map(s=>({questionId:s.questionId,questionVersion:s.questionVersion}));
}
export function getR71Question(ref){
  const x=internal(ref),f=x.f,v=x.view;
  return {...V,questionId:f.questionId,questionVersion:f.questionVersion,
    lessonRef:{lessonId:f.lessonId,lessonVersion:'1.0.0'},
    assessmentVersion:R71_ASSESSMENT_VERSION,scorerId:R71_SCORER_ID,
    scope:f.basis==='exact'?'exact-objective':'explicit-conditional-goal',
    targetSkillTagId:f.skillTagId,taskType:x.kind,promptZhTW:f.promptZhTW,
    playerView:v,ruleRef:clone(v.ruleRef),engineVersion:COMPLETE_ENGINE_VERSION,
    options:clone(x.options),publicationStatus:'instructor-review',officialCredit:false};
}
/** Pure grading, not a DecisionRecord. No storage writes, no learner credit. */
export function gradeR71Question(ref,choice){
  const x=internal(ref);
  if(typeof choice!=='string'||!x.options.some(o=>o.id===choice))
    throw new RangeError('Unknown or illegal answer option');
  const correct=x.accepted.includes(choice);
  return {...V,questionRef:{questionId:x.f.questionId,questionVersion:x.f.questionVersion},
    scorerId:R71_SCORER_ID,scoringVersion:R71_ASSESSMENT_VERSION,
    scope:x.f.basis==='exact'?'exact-objective':'explicit-conditional-goal',
    grade:correct?'perfect':'improve',score:correct?1:0,
    officialCredit:false,recordRef:null,reasonZhTW:x.reason,
    acceptedOptionIds:[...x.accepted],observations:clone(x.observations),
    evidence:{ruleRef:clone(x.view.ruleRef),engineVersion:COMPLETE_ENGINE_VERSION,
      viewId:x.view.viewId,asOfEventSeq:x.view.asOfEventSeq,audienceSeat:x.view.audienceSeat},
    limitations:['指定實驗桌規，不代表完整台灣桌規認證','未估計真實放槍機率、台數效用或真人能力']};
}
/** Reject mutations and unsupported versions before any future integration. */
export function validateR71Question(question){
  if(!same(question,getR71Question(question)))throw new RangeError('Question snapshot or version mismatch');
  return true;
}
export function getR71Coverage(){
  return LESSONS.map(lesson=>{
    const refs=listR71QuestionRefs({lessonId:lesson.lessonId});
    return {lessonRef:{lessonId:lesson.lessonId,lessonVersion:lesson.lessonVersion},
      status:lesson.status,legacyQuestionCount:lesson.questionRefs.length,
      supplementalQuestionCount:refs.length,
      exactObjectiveCount:refs.filter(r=>specFor(r).basis==='exact').length,
      conditionalCount:refs.filter(r=>specFor(r).basis==='conditional').length,
      targetedSkillTagIds:[...new Set(refs.map(r=>specFor(r).skillTagId))],
      exactObjectiveSkillTagIds:[...new Set(refs.filter(r=>specFor(r).basis==='exact').map(r=>specFor(r).skillTagId))],
      formalCredit:false,publicationBlocker:lesson.status==='published'?
        'independent-review-and-record-contract':'independent-review-scorer-contract-and-release-gates'};
  });
}

/** Versioned teaching material supplement; preserves Lesson@1.0.0 identity.
 * Intended for a future instructor-reviewed lesson player, not new credits. */
const lessonTeaching=[
 ['l1-01','先依牌碼分出萬、筒、索、字牌，數牌以整除 9 判斷花色、餘數加 1 判斷點數；實體副本編號不影響牌種。','先辨識一張公開棄牌，再練習轉換同牌種不同副本；不要把牌碼當點數。'],
 ['l1-02','順子須同花色連續三張，刻子須三張同牌，將眼須兩張同牌。公開吃牌後可見固定順子。','先分辨完整組合與搭子；字牌不可組順子，將眼不能當面子。'],
 ['l1-03','台灣十六張封閉標準形在和牌時包含五面子與一將眼；一般摸牌後十七張，未摸前十六張。','數有效面子與暗牌張數；槓以一個固定面子處理，不把多出的一張當普通暗牌。'],
 ['l1-04','標準和牌是全手結構命題；某張牌完成一個搭子，不代表整手已和。','先核對十六張手牌，枚舉候選新牌，再檢查整體結構。'],
 ['l2-01','向聽數表示到聽牌的結構距離；它不是摸牌時間或勝率。','用同一題的暗牌重算向聽，不用目測搭子數取代演算法。'],
 ['l2-02','有效進張可改善向聽，剩餘副本依已知實體牌扣除。','同時分辨有效牌種數與總副本數；未知副本可能在任何未知區域。'],
 ['l2-03','本版何切依最低向聽、同向聽最多有效進張排序。','只比較合法捨牌；相同兩項數值的候選全部正確。'],
 ['l2-04','多面聽須枚舉整體和牌牌種，並扣除已經耗盡的副本。','比較牌種數與副本數，不把未觀測副本誤寫成壁牌。'],
 ['l3-01','拆搭需以整副手牌的後續結構評估。公開固定面子後，暗牌的目標張數隨之改變。','先辨識固定面子，逐個比較合法捨牌後的向聽及有效進張，再說明犧牲哪種結構。'],
 ['l3-02','公開面子會改變可用牌與暗牌結構；不同捨牌可能保留不同後續組合。','在真實公開刻子局面中重算合法捨牌，不套用封閉十七張的固定公式。'],
 ['l3-03','一巡有效進張是當下可計算的改善副本，不是對未來牌山的預測。','說明已知副本、未知位置、改善指標及不能據此推導的機率。'],
 ['l3-04','同向聽同進張者是本評分政策下的完全平手；實戰還有其他尚未建模因素。','先比較兩個指定指標，再保留全部同分答案；不要將排序時的顯示順序誤認為第三個評分指標。'],
 ['l4-01','公開河牌、公開副露及自己暗牌都是已知實體牌；已領取的河牌不能再扣一次。','以實體 ID 去重，再求未觀測副本；不推斷未知副本位置。'],
 ['l4-02','合法吃碰槓由指定桌規與當前回合決定，合法不等於有利。','在不同真實 claim window 選出指定宣告，並辨識公開副露與暗槓的差異。'],
 ['l4-03','公開副露與牌河是觀測訊號，並非已校準放槍率。','練習辨識指定對手曾捨的牌種，但不稱為安全牌；保留未知風險。'],
 ['l4-04','牌效、台數、和牌機率和支付政策是不同變量。','缺少指定計台與效用模型時，選擇保留不確定性，不用牌效推論唯一最高期望收益。'],
 ['l5-01','把精確的牌效與條件化的攻守政策分開：先列出合法候選與最低向聽，再交代額外的公開資訊偏好。','按題目明示排序做決策，解釋何處是假設、何處是客觀計算；不要宣稱為普遍最優。'],
 ['l5-02','速度與答題正確率是不同訊號，重複題目也可能有記憶效應。','先正確重算牌效及平手，再理解計時為何不能直接認證能力。'],
 ['l5-03','有效理由應可由原題版本、公開視角與明確結構指標重播。','先提交可核對的向聽數，再區分理由與不可驗證的對手推測。'],
 ['l5-04','綜合判斷應先檢查合法動作，再分列結構、模型假設和未知因素。','對副露與槓牌局面說明哪些能判分、哪些需要外部計分或風險證據。']
];
export const R71_LESSON_PLAN_VERSION='academy-r71-lesson-plan/1.0.0';
export function getR71LessonPlan(lessonId){
  const lesson=LESSONS.find(l=>l.lessonId===lessonId);
  const row=lessonTeaching.find(([id])=>'academy-'+id===lessonId);
  if(!lesson||!row)throw new RangeError('Unknown R7.1 lesson');
  return {...V,lessonRef:{lessonId,lessonVersion:lesson.lessonVersion},
    supplementVersion:R71_LESSON_PLAN_VERSION,status:lesson.status,
    publicationStatus:'instructor-review',officialCredit:false,
    objectives:clone(lesson.objectives),prerequisiteLessonIds:[...lesson.prerequisiteLessonIds],
    teachingZhTW:row[1],practiceZhTW:row[2],
    questionRefs:listR71QuestionRefs({lessonId}),
    completionPolicy:'no-official-credit-until-independent-review-and-record-contract'};
}

/**
 * Instructor-only handoff to the existing AcademyDecisionRecord V1 registry.
 * Only actual Rules-issued legal actions qualify for this record family;
 * knowledge-choice questions require a separately agreed record contract.
 * This bundle is deliberately not registered and cannot award official credit.
 */
export function buildR71ScenarioReviewBundle(ref){
  const x=internal(ref);
  if(x.kind!=='legal-action')throw new RangeError('Knowledge-choice is not a LegalAction record');
  const q=getR71Question(ref),v=x.view;
  const sourceViewRef={gameId:v.gameId,viewId:v.viewId,asOfEventSeq:v.asOfEventSeq,audienceSeat:v.audienceSeat};
  const fixtureId='r71-review:'+q.questionId+'@'+q.questionVersion;
  const legalActionIds=q.options.map(o=>o.id);
  if(legalActionIds.some(id=>!v.legalActions.some(a=>a.actionId===id)))throw new RangeError('Non-Rules action');
  const results=Object.fromEntries(legalActionIds.map(id=>[id,{
    grade:x.accepted.includes(id)?'perfect':'improve',score:x.accepted.includes(id)?1:0,errorTypeIds:[] }]));
  return {
    question:{...V,questionId:q.questionId,questionVersion:q.questionVersion,lessonRef:clone(q.lessonRef),
      taskType:'scenario',status:'draft',ruleRef:clone(v.ruleRef),skillTagIds:[q.targetSkillTagId],
      source:{kind:'player-view-snapshot',snapshotRef:v.viewId},generator:{fixtureId,generatorVersion:R71_ASSESSMENT_VERSION},
      prompt:{playerView:clone(v),options:legalActionIds,promptZhTW:q.promptZhTW},
      answerKey:{scorerId:R71_SCORER_ID,scoringVersion:R71_ASSESSMENT_VERSION,
        correctnessBasis:'unverified',acceptedActionIds:[...x.accepted]}},
    fixture:{fixtureId,questionId:q.questionId,questionVersion:q.questionVersion,
      ruleRef:clone(v.ruleRef),sourceViewRef,engineVersion:COMPLETE_ENGINE_VERSION,
      scorerId:R71_SCORER_ID,scoringVersion:R71_ASSESSMENT_VERSION,
      verified:false,basis:'unverified',skillTagIds:[q.targetSkillTagId],
      legalActionIds,results},
    reviewPolicy:{scope:q.scope,reasonZhTW:x.reason,observations:clone(x.observations),
      releaseRequirements:['independent-rules-and-scorer-review','versioned-answer-snapshot-digest',
        'contract-owner-approval','adaptive-ui-and-offline-gates'],officialCredit:false}
  };
}
