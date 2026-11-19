# Master Academy — 分層、職責與整合架構

> Phase 0 架構提案；依 `docs/contracts/MASTER_ACADEMY_V1.md`。基準 main：`5e692fd9bce18ff6a947cd7f2045e8425b8fe63b`。以下路徑與方法為**規劃，不代表模組已實作**。

## 單向依賴

```text
Existing src/tiles.js, src/shanten.js, src/practice.js, src/training/*, src/storage/*
                  │  (preserved and regression-tested)
                  ▼
       RuleProfile Registry + Rules Engine [authoritative GameState]
                  │ projectPlayerView(seat, eventSeq)
                  ▼
         PlayerView (allowlist, exact as-of time)
                  ├───────────────────────────┐
                  ▼                           ▼
     Advanced Strategy                Learning Academy
     (only PlayerView)                (Lesson/Question/answerKey vault)
                  └───────────┬───────────────┘
                              ▼
                canonical grading and v3 DecisionRecord
                              │
                              ▼
                    Adaptive Training
                (AbilityProfile + ReviewPlan)
                              │
                              ▼
                    Academy public façade
                              │
                              ▼
                     Academy UI / PWA
```

此圖強調資料路徑而非允許 import 依賴逆向：Rules Engine 不得 import Strategy/Academy/Adaptive/UI；Learning Academy 只可引用 immutable StrategyAnalysis DTO，不可 import Strategy 的內部模型／GameState。Adaptive 只依賴 validated record 和 skills registry。UI 僅透過 public façade 取得 `PlayerView`、`QuestionPublic`、`GradingResult`、`AbilityProfilePublic`、`ReviewPlan`。

## 五個 AI 的檔案所有權與 API 接縫

| AI | 預定新路徑（建議，不強佔既有 PR） | 主要交付 | 不能私改 |
| --- | --- | --- | --- |
| 1 Rules Engine | `src/rules/**`、`tests/rules/**` | `RuleProfile` registry、牌組守恆、合法動作/事件、`projectPlayerView` | `src/practice.js`、UI、舊 `records.js` |
| 2 Advanced Strategy | `src/strategy/**`、`tests/strategy/**` | `StrategyAnalysis`、可信的分析分類與反洩漏測試 | 完整 `GameState`、Rule Engine 核心 |
| 3 Learning Academy | `src/academy/lessons/**`、`data/academy/**`、`tests/academy/**` | `Lesson`、`AcademyQuestion`、可重播題庫與 registry | Rules Engine、Adaptive、現有正式 v3 封存 |
| 4 Adaptive Training | `src/adaptive/**`、`tests/adaptive/**` | `AbilityProfile`、`ReviewPlan`、`TrainingSession`、sidecar 持久化/遷移 | `src/training/records.js`、UI |
| 5 Academy UI | `src/academy-ui/**`、`src/app.js`、`index.html`、`style.css`、`public/**`、`sw.js`、`tests/browser/**` | 真正接線 12 步學習閉環、離線 PWA | Rules/Strategy/Adaptive 內部、歷史數學核心 |
| Integration | `docs/contracts/**`、`docs/quality/MASTER_ACADEMY_INTEGRATION_REPORT.md`、`tests/integration/master-academy-*` | 契約、cross-module QA、整合 staging／CI 證據 | 平行工作者專屬檔案，除非經提案及來源 PR 調整 |

目前 `src/app.js`、`sw.js` 等是既有 V0.2 核心：UI AI 若需更動要保留原何切/聽牌/多面聽、34 張 SVG、v3 archive 與 `CACHE_VERSION` 原子更新；不容許用靜態頁替代實際功能。

## 序列化與安全界線

1. Rules Engine 的 `GameState` 由完整局面事件 log 還原；公開頁面只能取得 `PlayerView`，並且 `PlayerView` 對所有對手暗牌/wall 做白名單投影。回放中的 post-game full-information 另走**明示授權及新 schema**，不沿用 as-of PlayerView。
2. Learning 題目 `answerKey` 與完整 grading fixture 留在受保護服務／local-domain 封存層；UI 接到 `QuestionPublic`，只在作答後顯示 `GradingResult`。本地 PWA 中所有 JS/JSON 都能被使用者檢視，**若答案內嵌在前端下載檔，無法宣稱真正防作弊或保密**。本版可做到正常 UI 預答題不洩漏，但強防作弊需服務端授權。
3. 已驗證 `DecisionRecord v3` 保留原始成績 snapshot；自適應 `AbilityProfile`／`ReviewPlan` 屬可重算的**衍生 sidecar**，採先驗證/寫原紀錄、再更新 sidecar 並容許重建。不得覆寫 `tw-mahjong-trainer:session:v1` 或 `archive:v3`。
4. 排程依傳入 `asOf` 和 IANA 時區重現；舊例 `advanceReview` 僅 SM-2-inspired。策略放槍率/台數未驗證時不顯示數字或冒稱「正確答案」。
5. 獨立 QA 必須測非法負面例：隱藏牌曝光、重複 physical ID、未知 RuleProfile、無法重播題目、重複 DecisionRecord、過期 expectedRevision、PWA 快取半更新、quota-denied 舊資料保全。

## 建議整合與 Release Policy

- Phase 0：本契約 PR 本身只寫文檔／架構；須過當時 `Verify / test`。五個 AI 尚無可審新 PR 時**不得以空模組宣稱已整合**。
- Phase 1：逐來源 PR 檢查私有邊界、檔案所有權、循環依賴、真實功能與 CI；不正確的來源回原 PR 修補。
- Phase 2：以 `integration/mahjong-academy` 隔離整合：契約 → Rules → Strategy → Lessons → Adaptive → UI → full integration tests → SW/Pages preview。不得直接推 protected main；同 SHA 重跑 Verify/Golden/Oracle/browser/offline，所有 Required CI 成功後才可考慮個別合併。
- 既有 v0.2 正式發布仍獨立管理：`Issue #12` 未完成實機驗收時保持 `NOT_RUN`；`PR #26` 的 pinned `SOURCE_SHA` 是舊候選、不得擅改成 Academy；新版另建非正式預覽並記錄固定 SHA；不可借用舊測試簽署新版本。
- 功能狀態欄須分為 `not-started`、`in-review`、`code-merged`、`node-passed`、`browser-passed`、`preview-deployed`、`device-not-run`、`release-authorized`，不可混成「完成」。
