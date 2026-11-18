# V0.2 獨立品質驗證與 Benchmark

本工作流**不修改正式程式**，只新增 `tests/golden-*.test.js`、`tests/benchmark-*.test.js`、`tests/fixtures/`、`scripts/benchmark*.js`、`docs/quality/`。

## 測試指令

```bash
# CI / 快速回歸：不啟用 10,000 題壓力測試
npm run check

# 只測新增驗證
node --test tests/golden-*.test.js tests/benchmark-*.test.js

# 10,000 題（交替 16/17 張、完整實體牌堆無放回抽樣）
MAHJONG_STRESS=1 MAHJONG_SEED=20261119 MAHJONG_CASES=10000 \
  node --test tests/benchmark-cross.test.js

# 可重現耗時統計（不自動混入 CI 的效能門檻）
node scripts/benchmark-suite.js --cases 500 --seed 20261119

# 同機器同 Node 版本比較退化（先存自己的 baseline）
node scripts/benchmark-suite.js --cases 500 --seed 20261119 --out docs/quality/local-baseline.json
node scripts/benchmark-suite.js --cases 500 --seed 20261119 \
  --baseline docs/quality/local-baseline.json --max-regression 1.5
```

`local-baseline.json` 為**執行時輸出**，不要把特定電腦的結果當作跨機器 CI 絕對門檻；更新 baseline 應經過審查。CLI 會報告 shanten 與 rankDiscards 的 p50、p95、最大耗時、總耗時與 checksum。排名計時會對約 `ceil(cases/20)` 道 17 張手牌執行。為減少 Node/JIT 波動，先預熱，但短時間 p95 仍有雜訊。

## Oracle 原理及獨立性

`tests/fixtures/reference-oracle.js` 採用**自目標向現有手牌的匹配**，不會讀取或複製 `src/shanten.js` 的 DFS。它逐張掃描目標牌種，使用動態規劃建構恰好五個面子（一組三張刻子或同花色連續三張順子）、一組將眼。狀態追蹤既有面子／將眼數量，以及前兩種起始順子造成的待補義務。每張目標牌最多四份，跨花色不允許順子。最大匹配張數為 `M`，獨立向聽預期值為 `16 - M`。

此定義針對**不考慮副露及特殊胡法**的結構性一般和牌，且考慮同一種牌的物理四張限制；16 張聽牌應為 0，17 張胡牌應為 -1。此 oracle 與正式實作仍可能有共同的規則理解錯誤，故也存有人工推導的固定 golden 牌例。

進張 Oracle 逐一加一張尚有剩餘的牌，獨立比較目標匹配向聽數是否下降，並用 `4 - 手牌持有 - 可見明牌` 計算剩餘理論張數。它不代表真實摸牌機率；牆內有無牌、花牌、其他玩家暗牌均未知。

## 覆蓋與邊界

- 人工固定牌例：胡牌、單吊、邊張、兩面、跨花色假順子、孤張字牌、四組槓子
- 型別／牌數：16 或 17、牌碼 0–33、最多四張、公開牌與手牌相加不超過四張
- 固定種子：`xorshift32` 無放回模擬 136 張，含固定抽取公開牌，能由 `seed + case index` 重播
- 隨機交叉：快速 200 題，額外 8 題含明牌逐一驗證進張；大型交叉另行手動開啟，至少 10,000 題
- 評分：既有排序、每種不同捨牌、`shanten/copies/kinds/draws` 一致性、perfect/acceptable/improve 分級
- 效能：快測只 smoke，正式分析用 CLI；不在一般 CI 施加易受機器干擾的時間限制

## 不包含的範圍

現有程式尚無正式 `PlayerView` / 隱藏手牌資訊模型，故無法宣稱完整防止實戰資訊洩漏。測試只確認**函式輸入內可見資訊**的扣除與合法性；對 UI、完整局面、吃碰槓、特殊胡法、家規、牌牆抽牌機率、題目 ID/版本/持久化進度並未覆蓋。`generateHand` 現階段可接受 RNG，但產題分布仍是胡牌擾動，並非真實對局分布。

已知缺陷及最小可重現案例請見 [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)。Node 的 TODO 斷言**實際執行且失敗**，但不令現有 CI 整體失敗；修復後移除 TODO，再讓其成為一般必須通過的測試。正式功能程式應由其他工作流修改。
