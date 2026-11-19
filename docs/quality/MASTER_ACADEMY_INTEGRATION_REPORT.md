# Taiwan Mahjong Master Academy — 整合與品質報告

> **Phase 0 基線稽核｜2026-11-19（Asia/Taipei）｜MASTER ACADEMY 尚未整合完成。**
> 契約 `master-academy/1.0.0` 已經由 [PR #32](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/32) 合併。這是具有精確 GitHub 證據的階段快照，不是最終產品驗收或 v0.2.0 發布授權。完整契約：[MASTER_ACADEMY_V1.md](../contracts/MASTER_ACADEMY_V1.md)，依賴圖：[MASTER_ACADEMY_ARCHITECTURE.md](../MASTER_ACADEMY_ARCHITECTURE.md)。

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
