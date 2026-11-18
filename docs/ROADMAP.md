# Taiwan Mahjong Trainer — 產品與工程藍圖

> 狀態：規劃文件（2026-11-19）；已完成與計畫中功能必須分開標記。  
> Repository: https://github.com/kodlbegiko/taiwan-mahjong-trainer

## 1. 願景與定位

打造一套**開源、離線優先、台灣 16 張麻將真人玩家專用**的訓練系統：從何切、牌效率、聽牌、攻防，到牌局複盤與個人化訓練。核心價值不是代替玩家出牌，而是讓玩家看懂理由、找到弱點，並能衡量自己是否真的進步。

**北極星指標**：玩家在未見過的標準測試題上，決策品質隨訓練而改善。不得把答題次數或對局勝率單獨當作能力提升的證據。

目前**不以**四人即時連線、賭博計分平台、付費 API、通用大型 AI 聊天機器人為 MVP。

## 2. 目前基線（v0.1）

- ✅ 17 張非花牌何切練習、難度選擇、隨機產題
- ✅ 一般牌型（五面子＋一對將）向聽數、有效進張、各候選捨牌排序
- ✅ 瀏覽器本機練習紀錄（localStorage）、基本自動測試
- ⚠️ 現有題目由胡牌型擾動產生，分布不代表真實對局
- ⚠️ 尚未支援公開副露／明牌、台數、家規、過水、攻防估計、完整牌譜
- ⚠️ 現行排序只代表結構性牌效率：低向聽 → 進張張數 → 進張種類，不等於實戰最佳策略

程式入口：src/tiles.js、src/shanten.js、src/practice.js、src/app.js。使用原生 ES Modules，Node.js 20+ 的內建測試工具；先保持相容，避免過早重寫框架。

## 3. 產品六大模組

| 模組 | 核心能力 | 基本輸出 |
| --- | --- | --- |
| 牌效率學院 | 何切、向聽、有效進張、搭子拆解、兩巡效率、多面聽 | 可核驗的出牌比較與解說 |
| 攻防訓練場 | 巡目、公開牌、吃碰槓、攻守切換 | 風險因素與決策權衡，不捏造放槍率 |
| 牌局複盤室 | 標準牌譜、逐巡重播、替代路線 | 玩家當時視角及局後全資訊視角 |
| 成長中心 | 弱點標記、間隔複習、能力變化 | 以未見測試題驗證進步 |
| 教學教練 | 分程度課程、逐步解釋、觀念補強 | 有證據可追溯的解說 |
| 實戰模擬場 | 完整規則引擎、單機 Bot、局後回顧 | 可重播合法對局 |

## 4. 里程碑與驗收門檻

| 版本 | 重點 | 驗收標準 |
| --- | --- | --- |
| v0.1 ✅ | 何切練習器 | 可運作且有基本測試 |
| v0.2 | 牌效率 2.0 | 牌型解析、聽牌題、固定測例、完整可核對解說 |
| v0.3 | 題庫與學習紀錄 | 題目分類、弱點分析、可重現題目、間隔複習 |
| v0.4 | 明牌與副露 | 吃碰槓後牌數與向聽計算、明牌扣除、家規資料模型 |
| v0.5 | 攻防學院 | 情境題、風險依據、估計與確定性分離 |
| v0.6 | 計台與桌規 | 可配置 RuleProfile、台數測例、結算一致性 |
| v0.7 | 牌譜複盤 | MatchRecord JSON、回放、局部資訊隔離 |
| v0.8 | 實戰模擬 | 四人狀態機、合法 Bot、可重播完整對局 |
| v0.9 | 個人化訓練 | 由錯誤類型導向練習與能力診斷 |
| v1.0 | 正式版 | PWA、文件、使用者可重現的 benchmark、品質門檻 |
| v2.0 | 開放策略研究 | 策略介面、社群題庫、可比較的公開評估 |

版本號是功能範圍，不是交付日期承諾。各版需先通過 correctness gate 才能擴大功能。

## 5. 下一個開發週期：v0.2（最高優先）

**P0**
1. 牌效率正確性：擴充固定 golden cases；對合法隨機手牌做至少 10,000 個交叉驗證案例。參考實作必須獨立，差異需有具體理由，不得直接忽略。
2. 可解釋的牌型拆解：列出五面子／搭子／將眼或孤張候選，以及棄牌如何改變有效進張。解說結論應由演算法資料產生。
3. 練習題契約：題目 ID、規則版本、產生器版本、種子、完整手牌、答案及評分依據均可保存。
4. 聽牌／多面聽題型：輸出所有有效胡牌張與剩餘理論張數；不得混淆聽牌與下一摸後向聽下降。

**P1**
5. 題庫與錯誤分類：至少 200 題經驗證的可重現題，提供基本分類、篩選。
6. 訓練紀錄：從只存總成績升級為可回溯的單題決策紀錄；使用 IndexedDB 或可版本化的本機儲存。
7. UI 改善：手機操作、鍵盤操作、學習提示；避免答題後直接顯示無法理解的數值。

驗收：現有公開 API 不破壞；既有測試全部通過；新增正確性、資料重播、解說一致性測試；瀏覽器可以從產題、作答、看理由到下一題完成閉環。

## 6. 工程資料契約（先定義，再平行開發）

現有 exports，v0.2 必須先保持相容：
- shanten(tiles16or17): number
- improvingDraws(hand16, visible=[]): { shanten, draws, kinds, copies }
- generateHand(level='intermediate', rng=Math.random): number[17]
- rankDiscards(hand17, visible=[]): ranked array
- gradeAnswer(ranking, chosen): grading result

目前牌碼採 0–33（萬 0–8、筒 9–17、索 18–26、字 27–33），各類最多四張；花牌另行建模。計算手牌為 16 張，摸牌後為 17 張；一般胡牌為五面子一對將。副露、花牌及家規必須透過明確狀態／設定輸入，不能默默混入現有函式。

未來需要定義並版本化：
- RuleProfile：計台、過水、花槓等桌規，明確寫出預設值。
- Exercise：id / version / seed / hand / visibleTiles / taskType / answerRules。
- DecisionRecord：exerciseId / chosen / answerMetadata / duration / algorithmVersion。
- MatchRecord / Turn / Action / PlayerView：合法動作、時間序、資訊可見範圍、重播資料。

核心演算法和 UI 分層；不允許讓 UI 的 DOM 狀態成為唯一可重現的遊戲資料。

## 7. 可靠性與風險邊界

1. **數學精確與策略估計分開**：向聽與已知牌數可驗證；攻防放槍率、期望得分只有模型和證據可用時才量化，否則呈現特徵與不確定性。
2. **隱藏資訊保護**：策略器只接收當時 PlayerView 可見資訊；局後全資訊只能作複盤，不能回填當時決策。
3. **題庫偏差**：同時提供胡牌型擾動、合法隨機發牌、模擬局面抽樣；標記來源且測量題型分布。
4. **家規差異**：不假定「北／中／南」只有一種規則。RuleProfile 必須能明示並驗證變體。
5. **隱私與成本**：離線優先，核心功能不需要登入或付費 API；若將來收集社群答題資料必須明確 opt-in。

## 8. 平行開發工作流

建議由一位整合者管理 main 與規格；其餘工作者各自建立 feature branch / worktree，禁止直接推 main。

| 工作流 | 專責與主要檔案 | 不應修改 |
| --- | --- | --- |
| A：核心數學 | src/shanten.js、src/tiles.js、tests/core-*.test.js | app.js、style.css |
| B：解說引擎 | src/analysis/、tests/analysis-*.test.js | shanten.js、app.js |
| C：題庫與進度 | src/practice.js、src/training/、src/storage/、data/exercises/、tests/training-*.test.js | shanten.js、app.js |
| D：前端體驗 | index.html、style.css、src/app.js、public/ | src/shanten.js、src/practice.js |
| E：驗證與基準 | tests/benchmark-*.test.js、tests/golden-*.test.js、scripts/benchmark*.js、docs/quality/ | src/核心邏輯 |
| 整合者 | README.md、docs/ROADMAP.md、跨模組契約與 PR 整合 | — |

工作者遇到跨檔案需求時：先提出介面變更提案，禁止私下改動其他工作流的專責檔案。PR 必須描述改動、相容性、測試結果、已知限制與回退方式。

整合順序：核心契約及驗證 → 解說／題庫 → UI → 跨模組回歸測試。合併每個 PR 後皆執行 npm run check。

## 9. 開源與衡量

- PR 必須附可重現牌例或測試，不以「AI 說這樣打較好」當作證明。
- Benchmark 除答題正確率外，也追蹤決策時間、非最佳效率損失、演算法耗時、不同牌型分組的錯誤分布。
- 正式公開的教學解說需能追溯到計算輸出、規則版本及具體牌例。
- 對使用者只承諾可核對的改善，不誇大實戰勝率。

## 10. 發展原則

**牌效率正確性 → 可解釋教學 → 個人化訓練 → 攻防判斷 → 牌局複盤 → 實戰模擬 → 開放策略評估。**

每個里程碑都應形成獨立可使用、可測試、可重現的成果，而非只增加功能選單。

## 11. V0.2 整合查核（2026-11-19）

- [x] 確認五個工程分支及 Pull Request（#1 core、#2 benchmark、#3 explain、#5 training、#4 UI）；各分支 CI success 只代表個別分支檢查。
- [x] 已以 PR #6 合併 `docs/API_CONTRACT.md`、`docs/INTEGRATION_PLAN.md`、`docs/quality/V0.2_INTEGRATION_REPORT.md`；PR #2 已合併獨立測試與 Benchmark（兩個 TODO 缺陷未修復）。
- [x] 在 Draft PR #10 疊合四個功能 PR 執行整合 CI：66 tests、60 pass、3 fail、1 skip、2 TODO，**NO-GO**。
- [x] 第二輪重新核對最新 main / feature SHA；無新修復 commit。更新 Draft PR #10，保留既有測試而不覆蓋衝突。
- [x] 第二輪隔離 [CI #44358617174](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44358617174)：67 tests、61 pass、3 fail、1 skipped、2 TODO；固定 seed 10,000 題**數值級 Oracle** 通過，但無法豁免 Q-001 golden。
- [ ] [Issue #13](https://github.com/kodlbegiko/taiwan-mahjong-trainer/issues/13)：main 分支保護仍未啟用；需人工到 GitHub Settings / Rules 設定，並測試 enforcement。
- [ ] 修復 Q-001：四組槓子向聽錯誤，取消 TODO 失敗標記。
- [ ] 修復 Q-002：何切捨牌必須扣除可摸數，統一 ranking/評分/解說與題目版本。
- [x] 固定 seed 的 10,000 題數值級獨立 Oracle 在整合 SHA `4f673f97` 通過（不代表所有邊界牌型均正確）。
- [ ] 整合 HEAD 的 `npm run check` 全綠、Q-001/Q-002 強制回歸無 TODO、跨模組一致性及主線回歸通過。
- [ ] 接通 v2 DecisionRecord 的 UI，並驗證 v1 localStorage 保留與匯入／匯出；若尚未接線須在 release notes 列未完成。
- [x] Staging `808e245e` 的 [Chromium browser smoke #44359395885](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44359395885) 在桌面 1440px 與手機模擬 390px 完成答題、鍵盤、既有 localStorage 重載，並上傳視覺截圖。
- [ ] iOS/Android 實機、人眼視覺驗收、v2 DecisionRecord UI 接線、PWA 安裝／離線；manifest 並不等於離線 PWA。
- [ ] 按整合驗證結果更新 README、CHANGELOG 與最終合併 PR / SHA；不得先標記 V0.2 完成。

註：以上勾選僅是整合審查／契約文件已建立，不是功能實作已併入正式版。

## 12. 第三輪整合驗證（2026-11-19；第 11 節保留為歷史稽核快照）

- [x] PR #16：在核心分支啟用 Q-001 必過 Golden Regression；PR #1 核心合併 main `f15e8fc3404ec380b65bc1493a87e76da6b4a1c2`，主線 Verify #44363444102 success。
- [x] PR #17：在題庫分支啟用 Q-002 必過 Golden Regression；PR #5 題庫及 v3 版本化資料合併 main `9f74e528291e3a2a945ed5d63b99fdaa3eba5d35`，主線 Verify #44364507850 success。
- [x] PR #3 解說從 canonical `rankDiscards/gradeAnswer` 取得數值與評分；合併 main `ed47593c0f209d295e9e0da941f0d0d1aa6b5638`，主線 Verify #44364857547 success。
- [x] Draft PR #10 以最新 main＋#4 UI 的正式原始 blob 重建 staging，保留整合專用測試，SHA `7564f0c840129c8bc20b4ca86c74aa253f12f4b3`；[Verify #44365221250](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221250) 81/80 pass/0 fail/1 opt-in skip/0 TODO；含 10,000 題數值級 Oracle、Q-001/Q-002/I-003 強制一致性檢查。
- [ ] PR #4 最終手機 Chromium 模擬、鍵盤、v1 localStorage 保存與主線合併後回歸驗收；不可沿用歷史 SHA 代替。
- [ ] 牌型拆解教學與聽牌／多面聽新題型的**瀏覽器 UI 接線**；新版 DecisionRecord 實際 UI 儲存仍未完成（底層純函式和 adapter 不等於已向玩家提供）。
- [ ] iOS/Android 實機操作與完整離線 PWA 安裝（Service Worker 尚未提供），以及 Issue #13 的 main 強制保護規則。
- [ ] 最新正式品質報告、CHANGELOG、主線 CI 及所有 V0.2 必要功能驗收；通過後才能把里程碑從 NO-GO 改為 GO。

**註：第 11 節當時未修的 Q-001/Q-002 現已由第 12 節處理；不要將舊勾選狀態讀成現在的狀態。**
