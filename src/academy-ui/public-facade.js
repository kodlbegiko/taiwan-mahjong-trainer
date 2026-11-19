/**
 * Read-only Academy UI adapter for the already shipped V0.2 training pipeline.
 * The Master Academy V1 contract is not an implementation. This adapter must
 * NOT fabricate V1 Lesson / AbilityProfile / ReviewPlan / GradingResult objects.
 * All scoring and persistence remain in src/app.js -> canonical v3 functions.
 */
import { ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, V2_ARCHIVE_STORAGE_KEY, importTrainingJSON, migrateArchive, emptyArchive } from '../storage/archive.js';
import { buildReviewQueue, summarizeWeaknesses } from '../training/progress.js';

export const UI_CONTRACT_VERSION = 'master-academy/1.0.0';
export const ACADEMY_LESSONS = Object.freeze([
  Object.freeze({
    id: 'v02-discard', title: '向聽數與何切決策', level: '入門', mode: 'discard',
    prerequisites: [], skills: ['efficiency.shanten', 'efficiency.ukeire'],
    objectives: ['觀察摸牌後的 17 張手牌', '比較向聽數、進張種類與理論張數', '閱讀 canonical 拆解'],
    content: ['捨牌比較先看向聽數，再看理論有效進張數與種類。', '這是非副露的五面子一將眼結構效率；不是放槍率、台數或實戰勝率。'],
  }),
  Object.freeze({
    id: 'v02-tenpai', title: '聽牌與胡牌張辨識', level: '基礎', mode: 'tenpai',
    prerequisites: ['v02-discard'], skills: ['waits.enumeration'],
    objectives: ['理解 0 向聽', '選出全部可胡牌張', '核對漏選與誤選'],
    content: ['聽牌的有效胡牌張不同於未聽牌時的一般進張。', '評分使用 V0.2 已驗證的 Exercise / DecisionRecord v3。'],
  }),
  Object.freeze({
    id: 'v02-multi-wait', title: '多面聽完整列舉', level: '進階', mode: 'multi_wait',
    prerequisites: ['v02-tenpai'], skills: ['waits.enumeration'],
    objectives: ['避免漏掉多面聽', '確認全部 34 種候選牌', '回顧正式評分與牌型'],
    content: ['不同胡牌張可能來自不同的牌型拆解，不要只找第一種。', '多面聽測驗要求選擇完整集合，而非單選一張。'],
  }),
]);
export const TASK_NAMES = Object.freeze({discard:'何切訓練',tenpai:'聽牌判斷',multi_wait:'多面聽訓練'});
export const ERROR_NAMES = Object.freeze({
  'higher-shanten':'向聽數增加',
  'lower-ukeire':'理論有效進張較少',
  'missed-winning-tile':'漏選胡牌張',
  'false-winning-tile':'誤選胡牌張',
});
const ZONE = 'Asia/Taipei';
const clone = value => JSON.parse(JSON.stringify(value));
const taiwanDay = value => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(value));

/** Read existing versioned records without creating/updating ANY storage key. */
export function readLegacyArchive(storage) {
  if (!storage) return {archive:emptyArchive(), status:'unavailable', reason:'此裝置沒有可用的儲存空間'};
  try {
    const raw3 = storage.getItem(ARCHIVE_STORAGE_KEY);
    // A corrupt v3 key always blocks fallback: never mask damaged user data.
    if (raw3 !== null) return {archive:importTrainingJSON(raw3),status:'ok',source:'archive:v3'};
    const raw2 = storage.getItem(V2_ARCHIVE_STORAGE_KEY);
    if (raw2 !== null) return {archive:importTrainingJSON(raw2),status:'legacy',source:'archive:v2'};
    const raw1 = storage.getItem(LEGACY_SESSION_KEY);
    if (raw1 !== null) return {archive:migrateArchive(JSON.parse(raw1)),status:'legacy',source:'session:v1'};
    return {archive:emptyArchive(),status:'ok',source:'empty'};
  } catch (error) {
    return {archive:emptyArchive(),status:'error',reason:'既有紀錄讀取或驗證失敗；未更動原始資料。請先從舊版匯出或修復資料。'};
  }
}

/** Public, derived metrics only: no answerKey, private GameState or exercise snapshots. */
export function getAcademySnapshot(storage, asOf = new Date().toISOString()) {
  if (!Number.isFinite(Date.parse(asOf))) throw new TypeError('asOf 必須是有效 ISO 日期');
  const loaded = readLegacyArchive(storage);
  if (loaded.status === 'error' || loaded.status === 'unavailable') {
    return { status:loaded.status, warning:loaded.reason, lessons:ACADEMY_LESSONS,
      stats:null, today:null, review:[], recent:[], recommendation:null };
  }
  const records = loaded.archive.records.filter(r => r.schemaVersion === 3);
  const stats = summarizeWeaknesses(records);
  const recentRecords = [...records].sort((a,b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
  const localToday = taiwanDay(asOf);
  const todayRecords = records.filter(r => taiwanDay(r.timestamp) === localToday);
  const queue = buildReviewQueue(records, {asOf, includeNotDue:true});
  const accessible = new Map(loaded.archive.exercises.map(e=>[e.id,e.taskType]));
  // Records may contain validated replay snapshots even if exercises[] is incomplete.
  for (const r of records) if (!accessible.has(r.exerciseId)) accessible.set(r.exerciseId, r.taskType);
  const review = queue.map(item => ({
    exerciseId:item.exerciseId, taskType:accessible.get(item.exerciseId) ?? null,
    dueAt:item.dueAt, isDue:Date.parse(item.dueAt) <= Date.parse(asOf),
    method:'sm2-inspired', repetitions:item.repetitions,
    available:accessible.has(item.exerciseId),
  }));
  const availableModes = Object.entries(stats.byTask);
  const suggested = availableModes.length
    ? [...availableModes].sort((a,b)=>a[1].meanScore-b[1].meanScore || a[0].localeCompare(b[0]))[0][0]
    : 'discard';
  const firstDue = review.find(x=>x.isDue && x.available && TASK_NAMES[x.taskType]);
  const recommendation = firstDue
    ? {kind:'review',taskType:firstDue.taskType,exerciseId:firstDue.exerciseId,reason:'V0.2 已到期的啟發式複習（非正式 Adaptive 模型）'}
    : {kind:'practice',taskType:suggested,exerciseId:null,reason:stats.attempts ? '依目前 v3 題型平均分數較低者推薦（未校準）' : '從已驗證的 V0.2 何切訓練開始'};
  const lastFive = recentRecords.slice(0,5);
  const previousFive = recentRecords.slice(5,10);
  const sampleMean = items => items.reduce((sum,r)=>sum+r.score,0)/items.length;
  const trend = previousFive.length === 5 && lastFive.length === 5
    ? {currentMean:sampleMean(lastFive),previousMean:sampleMean(previousFive),sampleSize:5,estimated:true}
    : null;
  return {
    status:loaded.status, source:loaded.source,
    warning:loaded.status === 'legacy' ? '目前僅有舊版資料，未推導不存在的逐題能力證據。' : null,
    lessons:ACADEMY_LESSONS,
    stats:{...stats, legacyAggregateCount:loaded.archive.legacySessions.length},
    today:{date:localToday,completed:todayRecords.length,goal:3,goalBasis:'使用者介面示範目標（非自適應計畫）'},
    review, recent:recentRecords.slice(0,10).map(r=>({
      id:r.id,exerciseId:r.exerciseId,taskType:r.taskType,grade:r.grade,score:r.score,
      timestamp:r.timestamp,durationMs:r.durationMs,scoringVersion:r.scoringVersion,
      errors:clone(r.errorTypes),
    })), recommendation, trend,
    capability:{officialV3:true,academyLessons:false,verifiedScenario:false,adaptive:false},
  };
}

/**
 * Display-only PlayerView-like fixture. This is NOT produced by a verified Rules
 * Engine, has no legal moves and cannot be scored or persisted.
 */
export function getScenarioLayoutFixture() {
  const types = [0,1,2,3,4,5,6,9,10,11,18,19,20,27,27,31,33];
  const counts = new Map();
  const concealed = types.map(tileType => {
    const copyIndex = counts.get(tileType) ?? 0; counts.set(tileType,copyIndex+1);
    return {schemaVersion:1,contractVersion:UI_CONTRACT_VERSION,kind:'standard',
      id:'t:'+tileType+':'+copyIndex,tileType,copyIndex};
  });
  return clone({
    fixtureOnly:true,
    schemaVersion:1, contractVersion:UI_CONTRACT_VERSION,
    viewId:'ui-layout-only',gameId:'not-a-game',
    ruleRef:{profileId:'unverified-ui-fixture',ruleVersion:'not-applicable'},
    audienceSeat:0,asOfEventSeq:0,
    round:{handIndex:0,currentSeat:0,phase:'ui-only',dealerSeat:0},
    self:{seat:0,concealed,melds:[],river:[],flowers:[]},
    opponents:[1,2,3].map(seat=>({seat,concealedCount:16,melds:[],river:[],flowers:[]})),
    publicEvents:[],legalActions:[],knownUnavailableTypes:[],
    capabilities:{structuralScore:false,roundActions:false,settlement:false},
  });
}
