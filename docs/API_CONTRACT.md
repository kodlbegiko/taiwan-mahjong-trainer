# Taiwan Mahjong Trainer — 跨模組 API Contract（提案 v0.2）

> 截止基準：2026-11-19；main `ff177b8e9dc59f3ad796f78d6dab9420ab677a7c`（v0.1）。
> 本文件區分「目前已發布的 v0.1 行為」及「候選 PR 的 v0.2 介面」。在正式合併與跨模組回歸前，候選 API **不是 main 已交付功能**。
> 相容性規則：函式名稱、參數順序、同步性、輸出欄位與異常語意必須保留；修復錯誤數值時要有版本與遷移決策。

## A. 共同牌模型與計算邊界

- 非花牌：整數 0–33（萬 0–8、筒 9–17、索 18–26、字 27–33），每種實體牌最多 4 張；不允許跨花色順子。
- 未副露：打完 16 張、摸牌後 17 張；完成一般牌型 = 五面子＋一將眼。向聽值：胡牌 `-1`、聽牌 `0`。
- `visible` / `visibleTiles`：玩家手牌**以外**已知且不可再摸的牌；不得重複納入手牌。每種 `hand+visible <= 4`。
- 捨牌後，被打出的那一張必須計入已知不可摸牌。計算單個候選：`improvingDraws(hand16, [...visible, discard])`，而非只有 `visible`。
- `copies` 是可取得的理論剩餘張數，不是摸牌機率；僅計一般結構性牌效率，不涵蓋台數、花牌、特殊胡法、過水及防守風險。
- 純函式不得更動傳入的陣列。固定 seed 的資料生成與重播須可決定性重現。

## B. v0.1 公開契約（必須保持）

| Module | API | Input | Return / Invariants |
| --- | --- | --- | --- |
| `src/tiles.js` | `toCounts(tiles)` | integer[] | Uint8Array(34), 非法牌碼或超過四張抛 RangeError |
| `src/tiles.js` | `TILE_LABELS, TILE_COUNT, tileClass(tile), sortTiles(tiles), tileLabel(tile)` | 牌碼 | 保持原導出及牌碼映射 |
| `src/shanten.js` | `shanten(tiles)` | 16 或 17 張 | number（可為 -1）；錯誤張數拒絕 |
| `src/shanten.js` | `improvingDraws(hand16, visible=[])` | 16 張＋其他已見牌 | `{shanten:number, draws:{tile:number,count:number}[], kinds:number, copies:number}` |
| `src/practice.js` | `generateHand(level='intermediate', rng=Math.random)` | level: beginner/intermediate/advanced; rng:()=>[0,1) | 排序後合法 17 張 number[] |
| `src/practice.js` | `rankDiscards(hand17, visible=[])` | 17 張＋已知其他牌 | array of `{tile,shanten,draws,kinds,copies}`, 按 shanten 升冪、copies 降冪、kinds 降冪、tile 升冪 |
| `src/practice.js` | `gradeAnswer(ranking, chosen)` | 候選排序＋所選牌 | `{grade,title,best,answer}`; grade = perfect/acceptable/improve；同 shanten & copies 為 perfect |

**重要修正（待合併）**：v0.1 的 `rankDiscards` 對「剛棄掉的牌」沒有扣除，Q-002。保持 API 形狀及呼叫方式，但 v0.2 須修正語意、加入 regression、更新評分版本及既有題庫答案，不得把新數值默默歸於舊的 `efficiency-v1`。舊 session 只有總結，不得偽造舊答案以遷移。

## C. 候選 v0.2 API 與版本（尚未發布）

| PR | Module | Proposed exports / return | 審核限制 |
| --- | --- | --- | --- |
| #1 | `src/shanten.js`, `src/core/efficiency.js` | `calculateShanten(concealed,{fixedMelds=0})`; `analyzeDraws(concealed,{visible=[],fixedMelds=0})`; `analyzeDiscards(concealed,{visible=[],fixedMelds=0})`; `winningTiles(concealed,options={})` | 保留 wrapper；`analyzeDiscards` 每個候選含棄牌計入 visible；fixedMelds 只代表結構上的已完成面子數，不等於可驗證的副露狀態 |
| #1 | `src/tiles.js` | `knownTileCounts(hand,visible=[])` | 必須檢驗所有牌加總物理上合法 |
| #3 | `src/analysis/explain.js` | `analyzeStructure(hand,{maxDecompositions=4})`; `explainDiscard(hand17,discard,{visibleTiles=[],maxDecompositions=4})`; `EXPLANATION_SCHEMA_VERSION='0.2.0'` | `decision.grade` 使用 optimal/same-shanten/higher-shanten；**不是** practice 的 perfect/acceptable/improve；必須用同一份 canonical ranking 才能顯示 |
| #5 | `src/training/random.js` | `createSeededRandom, hashSeed, randomInt, dealRandomHand`; `GENERATOR_VERSION='2.0.0'` | seed 及抽樣來源必須固定 |
| #5 | `src/training/exercises.js` | `createExercise, validateExercise, generateExerciseBank`、`EXERCISE_SCHEMA_VERSION=2`, `RULESET_VERSION='taiwan-16-standard-v1'`, `SCORING_VERSION='efficiency-v1'`, `ALGORITHM_VERSION='five-meld-one-pair-v1'` | **阻擋**：Q-002 修正後，評分規則/版本與 200 題 bank 必須同步重建／比對，不得繼續用有偏差的 `efficiency-v1` |
| #5 | `src/training/records.js` | `createDecisionRecord(exercise,choice,{durationMs,timestamp,attemptId})`; `validateDecisionRecord`; `RECORD_SCHEMA_VERSION=2` | 保存完整 exerciseSnapshot、版本、時間、選擇與評分；不以 hash 當作無碰撞 ID |
| #5 | `src/training/progress.js` | `summarizeWeaknesses`, `advanceReview`, `buildReviewQueue` | 間隔複習是啟發式，非人類能力驗證 |
| #5 | `src/storage/archive.js` / `src/storage/local.js` | `importTrainingJSON, exportTrainingJSON, validateArchive, migrateArchive, mergeArchives, createLocalTrainingStore` | `schemaVersion:2`; 拒絕未知版本；保留 `tw-mahjong-trainer:session:v1` 並存 v2 `tw-mahjong-trainer:archive:v2`；不可覆寫舊 key |
| #5 | `src/training/waits.js` | `isWinningHand, winningTiles(hand16,visibleTiles=[]), generateTenpaiHand, generateMeldSeededHand` | **名稱碰撞**：本模組 `winningTiles` 輸出 `{tile,copies}[]`，核心同名 API 輸出 `{tile,count}[]`；呼叫端必須用明確別名或適配，不可無意混用 |

## D. Canonical cross-module rules（整合時強制）

1. `rankDiscards` 是 UI、Exercise、DecisionRecord、解說的唯一候選牌順序與數值依據，修復後與 `analyzeDiscards` 的 `tile/shanten/draws/kinds/copies` 全欄位一致。
2. `gradeAnswer` 是練習成績的唯一權威；解說的 `decision.grade` 須做明確轉換或從相同 ranking 推導。不得各算各的而讓同一道題同時「最佳／非最佳」。
3. 不得把「下一摸可降向聽」混用為「可以立即胡牌」：聽牌題必須以獨立完整胡牌判定核對剩餘勝張。
4. `Exercise` 的資料 schemaVersion、generatorVersion、ruleVersion、algorithmVersion、answerRules.version 分別保存；更動分數語意時提升 scoringVersion，舊紀錄保留原 snapshot，不暗中重算舊分數。
5. 未接線的 API 不等於已上線的 UI：V0.2 若只有 local storage adapter、未由 `src/app.js` 呼叫，報告只能寫「API 可用、UI 尚未接線」。
6. 新公開 API 需附可直接 import 的範例、非法輸入測試、確定性與牌數守恆測試；任何行為變更必須在 PR 說明與 CHANGELOG 明示。

## E. Merge gates

- 原有 6 項 v0.1 測試不可退化；`npm run check` 在整合 HEAD 成功，所有新匯出需有測試。
- Q-001 four-quad 字牌例：`[27,27,27,27,28,28,28,28,29,29,29,29,30,30,30,30]` 必須是 `shanten=4`，且 golden 測試不可使用 TODO/skip。
- Q-002 棄牌可見例：`[0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28]` 捨出 `0` 時，`rankDiscards(...).copies` 必須是 `6` 而不是 `7`。
- 獨立 oracle 的 10,000 題以上固定 seed 跨模組回歸，失配不得忽略；Benchmark 紀錄同機器及 Node 版本，不跨機器硬設延遲門檻。
- 實際答題：出題 → 選牌 → 計分 → 數值/說明一致 → 下一題；手機、鍵盤、舊 localStorage 需驗收，PWA manifest 不代表離線可安裝。

## F. 2026-11-19 第二輪 API 相容與版本審查（未發布）

本文件開頭的 `ff177b8e9dc59f3ad796f78d6dab9420ab677a7c` 是建立契約時的**歷史 v0.1 基準**，不是持續變動的最新 main。此次重新讀取時 main 為 `53981149d5f632db8d8dbbf3bd11fbd0999d48e3`。

- #1 / #3 / #5 最新 head 仍分別為 `abf8b997` / `4781f136` / `1aa1746b`；沒有新的修復 commit。#4 仍為 `e1193d6f`。
- Q-001：核心 DFS 仍計算四組字牌槓子為 `2` 而非 `4`，不可使用隨機樣本的 zero mismatch 取代 golden 邊界測試。
- Q-002：`src/practice.js` 仍呼叫 `improvingDraws(hand16, visible)`，未使用 `visible + discarded`；必須保持舊 API 簽名，但修正所有 candidate 的物理張數。
- I-003：`explainDiscard` 仍自行從 `rankDiscards` 的 `draw.count` 減去棄牌，造成解說／評分獨立計算；修正 #5 後若不改此處，還有**二次扣減**風險。必須以唯一 canonical ranking 派生 `decision` 與說明。
- #5 `SCORING_VERSION='efficiency-v1'`、`ALGORITHM_VERSION='five-meld-one-pair-v1'` 未提升；修正輸出語意須明確升版並重建經驗證 200 題資料，保留舊 version 的歷史作答快照。
- `winningTiles` 仍有 `{tile,count}` 與 `{tile,copies}` 的 namespace/shape 衝突；整合呼叫端必須匯入明確別名或使用 adapter，不得誤認相容。

[隔離 CI #44358617174](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44358617174) 針對 `4f673f97a137a886d6e0b14617a42e889a59d391` 的 67 項測試顯示 3 項 P0 失敗；但固定種子 10,000 個合法 16／17 張牌的**數值級** oracle cross-check 通過。此結果只對該 SHA 有效。
