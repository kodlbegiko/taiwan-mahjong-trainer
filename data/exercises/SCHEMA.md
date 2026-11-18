# Taiwan Mahjong Trainer — V0.2 訓練資料契約

本模組採用原生 ES Modules（瀏覽器或 Node.js 20+），生成、核驗、評分、進度計算皆無需網路、登入或付費 API。

**本 PR 不修改 `src/app.js`**；因此現有 UI 仍使用 `tw-mahjong-trainer:session:v1`。新的儲存轉接器提供後續前端整合，匯入舊資料時不會自行覆寫舊 key。

## Exercise schema v3（同時支援歷史 v2）

建立：`createExercise({ seed, index, taskType, level, visibleTiles })`

| 欄位 | 意義 |
| --- | --- |
| `schemaVersion: 3` | Q-002 修正後題目資料契約版本；歷史 v2 維持原版 |
| `id` | generatorVersion、seed、index、taskType、level、可見牌共同決定的穩定 ID（32-bit hash，非全域無碰撞） |
| `seed`, `index`, `generatorVersion` | 可重現種子、序號與生成器版本 |
| `ruleVersion`, `algorithmVersion` | 台灣 16 張、一般五面子一將眼；不支援副露、花牌或特殊胡法 |
| `taskType` | `discard`：17 張何切；`tenpai`：16 張聽牌；`multi_wait`：16 張至少兩種可摸得的胡牌張 |
| `sampleSource` | `uniform-136-wall` / `meld-seeded-wall-rejection` / `constructed-tenpai-plus-wall` / `constructed-tenpai` |
| `requestedLevel` | 抽樣層級，不代表人類解題難度 |
| `estimatedDifficulty` | `label`、`method`、`humanValidated: false`；**不可宣稱已經真人校準** |
| `hand`, `visibleTiles` | 0–33 牌碼，兩者合計每種不超過四張 |
| `answerRules`, `answer` | 版本化評分標準及完整、可核對的正解 |

何切 `answer.ranking` 包含每種可捨牌的 `tile / shanten / copies / kinds / draws`，按 **向聽數較少 → 理論進張張數較多** 判滿分，並列皆算最佳。進張種類數只用來排序，不改變既有 `gradeAnswer` 契約。

聽牌題 `answer.expectedTiles` 和 `answer.winningTiles: [{tile,copies}]` 記錄所有尚有剩餘牌數的胡牌張；`winningTiles()` 透過獨立的五面子一將眼遞迴判定交叉核驗，而非直接相信向聽數下降就等於胡牌。

**Q-002 已修復**：何切排序分析候選捨牌時將被棄掉的實體牌計入不可再摸牌，呼叫 `improvingDraws(hand16, [...visible, discardedTile])`。`visibleTiles` 明確僅代表原始 17 張手牌**以外**已知的實體牌；傳入的 `hand17 + visible` 先驗證不超過四張。牌碼相同不代表同一張實體牌，因此不能僅靠牌碼自動去重。本版不預測實戰勝率、放槍率、家規或特殊胡法。

## DecisionRecord schema v3（歷史 v2 原樣保留）

`createDecisionRecord(exercise, chosen, { timestamp, durationMs, attemptId })` 的資料包含：

- `id`, `schemaVersion`, `exerciseId`, `taskType`, `timestamp`, `durationMs`
- `chosen`：何切為牌碼數字，聽牌題為去重、排序的牌碼陣列
- `grade`（perfect / acceptable / improve）、`score`（0–1）、`errorTypes`、`answerMetadata`
- `algorithmVersion`, `scoringVersion`, `exerciseSnapshot`：保存當下的完整手牌、正解、抽樣及評分依據，避免後續演算法改版污染歷史

預設 record ID 從題目、時間、耗時、選牌導出；同時刻的相同作答請傳入不同 `attemptId`，避免碰撞。錯誤分類：`higher-shanten`、`lower-ukeire`、`missed-winning-tile`、`false-winning-tile`。聽張題用集合 Jaccard 評分，完整且沒有多選才給滿分。

`summarizeWeaknesses(records)` 統計題型、錯誤類別、正確率、分數及耗時。`buildReviewQueue(records, { asOf })` 是具明確時間輸入的純資料重播；間隔排程僅是 SM-2 啟發式，**不是實測記憶或學習能力模型**。

## JSON archive v3 與資料遷移

```json
{
  "format": "taiwan-mahjong-training-archive",
  "schemaVersion": 3,
  "exercises": [],
  "records": [],
  "legacySessions": []
}
```

`importTrainingJSON()` / `exportTrainingJSON()` 核驗新版本題目答案、歷史版本語意下的紀錄評分、ID 重複和版本。未知的新版本會拒絕，不做隱式降版。V0.1 的舊 session 陣列或 `{schemaVersion:1,stats:[...]}` 將保存於 `legacySessions`，**絕不虛構當時沒有保存的牌、選擇和時間細節**。

單次 JSON 文字上限 20 MiB，每個陣列最多 10,000 筆。JSON 不執行程式碼。封存只在本機處理，未加入跨裝置同步。

`createLocalTrainingStore(localStorage)` 依序讀取 `archive:v3` → `archive:v2` → `session:v1`；只寫入 `archive:v3`，不修改舊 key。瀏覽器拒絕 localStorage 時會退到該實例記憶體，因此頁面關閉後不保證保留。

### 使用

```js
import { createExercise, generateExerciseBank, validateExercise } from './src/training/exercises.js';
import { createDecisionRecord } from './src/training/records.js';
import { summarizeWeaknesses, buildReviewQueue } from './src/training/progress.js';
import { createLocalTrainingStore } from './src/storage/local.js';

const exercise = createExercise({ seed: 'demo', index: 0, taskType: 'discard', level: 'beginner' });
validateExercise(exercise);
const chosen = exercise.answer.optimalTiles[0];
const store = createLocalTrainingStore(globalThis.localStorage);
const record = store.addDecision(exercise, chosen, {
  timestamp: new Date().toISOString(), durationMs: 2500, attemptId: 'demo-1'
});
const backup = store.exportJSON();
const restored = store.importJSON(backup);
const summary = summarizeWeaknesses(restored.records);
const due = buildReviewQueue(restored.records, { asOf: new Date().toISOString() });
const bank = generateExerciseBank({ seed: 'tmt-v02-public-bank', count: 200 });
```

## 題庫分布與已知限制

`public-bank-manifest-v3.json` 定義經 Q-002 修正後的 **200 道題**；`tests/training-generator.test.js` 每次完整驗證新題庫答案、ID 唯一與 seed 重播。`samples-v3.json` 含修正後三道完整範例。原始 `public-bank-manifest-v2.json` 與 `samples-v2.json` 保留作為歷史 `efficiency-v1` 的可重建範例，不得直接改寫。

僅進階層使用 136 張實體牌的均勻、不放回抽樣；初階及聽牌題刻意偏向教學牌型，中階採取部分面子引導與條件篩選。**200 題是演算法驗證，不代表真人難度驗證、真實牌局抽樣或策略效能驗證。**

修改規則、牌型或演算法時須提升版本、遷移或明確拒絕舊資料；不應靜默覆寫歷史作答的完整題目快照。舊公開 API `generateHand / rankDiscards / gradeAnswer` 保持同步、同參數與回傳結構。

## Q-002 評分版本差異與重播

| 欄位 | 歷史版 | 修正版 |
| --- | --- | --- |
| `Exercise.schemaVersion` | 2 | 3 |
| `DecisionRecord.schemaVersion` | 2 | 3 |
| `Archive.schemaVersion` | 2 | 3 |
| `answerRules.version` / `scoringVersion` | `efficiency-v1` | `efficiency-v2` |
| `algorithmVersion` | `five-meld-one-pair-v1` | `five-meld-one-pair-v2-discard-visible` |
| 何切剩餘牌 | 不扣剛棄牌，可能高估 | 扣除剛棄掉的實體牌 |
| 題目 ID | `ex2-*` | `ex3-*`，不可互相覆寫 |
| 儲存 key | `archive:v2` | `archive:v3`，舊 key 保留 |

`generatorVersion = '2.0.0'` 維持不變：產生手牌用的 PRNG／抽樣流程沒有改；**同一個 seed 與 index 的牌可相同，但評分及 ID 依 schema 分別建立**。可明確指定 `createExercise({ seed, index, schemaVersion: 2 })` 重建歷史版題目；預設為新版 3。使用 `replayExercise(exercise)` 按題目自己的 seed、版本、索引、題型與可見明牌進行完整重播與驗證。

舊版封存只提升外層 Archive 至 v3；原本 `exercises[]`、`records[]`、`exerciseSnapshot`、`answer`、`score`、`grade`、`scoringVersion` 均不修改。舊紀錄在其**原有的 scoringVersion** 下檢驗，絕不以新的排名覆寫歷史結果。單一新 record 若刻意對舊 Exercise 作答，仍沿用原 snapshot 的 `answerRules.version`。

**跨模組資料形狀**：`src/core/efficiency.js` 的 `winningTiles` 回傳 `{tile,count}[]`；訓練 `src/training/waits.js` 的 `winningTiles`（另匯出清楚的別名 `trainingWinningTiles`）回傳 `{tile,copies}[]`。需要交換請明確使用 `trainingWaitsToCoreDraws()` 或 `coreDrawsToTrainingWaits()`，不要無意以解構同名函式覆蓋。

與 AI 2／AI 4 的整合：核心 `analyzeDiscards` 的每候選 `tile/shanten/draws/kinds/copies` 必須和 `rankDiscards` 完全一致；解說模型採 `optimal / same-shanten / higher-shanten`，UI/訓練採 `perfect / acceptable / improve`，需要顯式 enum mapping。`tests/training-core-cross.test.js` 在整合有 `src/core/efficiency.js` 的分支自動啟用；單獨 training PR 不會自行創建或修改該檔。
