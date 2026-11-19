# 台麻練習所 · Taiwan Mahjong Trainer

> **最新工程整合快照（2026-11-19，正式 V0.2 尚未發布）：** PR #10／#21／#22 已合併至 main `745d89d5cf6f8754563660ede9c92b836048efae`；main 現有三種玩家訓練題型、可解說的正式評分、v3 作答紀錄及離線 Service Worker。[main Verify #44454406093](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44454406093) 94 項／93 通過／0 失敗／0 TODO／1 選擇性 skipped，[main Independent UI/PWA #44454406103](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44454406103) 真 Chrome 離線／新分頁／更新測試成功。**V0.2 仍 NO-GO**：[Issue #12](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/12) 的 iPhone Safari／Android Chrome 實機 PWA 與輔助使用技術驗收，及 [Issue #13](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/13) 的 main Rulesets 強制保護尚未完成；`package.json.version` 保留 `0.1.0`、無 `v0.2.0` Tag/Release。下文的 V0.1 與舊稽核描述屬已發布版本／歷史快照。


[![Verify](https://img.shields.io/badge/status-MVP%20v0.1-2d6d5e)](#)

一個開源、離線優先、不需要帳號或付費 API 的 **台灣 16 張麻將真人訓練平台**。

目前 v0.1 提供「何切練習」：隨機產生 17 張手牌，讓玩家選擇捨牌，然後比較全部候選的向聽數、有效進張種類及理論剩餘張數。

> 牌效率與實戰最佳決策是兩回事。本版不估算放槍率、台數或相手行為。

## 立即啟動

1. 下載此專案並進入根目錄。
2. 使用 Node.js（20+）啟動內建靜態伺服器（免安裝依賴）：

```bash
npm run dev
```

3. 打開 `http://127.0.0.1:4173`。不需要 npm install，也不需要任何 API Key。

也可用 VS Code Live Server，或用 `python3 -m http.server 4173` 開啟。不要直接用 `file://` 打開 `index.html`，因為 ES Modules 可能被瀏覽器阻擋。

## 測試

```bash
node --test
npm run check
```

需求：Node.js 20+。網頁執行不依賴 Node 或後端。

## 規則與限制

- 台灣 16 張麻將一般胡牌：**5 面子（刻／順）＋1 對將眼**；摸牌後 17 張，打出後 16 張。
- 計算牌效率使用 34 種非花牌，每種 4 張；花牌另外補摸，不會出現在目前練習手牌中。
- **向聽數**：完成牌型是 `-1`，打完牌後聽牌是 `0`。
- **有效進張**：摸到後向聽數可以降低的牌。理論剩餘張數為 `4 - 手牌中已知張數`，目前未扣除河牌與明刻。
- 不支援已吃碰槓的手牌、過水／特殊胡法、門風圈風、台數計算、家規差異與風險模型。
- 目前最佳選擇的判準：**向聽最小 → 有效進張理論張數最多 → 進張種類最多**。同分視為並列最佳。
- 題目難度是透過擾動完成牌型產生的**近似難度**，不是以實測人類解題難度分級。

## 專案結構

```text
index.html              無框架網頁
style.css               RWD 視覺樣式
src/tiles.js            牌碼、顯示與合法性
src/shanten.js          一般牌型向聽、有效進張
src/practice.js         題目產生、何切排序與評分
src/app.js              互動、個人紀錄（localStorage）
scripts/serve.js         零依賴的本機開發伺服器
tests/                  Node 內建測試
.github/workflows/ci.yml GitHub Actions 驗證
```

## GitHub Pages 上線

把根目錄檔案推到 GitHub repo 的 `main` 分支後，在 `Settings > Pages > Build and deployment` 選擇 `Deploy from a branch`，選 `main` 和 `/(root)`。所有引用路徑皆為相對路徑，支援專案子路徑。

## Roadmap

**完整產品與工程藍圖：** [docs/ROADMAP.md](docs/ROADMAP.md)（含版本里程碑、驗收標準、資料契約與平行開發分工）。


- [x] 基礎 16 張一般牌型向聽數演算法
- [x] 捨牌排序、進張種類與剩餘張數
- [x] 隨機題目、難度選擇、練習紀錄
- [ ] 牌型解析與數學化文字說明
- [ ] 已知明牌／副露牌效率與多面聽練習
- [ ] 風險可解釋的攻防訓練（不能用未驗證的假放槍率）
- [ ] 台數規則 profile（北／中／南／自訂）
- [ ] 牌譜 JSON 格式、匯入及完整複盤
- [ ] 題庫與個人弱點追蹤、間隔複習
- [ ] 測試集、演算法交叉驗證及效能基準

## 貢獻

歡迎回報錯誤牌例，請附上完整手牌、預期向聽數、實際結果及使用的家規。程式採 MIT License。

## V0.2 整合狀態（最新：2026-11-19）

**正式發布判定仍為 NO-GO。** main 已有 #1 牌效率核心（merge `f15e8fc`）、#5 可重現題庫／schema v3／efficiency-v2（merge `9f74e528`）、#3 可解釋教學純函式（merge `ed47593c`），並已完成 **#4 前端（merge `fa164611`）**。這些底層 API 已進入 main；不能把未接線的前端教學、聽牌題、v3 DecisionRecord 及完整離線 PWA 宣稱已向玩家開放。

已透過獨立 #16 / #17 把四組槓子、捨牌扣除的 golden TODO 變成強制斷言；Q-001/Q-002/I-003 在隔離 staging [Verify #44365221250](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221250) 通過。81 tests / 80 pass / 0 fail / 1 opt-in skip / 0 TODO，含固定 seed 10,000 題數值級 Oracle。**同一 staging SHA 的 [Chromium #44365221412](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221412) 亦通過 1440px 桌面／390px 手機模擬。#4 已合併，main [Verify #44366663851](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44366663851) 75 total / 74 pass / 0 fail / 1 skip / 0 TODO。**

[API Contract](docs/API_CONTRACT.md) · [整合計畫](docs/INTEGRATION_PLAN.md) · [V0.2 品質報告](docs/quality/V0.2_INTEGRATION_REPORT.md) 詳列每次測試 SHA、已合併 PR、未完成項。main 尚未啟用 GitHub branch ruleset（[Issue #13](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/13)）。

> 這是**已合併的 V0.2 工程核心與改善後 V0.1 答題介面**，尚未宣告 V0.2 正式發布或更新 `package.json.version`。Issue #7/#8/#9 P0 已修復關閉，但 [Issue #12](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/12) 的新訓練模式 UI、v3 作答紀錄接線、完整可操作進階教學、實機與離線 PWA 尚未完成；[Issue #13](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/13) 的 main 分支保護尚未啟用。**正式發布仍 NO-GO。**


### 第五輪 QA 稽核（2026-11-19）

PR [#15](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/15) 已補強**必跑**的 10,000 題混合分布獨立 Oracle（6,000 隨機、2,000 構造/擾動、2,000 四槓對抗）；main merge SHA `067c8bbcc5026e542ae5b6688a7aceb5dd33e5b7`，主線 [Verify #44444529115](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444529115) 成功（82 題、81 pass、0 fail、0 TODO、1 skipped）。Draft #10 最新已驗證 staging `b62979a0cd2fec75451f37a4f5e594a0a7e820ea` 的 [Verify #44444678634](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678634) 成功（88 題、87 pass、0 fail、0 TODO、1 skipped，包含兩套各 10,000 題 Oracle）；[同 SHA Chromium #44444678821](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678821) 桌面 1440px／手機模擬 390px 成功。這些是**既有何切流程與核心契約**的證據，不代表 V0.2 完整 UI、v3 DecisionRecord 接線、手機實機或離線 PWA 已完成。**發布仍 NO-GO。**
