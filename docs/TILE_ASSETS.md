# Taiwan Mahjong Trainer — 34 種 SVG 牌面素材

## 素材契約

- 本目錄新增 `public/tiles/0.svg` 至 `33.svg`。每張使用 `viewBox="0 0 72 100"`，本體透明，牌身、選中狀態及陰影由 UI/CSS 負責。
- 0–8：一至九萬（上方深藍中文數字，下方朱紅「萬」）；9–17：一至九筒（傳統多色環形筒）；18–26：一至九索（一索鳥紋、其餘逐根竹條）；27–33：東、南、西、北、中、發、白（白板是空心框，不是「白」字）。
- 使用方式：`<img src="./public/tiles/9.svg" alt="一筒" width="40" height="56">`，路徑相對於網站根目錄。SVG 為完全獨立的靜態向量，沒有 JavaScript、外部 SVG 引用、字型網路請求及嵌入圖片。
- 開發者展示：`docs/tiles-preview.html`；從網站專案根目錄透過 HTTP 靜態伺服器開啟即可看到 34 張牌及 40／56／60px 實例。牌面中的 `<title>` 與 img `alt` 提供無障礙名稱。

## 圖像來源與授權

筒子、竹索、鳥紋及白板圖形為本專案新繪的 SVG 幾何圖案，未裁切、追描或複製照片素材。萬字牌與風牌／三元牌中的中文書法輪廓擷取自 **Noto Serif CJK TC Bold**，字體 © 2010–2012 Google Corporation，依 **SIL Open Font License 1.1** 授權。上游字體與授權文件：https://github.com/notofonts/noto-cjk ，https://openfontlicense.org/ 。本儲存庫另保存上游 OFL 1.1 授權全文於 [`docs/licenses/NotoSerifCJK-OFL-1.1.txt`](./licenses/NotoSerifCJK-OFL-1.1.txt)。專案內 `docs/tile-glyph-outlines.json` 保存來源輪廓資訊，以便稽核。牌面輪廓經雙區塊排版重新組合；不包含任何外部字型檔案，並保留來源及授權聲明。MIT 專案的原有 LICENSE 不變；上述來源字形遵守自身 OFL 授權。

## 整合及限制

1. 目前 `main` 的 `src/app.js` 尚使用文字牌面。負責 renderer 的 AI 須依牌碼將 `public/tiles/{id}.svg` 接入三個訓練模式，並保留可存取的中文牌名。
2. 此素材 PR **不修改** `sw.js`；2026-11-19 的 Service Worker 僅 precache 固定 Shell 清單，對不在清單內的 `/public/tiles/` 資源直接走網路。故「SVG 自身無外部依賴」不代表在現行 PWA 中已能離線載入；SW 整合方必須將 34 張資源加入 precache（或設計經驗證的 runtime cache），更新 cache version，並測試全離線首次開啟。
3. HTML `<img>` + 簡單 SVG 基本圖形屬於 iOS Safari、Android Chrome 的通用標準功能，但**尚未完成實機證明**；需在兩平台做 40–60px 清晰度、深色桌面、PWA 重啟離線驗收。視覺設計為傳統台灣麻將的原創演繹，不保證與任何廠牌圖案一模一樣。

## 範圍及靜態驗收

- 必須恰有 34 個以 0–33 連號命名的獨立 SVG，每張有 `xmlns`、`<title>`、固定 viewBox，且無 `<script>`、`foreignObject`、`<image>`、`@font-face`、外部引用。
- 筒子 1–9 個環形圓圖（1 筒為一幅同心圓飾紋）；索子 2–9 根竹條（每根含三節）；紅中／綠發／白板和風牌的位置正確。
- 只新增 `public/tiles/*.svg` 與 `docs/` 內展示、授權說明及向量字形來源；不碰 `src/app.js`、`style.css`、`sw.js`、牌碼定義或版本。
