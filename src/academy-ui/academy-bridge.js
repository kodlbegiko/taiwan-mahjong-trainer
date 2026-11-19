/**
 * Academy UI -> AI6 Public Façade adapter.
 *
 * PR #38 owns only this UI adapter. Production loads AI6's exact module when
 * it is present on a composed checkout; no AI3/AI4 private modules are copied.
 * A fixture may be supplied to createAcademyBridge in isolated tests only.
 */
import { ARCHIVE_STORAGE_KEY, importTrainingJSON } from '../storage/archive.js';

export const UI_PROGRESS_KEY = 'tw-mahjong-master-academy:ui-links:v1';
export const ACADEMY_CONTRACT = 'master-academy/1.0.0';
const own = (v,key)=>Object.prototype.hasOwnProperty.call(v,key);
const clone = obj => JSON.parse(JSON.stringify(obj));
function assert(value,message){ if(!value) throw new TypeError(message); }
function key(ref){return ref.questionId+'@'+ref.questionVersion;}
function validRef(ref){return ref&&typeof ref.questionId==='string'&&ref.questionId.length>0&&typeof ref.questionVersion==='string'&&ref.questionVersion.length>0;}
function validRecordRef(ref){return ref&&ref.kind==='legacy-v3'&&typeof ref.id==='string'&&ref.id.length>0;}
function emptyLinks(){return {schemaVersion:1,contractVersion:ACADEMY_CONTRACT,selectedLessonId:null,links:[]};}
function verifyLinkMap(value){
  assert(value&&value.schemaVersion===1&&value.contractVersion===ACADEMY_CONTRACT&&Array.isArray(value.links),'UI 進度版本不受支援');
  assert(value.selectedLessonId===null||typeof value.selectedLessonId==='string','選課識別錯誤');
  assert(value.links.length<=10000,'UI 進度超出上限');
  const ids=new Set();
  for(const x of value.links){
    assert(validRef(x)&&typeof x.lessonId==='string'&&validRecordRef(x.recordRef),'課程證據引用無效');
    assert(!ids.has(x.recordRef.id),'UI 證據紀錄重複');
    ids.add(x.recordRef.id);
  }
  return value;
}
function recordProof(storage,id) {
  const raw=storage?.getItem(ARCHIVE_STORAGE_KEY);
  if(typeof raw!=='string') return null;
  const verified=importTrainingJSON(raw);
  const actual=verified.records.find(x=>x.schemaVersion===3&&x.id===id);
  return actual ? {id:actual.id,exerciseId:actual.exerciseId,taskType:actual.taskType,
    hand:actual.exerciseSnapshot.hand,visibleTiles:actual.exerciseSnapshot.visibleTiles,
    seed:actual.exerciseSnapshot.seed,index:actual.exerciseSnapshot.index,
    generatorVersion:actual.exerciseSnapshot.generatorVersion} : null;
}
function readLinks(storage){
  if(!storage||typeof storage.getItem!=='function') throw new Error('本機儲存不可使用');
  const raw=storage.getItem(UI_PROGRESS_KEY);
  const map=raw===null?emptyLinks():verifyLinkMap(JSON.parse(raw));
  // Treat all UI link metadata as untrusted until its canonical v3 record exists.
  return {...map,links:map.links.filter(x=>recordProof(storage,x.recordRef.id))};
}
function writeLinks(storage,value){
  verifyLinkMap(value);
  const bytes=JSON.stringify(value);
  storage.setItem(UI_PROGRESS_KEY,bytes);
  assert(storage.getItem(UI_PROGRESS_KEY)===bytes,'UI 進度未經讀回確認');
  return readLinks(storage);
}
function assertPublicQuestion(q,ref) {
  assert(q&&q.contractVersion===ACADEMY_CONTRACT&&q.schemaVersion===1&&q.status==='validated','正式題目尚不可作答');
  assert(validRef(q)&&key(q)===key(ref),'題目識別或版本不符');
  assert(['discard','tenpai','multi_wait'].includes(q.taskType),'未驗證的情境題不得計分');
  assert(q.prompt&&Array.isArray(q.prompt.legacyHand)&&Array.isArray(q.prompt.options),'缺少公開題目資訊');
  assert(q.prompt.legacyHand.length===(q.taskType==='discard'?17:16),'手牌長度不符');
  assert(q.prompt.legacyHand.every(x=>Number.isInteger(x)&&x>=0&&x<34),'手牌牌碼錯誤');
  assert(q.prompt.options.length>0&&q.prompt.options.length<=34,'合法選項數量錯誤');
  const numbers=q.prompt.options.map(x=>Number(x));
  assert(numbers.every(x=>Number.isInteger(x)&&x>=0&&x<34),'選項牌碼錯誤');
  assert(new Set(numbers).size===numbers.length,'選項牌碼重複');
  if(q.taskType==='discard') assert(numbers.every(x=>q.prompt.legacyHand.includes(x)),'不合法的捨牌選項');
  const forbidden=new Set(['answerKey','GameState','wall','replacementWall','futureEvents','privateEvents','answerSnapshotDigest']);
  const visit = obj => {
    if(!obj||typeof obj!=='object') return;
    for(const [k,v] of Object.entries(obj)){
      assert(!forbidden.has(k),'QuestionPublic 含有未授權的欄位');
      visit(v);
    }
  };
  visit(q);
  return { ...clone(q), prompt:{...clone(q.prompt),options:numbers}};
}
/** UI-owned linkage is not trusted evidence until it matches both a v3 raw
 * record AND AI3's public immutable question projection. */
function provenLessonLink(facade,storage,link,lessons){
  try {
    const record=recordProof(storage,link.recordRef.id);
    const ref={questionId:link.questionId,questionVersion:link.questionVersion};
    const publicQ=assertPublicQuestion(facade.getPublicQuestion(ref),ref);
    const lesson=lessons.find(x=>x.lessonId===link.lessonId);
    if(!record||!lesson||!lesson.questionRefs.some(x=>key(x)===key(ref))) return false;
    if(publicQ.lessonRef?.lessonId!==link.lessonId||publicQ.taskType!==record.taskType) return false;
    if(JSON.stringify(publicQ.prompt.legacyHand)!==JSON.stringify(record.hand)||
       JSON.stringify(publicQ.prompt.visibleTiles??[])!==JSON.stringify(record.visibleTiles)) return false;
    if(publicQ.generator && (publicQ.generator.seed!==record.seed||
       publicQ.generator.index!==record.index||
       publicQ.generator.generatorVersion!==record.generatorVersion)) return false;
    return true;
  }catch{return false;}
}
/** Use only the source contract's public methods, never internal grading imports. */
export function createAcademyBridge(facade,storage,{now=()=>new Date().toISOString(),fixtureOnly=false}={}){
  assert(facade&&facade.contractVersion===ACADEMY_CONTRACT,'整合 Façade 契約版本不符');
  for(const method of ['getLessons','getQuestionRefs','getPublicQuestion','submitStructuralAnswer','getDashboard'])
    assert(typeof facade[method]==='function','缺少正式 Façade API：'+method);
  const bridge={
    fixtureOnly,available:true,facade,storage,
    lessons:[],dashboard:null,session:null,links:emptyLinks(),
    selectedLessonId:null,question:null,choice:[],startedAt:0,attemptId:null,
    phase:'idle',result:null,error:null,warning:null,
    refresh(){
      const asOf=now();
      const lessons=facade.getLessons();
      assert(Array.isArray(lessons)&&lessons.every(l=>l.contractVersion===ACADEMY_CONTRACT
        &&l.schemaVersion===1&&typeof l.lessonId==='string'&&Array.isArray(l.questionRefs)),'LessonPublic 來源無效');
      this.lessons=clone(lessons);
      this.dashboard=clone(facade.getDashboard({asOf}));
      assert(this.dashboard.profile?.contractVersion===ACADEMY_CONTRACT
        &&this.dashboard.reviewPlan?.contractVersion===ACADEMY_CONTRACT,'Adaptive 公開資料未就緒');
      this.session=typeof facade.getTrainingSession==='function'?clone(facade.getTrainingSession({asOf})):null;
      // Only Adaptive's verified sidecar is authoritative in production.
      // The deprecated ui-links:v1 storage key is ignored for evidence and
      // never written by the production bridge. Fixture tests retain their
      // isolated UI-only store, clearly marked fixtureOnly.
      if (fixtureOnly) {
        this.links=readLinks(storage);
      } else {
        assert(typeof facade.getProvenanceLinks==='function',
          '正式整合必須提供可驗證的 provenance 來源');
        const official=facade.getProvenanceLinks();
        assert(Array.isArray(official),'正式來源對應必須為陣列');
        const prior=this.selectedLessonId;
        this.links={...emptyLinks(),links:clone(official),
          selectedLessonId:prior??official.at(-1)?.lessonId??null};
      }
      this.links.links=this.links.links.filter(link=>provenLessonLink(facade,storage,link,this.lessons));
      if(this.selectedLessonId===null) this.selectedLessonId=this.links.selectedLessonId;
      return this;
    },
    progress(lesson){
      const refs=new Set(lesson.questionRefs.map(key));
      const unique=new Set(this.links.links.filter(l=>l.lessonId===lesson.lessonId&&refs.has(key(l))).map(key));
      return {completed:unique.size,total:refs.size,done:refs.size>0&&unique.size===refs.size};
    },
    canStart(lesson){
      return lesson.prerequisiteLessonIds.every(id=>{
        const pre=this.lessons.find(x=>x.lessonId===id);
        return pre&&this.progress(pre).done;
      });
    },
    startLesson(lessonId,{questionRef=null}={}){
      const lesson=this.lessons.find(x=>x.lessonId===lessonId);
      assert(lesson,'找不到正式課程');
      assert(this.canStart(lesson),'尚未完成先修課程');
      const refs=facade.getQuestionRefs({lessonId});
      assert(Array.isArray(refs)&&refs.length>0,'這門課沒有可作答題目');
      const valid=new Set(lesson.questionRefs.map(key));
      assert(refs.every(x=>validRef(x)&&valid.has(key(x))),'正式題目與課程引用不一致');
      const done=new Set(this.links.links.filter(x=>x.lessonId===lessonId).map(key));
      const ref=questionRef?refs.find(x=>key(x)===key(questionRef))
        :refs.find(x=>!done.has(key(x)))??refs[0];
      assert(ref,'無法重播指定的課程題目');
      const publicQ=assertPublicQuestion(facade.getPublicQuestion(ref),ref);
      this.selectedLessonId=lessonId;
      this.question=publicQ;this.choice=[];this.startedAt=Date.now();this.attemptId=null;
      this.phase='answering';this.error=null;this.warning=null;this.result=null;
      try {
        if (fixtureOnly) this.links=writeLinks(storage,{...this.links,selectedLessonId:lessonId});
        else this.links.selectedLessonId=lessonId;
      }catch(e){this.warning='選課進度無法儲存；作答後需再次確認本機儲存狀態。';}
      return publicQ;
    },
    select(tile){
      assert(this.phase==='answering'&&this.question,'沒有等待作答的正式題目');
      const options=this.question.prompt.options;
      assert(options.includes(tile),'不是合法的選擇');
      if(this.question.taskType==='discard') this.choice=[tile];
      else this.choice=this.choice.includes(tile)?this.choice.filter(x=>x!==tile):[...this.choice,tile].sort((a,b)=>a-b);
      return this.choice;
    },
    submit(){
      assert(this.phase==='answering'&&this.question,'此題不可再次提交');
      assert(this.question.taskType!=='discard'||this.choice.length===1,'尚未選擇要捨棄的牌');
      const ref={questionId:this.question.questionId,questionVersion:this.question.questionVersion};
      const choice=this.question.taskType==='discard'?this.choice[0]:[...this.choice];
      const timestamp=now();
      this.attemptId=this.attemptId??('academy-ui-'+(globalThis.crypto?.randomUUID?.()??String(Date.now())+'-'+Math.floor(Math.random()*1e9)));
      let result;
      try {
        result=facade.submitStructuralAnswer(ref,choice,{timestamp,
          durationMs:Math.max(0,Date.now()-this.startedAt),attemptId:this.attemptId,asOf:timestamp});
      } catch(e) {
        this.phase='failed';this.error='官方提交或儲存失敗：'+e.message+'。請重新載入核對原始紀錄，勿連續重複送出。';
        return null;
      }
      // A valid score alone is not a durable submission.
      if(!result||!validRecordRef(result.recordRef)||result.recordRef.id!==this.attemptId
        ||result.gradingResult?.status!=='graded'||result.gradingResult?.questionRef?.questionId!==ref.questionId){
        this.phase='failed';this.error='評分或紀錄引用不符；不更新課程進度。';return null;
      }
      this.result=clone(result);this.phase='graded';
      if(result.durable!==true||!recordProof(storage,result.recordRef.id)) {
        this.phase='failed';this.error='原始作答尚未證實永久保存；目前僅能顯示評分，不計入課程進度。';
        return result;
      }
      if (fixtureOnly) {
        try {
          const mapped={questionId:ref.questionId,questionVersion:ref.questionVersion,
            lessonId:this.selectedLessonId,recordRef:clone(result.recordRef)};
          const old=this.links.links.filter(x=>x.recordRef.id!==mapped.recordRef.id);
          this.links=writeLinks(storage,{...this.links,links:[...old,mapped]});
        } catch(e){
          this.phase='partial';this.warning='Fixture v3 紀錄已保存，但測試課程關聯未保存。';
          return result;
        }
      } else if (result.provenanceDurable!==true) {
        this.phase='partial';
        this.warning='正式 v3 作答已保存，但 Adaptive 的權威 provenance 尚未寫入並驗證；不更新課程進度。';
        return result;
      }
      if(result.derivedFresh!==true) {
        this.phase='partial';this.warning='正式原始作答已保存，但 Adaptive 衍生分析尚未成功更新。';
        return result;
      }
      try{this.refresh();}catch(e){
        this.phase='partial';this.warning='作答已保存，但能力與複習資料無法確認：'+e.message;
        return result;
      }
      if(!this.links.links.some(link=>link.recordRef.id===result.recordRef.id)){
        this.phase='partial';this.warning='紀錄雖已持久化，但課程題目與官方來源無法核對；不計入完成度。';
        return result;
      }
      this.phase='saved';this.warning=null;
      return result;
    },
    getDueItems(){
      const plan=this.dashboard?.reviewPlan;
      if(!Array.isArray(plan?.items)) return [];
      const nowMs=Date.parse(now());
      return plan.items.filter(x=>Date.parse(x.dueAt)<=nowMs
        &&!(x.reasonCodes??[]).some(y=>y.startsWith('unavailable:')));
    },
    reviewLink(item){
      if(!item||!validRef(item))return null;
      // Adaptive now emits academy-q-* for verified provenance, but imported
      // legacy v3 reviews may still use ex3-*; never guess the mapping.
      const matches=this.links.links.filter(l=>{
        const proof=recordProof(storage,l.recordRef.id);
        const sameQuestion=l.questionId===item.questionId &&
          l.questionVersion===item.questionVersion;
        const legacyMatch=item.questionVersion==='legacy-exercise-v3' &&
          proof?.exerciseId===item.questionId;
        const referenced=Array.isArray(item.sourceRecordRefs) &&
          item.sourceRecordRefs.some(r=>r.kind===l.recordRef.kind&&r.id===l.recordRef.id);
        return proof && referenced && (sameQuestion || legacyMatch);
      });
      return matches.length?matches[matches.length-1]:null;
    },
  };
  return bridge.refresh();
}
export async function loadAcademyBridge(storage){
  try {
    // The import is intentionally optional on this source PR. AI6 must compose
    // this exact module and all its dependencies, then rerun E2E and offline CI.
    const {createMasterAcademyFacade}=await import('../integration/master-academy-facade.js');
    return {status:'ready',bridge:createAcademyBridge(createMasterAcademyFacade(storage),storage)};
  }catch(error){
    return {status:'unavailable',reason:'正式 Learning / Adaptive / Public Façade 尚未在這個版本整合。'+
      ' 可以繼續使用 V0.2 三題型。',error};
  }
}
