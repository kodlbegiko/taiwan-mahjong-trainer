/**
 * Versioned, unscored lesson supplements for the eight not-yet-published
 * upper-level lessons. These are explanations, NOT verified scenarios,
 * lawful game-action fixtures, grading keys or learner achievement evidence.
 *
 * Kept separate from legacy Lesson@1.0.0 to avoid changing the content
 * referenced by already-durable Academy/v3 provenance snapshots.
 */
import { LESSONS } from './lessons.js';

export const LESSON_GUIDE_VERSION = 'academy-unpublished-guides/1.0.0';
const topics = [
  {
    id:'academy-l4-01',
    concept:'牌河、自己手牌與已公開副露只能提供可觀測的牌種副本數；未知副本的位置仍未知。',
    workedReasoning:'假設某張牌在自己的手牌出現 1 張，公開牌河出現 2 張，則在標準四張副本模型下，最多只剩 1 張未被觀測到。不能推論那一張一定在牌牆，也不能推論對手必然持有。',
    commonMistake:'把「未看到」誤寫成「牌牆裡還有」，或從對手暗牌／未公開牌牆推導已知張數。',
    acceptanceEvidence:'需要含真正牌河、已知副露與觀測時序的 PlayerView golden fixtures，逐一檢查可見性和物理副本守恆。'
  },
  {
    id:'academy-l4-02',
    concept:'公開副露只揭露副露內容，不會揭露其餘暗牌。能否吃碰槓也必須取決於當下合法動作清單。',
    workedReasoning:'即使看見對手公開的一組刻子，仍不能把他未展示的手牌列入牌種計數；不能僅從三張相同牌就推斷任何座位現在都能碰牌。',
    commonMistake:'把公開副露與對手完整暗牌混為一談，或以常識取代 Rules Engine 的合法動作判定。',
    acceptanceEvidence:'需要正式 RuleProfile 與 PlayerView 的吃碰槓合法動作 golden fixtures，並確保未知暗牌不會洩漏。'
  },
  {
    id:'academy-l4-03',
    concept:'隨巡目變化的攻守決策需要分開檢查已知結構牌效與未校準的放槍風險。',
    workedReasoning:'同樣一張切牌，即使向聽與有效進張不變，對手已公開的牌河、副露及局面條件可能不同；若沒有 verified 風險模型，應保留「未知」，不能輸出放槍百分比。',
    commonMistake:'用單一有效進張大小直接宣稱此時「安全」，或把 AI 推測寫成已知事實。',
    acceptanceEvidence:'需要明確版本的合法時序情境、可重播決策基準及經審核風險 rubric。'
  },
  {
    id:'academy-l4-04',
    concept:'結構牌效率與台數／輸贏效益是不同目標；沒有確定的計分規則就不能相加比較。',
    workedReasoning:'兩個選項可能一個較快接近聽牌，另一個在某種家規下有潛在台數，但在 ScoringProfile、和牌機率與局面沒有定義前，只能列出條件，不可給出唯一的綜合最佳答案。',
    commonMistake:'把「最高有效進張」等同「預期得分最高」，或把某一家規台型套用到所有台灣十六張玩法。',
    acceptanceEvidence:'需要經引用核對的版本化 ScoringProfile、結算 golden fixtures 與明示效用模型。'
  },
  {
    id:'academy-l5-01',
    concept:'把可精確重播的封閉手牌數據，與只能在給定情境或模型中估計的策略判斷分欄紀錄。',
    workedReasoning:'可精確核對捨牌後的向聽與有效進張；但對手動機、牌壁位置、放槍率和台數效益都需要額外可驗證來源，不能混進同一個「精確分數」。',
    commonMistake:'因多個數字一起顯示，就假設整個多因素模型已被驗證。',
    acceptanceEvidence:'需要獨立的多因素案例審稿、可觀測 PlayerView 與版控 scorer。'
  },
  {
    id:'academy-l5-02',
    concept:'答題速度可以作為練習節奏資訊，但沒有經驗研究就不是麻將實力或高手等級的測量。',
    workedReasoning:'同一個人更快完成結構題，可能是熟悉題型、介面或記憶原題；要證明技巧進步需控制題目重複、難度與獨立評估，而不只是縮短毫秒數。',
    commonMistake:'把三種生成抽樣層級或計時成績，直接改寫成人類能力分級。',
    acceptanceEvidence:'需要獨立題目集、難度校準、學習成效測量設計與人工教學審核。'
  },
  {
    id:'academy-l5-03',
    concept:'可重播的理由應有可核查的原題、版本、牌面與評分依據；無法核查的推測須標示假設。',
    workedReasoning:'完整理由應區分「原題 seed／版本」、「合法手牌」、「最佳向聽和進張」、「所選牌的差距」；若推測對手有特定暗牌，必須明寫只是情境假設。',
    commonMistake:'只寫「這樣比較好」或引用不存在的對手資訊，卻聲稱理由已經實證。',
    acceptanceEvidence:'需要針對自由表述解說的可重播 rubric、人工覆核及可追溯的題目版本。'
  },
  {
    id:'academy-l5-04',
    concept:'綜合測驗應把來源可追溯、結構計算、情境條件與未知因子都列出，而非把所有觀念綁成單一假分數。',
    workedReasoning:'在規則和題目狀態只支援封閉手牌時，正式可評的是結構答案；涉及副露、計台或放槍的假設只能作為未計分的討論。',
    commonMistake:'一個結構題答對，就宣稱已通過四人麻將攻守與台數綜合實戰認證。',
    acceptanceEvidence:'需要完整且可觀測的多人局 PlayerView、合法動作、評分 golden cases 以及獨立綜合 rubric。'
  }
];

export const UNPUBLISHED_LESSON_GUIDES=Object.freeze(topics.map(t=>Object.freeze({
  guideVersion:LESSON_GUIDE_VERSION,
  lessonRef:Object.freeze({lessonId:t.id,lessonVersion:'1.0.0'}),
  audience:'instructor-review',
  grading:'unscored',
  officialCredit:false,
  sourceScope:'conceptual-supplement-only',
  concept:t.concept,
  workedReasoning:t.workedReasoning,
  commonMistake:t.commonMistake,
  acceptanceEvidence:t.acceptanceEvidence
})));

const clone=x=>JSON.parse(JSON.stringify(x));
export function getUnpublishedLessonGuide(lessonId) {
  const guide=UNPUBLISHED_LESSON_GUIDES.find(x=>x.lessonRef.lessonId===lessonId);
  return guide?clone(guide):null;
}
export function validateUnpublishedLessonGuides(guides=UNPUBLISHED_LESSON_GUIDES,lessons=LESSONS) {
  if(!Array.isArray(guides)||!Array.isArray(lessons))throw new TypeError('Lesson guides must be arrays');
  const seen=new Set();
  for(const guide of guides) {
    const id=guide?.lessonRef?.lessonId;
    const lesson=lessons.find(x=>x.lessonId===id &&
      x.lessonVersion===guide.lessonRef.lessonVersion);
    if(!id||seen.has(id)||!lesson||lesson.status!=='validated'||
       guide.guideVersion!==LESSON_GUIDE_VERSION ||
       guide.audience!=='instructor-review' || guide.grading!=='unscored' ||
       guide.officialCredit!==false || guide.sourceScope!=='conceptual-supplement-only'||
       ['concept','workedReasoning','commonMistake','acceptanceEvidence']
         .some(k=>typeof guide[k]!=='string'||guide[k].length<25))
      throw new RangeError('Unpublished guide has false evidence, stale source or missing content');
    seen.add(id);
  }
  if(seen.size!==lessons.filter(x=>x.status==='validated').length)
    throw new RangeError('Not all validated lessons have reviewed guide drafts');
  return true;
}
