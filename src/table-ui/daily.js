/**
 * Daily UI uses Adaptive's canonical controller and Web Locks.
 * No new Session state or scores are persisted in this view layer.
 */
import { tileFaceMarkup, tileAccessibleName } from '../tile-visuals.js';

const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
})[c]);
const now=()=>new Date().toISOString();
const short=x=>x?.questionId+'@'+x?.questionVersion;
const t=x=>Number.isInteger(x)&&x>=0&&x<34?x:null;
const tile=x=>t(Number(x))===null ? esc(x) :
  '<span class="table-tile tile" role="img" aria-label="'+esc(tileAccessibleName(Number(x)))+'">'+
  tileFaceMarkup(Number(x))+'</span>';

export async function createDailyPanel(storage) {
  if (!storage) throw new Error('本機儲存不可用，無法提交正式 Daily Session');
  const [adaptive,learning,master]=await Promise.all([
    import('../adaptive/index.js'),import('../academy/index.js'),
    import('../integration/master-academy-facade.js')
  ]);
  if (typeof adaptive.createDailyTrainingController!=='function')
    throw new Error('Daily 正式 Controller 尚未整合');
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Taipei';
  const ctrl=adaptive.createDailyTrainingController(storage,{
    learning,registry:master.APPROVED_LEGACY_REGISTRY,
    validateAcademyDecisionRecord:learning.validateAcademyDecisionRecord,
    profileId:'local-academy-profile',timezone
  });
  let progress=null, question=null, lastGrade=null, lastSaved=null;
  let error='', startedAt=Date.now(), state='loading', pending=false;

  const sameRef=(a,b)=>!!a&&!!b&&a.questionId===b.questionId&&
    a.questionVersion===b.questionVersion;
  const recordId=ref=>typeof ref?.id==='string'&&ref.id.length>0?ref.id:null;
  function setProgress(next) {
    if(!next||next.status==='error')throw new Error(
      'Daily 狀態驗證失敗：'+(next?.error?.code??'INVALID_PROGRESS'));
    const prev=progress?.nextQuestionRef;
    const nextQuestion=next.nextQuestionRef?
      ctrl.getQuestion(next.nextQuestionRef,{asOf:now()}):null;
    progress=next;question=nextQuestion;
    if(!sameRef(prev,next.nextQuestionRef))startedAt=Date.now();
  }
  async function refresh() {
    if(pending)throw new Error('仍在提交作答，不可並行刷新');
    state='loading';
    try {
      setProgress(await ctrl.getDailyProgressLocked({asOf:now()}));
      state='ready';error='';
      return progress;
    }catch(e){state='failed';error=e.message;throw e;}
  }
  async function start(minutes=30) {
    if(pending)throw new Error('提交尚未結束');
    if(![10,20,30,60].includes(minutes))throw new Error('不支援的訓練長度');
    state='loading';
    try {
      await ctrl.ensureTodayLocked({asOf:now(),minutes});
      lastGrade=null;lastSaved=null;
      setProgress(await ctrl.getDailyProgressLocked({asOf:now()}));
      state='ready';error='';return progress;
    }catch(e){state='failed';error=e.message;throw e;}
  }
  async function resume() {
    if(pending)throw new Error('提交尚未結束');
    state='loading';
    try {
      await ctrl.resumeSessionLocked({asOf:now()});
      setProgress(await ctrl.getDailyProgressLocked({asOf:now()}));
      lastGrade=null;lastSaved=null;state='ready';error='';
      return progress;
    }catch(e){state='failed';error=e.message;throw e;}
  }
  async function finish() {
    if(pending)throw new Error('提交尚未結束');
    state='loading';
    try {
      setProgress(await ctrl.completeSessionLocked({asOf:now()}));
      state='ready';error='';return progress;
    }catch(e){state='failed';error=e.message;throw e;}
  }
  async function abort() {
    if(pending)throw new Error('提交尚未結束');
    state='loading';
    try {
      setProgress(await ctrl.abortSessionLocked({asOf:now(),reason:'user-aborted'}));
      state='ready';error='';return progress;
    }catch(e){state='failed';error=e.message;throw e;}
  }
  function getChoice(root) {
    const checked=[...root.querySelectorAll('[name="daily-answer"]:checked')]
      .map(x=>Number(x.value));
    if(!checked.length)throw new Error('尚未選擇答案');
    if(checked.some(x=>t(x)===null))throw new Error('非法選項');
    return question.taskType==='discard'?checked[0]:checked;
  }
  /**
   * A saved display is earned only after the official locked readback proves
   * the exact QuestionRef <-> RecordRef link in the canonical session.
   * Never treat mere UI copy or the grader's temporary response as persistence.
   */
  async function submit(root) {
    if(pending)throw new Error('上一筆正式作答仍在提交中');
    if(state==='recovery-required')
      throw new Error('有待恢復的提交；請先使用「恢復／刷新 Session」');
    if(!question||!progress?.nextQuestionRef)throw new Error('目前沒有可作答的題目');
    const choice=getChoice(root), ref={...progress.nextQuestionRef};
    const sessionId=progress.sessionId, before=progress.completed;
    const key='table-daily-attempt:'+sessionId+':'+short(ref);
    let attemptId;
    try{attemptId=globalThis.sessionStorage?.getItem(key);}catch{}
    if(!attemptId) {
      attemptId='table-'+(globalThis.crypto?.randomUUID?.()??
        String(Date.now())+'-'+Math.floor(Math.random()*1000000));
      try{globalThis.sessionStorage?.setItem(key,attemptId);}catch{}
    }
    pending=true;state='submitting';error='';lastGrade=null;lastSaved=null;
    let outcome=null;
    try {
      outcome=await ctrl.submitSessionAnswerLocked({
        questionRef:ref,choice,asOf:now(),
        durationMs:Math.max(0,Math.min(86_400_000,Date.now()-startedAt)),
        attemptId
      });
      if(!['saved','already-answered'].includes(outcome?.status)){
        state='recovery-required';
        error='正式寫入未完成（'+(outcome?.status??'unknown')+'）：'+
          (outcome?.message??outcome?.errorCode??'需先恢復正式紀錄');
        return outcome;
      }
      const refId=recordId(outcome.recordRef);
      if(!refId)throw new Error('正式 API 未提供可驗證的 RecordRef');
      const readback=await ctrl.getDailyProgressLocked({asOf:now()});
      if(readback?.status==='error'||readback?.sessionId!==sessionId)
        throw new Error('Daily Session 讀回身分不符');
      const exactLink=readback.completedQuestions?.some(x=>
        sameRef(x.questionRef,ref)&&recordId(x.recordRef)===refId);
      const inSession=readback.recordRefs?.some(x=>recordId(x)===refId);
      if(!exactLink||!inSession||readback.completed<before||
          sameRef(readback.nextQuestionRef,ref))
        throw new Error('正式 RecordRef、QuestionRef 與 Session Progress 讀回不一致');
      setProgress(readback);
      lastGrade=outcome.gradingResult??null;
      lastSaved={questionRef:ref,recordRef:outcome.recordRef};
      state='saved';error='';
      try{globalThis.sessionStorage?.removeItem(key);}catch{}
      return {status:'saved',recordRef:outcome.recordRef,gradingResult:lastGrade,
        officialReadback:true};
    }catch(e){
      // Write may already have committed. Never generate a second attempt
      // before the official recovery protocol reconciles the original ID.
      state='recovery-required';
      error='提交結果尚未完成正式持久化驗證：'+e.message;
      return {status:'recovery-required',errorCode:'UI_READBACK_FAILED',
        message:e.message,recordRef:outcome?.recordRef??null};
    }finally{pending=false;}
  }
  function render() {
    const p=progress;
    const header='<section class="table-daily-state" data-daily-state="'+esc(state)+'"'+
      (lastSaved&&state==='saved'?' data-daily-record-id="'+esc(lastSaved.recordRef.id)+'"':'')+
      '><header class="table-heading"><h1 id="table-heading" tabindex="-1">今日正式訓練</h1>'+
      '<span class="table-overline">ACADEMY DAILY / 正式 v3 作答</span></header>'+
      '<p class="table-muted">進度與成績只以 Adaptive / Learning 的持久化結果為準；不另建 UI 資料庫。</p>'+
      '<p role="status" aria-live="polite">提交狀態：'+
      esc({loading:'讀取中',ready:'可操作',submitting:'正在透過正式 API 儲存',
        saved:'正式 RecordRef 已讀回', 'recovery-required':'需要恢復驗證',
        failed:'操作失敗'}[state]??state)+'</p>';
    if (!p) return header+'<section class="table-empty"><p>尚未讀取今日課表。</p>'+
      '<button type="button" data-daily-resume>讀取今日課表</button></section>';
    const progressText='<p role="status">日期 '+esc(p.dayKey)+' · '+esc(p.timezone)+
      ' · 狀態 '+esc(p.status)+' · '+esc(p.completed)+' / '+esc(p.total)+' 題</p>';
    if (p.status==='error')return header+progressText+'<p class="table-warning" role="alert">'+
      esc(p.error?.code)+'：'+esc(p.error?.message)+'</p>'+
      '<button type="button" data-daily-resume>重新驗證／恢復</button>';
    if (p.status==='not-started')return header+'<section class="table-empty"><h2>開始今日課表</h2>'+
      '<label for="daily-minutes">訓練長度</label><select id="daily-minutes">'+
      [10,20,30,60].map(n=>'<option value="'+n+'"'+(n===30?' selected':'')+'>'+n+' 分鐘</option>').join('')+
      '</select><button type="button" class="primary" data-daily-start>正式建立 Session</button>'+
      '</section>';
    let html=header+progressText+
      '<div class="table-footer-controls"><button type="button" data-daily-resume>恢復／刷新 Session</button>';
    if (p.nextStep==='complete'&&p.status==='active')
      html+='<button type="button" class="primary" data-daily-complete>完成訓練</button>';
    if (p.status==='active'||p.status==='planned')
      html+='<button type="button" class="secondary" data-daily-abort>結束今日訓練</button>';
    html+='</div>';
    if(lastSaved&&state==='saved')
      html+='<section class="table-round-summary" data-daily-save-confirmed="true" role="status">'+
        '<h2>正式作答已保存並讀回</h2><p>RecordRef：'+esc(lastSaved.recordRef.id)+
        '；QuestionRef：'+esc(short(lastSaved.questionRef))+'</p>'+
        (lastGrade?'<h3>上一題正式評分</h3><pre class="table-daily-grade">'+
        esc(JSON.stringify(lastGrade,null,2))+'</pre>':
        '<p>官方已確認作答紀錄；此提交沒有重新回傳評分明細。</p>')+'</section>';
    if (question && p.nextStep==='answer') {
      const q=question,options=q.prompt?.options??[];
      const multiple=q.taskType!=='discard';
      html+='<section class="table-actions table-daily-question"><h2>'+esc(q.taskType)+
        ' · '+esc(q.questionId)+'</h2><p>題型由已發布 Learning QuestionPublic 提供。'+
        (multiple?'可複選有效牌。':'請選擇一張捨牌。')+'</p>'+
        '<div class="table-daily-hand" aria-label="題目手牌">'+
        (q.prompt?.legacyHand??[]).map(tile).join('')+'</div>'+
        '<div class="table-action-buttons" role="group" aria-label="正式題目選項">'+
        options.map(x=>'<label class="table-daily-option"><input name="daily-answer" type="'+
          (multiple?'checkbox':'radio')+'" value="'+esc(x)+'"/>'+tile(x)+'</label>').join('')+
        '</div><button type="button" class="primary" data-daily-submit '+
        (pending||state==='recovery-required'?'disabled':'')+
        '>提交正式答案</button></section>';
    } else if(p.nextStep==='done')html+='<p>今日 Session 已正式完成，能力摘要以 Adaptive API 為準。</p>';
    else if(p.nextStep==='aborted')html+='<p>今日 Session 已結束；已保存作答不會刪除。</p>';
    if (p.abilityProfile)html+='<section class="table-round-summary"><h2>今日能力摘要</h2>'+
      '<p>校準狀態：'+esc(p.abilityProfile.calibrationStatus??'未校準')+
      '；未校準技能不提供虛構熟練度。</p></section>';
    if(error)html+='<p class="table-warning" role="alert">'+esc(error)+'</p>';
    return html+'</section>';
  }
  return Object.freeze({start,resume,refresh,submit,finish,abort,render,
    get progress(){return progress;},get status(){return state;},
    get saving(){return pending;},get error(){return error;}});
}
