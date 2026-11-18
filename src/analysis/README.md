# V0.2 可解釋牌效率 API

此模組是純函式、原生 ES Modules，不依賴 DOM、localStorage、LLM 或未合併分支。僅處理**未副露、非花牌的台灣十六張（摸牌後 17 張）**，五面子一將的標準牌型；不推算攻防、台數、特殊胡牌與實戰勝率。

## 使用

```js
import { explainDiscard, analyzeStructure } from './src/analysis/explain.js';

const hand17 = [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28];
const result = explainDiscard(hand17, 28, {
  visibleTiles: [],
  maxDecompositions: 4,
});
console.log(result.selected.metrics);
// => { shanten: 0, kinds: 1, copies: 2,
//      draws: [{tile: 28, label: '南', count: 2}], drawMeaning: 'winning' }

const structure = analyzeStructure(result.selected.hand16);
console.log(structure.decompositions[0].counts);
// => {meld: 5, head: 0, taatsu: 0, isolated: 1}
```

牌碼沿用 `src/tiles.js`：0–8 萬、9–17 筒、18–26 索、27–33 東南西北中發白；每種最多四張。輸入 `hand17` 必須是 17 張非花牌，`discard` 必須存在於手牌，`visibleTiles` 是**不含自身手牌**的已知其他牌。`maxDecompositions` 預設 4，支援 1–12；函式不改變輸入。

## 輸出契約（`schemaVersion: '0.2.0'`）

- `scope`：計算範圍與剩餘張數定義，禁止誤讀為摸牌機率。
- `input`：標準排序的 17 張手牌、捨牌與可見牌。
- `originalStructure`：17 張的同分拆解（**僅展示摸牌後結構，不應與捨後 16 張向聽直接比較**）。
- `selected`：所選方案，含 `discard`、`hand16`、`rank`（修正後）與 `coreRank`（原練習 API）、`rawCoreMetrics`、`metrics`、`structure`。
- `candidates`：每一種**不同牌碼**的捨牌方案，按「向聽數升序 → 有效進張張數降序 → 種類降序 → 牌碼升序」排序；皆有結構化拆解。
- `decision`：`grade`（`optimal` / `same-shanten` / `higher-shanten`）、`rank`、`equivalentDiscards`、`comparison`（對最佳方案的 `shantenDelta`、`copiesDelta`、`kindsDelta`）、`structuralTradeoff`（兩種捨法下保留牌可扮演的角色）、附 `evidence` 的 `reasons`、`explanations.beginner` 與 `.advanced` 繁中陣列。

`structure.decompositions[]` 中每種解均列出 `melds`、`head`、`taatsu`、`isolated`、`counts`、`scoreBasis`、`signature`。每一張牌**恰好被分到一個分組**，可由 `base - meldCredit - taatsuCredit - headCredit` 核對向聽數。結構相同分數可能有多種合法拆法；`truncated` 表示只顯示部分同分結果。`structuralTradeoff.possibleRoles` 也只保證涵蓋已列出的拆解，不應解讀為所有可能角色。

## 進張張數的修正與整合提案

現行 `rankDiscards(hand17, visible)` 呼叫 `improvingDraws(hand16, visible)`，沒有把**本次捨出的牌**加入可見資訊，因此可能高估有效進張。此模組**只在分析層**依每個 `draw.tile === discard` 扣除 1 張，必要時移除 0 張的種類，再重新排序。結果等同 `improvingDraws(hand16, [...visibleTiles, discard])`，有測試比對；原值保留在 `rawCoreMetrics`、原名次保留在 `coreRank`。

**交給整合 AI / 核心負責人的介面提案**：在下一輪合併時決定是否讓 `practice.rankDiscards` 把此次棄牌計入已知牌，並同步修改練習評分及 UI 的文案／測試。在統一之前，解說引擎的 `rank`/`grade` **可能與現有 V0.1 答題評分不同**，勿直接混用。

此外「有效進張」在此專指**下一摸後可降低向聽數（聽牌時為可胡牌）**，不是保證會摸到的張數；也不是兩巡效率、攻防風險或得分期望。公開副露、花牌、特殊牌型及桌規仍需由其他工作流擴充正式契約。

## 測試

```bash
node --test tests/analysis-*.test.js
npm run check
```

測試涵蓋固定牌型、同分拆解、16/17 張分數、可見資訊、捨牌修正、純函式、錯誤輸入、確定性隨機例與各方案完整牌數守恆。若核心的分數定義更新，必須同步檢查 `scoreBasis` 的一致性斷言，不能讓解說自行猜測新規則。
