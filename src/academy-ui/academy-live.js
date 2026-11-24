/** Pure UI renderer. No private Question, answer key, or scoring code is imported. */
import {tileAccessibleName,tileFaceMarkup} from '../tile-visuals.js';

const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
const pct=v=>Number.isFinite(v)?Math.round(v*100)+'%':'樣本不足';
const date=v=>Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
const button=(text,action,attr='',cls='secondary')=>'<button type="button" class="'+cls+' academy-action" data-live-action="'+action+'" '+attr+'>'+escapeHTML(text)+'</button>';
const head=(name,description)=>'<header class="academy-page-head"><p class="academy-overline">MASTER ACADEMY · 來源分級</p><h1 id="academy-page-heading" tabindex="-1">'+escapeHTML(name)+'</h1><p>'+escapeHTML(description)+'</p></header>';
const reason=(e)=>'<div class="academy-alert" role="status" aria-live="polite">'+escapeHTML(e)+'</div>';
const questionAttrs=q=>'data-lesson-id="'+escapeHTML(q.lessonRef?.lessonId??'')+'"';
const refKey=x=>x.questionId+'@'+x.questionVersion;
function chooseQuestion(bridge){
  const q=bridge.question;
  if(!q) return '';
  const waiting=bridge.phase==='answering';
  const isDiscard=q.taskType==='discard',scenario=q.taskType==='scenario';
  const choices=q.prompt.options;
  const selected=new Set(bridge.choice);
  const hand= q.prompt.legacyHand.map((tile,i)=>'<span class="academy-hand-tile tile" role="img" aria-label="第'+(i+1)+'張 '+escapeHTML(tileAccessibleName(tile))+'">'+tileFaceMarkup(tile)+'</span>').join('');
  // No answerKey and no raw GameState. All buttons receive public tile options.
  const options=scenario?choices.map(id=>'<button type="button" class="academy-action secondary" data-live-action="choose-scenario" data-option="'+escapeHTML(id)+'" aria-pressed="'+String(selected.has(id))+'"'+(!waiting?' disabled':'')+'>'+escapeHTML(q.prompt.optionLabels[id])+'</button>').join(''):
    (isDiscard?q.prompt.legacyHand:choices).map((tile,i)=>{
    const available=choices.includes(tile);
    return '<button type="button" class="academy-choice tile" data-live-action="choose" data-tile="'+tile+'"'+
      ' aria-pressed="'+String(selected.has(tile))+'" aria-label="'+escapeHTML(tileAccessibleName(tile))+
      (selected.has(tile)?' 已選取':'')+'"'+(!waiting||!available?' disabled':'')+'>'+
      tileFaceMarkup(tile)+'</button>';
  }).join('');
  let feedback='';
  if(bridge.result?.gradingResult){
    const g=bridge.result.gradingResult;
    const ex=g.explanation??{};
    feedback='<section id="academy-grade" class="academy-surface" aria-live="polite"><h3>正式 GradingResult · '+escapeHTML(g.grade)+'</h3>'
      +'<p><strong>評分 '+pct(g.score)+'</strong> · '+escapeHTML(g.scoringVersion??'')+'</p>'
      +(ex.answerSummary?'<p>'+escapeHTML(ex.answerSummary)+'</p>':'')
      +(ex.primaryReason?'<p>'+escapeHTML(ex.primaryReason)+'</p>':'')
      +(Array.isArray(ex.commonMisconceptions)&&ex.commonMisconceptions.length?
        '<h4>解題提醒</h4><ul>'+ex.commonMisconceptions.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')+'</ul>':'')
      +'<small>RecordRef：'+escapeHTML(bridge.result.recordRef?.kind)+' / '+escapeHTML(bridge.result.recordRef?.id)+'</small></section>';
  }
  return '<section id="academy-question" class="academy-surface" '+questionAttrs(q)+'>'+
    '<div class="academy-section-title"><h2>正式題目 '+escapeHTML(q.questionId)+'</h2><span class="academy-tag">'+escapeHTML(q.taskType)+' · '+escapeHTML(q.questionVersion)+'</span></div>'
    +'<p>'+escapeHTML(q.instructionsZhTW??(isDiscard?'請選擇捨牌':'選出全部胡牌張'))+'</p>'
    +'<p class="academy-caption">QuestionPublic · 僅顯示玩家可見牌張；作答前不顯示答案或正確性</p>'
    +'<h3>手牌 '+q.prompt.legacyHand.length+' 張</h3><div class="academy-live-hand" role="group" aria-label="公開手牌">'+hand+'</div>'
    +(scenario?'<p>固定面子 '+q.prompt.playerView.self.melds.length+' 組；已知明牌：</p><div class="academy-live-hand">'+q.prompt.visibleTiles.map(tileFaceMarkup).join('')+'</div>':'')
    +'<h3>'+(scenario?'選擇合法動作':isDiscard?'選一張棄牌':'從 34 種牌中選出所有胡牌張')+'</h3><div class="academy-choice-grid" role="group" aria-label="合法作答選項">'+options+'</div>'
    +'<p id="academy-selected" aria-live="polite">已選 '+selected.size+(scenario?' 個動作':' 種牌')+(selected.size?'：'+escapeHTML(bridge.choice.map(x=>scenario?q.prompt.optionLabels[x]:tileAccessibleName(x)).join('、')):'')+'</p>'
    +(waiting?button('確認送出正式評分','submit',(isDiscard||scenario)&&!bridge.choice.length?'disabled':'','primary'):'')
    +(bridge.warning?reason(bridge.warning):'')+(bridge.error?reason(bridge.error):'')+feedback
    +(bridge.phase==='saved'?'<p class="academy-success" role="status">'+(scenario?'已經讀回確認：Academy V1 情境紀錄、Adaptive 能力與複習資料均已更新。':'已經讀回確認：原始 v3 紀錄、課程關聯、Adaptive 能力與複習資料均已更新。')+'</p>':'')
    +(bridge.phase==='partial'?reason('僅部分資料已保存。不可視為完成完整學習閉環；請核對後再繼續。'):'')
    +((bridge.phase==='saved')?(scenario?'':button('下一題','next','','primary'))+button('返回原課程','return-lesson'):'')
    +((bridge.phase==='failed'||bridge.phase==='partial')?button('重新載入並核對紀錄','reload'):'')
    +'</section>';
}
function lessonsView(b) {
  const available=b.lessons;
  const current=available.find(x=>x.lessonId===b.selectedLessonId)||available[0];
  const byId=new Map(available.map(l=>[l.lessonId,l]));
  const levels=[1,2,3,4,5];
  const rows=levels.map(level=>{
    const lessons=available.filter(l=>l.lessonId.startsWith('academy-l'+level+'-'));
    if(!lessons.length) return '';
    return '<section class="academy-level"><h2>第 '+level+' 級 · '+escapeHTML(['入門','熟練','進階','高手','大師挑戰'][level-1])+'</h2><div class="academy-level-lessons">'+lessons.map(l=>{
      const p=b.progress(l),allowed=b.canStart(l);
      const focused=l.lessonId===current?.lessonId;
      return '<button type="button" class="academy-lesson-pick" data-live-action="select-lesson" data-lesson="'+escapeHTML(l.lessonId)+'" aria-pressed="'+focused+'">'+
        '<span>'+escapeHTML(l.status==='published'?'已發布 · 正式結構題':'已驗證結構題 · 尚未正式發布')+'</span>'+
        '<strong>'+escapeHTML(l.titleZhTW)+'</strong><small>進度 '+p.completed+'/'+p.total+' · '+(p.done?'已完成':allowed?'可開始':'建議先完成前置課程')+'</small></button>';
    }).join('')+'</div></section>';
  }).join('');
  return head('規則與課程','直接讀取 AI3 正式 LessonPublic 的五級課程；不使用先前的三門靜態假課。')
  +'<div class="academy-course-layout"><div class="academy-level-stack" aria-label="五級正式課程">'+rows+'</div>'
  +(current?'<section class="academy-surface academy-lesson-detail"><span class="academy-tag">LessonPublic · '+escapeHTML(current.lessonId)+'</span>'+
      '<h2>'+escapeHTML(current.titleZhTW)+'</h2><p>課程版本：'+escapeHTML(current.lessonVersion)+' · 題數 '+current.questionRefs.length+'</p>'+
      '<h3>學習目標</h3><ul>'+current.objectives.map(o=>'<li>'+escapeHTML(o)+'</li>').join('')+'</ul>'+
      '<h3>先修關係</h3><p>'+escapeHTML(current.prerequisiteLessonIds.length?current.prerequisiteLessonIds.map(id=>byId.get(id)?.titleZhTW??id).join('、'):'無')+'</p>'+
      '<h3>教學內容</h3>'+current.contentBlocks.filter(x=>x.kind!=='tile-example').map(x=>'<p>'+escapeHTML(x.content)+'</p>').join('')+
      '<p class="academy-caption">目前課程狀態：'+escapeHTML(current.status)+'。尚未驗證的攻防、台數及模擬不計分。</p>'+
      button(b.canStart(current)?'開始／繼續此課程':'先完成先修課程','begin-lesson','data-lesson="'+escapeHTML(current.lessonId)+'"'+(!b.canStart(current)?' disabled':''),'primary')+
      (b.scenarioRefs?.(current.lessonId).length?button('客觀情境評估（獨立正式紀錄）','begin-scenario','data-lesson="'+escapeHTML(current.lessonId)+'"'+(!b.canStart(current)?' disabled':'')):'')+
      '</section>':'')+'</div>'
    +chooseQuestion(b);
}
// Presentation only. Do not infer mastery from an attempt count or average.
const DIAGNOSTIC_LABELS=Object.freeze({
  'unobserved':'尚未評估','insufficient-evidence':'證據不足',
  'practice-priority':'優先練習','observed-high-score':'觀察表現良好',
});
export function renderSkillDiagnostics(dashboard,{compact=false}={}){
  const rec=dashboard?.recommendation,profile=dashboard?.profile;
  const fallback='<section class="academy-surface" data-skill-diagnostics="unavailable"><h2>個人化學習診斷</h2><p>尚無可核對的新版診斷資料；不自行推測弱點。</p></section>';
  // Adaptive returns RecoveryReport {results,remaining}, not a boolean.
  const recovery=dashboard?.pendingRecovery;
  if(!recovery||recovery.remaining!==0||!Array.isArray(recovery.results)||
     recovery.results.some(r=>r?.recovered!==true)||dashboard?.durable!==true||
     rec?.diagnosticPolicy?.version!=='observed-practice-priority/1.0.0'||
     rec.diagnosticPolicy.calibratedMastery!==false||
     rec.diagnosticPolicy.minAttempts!==5||rec.diagnosticPolicy.minUniqueQuestions!==3||
     rec.diagnosticPolicy.practiceScoreThreshold!==0.8||
     rec.calibrationStatus!==profile?.calibrationStatus||
     !Number.isFinite(Date.parse(profile?.updatedAt))||
     Date.parse(rec.generatedAsOf)!==Date.parse(profile.updatedAt)||
     !Array.isArray(rec.skillDiagnostics)||!Array.isArray(profile.skills))return fallback;
  const byId=new Map(profile.skills.map(s=>[s.tagId,s]));
  const rows=rec.skillDiagnostics,seen=new Set();
  if(rows.length!==byId.size||byId.size!==profile.skills.length)return fallback;
  for(const row of rows){
    const s=byId.get(row?.tagId);
    if(!s||seen.has(row.tagId)||!Object.hasOwn(DIAGNOSTIC_LABELS,row.status)||
       !Number.isSafeInteger(row.attempts)||row.attempts<0||row.attempts!==s.attempts||
       !(row.uniqueQuestionCount===null||Number.isSafeInteger(row.uniqueQuestionCount)&&
         row.uniqueQuestionCount>=0&&row.uniqueQuestionCount<=row.attempts)||
       !(row.observedMean===null||Number.isFinite(row.observedMean)&&row.observedMean>=0&&row.observedMean<=1)||
       row.observedMean!==s.meanScore)return fallback;
    const enough=row.attempts>=5&&row.uniqueQuestionCount>=3&&Number.isFinite(s.estimatedProficiency);
    const expected=!row.attempts?'unobserved':!enough?'insufficient-evidence':
      row.observedMean<0.8?'practice-priority':'observed-high-score';
    if(row.status!==expected)return fallback;
    seen.add(row.tagId);
  }
  const order=['practice-priority','insufficient-evidence','unobserved','observed-high-score'];
  const sorted=[...rows].sort((a,b)=>order.indexOf(a.status)-order.indexOf(b.status)||
    (a.observedMean??1)-(b.observedMean??1)||a.tagId.localeCompare(b.tagId));
  const shown=compact?sorted.slice(0,6):sorted;
  return '<section class="academy-surface" data-skill-diagnostics="verified"><h2>個人化學習診斷</h2>'+
    '<p class="academy-caption">至少 5 次作答、3 道不同題目才比較觀察分數；低於 80% 列為練習優先。未經真人校準，不代表精熟度。</p>'+
    '<div class="academy-data-table-wrap"><table class="academy-data-table"><thead><tr><th scope="col">技能</th><th scope="col">作答／不同題</th><th scope="col">觀察平均</th><th scope="col">診斷</th></tr></thead><tbody>'+
    shown.map(r=>'<tr data-diagnostic-status="'+escapeHTML(r.status)+'"><th scope="row">'+escapeHTML(r.tagId)+
      '</th><td>'+r.attempts+' 次／'+(r.uniqueQuestionCount??'—')+' 題</td><td>'+
      (r.observedMean===null?'—':pct(r.observedMean))+'</td><td>'+DIAGNOSTIC_LABELS[r.status]+'</td></tr>').join('')+
    '</tbody></table></div>'+
    (rows.length>shown.length?'<p class="academy-caption">另有 '+(rows.length-shown.length)+' 項技能，可至成長中心查看。</p>':'')+
    '</section>';
}
function todayView(b){
  const profile=b.dashboard.profile;
  const due=b.getDueItems();
  const next=b.lessons.find(x=>b.canStart(x)&&!b.progress(x).done)
    ??b.lessons.find(x=>b.canStart(x));
  const known=profile.skills.filter(x=>x.attempts>0);
  const evidences=new Set(known.flatMap(x=>x.evidenceRefs.map(ref=>ref.kind+':'+ref.id))).size;
  return head('今日訓練','使用經驗證的 LessonPublic、AbilityProfilePublic 與 ReviewPlan；不顯示固定虛擬練習目標。')
    +(b.fixtureOnly?reason('Fixture-only · 本頁學習紀錄與能力狀態僅作 UI 測試，不是正式整合。'):'')
    +'<div class="academy-metrics">'
    +'<div class="academy-metric"><strong>'+evidences+'</strong><span>有效 RecordRef 證據數</span></div>'
    +'<div class="academy-metric"><strong>'+due.length+'</strong><span>已到期、可重播複習</span></div>'
    +'<div class="academy-metric"><strong>'+b.lessons.filter(x=>b.progress(x).done).length+'/'+b.lessons.length+'</strong><span>已驗證完成課程</span></div>'
    +'<div class="academy-metric"><strong>未校準</strong><span>能力量表狀態</span></div></div>'
    +'<section class="academy-hero-card"><span class="academy-tag">CURRENT CURRICULUM</span>'
    +'<h2>'+escapeHTML(next?.titleZhTW??'沒有可開始的課程')+'</h2>'
    +(next?'<p>課程 '+escapeHTML(next.lessonId)+' · '+next.questionRefs.length+' 題（非模擬分數）</p>':'')
    +(next?button('選擇課程並開始','go-lesson','data-lesson="'+escapeHTML(next.lessonId)+'"','primary'):'')+
    '</section>'
    +renderSkillDiagnostics(b.dashboard,{compact:true})
    +'<section class="academy-surface"><h2>來自 Adaptive 的複習計畫</h2>'
    +(due.length?due.slice(0,6).map(x=>{
      const link=b.reviewLink(x);
      return '<div class="academy-queue-row"><div><strong>'+escapeHTML(x.skillTagIds.join('、')||x.questionId)+'</strong><small>'+escapeHTML(x.questionId)+' · '+date(x.dueAt)+'</small></div>'+
        (link?button('重做',link.scenario?'review-scenario':'review-question','data-lesson="'+escapeHTML(link.lessonId)+'" data-question="'+escapeHTML(link.questionId)+'" data-version="'+escapeHTML(link.questionVersion)+'"'):'<span class="academy-muted">須由正式題庫映射才能重做</span>')+'</div>';
    }).join(''):'<p>沒有到期的可重播題目，不代表能力已達標。</p>')+'</section>'
    +'<section class="academy-surface"><h2>訓練 Session</h2><p>'+
      (b.session?'來源：TrainingSession · '+escapeHTML(b.session.status??'未知狀態'):'正式 TrainingSession 尚未由 AI 6 的 Public Façade 提供；不建立假的每日課表。')+'</p></section>';
}
function growthView(b){
  const profile=b.dashboard.profile, plan=b.dashboard.reviewPlan;
  const known=profile.skills.filter(s=>s.attempts>0);
  return head('成長中心','AbilityProfilePublic 與 ReviewPlan，所有 estimatedProficiency 均為未經真人校準的估計。')
    +(b.fixtureOnly?reason('Fixture-only · 下列資料由測試 Provider 提供，非正式能力數據。'):'')
    +'<p class="academy-caption">Profile ID：'+escapeHTML(profile.profileId)+' · '+escapeHTML(profile.calibrationStatus)
    +' · 更新：'+date(profile.updatedAt)+'</p>'
    +'<section class="academy-surface"><h2>能力分項與可稽核證據</h2>'
    +(known.length?'<div class="academy-data-table-wrap"><table class="academy-data-table"><thead><tr><th scope="col">技能</th><th scope="col">作答</th><th scope="col">平均分數</th><th scope="col">未校準估計</th><th scope="col">證據數</th><th scope="col">平均耗時</th></tr></thead><tbody>'+
      known.map(x=>'<tr><th scope="row">'+escapeHTML(x.tagId)+'</th><td>'+x.attempts+'</td><td>'+pct(x.meanScore)+'</td>'+
        '<td>'+pct(x.estimatedProficiency)+'（未校準）</td><td>'+x.evidenceRefs.length+'</td><td>'+(
          Number.isFinite(x.meanDurationMs)?(x.meanDurationMs/1000).toFixed(1)+' 秒':'—')+'</td></tr>').join('')+
      '</tbody></table></div>':'<p>目前沒有有效逐題能力證據，不顯示虛構弱點或實力等級。</p>')
    +'</section>'+renderSkillDiagnostics(b.dashboard)+'<section class="academy-surface"><h2>正式複習資料</h2>'
    +'<p>ReviewPlan：'+escapeHTML(plan.planId)+' · SM-2-inspired、未經真人校準</p>'
    +'<p>已安排 '+plan.items.length+' 項，已到期且可重播 '+b.getDueItems().length+' 項。</p>'
    +'</section><section class="academy-surface"><h2>訓練 Session</h2><p>'
    +(b.session?'已取得正式 TrainingSession：'+escapeHTML(b.session.status??''):'目前 Public Façade 未提供 TrainingSession，正式 Session 整合仍待 AI 6。')+'</p></section>';
}
export function renderLiveAcademy(page,load){
  if(load.status!=='ready'){
    return head(page==='today'?'今日訓練':page==='lessons'?'規則與課程':'成長中心',
      '正式 Master Academy API 尚未合併至此 UI 分支。')
      +reason(load.status==='loading'?'正在確認來源介面…':load.reason??'來源暫不可用。')
      +'<p>目前不顯示假的課程、弱點、進步曲線或複習計畫。既有 V0.2 三題型仍可使用。</p>'
      +button('使用原有牌效率訓練','open-legacy','','primary');
  }
  const b=load.bridge;
  try {return page==='today'?todayView(b):page==='lessons'?lessonsView(b):growthView(b);}
  catch(e){return head('正式學習資料暫不可用','無法核實公開資料來源。')+reason(e.message);}
}
