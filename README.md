# 台麻練習所 · Taiwan Mahjong Trainer

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

## V0.2 整合狀態（開發中）

五個工程分支的功能尚未合併到 `main`，因此本 README 所述可使用功能仍以 **v0.1** 為準。整合者的 [API Contract](docs/API_CONTRACT.md)、[合併計畫](docs/INTEGRATION_PLAN.md) 與 [品質報告](docs/quality/V0.2_INTEGRATION_REPORT.md) 在文件 PR 中審查，**文件存在不代表功能發布**。核心正確性與統一進張計分是 V0.2 的阻擋門檻。
