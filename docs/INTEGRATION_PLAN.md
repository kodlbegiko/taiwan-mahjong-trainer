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

## 2026-11-19 第二輪重新整合（保留歷史稽核基準）

- 重新讀取 `main=53981149d5f632db8d8dbbf3bd11fbd0999d48e3`、四個功能 PR 與 Draft #10；功能分支 SHA 未移動，先前 QA 修復要求仍未落實。
- main 自前次 staging 以來僅修改五個文件（README、ROADMAP、CHANGELOG、INTEGRATION_PLAN、V0.2_INTEGRATION_REPORT）。確認與四個功能 PR 的 27 條改動路徑**完全不相交**；比對原 staging 27 條 blob SHA 均一致，只額外保留 `tests/integration-contract.test.js`。
- 以最新 main tree 作為 base，重新取四個功能 PR **最新 HEAD 的 blob**、保留整合測試，新增 `tests/integration-oracle-10k.test.js`；建立 parent 為舊 staging + 最新 main 的整合 commit，並以 `expected_sha` 更新 staging ref，沒有 `force push`、沒有覆蓋已衝突檔案。初版 SHA `4f673f97a137a886d6e0b14617a42e889a59d391`。
- 針對 `4f673f97` 的 [Verify #44358617174](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44358617174) 結果：67 total / 61 pass / 3 fail / 1 skip / 2 TODO；10,000 題獨立數值級 oracle PASS；Q-001/Q-002/I-003 各一個強制測試 FAIL。後續 browser smoke 的獨立 HEAD 及結果依品質報告追蹤。
- **流程停止點：第一階段（核心修復驗證）未通過。** 不合併 #1、#5、#3、#4，也不將 Draft #10 轉 Ready。若任何來源 HEAD 更新，重新疊合並在對應確切 SHA 重新驗證。

### Issue #13：main 分支保護的人工設定清單

GitHub API 查到 `main.protected=false`，Repository Rulesets API 回傳空陣列；Branch Protection 讀取端點因目前整合權限不足回傳 403，**沒有啟用保護的證據**。目前 GitHub 連線工具沒有設置 ruleset / branch protection 的寫入操作，不能代為宣告完成。

請具管理權限者到 [Repository Settings](https://github.com/kodlbegiko/taiwan-mahjong-trainer/settings/rules) → **Rules → Rulesets → New branch ruleset**，依序：

1. 規則目標選 `main`（Branch targeting）；設定 **Active**，避免 Evaluate/Disabled 只監控不阻擋。
2. 啟用 **Require a pull request before merging**；建議 **Require conversation resolution before merging**。若有可實際審核的獨立協作者，可設最少 1 位 approval；只有同一帳號的 AI / 自己審核無法形成獨立 reviewer，不應開啟會讓單人專案永久無法合併的限制而無審核計畫。
3. **Require status checks to pass** → 指定現有 GitHub Actions `Verify / test`（實際選單名稱以 GitHub 提供為準）；啟用 require branch up-to-date before merging（或使用 merge queue，二擇一）。**注意**：原本 `TODO` / opt-in skipped 仍可讓 Verify 成功；需要另行保留 P0 強制測試與 10k gate。
4. 阻止 force push、禁止 branch deletion；設置 bypass 僅在明確緊急政策需要時，並審計。可要求 linear history，與 squash merge 策略一致。
5. 以無害測試 PR 實際驗證 failing check 被拒絕合併、pass check 可合併；記錄 ruleset ID / 驗證證據，再關閉 Issue #13。

上述是**待執行設定項**，不是已完成操作。

### 獨立瀏覽器驗證（已執行，不替代 P0 gate）

Staging `808e245ec99ec7512a544ae6beac1ee77f4b40cb` 的 [Chromium CI #44359395885](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44359395885) **success**：真實 headless Chromium 測桌面 1440px、手機模擬 390px、17 張點牌、方案/評分、下一題、方向鍵/Enter、舊 localStorage 保存/重載、手機牌按鈕尺寸與整頁水平溢出，四張 screenshot 上傳 artifact `v02-browser-smoke-images`。但相同 SHA 的 [Verify #44359395424](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44359395424) 仍因三項 P0 **failure**。

沒有 iOS/Android 實機、PWA Service Worker 離線安裝或 v2 DecisionRecord UI 接線的驗收。**相同 commit 的瀏覽器 pass 與核心 fail 應並列展示，絕不能合成一個綠燈。**

## 第三輪實際合併／回退／驗證日誌（2026-11-19）

1. PR #16（獨立 Golden Q-001），目標分支 `feat/core-accuracy`，CI #44363174991 pass，測試合併 SHA `b0ca3393cb7a351902e847978bd664b04f52de8d`，沒有直接把會讓舊 main 紅燈的測試先合併 main。隨後 PR #1 於 source HEAD `b0ca3393` 的 Verify #44363300567 success 後 squash 合併 `f15e8fc3404ec380b65bc1493a87e76da6b4a1c2`，main push Verify #44363444102 success（45 total /43 pass /0 fail /1 skip /1 當時尚未修的 Q002 TODO）。
2. PR #5 在 PR #1 後，以最新 main tree + 題庫分支所有 18 個精確 blob 安全重新整合，保留 source commit 為 parent、最新 main 為 second parent，以 expected SHA lease 更新分支；PR #17 強制 Golden Q-002 CI #44363792218 pass，測試合併到 `feat/training-system` 為 `7f01afb906777109838de911a72a6b96692eb688`；此 feature HEAD Verify #44364359687 success（64 total /63 pass /0 fail /1 skip /0 TODO），然後 PR #5 merge SHA `9f74e528291e3a2a945ed5d63b99fdaa3eba5d35`，main push Verify #44364507850 success（64/63/0/1 skip/0 TODO）。
3. PR #3 以 main `9f74e528` 作為 base tree、保留解說三個原有 blob 並用雙 parent 安全整合後，feature HEAD `c6e48209ab469ff6c01bc88bc1878e2b5ef1818e` Verify #44364699503 success（75 total /74 pass /0 fail /1 skip /0 TODO），合併 PR #3 SHA `ed47593c0f209d295e9e0da941f0d0d1aa6b5638`，main Verify #44364857547 success（75/74/0/1 skip/0 TODO）。
4. PR #4 以 main `ed47593c` base tree 加上原 UI 六個精確 blob 安全更新後，HEAD `a7836da22ce2f7dfa602b87b87bc7cf2eb47fb40` Verify #44365062359 success；Draft staging PR #10 使用最新 main + 該 UI blob 與獨立整合測試，HEAD `7564f0c840129c8bc20b4ca86c74aa253f12f4b3` Verify #44365221250 success（81 total /80 pass /0 fail /1 skip /0 TODO）。**本節寫入時 #4 仍須其最新 staging Chromium browser CI #44365221412 結果與正式 main push gate，沒有提前合併。**

### 下一次合併的嚴格門檻

- PR #4 的真正 Chromium desktop/mobile（本次 staging SHA）與 localStorage／鍵盤 smoke 結果必須 PASS；同 SHA full Verify 必須成功；PR4 HEAD SHA 不能移動。合併前再次核實 main；合併後核實確切 main push SHA CI 並更新品質報告與 CHANGELOG。
- 後續 docs-only PR 只在當下 HEAD 的 CI success 後合併；該 PR 不能將未完成的 v3 UI 訓練進度、實機手機、離線 PWA 和 branch rulesets 寫成完成。
- rollback 優先逐 PR revert 真正 merge SHA（#1/#5/#3/#4）；不 force-push main，不以覆蓋整檔解 conflict。

### 最後一個功能 PR 與主線 CI 結果（後續追加）

- PR #4 source HEAD `a7836da22ce2f7dfa602b87b87bc7cf2eb47fb40` [Verify #44365062359](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365062359) SUCCESS；與已合併 #1/#5/#3 的 exact blob 疊合後，staging `7564f0c840129c8bc20b4ca86c74aa253f12f4b3` [Verify #44365221250](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221250) SUCCESS 81 total/80 pass/0 fail/0 TODO/1 opt-in skip，且在同 SHA 的 [Chromium #44365221412](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221412) success：1440px desktop/390px mobile emulation，作答、數值、鍵盤、下一題、v1 localStorage 與 legacy 資料載入。Artifacts `v02-browser-smoke-images` ID `14457335506`。
- PR #4 在 source SHA 未移動、main `ed47593c` 未漂移、source CI＋staging 全部 success 後，squash merge SHA `fa1646111178c668ee2744b72546692ff148e850`，主線 [Verify #44366663851](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44366663851) SUCCESS 75 total/74 pass/0 fail/0 TODO/1 opt-in skip。
- Draft #10 在四個功能 PR 都進入 main 後，重新以 `main=fa1646111178c668ee2744b72546692ff148e850` 建立 base tree，只保留四個**未進入 main** 的整合測試與 browser smoke 腳本/workflow，沒有重複疊加已合併的功能 blob；新 staging HEAD `b607fe666ef3b4e8379023aacf6edb31ec22a874`，維持 Draft、未合併。該 HEAD 的 CI 須單獨核實，不能引用舊 SHA 冒充。
- 已關閉 #7/#8/#9 三項 P0（含程式與整合回歸證據）；#12（尚未接線的 V0.2 UI / mobile actual device / offline PWA）與 #13（main branch protections）仍 OPEN。**發布仍 NO-GO**，不設 V0.2 release tag。


## 第五輪測試 PR 與 staging 原子整合（2026-11-19）

PR #15 原 head `b96b5ded38aeeb83fcd980048e495623ceba1d36` 針對舊修復前基準，原紅色 CI 為歷史紀錄。以當時 main `825332530407bd23fea94137ba9f2f8f43e9591d` 作 tree base，只取六個 tests/benchmark 檔案、排除過期 `tests/golden-scoring.test.js` 與過時文件，保留舊 head/new main 作 commit parents 並以 expected SHA 快轉 ref，**無 force push/production 修改**。新增常駐 10k mixed-family oracle，PR #15 HEAD `32bd48b14844458d53f7523e0fee2d5c87130215` [Verify #44444307232](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444307232) SUCCESS 後才 squash merge main `067c8bbcc5026e542ae5b6688a7aceb5dd33e5b7`；main [Verify #44444529115](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444529115) SUCCESS（82/81 pass/0 fail/0 TODO/1 skip）。Draft #10 以此 main tree＋四個獨立 integration/browser QA 檔案重建 staging，SHA `b62979a0cd2fec75451f37a4f5e594a0a7e820ea`，[Verify #44444678634](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678634) SUCCESS（88/87 pass/0 fail/0 TODO/1 skip），同 SHA [Chromium #44444678821](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678821) SUCCESS。Issue #12 與 #13 仍阻擋 V0.2 GO；新 main 合併後不得引用舊 SHA 的成功紀錄充當新 CI。
