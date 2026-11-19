# Adaptive Training V1 — API、信任邊界與整合說明

契約：`docs/contracts/MASTER_ACADEMY_V1.md` / `master-academy/1.0.0`。實作僅在 `src/adaptive/**`。此模組**不是** UI/PWA；整合者負責在 `sw.js` 加入新的 import 與離線快取、在 UI 綁定介面與重跑真實裝置測試。

## 分家族的正式資料路徑

- `legacy-v3`：只有 `schemaVersion===3` 並通過現有 `validateDecisionRecord(record,{verifyAnswers:true})` 的歷史正式作答才提供新逐題能力證據。舊 schema v2 可由原本 archive 讀回，不偷偷改分，但不冒稱 v3 的新證據。
- `academy-v1`：先做 `validateAcademyRecordShape`，再**強制**由 Learning Academy 注入 `validateAcademyDecisionRecord(record,{question})===true` 的語意驗證器；它需按固定 `fixtureId`、`questionVersion`、`ruleRef`、`scorerId`、`scoringVersion` 與 `engineVersion` 重播核對 `score/grade/legalActionIds/errorTypeIds`。沒有驗證器即拒絕計分或寫入，絕不可用 `score` 欄位自身充當證據。
- `SkillTag` 由 Learning Academy 所有。`registry.skills` 嚴守 V1 定義；舊三種題型沒有原生 `skillTagIds`，只有 Learning Academy/整合者**明確確認**並注入 `registry.legacyMappings = {taskTypes:{...},errorTypes:{...}}` 時才可映射。同一 record/tag 只計一次；無映射代表「未知」，不是零能力。
- `assessmentRefs` 是另行保留的未見題集合引用，非「這次練習的分數很高」即算測驗。Profile 的 `extensions['adaptive.evidence'].skillBreakdown` 分開記錄練習/測驗嘗試與不同題數。未有真人校準時 `calibrationStatus='uncalibrated'`。在 5 次有效樣本以前 `estimatedProficiency=null`；樣本足夠時只回傳未校準平均分數及保守誤差區間，不得解讀成真正實力百分比、達到大師級或具統計因果意義的進步。
- v1 Aggregate `legacySessions` 僅計 `legacyImported` 與 `legacyAggregateCount`，不創造任一 recordRef / errorType / tag。

## 公開 API

`src/adaptive/index.js`：

| 函式 | 輸入重點 | 輸出 |
| --- | --- | --- |
| `normalizeRecordEntries(entries,{validateAcademyDecisionRecord})` | `[{kind,record,question?}]`，同 ID 必須內容完全相同 | 驗證、去重、穩定排序的不可變副本 |
| `buildAbilityProfile({records,registry,asOf,profileId,legacySessions,assessmentRefs,validateAcademyDecisionRecord})` | 所有原始合法證據；時間顯式輸入 | 合約完整 `AbilityProfile V1` |
| `applyEvidence({records,...})` | **全部**合法原始紀錄而非增量盲加 | 重新產生 AbilityProfile；修正/移除紀錄後可重建 |
| `toAbilityPublic(profile)` | AbilityProfile | 僅個人化能力摘要與證據引用 |
| `buildReviewPlan({profile,records,asOf,timezone,dailyLimit,questionCatalog,validateAcademyDecisionRecord})` | 原始記錄與可用題庫，預設 Asia/Taipei | `ReviewPlan V1`，含 dueAt、優先級及 `unavailable:*` 原因 |
| `getTodayRecommendation(profile,reviewPlan,asOf)` | 明確本地日期的 instant | 已到期且可重播的題目、未知/弱項標籤 |
| `buildAnswerableCatalog({records,questionCatalog,validateAcademyQuestion,...})` | legacy 可回放快照；Academy 須獨立驗證 question | 實際可作答且鎖定來源/種子的題目清單 |
| `planDailyTraining({profile,reviewPlan,records,questionCatalog,minutes,seed,asOf,ruleRef,...})` | minutes=10/20/30/60，預設 30 | `{session:TrainingSession V1,sections,availableQuestionCount}` |
| `transitionTrainingSession(session,status,{at,recordRefs,reason})` | 僅 planned→active→completed/aborted | 驗證合法轉移後的新 Session |
| `createAcademyStore(storage,{registry,validateAcademyDecisionRecord,profileId,timezone,migrations})` | 例如 localStorage | `load/loadStatus/persistScoredRecord/rebuild/saveSession/importJSON/exportJSON/readLegacy` |

## 整合範例

```js
import {
  createAcademyStore, planDailyTraining, getTodayRecommendation,
} from './src/adaptive/index.js';

// registry / validateAcademyDecisionRecord / validateAcademyQuestion
// 必須由 AI 3 的正式模組提供；未接入時 Academy 情境分數不得啟用。
const store = createAcademyStore(window.localStorage, {
  registry, validateAcademyDecisionRecord, timezone: 'Asia/Taipei',
});
const asOf = new Date().toISOString(); // UI 邊界只取一次，再明確傳入純函式
const status = store.loadStatus();
if (!status.ok) {
  // 呈現 errorCode；保留原 bytes，不嘗試空狀態覆蓋
} else {
  const updated = store.rebuild({ asOf, questionCatalog });
  const { abilityProfile, reviewPlan } = updated.state;
  const today = getTodayRecommendation(abilityProfile, reviewPlan, asOf);
  const { session, sections } = planDailyTraining({
    profile: abilityProfile, reviewPlan, records: validatedEntries,
    questionCatalog, validateAcademyDecisionRecord, validateAcademyQuestion,
    minutes: 30, seed: 'daily-user-seed', asOf,
    ruleRef: { profileId: 'verified-profile-id', ruleVersion: 'verified-rule-version' },
  });
  store.saveSession(session);
}
```

**舊 v3 正確寫入順序**：舊 UI 使用 `createLocalTrainingStore.addDecision` 寫原本 `archive:v3` → 讀回確認 bytes 與 record → 呼叫 `store.persistScoredRecord({kind:'legacy-v3',record},{asOf})`。若原本 API 在私密模式/Quota 中只寫入記憶體，Adaptive 會回報 `LEGACY_NOT_DURABLE`，不會捏造永久保存成功。

**Academy V1 寫入順序**：`persistScoredRecord({kind:'academy-v1',record},{asOf})` 先將 raw record 寫入唯一 sidecar key，驗證讀回，再存衍生 profile/review。第二階段失敗會回傳 `{durable:true,derivedFresh:false,errorCode}`，原始紀錄仍在，下次用 `rebuild({asOf})` 恢復；第一階段 quota/denied 拋出 `AcademyStorageError`。如果沒有 browser storage，`loadStatus().durable=false`，不能顯示「已永久保存」。`saveSession` 只接受實際已持久化的 record refs。

## 本機版本、回退與不可變來源

- **新增且唯一 sidecar**：`tw-mahjong-master-academy:state:v1`，不覆寫原 `session:v1`、`archive:v2`、`archive:v3`。未知/未授權 schema、重複 ID、JSON 損壞、quota、讀寫被封鎖皆 fail closed。
- `migrateAcademyState(input,{migrations})` 僅支援**有實際明確轉換函式的**來源 schema；目前沒有已發布的 Academy v0，絕不幻想自動遷移未知歷史格式。所有 migrator 輸出仍要通過 V1 驗證。
- Interval 使用既有 `buildReviewQueue/advanceReview` 的 SM-2-inspired 規則，轉換為 IANA 日曆日；非正式人類遺忘曲線模型。無法重播的題目不刪除，ReviewPlan 保留 reason code `unavailable:*`，今日推薦排除它們。
- `TrainingSession.questionRefs` 保持選取順序；`extensions['adaptive.plan'].orderedSources` 附每題來源、section、seed、generatorVersion、估計分鐘數。題庫不足時保留不足分鐘數，不填入不存在 Bot 對局/未評分 scenario；Session status 只有實際作答且寫入 raw record 後才能引用 recordRef。
- `QuestionPublic` / Answer Key / PlayerView 資安界線由 Learning Academy 與 UI 層維護；此 reducer 只消費分家族的受驗證作答，不處理隱藏牌。

## QA 與責任界線

`tests/adaptive/*.test.js` 驗證新使用者、v1 Aggregate、v3 舊正式作答、情境驗證注入/拒絕、去重、任意輸入順序、答案竄改、DST、重播、可用題、Session 狀態、Quota/中斷/回復、schema/JSON 錯誤以及舊 key bytes 不變。GitHub CI 必須在**本 PR 最新 HEAD** 執行 `npm run check`，通過才視為 Node 驗收；未測真人校準、iOS 實機、完整前端整合與 PWA 預覽均維持 NOT_RUN。
