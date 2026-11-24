# R7 Master Academy V1 — 課程與題庫驗證紀錄

**分支**：`feat/r7-academy-content`（base `integration/mahjong-full-game`）
**適用契約**：`master-academy/1.0.0`；題目版本 `1.0.0`
**性質**：結構題庫／教學內容稽核，不是正式對局策略或人類能力認證。

## 1. 基準與權威邊界

- 既有 20 堂課：12 `published`、8 `validated`；**R7 不自動修改狀態**。
- 100 道固定種子、可重播的原始 Exercise v3 結構題，題型為捨牌 40、聽牌 40、多面聽 20；每堂課 5 題。
- **課程目標與正式題目標籤的直接對應僅 10/20（50%）**：已發布 8/12（66.7%），尚未發布 2/8（25%）。這是根據本版 `Lesson.skillTagIds` 與五題的 `Question.skillTagIds` 交集所做的覆蓋統計，**不是學生學會的比例、難度驗證或教學品質保證**。尚未對應的課程只能提供教材，不應將現有題分數宣稱為該目標的正式能力證據。
- 真正的官方評分與作答仍由 `createDecisionRecord`、`validateDecisionRecord` 和 `tw-mahjong-trainer:archive:v3` 產生／保存。Academy provenance／Adaptive sidecar 僅保存經 canonical v3 驗證的課程映射；不可建立第二套成績權威。
- `validated` 只代表已建立可解析內容與可重播結構題的基礎，不表示具備可發布的情境策略教學、台數評分或經專家審核。
- 第 3–5 級捨牌樣本 `requestedLevel='advanced'` 是**抽樣方式**；`estimatedDifficulty` 是依向聽／聽張數推得的演算法標籤，全部 `humanValidated=false`。不能宣稱已證實屬於人類高手難度。
- 目前 100 題 `visibleTiles=[]`，僅能驗證封閉手牌上的五面子一將眼牌效；不能當作牌河、放槍風險、吃碰槓／補花、台數或真人四人局的評分證據。

`auditAcademyContent()` 逐題核對題目 ID／版本、seed／index／generator、原題重播、牌數合法性、官方 scorer 版本、所有同分最優捨牌是否都被判為 perfect，以及全部聽張是否可取得滿分；輸出 JSON-safe 的每課／每題稽核紀錄、觀測到的難度分布及失敗清單。**稽核不讀取個人作答歷史，也不產生成績或修改任何儲存。**

## 2. 20 堂課完整驗證矩陣

下表「結構來源」欄的 `5` 表示每堂課指向五個固定版本 Exercise v3 題目，**不是**該課主題已由五道專項題驗證。逐題通過與否應以當次分支 CI 的 `tests/academy/r7-content-audit.test.js` 輸出和 `auditAcademyContent().lessonRows` 為準，不得沿用舊版 CI 作為本次通過證據。

| Lesson | 課名 | 原狀態 | 結構來源 | 教學／發布驗證結果 |
| --- | --- | --- | ---: | --- |
| L1-01 | 牌種與數字索引 | published | 5 | 有文字教材，但結構題不能獨立證明牌種辨識達標 |
| L1-02 | 面子、搭子與將眼 | published | 5 | 結構題可用；缺獨立面子分類作答 rubric |
| L1-03 | 台灣十六張結構 | published | 5 | 五面子一將眼題可重播；非完整台灣桌規 |
| L1-04 | 聽牌的必要條件 | published | 5 | 聽張可由 v3 scorer 核對；過水、放槍不在範圍 |
| L2-01 | 向聽數的意義 | published | 5 | 結構捨牌題可覆核向聽；非獨立向聽數輸入測驗 |
| L2-02 | 有效進張與孤張 | published | 5 | 進張副本數可覆核；無牌牆機率資訊 |
| L2-03 | 何切的評分次序 | published | 5 | 最小向聽、最大有效進張；接受所有等分最佳解 |
| L2-04 | 單面與多面聽 | published | 5 | 聽張集合可覆核；不可據此推估真人勝率 |
| L3-01 | 拆搭選擇 | published | 5 | 結構捨牌結果可核對；缺獨立拆搭過程 rubric |
| L3-02 | 牌型變化 | published | 5 | 結構捨牌題可練習；未驗證跨巡牌型決策 |
| L3-03 | 一巡效率的精確範圍 | published | 5 | 僅當下改善張數；無兩巡後機率模型 |
| L3-04 | 接近最佳答案比較 | published | 5 | 同向聽次佳得部分分數；不將次佳等同最佳 |
| L4-01 | 牌河是已知資訊 | validated | 5 | **不發布**：需要真正包含已知牌河的合法 fixture、明牌計數審核 |
| L4-02 | 公開副露不代表暗牌已知 | validated | 5 | **不發布**：缺經驗證副露合法動作／PlayerView 題目與情境 scorer |
| L4-03 | 巡目與攻守的條件性 | validated | 5 | **不發布**：缺可驗證巡目／放槍風險模型與情境 scorer |
| L4-04 | 台數和速度不可混用評分 | validated | 5 | **不發布**：缺 verified ScoringProfile／速度台數取捨 golden fixtures |
| L5-01 | 多因素但僅限可驗證結構 | validated | 5 | **不發布**：缺多因素策略實例及 verified scenario scorer |
| L5-02 | 限時答題不等於能力認證 | validated | 5 | **不發布**：缺真人難度校準與獨立教學審稿 |
| L5-03 | 提出可重播的理由 | validated | 5 | **不發布**：缺自由表述理由的明確 rubric 及人工審核 |
| L5-04 | 綜合測驗與未知因素 | validated | 5 | **不發布**：缺真正整合的 Master Challenge／情境 scorer |

**解讀**：既有 `published` 課程仍可供學員閱讀、進行結構題練習，但其教學目標若超出正式題目 `skillTagIds`，應在課程稽核的 `unassessedObjectiveTagIds` 明列；這些技能不能被視為已有正式評分證據。若需正式驗收完整教學掌握度，仍須新增經審核的專項題與量尺，並以新版本記錄，不可覆寫舊題答案。

## 3. 題型、難度與答案多解

| 指標 | 認可的驗證方式 | 限制 |
| --- | --- | --- |
| 100 題唯一性 | seed、index、taskType、手牌及已知牌型逐題重建並檢查碰撞 | 唯一不等於題目教學品質高 |
| 捨牌多解 | 所有與最佳答案同向聽、同有效進張的牌均由正式 v3 grader 判 `perfect` | 不代表風險／台數權重下仍同分 |
| 聽牌與多面聽 | 完整合法聽張集合由 v3 重播，完整集合必得滿分 | 少選、多選依 v3 Jaccard 既定部分給分 |
| 題目難度 | 保留 `requestedLevel` 與 `estimatedDifficulty.method`，強制 `humanValidated=false` | 不可宣稱 V1 是經真人校準的難度測驗 |
| 進度／複習 | 對同一 RecordRef 重新載入／重複提交，canonical archive 僅有單一正式得分 | AbilityProfile／ReviewPlan 只是 v3 經驗證衍生物，不可自行新增事件 |

## 4. 修改範圍與自動回歸

- 新增 `src/academy/content-audit.js`，匯出 `auditAcademyContent()`。
- 新增 `src/academy/unpublished-guides.js`：針對 L4–L5 的 8 堂 validated 課程提供獨立版本的教學補充，包含核心觀念、範例推理、常見誤解及發布所需證據。其 `audience=instructor-review`、`grading=unscored`、`officialCredit=false`，**不是可計分的 8 堂課或經審核的 PlayerView 情境題**。未改寫既有 `Lesson@1.0.0`。
- **離線執行相容性**：`src/academy/content-audit.js` 與 `src/academy/unpublished-guides.js` 為獨立 QA／審稿模組，不由正式 `src/academy/index.js` 靜態匯入。Node 測試直接匯入原始檔案；避免在未更新 Service Worker precache 的情況下引入離線無法取得的新模組。
- 新增 `tests/academy/r7-content-audit.test.js`：題目來源重播、版本固定、題目公開邊界、所有等分最佳解、8 堂未發布 gate、教學補充防偽、刷新／重複提交與 canonical v3 單一計分。
- 仍需跑既有 `tests/academy/*.test.js`、`tests/adaptive/*.test.js`、`tests/integration/master-academy-learning-adaptive.test.js` 以及整套 `npm test`。
- 不修改 Table UI、Bot、Rules、Replay、Service Worker，不更新 100 題 seed，不覆寫 `LESSONS` 的既有發佈狀態，不改寫 archive:v3 或 Adaptive storage schema。

## 5. Release 判斷

**仍為 Draft / NO-GO（完整課程認證）**。本 PR 只提供可審核內容現況、測試防線及缺口；即使結構題 100/100 通過，也不能替代第 4–5 級情境題的法律動作與來源審核、真人教學驗證或正式全套計台。最新測試結果請以 PR head SHA 對應的 GitHub Actions check 為準。
