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
// 欄位：{ shanten, kinds, copies, draws: [{tile,label,count}], drawMeaning }
// 數值完全採用 rankDiscards(hand17, visibleTiles)；
// 待 Q-002 修正後，本範例捨南預期 copies=2。

const structure = analyzeStructure(result.selected.hand16);
console.log(structure.decompositions[0].counts);
// => {meld: 5, head: 0, taatsu: 0, isolated: 1}
```

牌碼沿用 `src/tiles.js`：0–8 萬、9–17 筒、18–26 索、27–33 東南西北中發白；每種最多四張。輸入 `hand17` 必須是 17 張非花牌，`discard` 必須存在於手牌，`visibleTiles` 是**不含自身手牌**的已知其他牌。`maxDecompositions` 預設 4，支援 1–12；函式不改變輸入。

## 輸出契約（`schemaVersion: '0.2.0'`）

- `scope`：計算範圍與剩餘張數定義，禁止誤讀為摸牌機率。
- `input`：標準排序的 17 張手牌、捨牌與可見牌。
- `originalStructure`：17 張的同分拆解（**僅展示摸牌後結構，不應與捨後 16 張向聽直接比較**）。
- `selected`：所選方案，含 `discard`、`hand16`、`rank`（canonical ranking）與 `coreRank`（相容別名，值與 rank 一致）、`rawCoreMetrics`（canonical 值的相容快照）、`metrics`、`structure`。
- `candidates`：每一種**不同牌碼**的捨牌方案，按「向聽數升序 → 有效進張張數降序 → 種類降序 → 牌碼升序」排序；皆有結構化拆解。
- `decision`：`grade`（`optimal` / `same-shanten` / `higher-shanten`）、`trainingGrade`（原 `perfect` / `acceptable` / `improve`）、`trainingTitle`、`rank`、`equivalentDiscards`（相同向聽及 copies，無論 kinds）、`comparison`（對最佳方案的 `shantenDelta`、`copiesDelta`、`kindsDelta`）、`structuralTradeoff`（兩種捨法下保留牌可扮演的角色）、附 `evidence` 的 `reasons`、`explanations.beginner` 與 `.advanced` 繁中陣列。

`structure.decompositions[]` 中每種解均列出 `melds`、`head`、`taatsu`、`isolated`、`counts`、`scoreBasis`、`signature`。每一張牌**恰好被分到一個分組**，可由 `base - meldCredit - taatsuCredit - headCredit` 核對 `structure.structuralShanten`。`structure.shanten` 永遠是 canonical `shanten()` 的輸出；只有在 `matchesCanonical === true` 時才能宣稱該拆解的分數等於正式向聽。若有差異，只標記為未對齊見證，不斷言核心向聽錯誤。結構相同分數可能有多種合法拆法；`truncated` 表示只顯示部分同分結果。`structuralTradeoff.possibleRoles` 也只保證涵蓋已列出的拆解，不應解讀為所有可能角色。

## Canonical ranking／grade 資料來源（I-003 適配）

`explainDiscard` **僅呼叫一次** `rankDiscards(hand17, visibleTiles)` 作為全部候選及 `shanten/kinds/copies/draws` 的唯一數值來源。不得依 `draw.tile === discard` 再減 1，不得自行重新排序。`coreRank` / `rawCoreMetrics` 是相容欄位，從 canonical ranking 直接複製，沒有第二套分數。教學只補上牌面 label 與可驗證結構見證。

`decision.trainingGrade` 與 `trainingTitle` 直接來自 `gradeAnswer(canonicalRanking, discard)`；教學枚舉值透過以下**語意映射**產生，而非自行比較 kinds 或另外評一次分：

| `gradeAnswer.grade` | `decision.grade` | 判準 |
| --- | --- | --- |
| `perfect` | `optimal` | 向聽數及 copies 等於排名首位 |
| `acceptable` | `same-shanten` | 向聽數等於首位，但 copies 不等 |
| `improve` | `higher-shanten` | 向聽數較高 |

**種類數只做排序中的 tie-break**；因此某候選即使 kinds 少於首位，只要 shanten/copies 相同，訓練仍評為 `perfect`，教學不得稱其「非最佳」。相同評分但排名較後時，`KIND_TIE_BREAK` 文案會明示此區別，並附數值證據。

### 上游相依：Q-002（Issue #8）

`rankDiscards` 的正確語意是對每個候選呼叫 `improvingDraws(hand16, [...visibleTiles, discard])`；由它唯一負責把**本次捨牌計入一次**（且不得同時放進 `visibleTiles`）。解說不能自行扣第二次。

截至本次修復，訓練 PR #5 的 `rankDiscards` **尚未完成 Q-002**。因此 I-003 的跨 API 數值／評語一致性測試可在舊實作通過，**但這不代表理論可摸張數已正確**。整合者必須等 Q-002 修正後，再執行 PR #10 的整合測試及 `npm run check`；尤其手牌範例捨 `0` 應得 `copies=6` 而非 `7`。這是獨立 release gate，禁止以對齊舊數值宣稱已關閉 Q-002。

此外「有效進張」在此專指**下一摸後可降低向聽數（聽牌時為可胡牌）**，不是保證會摸到的張數；也不是兩巡效率、攻防風險或得分期望。公開副露、花牌、特殊牌型及桌規仍需由其他工作流擴充正式契約。

## 測試

```bash
node --test tests/analysis-*.test.js
npm run check
```

測試涵蓋固定牌型、同分拆解、16/17 張分數、可見資訊、canonical 值與 grade 一致、純函式、錯誤輸入、確定性隨機例與各方案完整牌數守恆。Q-002 物理剩餘張數的獨立強制門檻在 PR #10 的整合測試中。若核心的分數定義更新，必須同步檢查 `scoreBasis` 的一致性斷言，不能讓解說自行猜測新規則。
