# Taiwan Mahjong Trainer — V0.2 整合計畫

> 建立：2026-11-19。此計畫與 `docs/API_CONTRACT.md` 在 `integration/v0.2-contracts` 建立；**不得把文件 PR 視為已整合五個功能 PR**。

## 基線與擁有權

- main：`ff177b8e9dc59f3ad796f78d6dab9420ab677a7c`；Node.js >=20；原生 ES Modules；`npm run check` 內含 syntax checks + node --test。
- #1 `feat/core-accuracy`：`src/core/`、`src/shanten.js`、`src/tiles.js`、`tests/core-*`。
- #2 `test/benchmark-suite`：`tests/golden-*`、`tests/benchmark-*`、`tests/fixtures/`、`scripts/benchmark-*`、`docs/quality/`。
- #3 `feat/explainability`：`src/analysis/`、`tests/analysis-*`。
- #5 `feat/training-system`：`src/practice.js`、`src/training/`、`src/storage/`、`data/exercises/`、`tests/training-*`。
- #4 `feat/ui-pwa`：`index.html`、`style.css`、`src/app.js`、`public/`。
- 整合者：API Contract、跨模組測試與 versioning、README / ROADMAP / CHANGELOG、release gate；跨權限檔案修改先取得負責工程師同步確認。

## 已讀檔案與核對結果

`README.md`、`docs/ROADMAP.md`、`docs/architecture.md`、`src/{tiles,shanten,practice,app}.js`、`tests/mahjong.test.js`、五個 PR 描述、改動檔案與 CI 狀態皆已讀取。各 PR 在其原始 HEAD 的 GitHub Actions `Verify` 均為 success；**這不等於五個 PR 疊合後測試通過**。截至建立本計畫，五個 PR 均未合併且 main 尚未變更。

## 依賴關係及合併序

```text
v0.1 main
  ├─ #1 core (Q-001 修復與 golden 對齊) ── #2 independent tests (取消 TODO)
  │       │                                      │
  │       ├─ #5 training (統一捨牌計分、版本／200題重建)
  │       │       └─ #4 UI (確認 v1 稽核與 v2 接線邊界)
  │       └─ #3 explanation (統一 ranking/grade，修正依賴)
  │                └─ #4 UI (如要展示可解釋回饋)
  └─ 任何階段皆不得以覆蓋整檔處理 conflict
```

## 階段門檻

1. **Contract gate**：合併此文件 PR；檢查舊 exports 名稱、同步性、引數、排序、`draws[].count`；發現新欄位或重命名先更新 contract 再寫程式。
2. **Core + Test gate**：獨立測試 PR #2 已先合併作為不改動 production 的保護性基準（merge SHA `6415e6c72b307858d1d1e41e2be7bdc76635079d`）；**其兩項 TODO 仍待修復**。#1 修復 Q-001 後，將已存在的 golden TODO 轉成必過測試，通過主線合併後的 `npm run check` 與 10,000 固定 seed 數值級 oracle，再考慮合併 core。
3. **Training gate**：#5 修復 Q-002 的公開 `rankDiscards` 行為；以 #1 的 `analyzeDiscards` 作對照；調升 scoringVersion，驗證 200 題及 v1 snapshot；通過後合併。
4. **Explainability gate**：#3 使用同一套已修正評分口徑；映射 `optimal/same-shanten/higher-shanten` 與 `perfect/acceptable/improve`，解說拆解須與 canonical shanten 一致。通過後合併。
5. **UI gate**：#4 的 v1 作答閉環不得退化；測試其與新版 `practice.js` 實際整合；若 v2 DecisionRecord 尚未在 UI 接線，保留未完成標記；行動瀏覽器實際操作、PWA 安裝／離線功能分別驗證。
6. **Release gate**：每次合併後重跑 `npm run check`，核對 GitHub Actions 實際完成狀態及 SHA；手動驗收產題、捨牌、解說、下一題、儲存與資料遷移；更新 README、ROADMAP、CHANGELOG、`docs/quality/V0.2_INTEGRATION_REPORT.md`。所有未完成與已知缺陷開 issue。

## 2026-11-19 實際驗證記錄

- PR #6（文件）已通過 CI 並合併 main；PR #2（獨立測試）已通過 CI 並合併 main，兩次 push CI 皆 success。
- 在 Draft PR #10 使用 Git tree 將 #1、#3、#5、#4 的**不重疊變更路徑**疊合（未處理或覆蓋任何衝突檔），加上強制整合測試。`npm run check`：66 tests，60 pass，3 fail，1 skip，2 TODO。Q-001/Q-002/I-003 三項失敗均有真實 CI 證據。
- 因功能 gate 未過，四個功能 PR 暫不合併；詳細 SHA、CI 與剩餘風險見 `docs/quality/V0.2_INTEGRATION_REPORT.md`。

## 合併作業規則

- 不直接把未驗證 PR 合併 main；每一個 HEAD 審核範圍、diff、review、CI 與關聯相依。
- 修復跨模組錯誤由負責分支提供測試與 commit；整合者可建立獨立 integration branch / PR，但不使用無理由的整檔覆蓋。
- 合併時確認 HEAD SHA 與測試 SHA 相同；HEAD 移動時重新驗證。
- 對無法執行的瀏覽器或本機 smoke、未取得的證據，明列「未驗證」，不能以 CI success 代替。
- 回退以具體 merge commit／PR 做 revert；不強制改寫 main 歷史。
