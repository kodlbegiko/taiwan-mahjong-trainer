import {getAcademySnapshot, getScenarioLayoutFixture, ACADEMY_LESSONS, TASK_NAMES, ERROR_NAMES} from './public-facade.js';
import {projectScenarioForUI, renderTileStrip} from './scenario.js';

const root = document.querySelector('#academy-root');
const nav = document.querySelector('#academy-navigation');
const PAGES = [
  ['today','今日訓練'],['training','牌效率學院'],['lessons','規則與課程'],
  ['strategy','進階策略'],['growth','成長中心'],['simulation','實戰與複盤'],
];
const gradeNames = {perfect:'完全正確',acceptable:'部分正確',improve:'需要練習'};
const safe = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = timestamp => new Date(timestamp).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const percent = n => Number.isFinite(n) ? Math.round(100*n)+'%' : '—';
// Public deep link used for legacy regression and for bookmarks to the canonical trainer.
let page = new URLSearchParams(window.location.search).get('academy') === 'training' ? 'training' : 'today';
let lessonId = ACADEMY_LESSONS[0].id;

function storage() { try { return window.localStorage; } catch { return null; } }
function snapshot() { return getAcademySnapshot(storage()); }
function title(name, eyebrow, description='') {
  return '<header class="academy-page-head"><p class="academy-overline">'+safe(eyebrow)+'</p><h1 tabindex="-1" id="academy-page-heading">'+safe(name)+'</h1>'
    + (description ? '<p>'+safe(description)+'</p>' : '') + '</header>';
}
function actionButton(name, action, props='', style='primary') {
  return '<button type="button" class="'+style+' academy-action" data-action="'+safe(action)+'" '+props+'>'+safe(name)+'</button>';
}
function empty(message) { return '<p class="academy-empty">'+safe(message)+'</p>'; }
function stateBanner(data) {
  return data.warning ? '<p class="academy-alert" role="status">'+safe(data.warning)+'</p>' : '';
}
function metric(number,label,description='') {
  return '<div class="academy-metric"><strong>'+safe(number)+'</strong><span>'+safe(label)+'</span>'
    +(description?'<small>'+safe(description)+'</small>':'')+'</div>';
}
function dueList(data, compact=false) {
  const items = data.review.filter(x=>x.isDue);
  if (!items.length) return empty('目前沒有已到期的 V0.2 複習題；新紀錄才會產生複習排程。');
  return '<div class="academy-stack">'+items.slice(0,compact?3:12).map(item=>'<article class="academy-queue-row"><div><strong>'
    +safe(TASK_NAMES[item.taskType]??'無法辨識的題型')+'</strong><small>到期 '+safe(fmt(item.dueAt))+' · SM-2-inspired（未校準）</small></div>'
    +(item.available && TASK_NAMES[item.taskType] ? actionButton('重做原題','review','data-id="'+encodeURIComponent(item.exerciseId)+'" data-task="'+safe(item.taskType)+'"','secondary') : '<span class="academy-muted">題目快照不可用</span>')+'</article>').join('')+'</div>'
    +(items.length>(compact?3:12)?'<p class="academy-muted">另有 '+(items.length-(compact?3:12))+' 題到期。</p>':'');
}
function todayView(data) {
  if (!data.stats) return title('今日訓練','TODAY / LOCAL')+stateBanner(data)+empty('無法安全載入紀錄。既有何切、聽牌與多面聽仍可在牌效率學院使用。')
    +actionButton('進入牌效率學院','page','data-page="training"');
  const rec = data.recommendation;
  return title('今天，練出更好的判斷','TODAY / 本機訓練',
    '建議內容只根據已驗證的 V0.2 作答統計；沒有正式自適應引擎時，不宣稱是個人化能力預測。')
    +stateBanner(data)
    +'<div class="academy-metrics">'
    +metric(data.today.completed+' / '+data.today.goal,'今日完成 / 自訂示範目標','台灣時間 '+data.today.date)
    +metric(String(data.review.filter(r=>r.isDue).length),'待複習題目','V0.2 啟發式排程')
    +metric(String(data.stats.attempts),'可驗證 v3 作答','舊 v1 匯總不列入')
    +metric(data.stats.attempts?percent(data.stats.perfectRate):'—','完整答對率','歷史已作答題型')
    +'</div><div class="academy-feature-grid"><article class="academy-hero-card"><span class="academy-tag">TODAY’S PICK · '+safe(rec.kind==='review'?'已到期複習':'可用正式訓練')+'</span>'
    +'<h2>'+safe(TASK_NAMES[rec.taskType])+'</h2><p>'+safe(rec.reason)+'</p>'
    +actionButton(rec.kind==='review'?'重新挑戰原題':'開始今日訓練','launch','data-task="'+safe(rec.taskType)+'"'+(rec.exerciseId?' data-id="'+encodeURIComponent(rec.exerciseId)+'"':''))
    +'</article><article class="academy-info-card"><span class="academy-tag">RECENT EVIDENCE</span><h2>近期表現</h2>'
    +(data.trend?'<p>最近 5 題平均得分 '+percent(data.trend.currentMean)+'；前 5 題 '+percent(data.trend.previousMean)+'。</p><small>僅為各種題型混合樣本的描述統計，不代表能力提升或顯著差異。</small>'
    :'<p>目前可比較的完整 v3 題數不足 10 題，暫不產生進步曲線。</p>')
    +'</article></div><div class="academy-two-col"><section class="academy-surface"><div class="academy-section-title"><h2>到期複習</h2><button class="academy-text-link" data-action="page" data-page="growth" type="button">所有證據與進度</button></div>'
    +dueList(data,true)+'</section><section class="academy-surface"><h2>需要多練的題型</h2>'
    +(Object.keys(data.stats.byTask).length ? Object.entries(data.stats.byTask).sort((a,b)=>a[1].meanScore-b[1].meanScore)
      .map(([mode,row])=>'<div class="academy-skill-row"><span>'+safe(TASK_NAMES[mode])+'</span><strong>'+safe(percent(row.meanScore))+'</strong><small>'+row.attempts+' 題 · 平均分數，非校準能力</small></div>').join('')
      :empty('尚無逐題紀錄。完成第一題後顯示不同題型的實際作答分數。'))+'</section></div>';
}
function trainingView() {
  return title('牌效率學院','V0.2 / CANONICAL TRAINING',
    '下方沿用原本三題型、正式評分、可解說的歷史紀錄及匯出機制。請從訓練模式選題。')
    +'<div class="academy-course-grid">'+ACADEMY_LESSONS.map((l,i)=>'<article class="academy-course-card"><span class="academy-tag">0'+(i+1)+' · '+safe(l.level)+'</span><h2>'+safe(TASK_NAMES[l.mode])+'</h2><p>'+safe(l.objectives[0])+'</p>'
      +actionButton('進入'+TASK_NAMES[l.mode],'launch','data-task="'+safe(l.mode)+'"','secondary')+'</article>').join('')+'</div>';
}
function lessonsView() {
  const current = ACADEMY_LESSONS.find(x=>x.id===lessonId)??ACADEMY_LESSONS[0];
  return title('規則與課程','COURSE / V0.2 GUIDE','目前提供對應既有正式題型的教學導讀；Master Academy V1 正式 Lesson 題庫尚未接入。')
    +'<div class="academy-course-layout"><div class="academy-stack" aria-label="課程目錄">'+ACADEMY_LESSONS.map((l,i)=>'<button type="button" class="academy-lesson-pick" data-action="lesson" data-id="'+safe(l.id)+'" aria-pressed="'+(l.id===current.id?'true':'false')+'"><span>0'+(i+1)+' · '+safe(l.level)+'</span><strong>'+safe(l.title)+'</strong><small>'+safe(l.prerequisites.length?'建議先修：'+l.prerequisites.map(id=>ACADEMY_LESSONS.find(x=>x.id===id)?.title??id).join('、'):'無建議先修')+'</small></button>').join('')+'</div>'
    +'<article class="academy-surface academy-lesson-detail"><span class="academy-tag">導讀 · 非正式 V1 Lesson</span><h2>'+safe(current.title)+'</h2>'
    +'<h3>學習目標</h3><ul>'+current.objectives.map(x=>'<li>'+safe(x)+'</li>').join('')+'</ul><h3>教學重點</h3>'
    +current.content.map(x=>'<p>'+safe(x)+'</p>').join('')
    +'<p class="academy-caption">證據來源：現有 V0.2 canonical Exercise v3 / efficiency-v2；不延伸到未驗證的完整四人台麻桌規。</p>'
    +actionButton('開始正式題型練習','launch','data-task="'+safe(current.mode)+'"')+'</article></div>';
}
function strategyView() {
  const fixture = projectScenarioForUI(getScenarioLayoutFixture());
  return title('進階策略訓練','SCENARIO / PREVIEW ONLY',
    '四人情境必須來自 Rule Engine 驗證的 PlayerView。本頁目前僅有標示 Fixture-only 的版型示例，不提供合法操作或計分。')
    +'<p class="academy-alert">Fixture-only · 非正式牌局；沒有 verified scorer，不能提交情境作答、保存 AcademyDecisionRecord 或計算能力。</p>'
    +'<div class="academy-table-preview" aria-label="四人牌桌情境介面示例">'
    +'<div class="academy-seat academy-seat-top">對家 <strong>暗牌 '+fixture.seats[2].concealedCount+' 張（僅計數）</strong><small>牌河及公開副露：無</small></div>'
    +'<div class="academy-table-middle"><div class="academy-seat">上家<strong>暗牌 '+fixture.seats[3].concealedCount+' 張</strong><small>公開花牌：0</small></div>'
    +'<div class="academy-table-felt"><span>玩家視角</span><strong>巡目 / 回合：未驗證</strong><small>合法動作：未開放</small></div>'
    +'<div class="academy-seat">下家<strong>暗牌 '+fixture.seats[1].concealedCount+' 張</strong><small>公開副露：0</small></div></div>'
    +'<div class="academy-self-seat"><strong>自己的牌 · 17 張版型測試</strong><div class="academy-mini-hand" role="group" aria-label="測試用 17 張牌面">'+renderTileStrip(fixture.hand)+'</div><small>僅用原創 SVG 展示；未經合法牌局引擎驗證。</small></div></div>'
    +'<div class="academy-surface"><h2>正式開放條件</h2><p>等待經 Rule Engine 驗證的 PlayerView、精確 legalActions 與對應的 GradingResult。任何未驗證策略估計都不得冒充確定答案。</p></div>';
}
function growthView(data) {
  if(!data.stats) return title('成長中心','EVIDENCE / LOCAL')+stateBanner(data);
  const stats = data.stats;
  return title('成長中心','EVIDENCE / VERIFIED V0.2',
    '僅展示已保存並通過驗證的 v3 題目統計與作答證據。能力精熟度、策略勝率及正式 Adaptive ReviewPlan 尚未開放。')
    +stateBanner(data)+'<div class="academy-metrics">'+metric(stats.attempts,'完整 v3 作答')
    +metric(stats.attempts?percent(stats.meanScore):'—','歷史平均得分','非能力估計')
    +metric(stats.attempts?(stats.meanDurationMs/1000).toFixed(1)+'s':'—','平均作答時間')
    +metric(stats.legacyAggregateCount,'舊版 v1 統計','沒有逐題證據')
    +'</div><section class="academy-surface"><h2>各題型證據</h2><div class="academy-data-table-wrap"><table class="academy-data-table"><thead><tr><th scope="col">題型</th><th scope="col">題數</th><th scope="col">完整答對</th><th scope="col">平均得分</th><th scope="col">平均秒數</th></tr></thead><tbody>'
    +Object.entries(stats.byTask).map(([mode,v])=>'<tr><th scope="row">'+safe(TASK_NAMES[mode])+'</th><td>'+v.attempts+'</td><td>'+percent(v.perfectRate)+'</td><td>'+percent(v.meanScore)+'</td><td>'+(v.meanDurationMs/1000).toFixed(1)+'</td></tr>').join('')
    +(!Object.keys(stats.byTask).length?'<tr><td colspan="5">目前沒有逐題資料</td></tr>':'')
    +'</tbody></table></div><p class="academy-caption">能力精熟度：未校準／無資料；不依答對率推導「大師級」。</p></section>'
    +'<div class="academy-two-col"><section class="academy-surface"><h2>錯誤型態（正式 v3 紀錄）</h2>'
    +(Object.entries(stats.byError).length?Object.entries(stats.byError).map(([err,count])=>'<div class="academy-skill-row"><span>'+safe(ERROR_NAMES[err]??err)+'</span><strong>'+count+' 次</strong></div>').join(''):empty('尚無錯誤分類紀錄'))
    +'</section><section class="academy-surface"><h2>待複習隊列</h2><p class="academy-caption">V0.2 buildReviewQueue；SM-2-inspired，並非正式 Adaptive ReviewPlan。只對有原題快照的題目提供重做。</p>'+dueList(data)+'</section></div>'
    +'<section class="academy-surface"><h2>最近作答（可檢查來源）</h2>'
    +(data.recent.length?'<div class="academy-stack">'+data.recent.map(r=>'<article class="academy-history-entry"><strong>'+safe(TASK_NAMES[r.taskType])+' · '+safe(gradeNames[r.grade])+'</strong><small>'+safe(fmt(r.timestamp))+' · '+Math.round(r.durationMs/1000)+' 秒 · v3 / '+safe(r.scoringVersion)+'</small><p>評分 '+percent(r.score)+(r.errors.length?' · '+r.errors.map(e=>safe(ERROR_NAMES[e]??e)).join('、'):'')+'</p></article>').join('')+'</div>':empty('尚無紀錄；完成正式訓練後出現'))
    +'</section>';
}
function simulationView() {
  return title('實戰模擬與複盤','ROADMAP / NOT ENABLED','完整四人對局、Bot、計台與逐巡複盤尚未通過規則驗證。')
    +'<div class="academy-unavailable"><h2>目前未開放實戰模式</h2><p>不生成虛假的四人對局、不提供沒有依據的勝率，也不將情境題寫入舊 v3 封存。</p>'
    +actionButton('查看情境牌桌版型','page','data-page="strategy"','secondary')+'</div>';
}
function renderNavigation() {
  nav.innerHTML = PAGES.map(([id,text],i)=>'<button type="button" data-academy-nav="'+id+'" aria-current="'+(id===page?'page':'false')+'" class="academy-nav-link'+(id===page?' active':'')+'"><span aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span>'+text+'</button>').join('');
}
function render() {
  if(!root || !nav) return;
  document.body.dataset.academyPage = page;
  renderNavigation();
  const data = snapshot();
  root.innerHTML = page==='today'?todayView(data):page==='training'?trainingView()
    :page==='lessons'?lessonsView():page==='strategy'?strategyView()
    :page==='growth'?growthView(data):simulationView();
}
function show(next, focus=true) {
  if (!PAGES.some(p=>p[0]===next)) return;
  page=next; render();
  if (focus) {
    document.querySelector('#academy-page-heading')?.focus({preventScroll:true});
    document.querySelector('#academy-navigation')?.scrollIntoView({block:'start'});
  }
}
function launch(mode,id=null) {
  if(!TASK_NAMES[mode]) return;
  page='training'; render();
  window.dispatchEvent(new CustomEvent('academy:open-legacy',{detail:{taskType:mode,...(id?{exerciseId:id}:{})}}));
  document.querySelector('#practice')?.scrollIntoView({block:'start'});
}
nav?.addEventListener('click',event=>{
  const button=event.target.closest('button[data-academy-nav]');
  if (button) show(button.dataset.academyNav);
});
root?.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if(!button) return;
  if(button.dataset.action==='page') show(button.dataset.page);
  if(button.dataset.action==='lesson') {lessonId=button.dataset.id;show('lessons',false);}
  if(button.dataset.action==='launch') launch(button.dataset.task,button.dataset.id?decodeURIComponent(button.dataset.id):null);
  if(button.dataset.action==='review') launch(button.dataset.task,decodeURIComponent(button.dataset.id));
});
window.addEventListener('academy:legacy-changed',()=>render());
window.addEventListener('storage',event=>{
  if(['tw-mahjong-trainer:archive:v3','tw-mahjong-trainer:archive:v2','tw-mahjong-trainer:session:v1'].includes(event.key)) render();
});
if(root&&nav) render();
