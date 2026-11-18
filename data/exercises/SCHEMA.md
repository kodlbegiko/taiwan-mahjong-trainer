# Taiwan Mahjong Trainer — V0.2 訓練資料契約

本模組採用原生 ES Modules（瀏覽器或 Node.js 20+），生成、核驗、評分、進度計算皆無需網路、登入或付費 API。

**本 PR 不修改 `src/app.js`**；因此現有 UI 仍使用 `tw-mahjong-trainer:session:v1`。新的儲存轉接器提供後續前端整合，匯入舊資料時不會自行覆寫舊 key。

## Exercise schema v2

建立：`createExercise({ seed, index, taskType, level, visibleTiles })`

| 欄位 | 意義 |
| --- | --- |
| `schemaVersion: 2` | 題目資料契約版本 |
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

注意：何切有效進張沿用舊 `rankDiscards`，目前捨出牌不會自動加入 `visibleTiles`。本版不預測實戰勝率、放槍率、家規或特殊胡法。

## DecisionRecord schema v2

`createDecisionRecord(exercise, chosen, { timestamp, durationMs, attemptId })` 的資料包含：

- `id`, `schemaVersion`, `exerciseId`, `taskType`, `timestamp`, `durationMs`
- `chosen`：何切為牌碼數字，聽牌題為去重、排序的牌碼陣列
- `grade`（perfect / acceptable / improve）、`score`（0–1）、`errorTypes`、`answerMetadata`
- `algorithmVersion`, `scoringVersion`, `exerciseSnapshot`：保存當下的完整手牌、正解、抽樣及評分依據，避免後續演算法改版污染歷史

預設 record ID 從題目、時間、耗時、選牌導出；同時刻的相同作答請傳入不同 `attemptId`，避免碰撞。錯誤分類：`higher-shanten`、`lower-ukeire`、`missed-winning-tile`、`false-winning-tile`。聽張題用集合 Jaccard 評分，完整且沒有多選才給滿分。

`summarizeWeaknesses(records)` 統計題型、錯誤類別、正確率、分數及耗時。`buildReviewQueue(records, { asOf })` 是具明確時間輸入的純資料重播；間隔排程僅是 SM-2 啟發式，**不是實測記憶或學習能力模型**。

## JSON archive v2 與資料遷移

```json
{
  "format": "taiwan-mahjong-training-archive",
  "schemaVersion": 2,
  "exercises": [],
  "records": [],
  "legacySessions": []
}
```

`importTrainingJSON()` / `exportTrainingJSON()` 核驗題目答案、紀錄評分、ID 重複和版本。未知的新版本會拒絕，不做隱式降版。V0.1 的舊 session 陣列或 `{schemaVersion:1,stats:[...]}` 將保存於 `legacySessions`，**絕不虛構當時沒有保存的牌、選擇和時間細節**。

單次 JSON 文字上限 20 MiB，每個陣列最多 10,000 筆。JSON 不執行程式碼。封存只在本機處理，未加入跨裝置同步。

`createLocalTrainingStore(localStorage)` 讀取 v2 優先；不存在時才讀舊 key；寫回只操作 v2 key。瀏覽器拒絕 localStorage 時會退到該實例記憶體，因此頁面關閉後不保證保留。

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

`public-bank-manifest-v2.json` 定義可用 `generateExerciseBank()` 重建的 **200 道題**；`tests/training-generator.test.js` 每次完整驗證其答案及 ID 唯一。`samples-v2.json` 包含可直接匯入的完整 Exercise 範例。

僅進階層使用 136 張實體牌的均勻、不放回抽樣；初階及聽牌題刻意偏向教學牌型，中階採取部分面子引導與條件篩選。**200 題是演算法驗證，不代表真人難度驗證、真實牌局抽樣或策略效能驗證。**

修改規則、牌型或演算法時須提升版本、遷移或明確拒絕舊資料；不應靜默覆寫歷史作答的完整題目快照。舊公開 API `generateHand / rankDiscards / gradeAnswer` 保持同步、同參數與回傳結構。
