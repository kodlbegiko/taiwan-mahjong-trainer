# Taiwan Mahjong Master Academy — 整合與品質報告

> **Phase 0 基線稽核｜2026-11-19（Asia/Taipei）｜MASTER ACADEMY 尚未整合完成。**
> 契約 `master-academy/1.0.0` 已經由 [PR #32](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/32) 合併。這是具有精確 GitHub 證據的階段快照，不是最終產品驗收或 v0.2.0 發布授權。完整契約：[MASTER_ACADEMY_V1.md](../contracts/MASTER_ACADEMY_V1.md)，依賴圖：[MASTER_ACADEMY_ARCHITECTURE.md](../MASTER_ACADEMY_ARCHITECTURE.md)。

> **最新狀態請優先看第 11 節。** 五個來源 PR 均已建立；本報告前述「來源尚未出現」僅代表 Phase 0 歷史快照，不是目前事實。

## 1. 最新 GitHub 主線與版本界線

| 項目 | 觀察值與證據 |
| --- | --- |
| 合約合併後 main SHA | `25870862b6499f7e699967aa76429ae5dcfc5db4` |
| 契約來源 PR #32 | source `c0e98afeda1182ae3b4fa04293a0448acf64675f`；[Verify #44499266060](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44499266060) SUCCESS；review finding 修正並解決後由 Required CI 合併 |
| main 保護 | `main.protected=true`；`Protect main` Active Ruleset ID `27611325`；強制 PR、對話解決、GitHub Actions `test` check、禁止 force push/刪除，無 bypass；[Issue #13](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/13) 已關閉 |
| 版本與正式 Release | `package.json.version=0.1.0`，GitHub Releases 目前為空；`v0.2.0` 未發布 |
| 未完成的 V0.2 驗收 | [Issue #12](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/12) OPEN。使用者選擇暫緩實機 iPhone/Android／VoiceOver/TalkBack，狀態 **NOT_RUN** |
| V0.2 預覽分支 | [Draft PR #26](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/26)，其 `SOURCE_SHA` 固定在舊 V0.2 應用快照，**不改成 Academy** |
| 已部署的預覽 | https://kodlbegiko.github.io/taiwan-mahjong-trainer/ ，經 [Pages #44494372699](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44494372699) 實際公開 HTTPS、SVG、manifest、SW 與離線測試；當時應用來源 `5e692fd9bce18ff6a947cd7f2045e8425b8fe63b`、`release:false`。**它不是 Academy 預覽站** |

以上資料是稽核時的查詢結果，後續來源 PR 合併前須刷新所有 SHA、CI 與 Ruleset，不把歷史報告當當前主線。

## 2. 五個來源 PR／模組交付狀態

| 模組 | 預定分支 | 實際 PR | 狀態與驗證 |
| --- | --- | --- | --- |
| Rules Engine | `feat/mahjong-rule-engine` | **尚無** | **NOT_STARTED**；無 RuleProfile/GameState/PlayerView/LegalAction 可執行來源模組或測試 |
| Advanced Strategy | `feat/advanced-strategy-training` | **尚無** | **NOT_STARTED**；無 StrategyAnalysis 或反暗牌洩漏證據 |
| Learning Academy | `feat/mahjong-learning-academy` | **尚無** | **NOT_STARTED**；無 Lesson／AcademyQuestion／正式可評分的新題庫 |
| Adaptive Training | `feat/adaptive-training` | **尚無** | **NOT_STARTED**；無 AbilityProfile/ReviewPlan/TrainingSession 新模組實作 |
| Academy UI | `feat/mahjong-academy-ui` | **尚無** | **NOT_STARTED**；無學院版 12 步使用者學習閉環 |
| 共用契約／架構 | `docs/master-academy-v1-contract` | **#32 MERGED** | **PHASE_0_COMPLETE**，16 個資料物件及單向依賴。**文件不是 runtime implementation** |
| 隔離整合 | `integration/mahjong-academy` | 本報告專用 Draft 整合 PR | **BASELINE_ONLY**；尚未引入上述五個功能 |

原 V0.2 的 34 SVG／何切／聽牌／多面聽已存在，**不可冒充五個新 Academy 模組**。若來源 AI 提交不同介面，先在來源 PR 以欄位對照與契約 amendment 協調；不可用整合分支擅改其他 AI 的私有檔案。

## 3. 共同契約與實質修復

[Phase 0 Contract](../contracts/MASTER_ACADEMY_V1.md) 依 owner／schema V1／必填與可選欄位／型別／JSON 序列化／驗證／相容性／資訊可見性定義：

`RuleProfile`、`TileIdentity`、`GameState`、`RoundState`、`PlayerView`、`LegalAction`、`TurnEvent`、`StrategyAnalysis`、`Lesson`、`AcademyQuestion`、`SkillTag`、`ErrorType`、`AbilityProfile`、`ReviewPlan`、`TrainingSession`，以及審查後補強的 `AcademyDecisionRecord`。

- 既有牌種 **0–33** 仍為相同數值；完整實體 ID 採 `t:<type>:<copy>`；花牌使用獨立 `f:<code>:<copy>`，不得進舊 34 SVG／向聽計算。
- 僅 Rules Engine 有完整 `GameState`；Strategy、Lesson 公開題目與 UI 只可拿經時間序 allowlist 投影的 `PlayerView`，不得讀暗牌、壁牌與未來事件。
- `RuleProfile` 未驗證時不能冒充通用台灣麻將桌規：計台、補花、過水、自摸放槍、吃碰槓優先權等須有 rule fixture 與驗證證據。
- 結構 `shanten`／已知牌數等精確結果與 `heuristic`／`estimated`／`unknown` 策略評估不可混為精確勝率。未知時不得捏造百分比。
- **審查缺陷已解決**：既有 `createDecisionRecord` v3 只支援 `discard/tenpai/multi_wait`，不能用來存 `scenario`。新增獨立 `AcademyDecisionRecord V1`／`RecordRef={kind:"legacy-v3"|"academy-v1",id}`／對應 validator 和 sidecar，還沒 verified scorer 的情境題必須 `unscorable`，不能更新能力。
- 新的 AbilityProfile、ReviewPlan 只由合法已持久化的紀錄以**冪等** reducer 產生；不得偽造舊 v1 資料，`archive:v3` 與 `session:v1` 原始資料不改寫。

這些目前只是契約審查已通過；來源模組的正式 validators、scorer／資料持久化 **尚未實作驗證**。

## 4. 基線功能及本輪可操作程度

**既有可操作基線**：三個正式練習模式（何切、聽牌、多面聽）、canonical `rankDiscards/gradeAnswer/explainDiscard`、全候選並列最佳、v3 `DecisionRecord`／舊 `localStorage` 相容、34 張獨立 SVG、目前 `sw.js` `CACHE_VERSION='tmt-v02-realistic-tiles-20261119-r1'`、實際 GitHub Pages 預覽及 Chrome 離線驗證。

**仍不存在的新 Academy 閉環**：

| 玩家流程 | 截至 Phase 0 |
| --- | --- |
| 開站／載入個人紀錄 | V0.2 已可；Academy sidecar 尚未接線 |
| 今日建議訓練 | **NOT_IMPLEMENTED** |
| 選課／新題型／合法重播情境題 | 舊三題型可用；Lesson/AcademyQuestion **NOT_IMPLEMENTED** |
| 作答／官方規則評分／策略解說 | 既有結構牌效可用；完整四人規則與 scenario 不能稱已完成 |
| 寫入完整新情境紀錄 | **NOT_IMPLEMENTED**；不得將情境題塞入 v3 |
| 更新弱點／安排複習 | 舊 progress 純函式存在；Academy 自適應流程 **NOT_IMPLEMENTED** |
| 顯示能力變化／證據可追溯 | **NOT_IMPLEMENTED**，不得宣稱已校準真人大師級能力 |

無完整情境題和能力模型時，**絕不可將靜態首頁視為已完成 12 步閉環**。

## 5. 最新自動化證據與尚未執行的測試

| 類型 | SHA／Workflow | 判定 |
| --- | --- | --- |
| `npm run check` / Verify | [main #44499594721](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44499594721)，`25870862b6499f7e699967aa76429ae5dcfc5db4` | **PASS：104 tests／103 pass／0 fail／0 TODO／1 選擇性 skipped** |
| 必要 Golden 和雙 10,000 題獨立數值 Oracle | 同一 main Verify 日誌，包含 Q-001/Q-002/I-003、`required: 10,000`、`integration: 10,000` | **PASS；不可把 skipped stress 算已執行** |
| 34 張 SVG／真 Chromium 尺寸／PWA | [main Tile QA #44499594706](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44499594706)，同 SHA | **PASS** |
| 獨立 UI/PWA | [main Independent #44499594563](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44499594563)，同 SHA | **PASS**：Node API/Golden/P0 和真 Chrome UI+離線 PWA jobs 均 SUCCESS，1440px/390px、離線新分頁、作答、持久化、SW 更新 |
| Rules/Strategy/Learning/Adaptive/Academy UI 專屬新測試 | 尚無來源 code | **NOT_RUN**，不能引用舊三模式 CI 冒充 |
| Academy cross-module browser/offline | 未整合新功能，亦無新版 Academy URL | **NOT_RUN** |
| iPhone Safari／Android Chrome 實機、VoiceOver／TalkBack | [Issue #12](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/12) | **NOT_RUN（使用者同意本階段延後）** |

## 6. 必要跨模組整合 Gate（等待來源）

- **R-01** Rules：單一實體牌守恆、起手／副露／補花各 phase 牌數、RuleProfile 來源可核對、合法 GameState→Action→Event 的正反例。
- **R-02** 隱藏資訊：保持公開狀態但替換三家暗牌，`PlayerView` 與 Strategy 公開輸出不得洩漏；永不傳完整壁牌與 answerKey。
- **S-01** Strategy：recommendation 必是 legalActions、metric 正確標 exact/heuristic/estimated/unknown；未驗證桌規不做正式風險百分比。
- **L-01** Lessons：所有題目 seed/replay/ruleRef/scorer 一致；source analysis version 可追溯；無 scorer 的 scenario 明示不可評。
- **A-01** Adaptive：兩種 RecordRef 家族獨立驗證、同一 record 不重複加權、舊 archive/v1 bytes 原樣保留、儲存額滿可回退。
- **UI-01** 玩家在實際瀏覽器連續完成今日推薦→選課→作答→評分→解說→存檔→能力弱點→複習→能力曲線，含錯誤處理、390px、桌面鍵盤／焦點、34 SVG。
- **PWA-01** 任何新增 JS／JSON／題庫資源與 `sw.js` cache 同步完整，提升 `CACHE_VERSION`，在 GitHub Pages 子路徑用真 Chrome 斷網新分頁答題、SW 更新、資料保存。
- **REG** 既有三題型、P0、雙 10k Oracle、全部 Node/Chromium/Tile QA 不退化；以**實際整合 HEAD** CI 放行，不能借舊分支成功記錄。

這些 Gate 是進入下一階段 PR 審查與 integration 的**必須驗證條件**，不是此報告宣稱已通過。

## 7. PWA、資料與實機界線

既有 V0.2 Pages 預發布固定的是 `5e692fd9bce18ff6a947cd7f2045e8425b8fe63b` 的應用快照，新的 Academy preview 須另建、明示 `sourceCommit` 與 `release:false`，不可改動 [PR #26](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/26) 的原 V0.2 驗收證據。屆時所有新 JS、JSON、課程素材與資料需與 Service Worker 原子快取版本一起審核；只靠 manifest 存在不等於真離線可用。實體 iOS、Android、VoiceOver/TalkBack 保留 **NOT_RUN**，不得直接關閉 Issue #12。

## 8. 已知限制與完整四人 Bot／複盤依賴

- **台灣桌規非單一官方配置**：計台、花牌、槓牌／補張、過水及特殊胡牌未有 RuleProfile + fixture 前不自動判定，不能用結構牌效替代完整實戰法規。
- **策略精確性限制**：放槍率、勝率、預期分數與人類弱點屬模型與資料相關估計，未有抽樣/校準不能聲稱精確或大師級。
- **玩家隱藏資訊**：未來四個 Bot 必須只讀各自 PlayerView，不能把 GameState 的牆牌或對手暗牌直接提供給策略；複盤全資訊需局後不同權限／schema。
- **Bot / 全局複盤需先完成**：verified 四人狀態機、合法動作與強制裁決、完整且可 seed 重播 TurnEvent、claim priority、合法自摸／放槍、回合結算、四個受限 Bot 決策、局後可公開的重播視角、物理牌守恆與隱藏資訊測試。**目前完全不能稱已交付**。
- **來源整合風險**：五個來源 PR 均未出現，無法審 source diff／循環依賴／測試；需在來源 PR 提前解決，不等合成後再黑箱修復。
- **發版限制**：本輪是開發 Master Academy，與既有 V0.2 正式 Release Gate 分離；不升 `package.json`、不造 `v0.2.0` Release，遵守現行 main Required Check。

## 9. 下一個交付節點

1. Phase 0 **COMPLETE**：共同契約經 PR #32 code review、修復實際 scenario record 衝突、Required CI、main 合併；本整合分支僅含基線報告。
2. Phase 1 **PENDING**：五個來源 PR 上線，逐件驗證 API 版本、資料所有權、隱藏資訊、測試與邊界；不同契約須先 amend。
3. Phase 2 **PENDING**：照 Rules → Strategy → Lesson → Adaptive → UI 納入隔離 branch，跑真正跨模組/瀏覽器/離線測試，僅經 Required CI 合併 protected main。
4. Phase 3 **PENDING**：建立獨立 Academy 固定 SHA 預覽並驗證離線，留下 iOS/Android **NOT_RUN**，更新此報告的實際 QA/Gate。

**最終結論：Phase 0 契約完成，Master Academy 全功能整合尚未完成；不對 V0.2 正式發版授權。**


---

## 10. Phase 1 來源審查／Phase 2 初次隔離整合快照（2026-11-19 晚間；以此節覆蓋前述「來源尚無 PR」歷史狀態）

> **此段是更新的稽核事實，不改寫前述 Phase 0 的歷史時間點。** 最新查詢時正式 `main=25870862b6499f7e699967aa76429ae5dcfc5db4`；所有五個來源 PR 已建立，均尚未合併。整合使用原 [Draft PR #33](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/33)，**不可在未解除阻擋前升為 Ready 或合併 main**。

| 模組／來源 PR | 當次 pinned HEAD | 來源 CI／驗收結論 |
| --- | --- | --- |
| Rules Engine [#34](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/34) | `6463132f039c28400f1b8816e683a90ddd77bc03` | `PR_OPEN / BLOCKED`；[Verify #44505529705](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44505529705) SUCCESS，但兩項未解決 inline reviews：`JSON.stringify` 比對導致 JSON key order 不同即錯拒合法重播；花牌 profile 漏 `code` 因 RegExp coercion 可通過驗證。已在來源 PR 留下 blocking 審查，未納入整合 |
| Strategy [#36](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/36) | `fe09dfe137e154a549d03da61b310e6386c4d6a6` | `PR_OPEN (Draft) / CI_PASS / CROSS_MODULE_NOT_RUN`；[Verify #44507783666](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44507783666) SUCCESS，程式只讀安全 `PlayerView` 並重用 canonical `analyzeDiscards`，模擬兩巡明確為 uncalibrated estimate，放槍/台數 unknown；等待真正 Rules→Strategy runtime tests |
| Learning Academy [#35](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/35) | `deceed51c156284607367a2592dae32f9808e736` | `PR_OPEN / CI_PASS / STAGED_FOR_INTEGRATION`；[Verify #44506271214](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44506271214) SUCCESS，20 Lessons、100 題基於正式 v3 的可重播結構題；`VERIFIED_SCENARIO_SCORER_COUNT=0`，不得稱已可評情境題 |
| Adaptive [#37](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/37) | `aca0a5f1e369aaa1fa5d55d8fd7e9df7e9807a2a` | `PR_OPEN (Draft) / CI_PASS / STAGED_FOR_INTEGRATION`；最新 [Verify #44508648384](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44508648384) SUCCESS。提供 RecordRef 家族驗證、idempotent AbilityProfile、ReviewPlan、namespaced sidecar；需要 Learning SkillTag registry 的正式 adapter 與實際 UI 消費者 |
| Academy UI [#38](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/38) | `e42d8a1b8abead2654fbdc0591353b62d6d3c3f3` | `PR_OPEN (Draft) / CI_PASS / UI-01 BLOCKED`；[Verify #44507726809](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44507726809) 及 Chrome/PWA jobs SUCCESS，但 `src/academy-ui/public-facade.js` 明確只是**舊 v3 紀錄的唯讀 adapter**；目前只有模擬 scenario 牌面與舊三模式導流，未接 `src/academy/*`／`src/adaptive/*`，**沒有正式 12 步閉環**；SW 也尚未納入新模組的 JS/JSON 資源 |

上述所有來源均收到整合者的 GitHub PR 討論審查：#34 需修 replay 與花牌；#36 需真正與 Rules 公開視角合測；#35 必須保留 scenario unscorable；#37 需正式 registry adapter／舊資料讀回；#38 必須回來源 PR 把真實 Learning/Adaptive API 接到玩家的全部學習流程。**不要在此整合 PR 偷改來源 AI 的責任模組**。

### 10.1 本輪實際提交到 #33 的隔離候選

- 正式 main 仍是 `25870862b6499f7e699967aa76429ae5dcfc5db4`，未變動。整合 Draft 在 `9b7e9bab2a2d321865f6bf5b4cc154c4dd78eec5` 組合了 **Learning #35 及 Adaptive #37 的 22 個新增來源檔案**，均使用與 GitHub PR HEAD 完全相同的 blob，無覆寫共用核心／任何 UI／`sw.js`。
- 整合者新增 `src/integration/master-academy-facade.js`：明確批准的 `SkillTag` registry 和 legacy error mapping、`LessonPublic/QuestionPublic` 讀取、`submitAcademyAnswer` 正式 v3 grading、舊版 `archive:v3` 持久化核驗、`RecordRef{kind:"legacy-v3"}`、Adaptive sidecar、`AbilityProfilePublic/ReviewPlan` 和今日建議。**沒有 verified scenario scorer 時拒絕正式作答**；不宣稱 Rules、Strategy、UI 12 步已接線。
- 新增必跑 `tests/integration/master-academy-learning-adaptive.test.js`：20 真 Lessons、100 題來源、公開題無 answerKey、正式 v3 作答→archive 讀回→AbilityProfile/ReviewPlan、重複 ID 擋下、歷史 v1/v3 bytes 保留、未驗證 scenario 不計分、損毀 sidecar fail closed、拒絕儲存時不能冒稱持久化。
- [整合 Verify #44538204653](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44538204653)，HEAD `9b7e9bab2a2d321865f6bf5b4cc154c4dd78eec5`：**146 tests／145 pass／0 fail／0 TODO／1 opt-in skipped**。兩套必要 10k Oracle 與 Q-001/Q-002/I-003 仍 PASS；Learning/Adaptive 來源獨立測試及四項全新整合測試 PASS。
- [整合 Independent UI/PWA #44538204663](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44538204663) 同 HEAD：Chrome UI/real offline PWA 及 Node API/P0 兩個 jobs 都 **SUCCESS**。**它只驗證既有 V0.2 UI 和 SW**，不能宣稱 Master Academy 新學院介面已離線／實機可用。
- 此階段沒有新增任何由瀏覽器直接 import 的 Academy 模組：原 V0.2 `sw.js` 沒有因隔離的 Node integration test 擅自升版。將來 UI 真正引入新模組時必須在其來源 PR 中更新全部新 JS/JSON 快取並原子提升 `CACHE_VERSION`。
- **額外發現 L-01/A-01 正式課程回放缺口**：Learning 的 AcademyQuestion ID 為 `academy-q-*`，官方 v3 DecisionRecord 保存的是底層 `ex3-*` exerciseId；Adaptive ReviewPlan 按底層 exerciseId 排程，缺少跨重載且可驗證的 `RecordRef + ex3-* → AcademyQuestionRef / LessonRef / SkillTagIds` 關聯。現階段可正式核對舊 v3 題目與能力 task/error 映射，但**不能宣稱已保有原 Academy Lesson 問題的完整作答／複習關聯**。已在來源 [#35](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/35)、[#37](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/37) 留下具體修改／同題重播測試要求；不得改寫舊 v3 紀錄。
- **PR #33 必須保留 Draft；既有 V0.2 Pages PR #26 SOURCE_SHA 不變，舊 V0.2 網址不是 Academy 預覽。**

### 10.2 真正剩餘的品質 Gate

| Gate | 狀態 | 原因 |
| --- | --- | --- |
| R-01 / R-02 | `BLOCKED` | #34 JSON key-order 重播與非法花牌 Profile 未修；Rules 不在隔離候選 |
| S-01 | `CI_PASS_ONLY` | #36 來源測試通過，但真實 PlayerView 接合、策略防洩漏同 SHA 尚未完成 |
| L-01 | `NODE_CROSS_PASS`（既有 v3 題型） | 100 題來源與公開題/評分檢查；情境題 verified scorer 仍為零 |
| A-01 | `NODE_CROSS_PASS`（legacy-v3）／`CURRICULUM_LINK_BLOCKED` | 真正 Learning→Adaptive 持久化／冪等／複習測試通過；`academy-q-*` 與底層 `ex3-*` 的持久化 lesson 關聯尚未建立；academy-v1 情境證據因無 scorer 不可宣稱已正式使用 |
| UI-01 | `BLOCKED` | #38 尚未導入 LessonPublic + Adaptive 公開 API，未有完整學習閉環 |
| REG-01 | `PASS` | 整合 Draft 同 SHA Golden／雙 10k Oracle／三種既有模式 Node 回歸 |
| REG-02 | `BASELINE_PASS` | 現有 34 SVG、Chromium desktop/mobile 模擬；不是五個新模組的 UI 驗收 |
| PWA-01 / Academy 預發布 | `BLOCKED` | 尚無完整新 UI/快取、新 Academy 固定 SHA preview；不拿 V0.2 old Preview 冒充 |
| 實體 iPhone/Android、VoiceOver/TalkBack | `NOT_RUN` | 使用者已決定暫緩；Issue #12 維持 Open |

**Phase 2 進展：Learning + Adaptive 在隔離組合的 backend 單一 v3 學習流程已獲得可重播測試證據。Rules／Strategy／UI 仍未通過跨模組放行，五個來源 PR 均未合併 main；完整 12 步 Master Academy 尚未完成、正式 Release 不授權。**


---

## 11. 2026-11-19 最新五來源真實整合稽核（覆蓋上方舊版歷史快照）

**注意**：前述 1–10 節是逐次歷史查核；以本節為最新狀態。共同權威契約仍為 `master-academy/1.0.0`；正式 main `25870862b6499f7e699967aa76429ae5dcfc5db4` 未動，Protect main ruleset #27611325 維持 Active。既有 Draft [PR #33](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/33) 尚未合併；下方**實際已測整合程式碼 HEAD** `a06505c8579cf817440822692854786c9bd330bf`。

### 11.1 最新五個來源與安全納入

| PR | 固定來源 SHA | 來源 CI／審查 |
| --- | --- | --- |
| [Rules #34](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/34) | `a8e5aaa59c3cd55fa99a57bc50bb9fb83f8bd544` | [Verify #44553905187](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44553905187) SUCCESS。原 Replay JSON key-order、花牌 code 型別兩個 review threads 均已 resolved；`sameJson` 及 flower type guard 和 regression 已核對。四席遊戲仍僅 experimental draw/discard |
| [Strategy #36](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/36) | `4f2029fcd54c5e43d5d17beb54f7f32dcd78d624` | [Verify #44555251088](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44555251088) SUCCESS。最新真實 Rules PlayerView→Strategy 測試在整合 HEAD 強制啟用，來源 PR 單獨測試不能冒充組合通過 |
| [Learning #35](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/35) | `172f6221fbd2d1363f4a0d04681f0b773293d486` | [Verify #44554576924](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44554576924) SUCCESS。20 個 Lesson／100 題有真實 seed、版本、v3 scorer、Learning-owned immutable provenance；scenario scorer count=0 |
| [Adaptive #37](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/37) | `03ee8408a8ce28a09be3439c640d768c31f5054e` | [Verify #44557070257](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44557070257) SUCCESS。正式 `createAdaptiveLearningAdapter`；`pendingProvenance[]` write-ahead、`provenanceLinks[]`、故障重建、正式 Academy 題目 ReviewPlan |
| [UI #38](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/38) | `634e3c4f80063beb709406210b210e77b7ceb979` | [Verify #44557077672](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44557077672) SUCCESS。來源 PR 的 Fixture-only UI E2E **不是**正式 Academy 端到端證據 |

已從以上五個固定來源 HEAD 保留原版 blob 導入 **64 個指定來源檔案**，未用整合分支舊 #35/#37 實作覆寫新提交。另有明確、獨立的整合者 Façade、UI Bridge 最小必要接縫、Service Worker 版本、真實 browser / Node 測試與 CI，未直接推送 main、未更動 V0.2 預發布 [PR #26](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/26)。

### 11.2 唯一可信資料來源

- 正式分數：原始 `tw-mahjong-trainer:archive:v3` 裡的 `DecisionRecord v3`；歷史 `session:v1` 和 v2/v3 原有 bytes 在讀取／重建時不得被覆寫。
- 課程／作答關聯：唯一權威是 Adaptive `tw-mahjong-master-academy:state:v1` 的 `provenanceLinks[]`，必須先保留 `pendingProvenance[]` 意圖，再寫入並驗證正式 v3 RecordRef，最後建立來源映射與重建未校準 AbilityProfile／ReviewPlan。中斷後 `recoverPending` 僅依真正 durable v3 記錄恢復。
- Integrator `src/integration/master-academy-facade.js` 注入 Learning 公開 callback 至 Adaptive owner；任何來源映射再以 Learning `createAcademyProvenance/validateAcademyProvenance` 和 Adaptive `validateLearningProvenance` 及原始 v3 記錄雙重驗證。
- 正式 UI `academy-bridge.js` 不再讀寫 `tw-mahjong-master-academy:ui-links:v1` 作成績真相，而由 Façade `getProvenanceLinks()` 重新建構；僅 `fixtureOnly:true` 獨立測試保留舊 link key。修復需求已回報 UI 來源 PR #38。正式 `ReviewPlan` 已依 `academy-q-*` 指向可重播原題，歷史未連結 `ex3-*` 不會被偽造成 Academy 學習。
- `getTrainingSession()` 目前只傳回既有已儲存 TrainingSession 或 null；**不宣稱新玩家每日 Session 已自動建立**。無 verified scenario scorer 時 `submitScenarioAnswer` 必須拒絕正式計分。

### 11.3 同一實際整合 HEAD 的完整 Gates

| Gate | 真實 Actions 與證據 | 結果 |
| --- | --- | --- |
| Required Verify／REG-01 | [Verify #44562519930](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562519930)：**207 tests、206 PASS、0 FAIL、1 opt-in skipped、0 TODO** | `CI_PASS` |
| 兩個各 10,000 題獨立 Oracle、Golden、P0 | 同一 Verify log 明確 `required: 10,000`、`integration: 10,000`，既有 Q-001/Q-002/I-003；選擇性 stress 未執行 | `CI_PASS` |
| R-01／R-02／S-01 | [combined #44562520086](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562520086) Node job：強制 `STRATEGY_REQUIRE_RULES_INTEGRATION=1`，真實 createGame → allowlist PlayerView → canonical 策略／合法 actionId → applyAction → replay；opponent／wall 暗牌隔離，stale／非法 ID 擋下 | `CI_PASS`，僅 experimental 四席 draw/discard |
| L-01／A-01 | 同一 combined Node job：真實 20 Lesson、100 題、QuestionPublic 無 answerKey；正式 v3 score → durable readback → write-ahead／provenance → AbilityProfile → 依 AcademyQuestionRef ReviewPlan；冪等、故障恢復、quota、壞 provenance、過期版本、未驗證 scenario 拒絕 | `CI_PASS` |
| 真實 UI-01／12 步／離線新分頁 | 同一 [combined #44562520086](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562520086) browser job SUCCESS：**390px mobile emulation、1440px desktop**，操作官方 Lesson→選牌→正式 grade→持久化→來源 mapping→Profile/Plan→reload→原課程／同題 replay，以及桌面 Chrome 離線新分頁；**沒有使用 fixture provider**；截圖和 JSON 在 `academy-combined-real-e2e` artifact | `BROWSER_PASS` |
| Academy UI regression | [Academy UI #44562519917](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562519917) SUCCESS，合成來源須真有 20 Lesson，來源單獨不能接 Façade 時仍 fail closed | `BROWSER_PASS` |
| REG-02／V0.2 功能與 PWA | [Tile Faces #44562519997](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562519997)、[Independent UI #44562519987](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562519987)、[V0.2 Browser/PWA #44562519844](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44562519844) 全部 SUCCESS；34 SVG、三題型、鍵盤、V0.2 regression 保留 | `CI_PASS` |

`sw.js` 新版 `tmt-v02-realistic-tiles-master-academy-20261119-r2` 保留原 V0.2 Tile QA 必需命名、34 SVG 與原快取，**額外 precache 30 個真正 Academy／Adaptive／Rules／Strategy／Integration JS/JSON**。每次變更 cache version 隨必要檔案同步升級。Chrome 模擬不代表實際 iOS/Android 或輔助科技通過。

### 11.4 可操作範圍、預發布與 NO-GO 邊界

- **已驗證可操作**：真正選擇正式 Academy 20 Lesson、100 題結構題，與舊何切／聽牌／多面聽共存；官方 v3 score/explanation、RecordRef 和原始 bytes，經驗證的 curriculum provenance、未校準能力／複習、重新載入回原課程、原題複習；390/1440 Chrome、PWA offline Chrome。
- **仍未完成**：完整 verified 台灣四人桌規／自摸放槍／吃碰槓補花／台數、經認證 scenario scorer、正式 Bot 與全資訊複盤、真人校準，以及從 UI 正式建立每天 TrainingSession。實體 Android/iOS、VoiceOver、TalkBack、完整裝置升版驗收全部 `NOT_RUN`；[Issue #12](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/12) 保持 Open。
- **Academy 專屬 HTTPS 固定 SHA 預發布**尚未有真實可驗證網址，因此 `BLOCKED`，不能使用舊 [V0.2 GitHub Pages](https://kodlbegiko.github.io/taiwan-mahjong-trainer/) 當新學院網站。只有獨立 HTTPS、明確 commit SHA、`release:false`、真實 live browser/source/offline 證據後才能標 `PREVIEW_DEPLOYED`。
- `package.json` 仍 `0.1.0`；沒有 `v0.2.0` Tag/GitHub Release，main 保護未降低，PR #33 **Draft** 未合併。
- **工程判定**：僅「結構題 V1 Learning＋Adaptive＋實驗性 Rules/Strategy 公開界線＋Chromium 的 12 步」範圍具 `CI_PASS/BROWSER_PASS`；**整體 Master Academy 正式工程整合仍為 NO-GO**（專屬預覽、正式 Session、完整四人玩法／scenario scorer 未達），不得發行或關閉品質 gate。
