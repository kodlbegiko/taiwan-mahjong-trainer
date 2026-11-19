# Taiwan Mahjong Master Academy — 跨模組資料與 API 契約 V1

> **狀態：Phase 0 契約提案／獨立 PR，並非已實作 API。**
> Contract ID：`master-academy/1.0.0`；本版物件 `schemaVersion: 1`。基準：2026-11-19，`main` `5e692fd9bce18ff6a947cd7f2045e8425b8fe63b`。合併前五位 AI 應先審閱；有衝突以來源 PR 及契約變更提案協調，**不可偷偷重寫實作**。
> 模組：Rules Engine／Strategy／Learning Academy／Adaptive Training／Academy UI。所有 `src/academy/*` 等預定路徑為**提議介面，不代表目前存在**。

## 0. 規範、相容與最小共識

- `MUST` 必須，`SHOULD` 建議，`MAY` 可選。若欄位未註記可選，即為必填；可選一律以 `?` 標記；缺少與 `null` 不等價。所有 TypeScript 標示僅為**文件型別**，目前無 TS 編譯器或 JSON Schema 執行器。
- 所有可獨立持久化／跨模組傳輸的物件均 MUST 含 `schemaVersion: 1` 及 `contractVersion: "master-academy/1.0.0"`（下表以 `V1` 簡寫）；`RuleProfile` 還須自己的 `ruleVersion`，`StrategyAnalysis` 須 `engineVersion`／`modelVersion`，題目還須 `generatorVersion`／`scoringVersion`，**不可混用**。
- 傳輸為 UTF-8 JSON：僅有限數值、布林、字串、陣列、普通物件及 `null`；禁止 `undefined`、`NaN`、`Infinity`、`BigInt`、函式、DOM 物件、`Map`、`Date` 物件。時間使用 UTC ISO-8601（如 `2026-11-19T09:00:00.000Z`），耗時非負整數毫秒。所有 ID 非空且在其命名空間唯一。序列化不能依賴未紀錄的全域時鐘、`Math.random` 或物件參照。
- 每個欄位的資料所有者見第 2–6 節；消費者只能讀取經驗證的副本，不得在渲染時修改引擎結果。未知 `schemaVersion`／`contractVersion` MUST fail closed；同版未知必填欄位拒絕、未知擴充只許在 `extensions` 中使用受控命名空間，不可讓別的欄位暗改語意。Minor 版只可增加**向後相容的可選**欄位；必填、分數、桌規與隱藏資訊的語意變更須升 Major 並保留 migrator。
- **已存在的正式契約不更名**：`src/tiles.js` 的 `0..33`、`toCounts`；`shanten`、`improvingDraws`、`rankDiscards`、`gradeAnswer`、`explainDiscard`；`createExercise` 的 schema v3（`ruleVersion:"taiwan-16-standard-v1"`、`scoringVersion:"efficiency-v2"`），`createDecisionRecord` v3、`tw-mahjong-trainer:archive:v3`／`session:v1` 舊 key；`training/waits.js` 的 `{tile,copies}` 與 core 的 `{tile,count}` 以明示 adapter 互轉。**V1 Academy 不等於修改上述 schema 至 1**。
- 規則只確認既有「未副露、非花牌、台灣十六張、五面子一將眼」結構牌效；自摸、放槍、過水、包牌、補花、吃碰槓優先權、計台和地方桌規若沒有完整可引來源與 Golden fixture，統一標 `unverified`／不允許自動判分。不可憑「台麻一般如此」硬編碼。
- 三種驗證層級：**shape**（型別、必填、enum、上限）→ **domain**（實體牌守恆、合法動作、隱藏資訊、時間序）→ **semantic**（同版本規則／評分器重播核對）；不能因 JSON 合法而宣稱牌局合法。驗證函式不得改寫輸入。
- `RuleProfile`／全局完整 `GameState`／未公開 `TurnEvent`／`AcademyQuestion.answerKey` 絕不能送至 UI 或 Strategy；**UI 接收的是降權後 DTO**，後端不論瀏覽器本機或未來伺服器，都要在 API 邊界先投影再序列化。

## 1. 共用型別、牌種與實體牌身分

`TileType = integer in [0,33]`，與現有 `src/tiles.js` 完全一致：

| 範圍 | 說明 | 張數 |
| --- | --- | --- |
| `0..8` | 一萬至九萬 | 各 4 |
| `9..17` | 一筒至九筒 | 各 4 |
| `18..26` | 一索至九索 | 各 4 |
| `27..33` | 東、南、西、北、中、發、白 | 各 4 |

`PhysicalTileId` 使用可解析的**字串**而不是擴張 34 種牌 ID：標準牌 `t:<TileType>:<copyIndex>`，`copyIndex ∈ 0..3`；例如 `t:27:3`。只有完整牌局引擎依 `RuleProfile` 建構／分配 physical ID，不能由 UI 隨意指派。映射 `typeOf("t:27:3") = 27`；`typeOf` 對花牌必須拋錯，**絕不可寫成 `34..41`**。單一牌局中每個 `PhysicalTileId` 只存在一份，`TileType` 的總副本數 ≤4。

花牌是**另一個辨識空間**：`FlowerCode` 是受 RuleProfile 白名單約束的字串（示範選項 `season-spring`、`season-summer`、`season-autumn`、`season-winter`、`plant-plum`、`plant-orchid`、`plant-bamboo`、`plant-chrysanthemum`），physical ID `f:<FlowerCode>:<copyIndex>`；預設候選每種類別 1 張，但**實際花牌種類、張數、補花、計台與是否採用都必須由 RuleProfile 明確宣告**。`RuleProfile.tileSet.flowers.enabled=false` 時不得產生花牌。花牌不進 `shanten`／`toCounts`／34 張 SVG 查表；其美術要另建素材且有 fallback。

### TileIdentity — owner: Rules Engine，V1，visibility: 依所在區域

| 欄位 | 型別 | 規範 |
| --- | --- | --- |
| `schemaVersion`／`contractVersion` | `1`／固定字串 | 必填，V1 |
| `id` | `PhysicalTileId` | 必填，同局唯一、可解析 |
| `kind` | `"standard" \| "flower"` | 必填 |
| `tileType?` | `TileType` | `kind=standard` 必填；花牌必須缺少 |
| `flowerCode?` | `string` | `kind=flower` 必填且列於 profile；標準牌必須缺少 |
| `copyIndex` | `integer≥0` | 必填，標準 0..3，花牌受 profile count 限制 |
| `extensions?` | `object` | 可選，不得改變身分或可見性 |

**驗證**：parse ID 與分支欄位一致；與牌組設定、重複、最多四張／花牌配置交叉檢查；隱藏的 `TileIdentity` 只能存 GameState／private events。JSON 為上述物件（不可存原型或混用整數牌碼）。既有 v3 `hand: number[]` 維持不變；只有在已證實封閉手牌全是標準非花牌時才可用 `tileType` 向下轉換，完整 GameState 不允許無損轉成舊 Exercise。

## 2. Rules Engine：全資訊與玩家視角分離

### RuleProfile — owner: Rules Engine，V1，visibility: public configuration（未驗證桌規仍不得宣稱正式可用）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `schemaVersion`／`contractVersion` | V1 | 必填 |
| `profileId`／`ruleVersion` | `string`／`string` | 不變識別／語意版本；題目、事件、分析全部保存 |
| `status` | `"verified" \| "experimental" \| "incomplete"` | 必填；`verified` 需要 fixture/reference 與審核 |
| `scope` | `"structural-16" \| "four-player"` | 結構牌效或真正四人規則，不得假冒相同能力 |
| `sourceRefs` | `string[]` | 桌規文字來源／授權及審核紀錄；完整四人 verified 時不可空 |
| `tileSet` | `{standardTypes:34,copiesPerType:4,flowers:{enabled:boolean,codes:{code:string,copies:integer}[]}}` | 必填 |
| `handShape` | `{base:16,drawn:17,winningMelds:5,eyes:1}` | 結構基線；已副露/槓牌時另按 phase 與有效牌數校驗 |
| `turnPolicy` | `{claimPriority:"configured" \| "unverified", replacementDraw:"configured" \| "unverified"}` | 沒有 verified fixture 時不得產生或判定相關動作 |
| `winningPolicy` | `{mode:"structural-only" \| "configured",configRef?:string}` | 自摸／放槍／過水等若未定義不得宣稱合法 |
| `scoringPolicy` | `{mode:"undefined" \| "configured",configRef?:string}` | 無已核對計台表時 `undefined`，不計分、不推估台數 |
| `extensions?` | `Record<string,unknown>` | 只限經定義的 namespaced 擴充 |

**驗證**：狀態／政策之交叉限制、牌組上限及來源 fixture；`structural-16` 不開放吃碰槓合法性、四人結算或花牌計台，`four-player` 未 verified 不得導出「正式合法」。規則快照需與其 `profileId + ruleVersion` 一起持久化；不存在「默認台灣桌規」的隱形 fallback。既有 `RULESET_VERSION='taiwan-16-standard-v1'` 只對舊的**結構範圍**，不得宣稱已涵蓋完整 RuleProfile。

### RoundState — owner: Rules Engine，V1，visibility: projected public

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`roundId`、`handIndex` | V1、`string`、`integer≥0` | 必填 |
| `dealerSeat`／`currentSeat` | `Seat=0\|1\|2\|3` | 必填，固定 seat 順序及 dealer；不可從 UI 推斷 |
| `phase` | `"dealing"\|"await_draw"\|"await_discard"\|"claim_window"\|"replacement"\|"settled"` | 必填 |
| `prevailingWind?`／`roundWind?` | `"east"\|"south"\|"west"\|"north"` | 只有 profile 定義風圈／風位時才可有 |
| `scores?` | `number[4]` | 僅有配置並核對之 scoringPolicy 才可提供；不得從牌效率虛構 |
| `lastPublicEventSeq` | `integer≥0` | 必填，public projection 的一致時間點 |

**驗證**：phase transition、seat turn 與相應 event Seq 一致，規則版本匹配；未配置計分則 `scores` 缺席。RoundState 不包含手牌、壁牌、Bot 策略或未知牌。

### GameState — owner: Rules Engine ONLY，V1，visibility: `internal-full`（**禁止直接外傳**）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`gameId`、`ruleRef` | V1、`string`、`{profileId,ruleVersion}` | 必填 |
| `round` | `RoundState` | 必填 |
| `players` | `PlayerPrivateState[4]` | 每項 `{seat,concealed:PhysicalTileId[],melds:Meld[],river:Discard[],flowers:PhysicalTileId[]}`，可含未公開手牌 |
| `wall`／`replacementWall?` | `PhysicalTileId[]` | 依規則定義的完整未摸堆／補牌；只允許 engine 讀 |
| `events` | `TurnEvent[]` | 唯一權威序列；可包含 private / system event |
| `rng` | `{seed:string,algorithmVersion:string,counter:integer≥0}` | 重播必需；不可使用未記錄的亂數 |
| `revision` | `integer≥0` | 狀態事件序號，動作提交樂觀鎖 |
| `integrity?` | `{sha256:string}` | 經定義 canonical JSON 序列化後計算，不得假裝防竄改權限機制 |

`Meld={kind:"sequence"|"triplet"|"kong",tileIds:PhysicalTileId[],open:boolean,sourceSeat?:Seat,sourceEventId?:string}`；`Discard={tileId,seq,claimedByEventId?}`。同一實體 ID 全牌組至多在**一個當前實體區域**（手、河、公開組、壁、花區）；宣告從河牌被領取須轉移 ownership 或用獨立 claim-reference，不能「河牌仍在 + 副露再新增同一張」雙重計數。四人起手/槓牌/補花時各 phase 的 effective tile count 必須由 profile 與 action history 計算；不能對所有 phase 強制 16/17 原始長度。驗證時從 seed + rules + events 重播，再比較壁牌、花牌、revision 與現況；未配置四人規則不具備正式判局資格。

### PlayerView — owner: Rules Engine projection，V1，visibility: `player-visible`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`viewId`、`gameId`、`ruleRef` | V1、`string`、`string`、ref | 必填 |
| `audienceSeat`／`asOfEventSeq` | `Seat`／`integer≥0` | 必填，視角 seat + 時間序 |
| `round` | `RoundState` | 只有該時間點公開、非私有的欄位 |
| `self` | `{seat,concealed:TileIdentity[],melds:Meld[],river:Discard[],flowers:TileIdentity[]}` | 僅本人非公開手牌可見 |
| `opponents` | `{seat,concealedCount:integer≥0,melds:Meld[],river:Discard[],flowers:TileIdentity[]}[]` | **禁止對手 concealed[] 或其實體 ID** |
| `publicEvents` | `TurnEventPublic[]` | 依 asOf event 序號裁切且逐事件隱藏欄位 |
| `legalActions` | `LegalAction[]` | 本視角合法候選；只含玩家可以知道的資料 |
| `knownUnavailableTypes` | `TileType[]` | 可由自己手牌 + 公開牌推得；不可由整個 GameState 壁牌計算 |
| `capabilities` | `{structuralScore:boolean,roundActions:boolean,settlement:boolean}` | 未驗證四人規則不得謊稱可以合法判局 |

**關鍵防洩漏驗證**：`Object.keys(view)` recursive allowlist、對照對手 concealed 隨機置換的兩個完整 GameState：只要公開事件／自己的牌相同，投影輸出（除非合法可推測之公開計數）必須逐欄相同；UI／策略測試不得 import `GameState`，不得出現 `wall`、`replacementWall`、`rng`、`futureEvents`、`answerKey`、`opponents[*].concealed`、任何對手暗牌 physical ID。即使系統在本地 JS 同一 origin 運作，也應以**獨立純函式投影產生副本**，禁止藉 shared object reference 改寫／讀回隱藏欄位。`PlayerView` 僅為遊戲畫面的玩家可見資料；公開的回放視圖要用不同 `visibility:"postgame"` 授權和 schema，不能重用此 DTO 偷渡局後資訊。

### LegalAction — owner: Rules Engine，V1，visibility: player-visible, exact only when supported

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`actionId`、`kind` | V1、`string`、`"discard"\|"draw"\|"chi"\|"pong"\|"kong"\|"win"\|"pass"\|"replace_flower"` | 必填；只有已驗證規則/phase 支援者才可出現 |
| `actorSeat`、`expectedRevision` | `Seat`、`integer≥0` | 必填，避免用過期畫面提交 |
| `tileIds` | `PhysicalTileId[]` | 必填，僅屬玩家手牌或已公開且合法可領取者；不得引用對手暗牌 |
| `claimEventId?` | `string` | 對公開棄牌吃碰槓等才必填 |
| `ruleRef`／`legalityBasis` | `RuleRef`／`{engineVersion,reasonCodes:string[]}` | 必填，精確引擎判斷依據，不含秘密狀態 |
| `extensions?` | `object` | 只限無資訊洩漏的驗證過內容 |

**驗證**：同一 `actionId` 可重現，actor/revision/phase、實體牌 ownership、桌規 claimPriority 都正確；不支持之動作不得「先顯示但按了沒作用」。提交動作時引擎以真實 GameState 再驗證，不信任客戶端傳回 `legalActions`。`draw` 可能是引擎自動動作，不應讓 UI 擅自選壁牌。

### TurnEvent — owner: Rules Engine，V1，internal ledger with public/private redaction

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`eventId`、`gameId`、`seq` | V1、`string`、`string`、`integer≥1` | 必填，`eventId` 與 `(gameId,seq)` 唯一 |
| `ruleRef`、`actorSeat?` | ref、`Seat` | 必填規則版；系統初始化可無 actor |
| `type` | `"deal"\|"draw"\|"discard"\|"claim"\|"kong"\|"flower"\|"win"\|"pass"\|"settle"` | 必填 |
| `visibility` | `"public"\|"seat-private"\|"system-private"` | 必填，決定 payload 投影 |
| `payload` | `Record<string,JSONValue>` | 必填，**事件型別專屬白名單**，私有抽牌只在 private payload |
| `causedByActionId?`／`previousEventId?` | `string` | 有源 action／事件時必填，因果可重播 |
| `occurredAt?` | UTC ISO-8601 | 僅供顯示；`seq` 才是遊戲順序與 deterministic replay 基準 |

使用兩個不同型別：`TurnEvent`（全資訊內部 ledger）與 `TurnEventPublic`（經投影，private draw 只可露出「某席摸了一張」等允許摘要，**不含 tileId**）。避免原事件 JSON 上做 `delete payload.tileId` 後仍保留其他暗牌欄位；應依事件 type + visibility 從零組建公開物件。事件追加後不重寫；同序號內容衝突或重播不一致 fail closed。

## 3. Advanced Strategy：證據／估計嚴格分離

### StrategyAnalysis — owner: Advanced Strategy，V1，input ONLY PlayerView

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`analysisId`、`viewRef`、`ruleRef` | V1、`string`、`{gameId,viewId,asOfEventSeq,audienceSeat}`、ref | 必填，鎖定唯一決策視角 |
| `engineVersion`／`modelVersion?` | `string` | 必填確定性分析器版；有實際估計模型時才可給 modelVersion |
| `legalActionIds` | `string[]` | 必填，必須是該 PlayerView `legalActions` 子集合，不能憑空生操作 |
| `recommendations` | `{actionId,rank,reasonCodes:string[],metrics:Metric[]}[]` | rank 為非負整數；每個推薦有可追溯 Metric |
| `assumptions`／`limitations` | `string[]` | 必填，明列未知資訊與桌規限制 |
| `computedAt?` | UTC 時間 | 可選純 metadata，不可改變確定性排序 |
| `evidenceRefs?` | `string[]` | 可選；指向測試 fixture 或 model 版本，不得直接附 GameState |
| `status` | `"exact-structural"\|"heuristic"\|"model-estimate"\|"unavailable"` | 必填，不得標示混合結果全部精確 |

`Metric={name:string,value:number|null,unit:string,epistemic:"exact"|"heuristic"|"estimated"|"unknown",method:string,ruleRef:RuleRef,sampleSize?:integer,interval?:{low:number,high:number},calibrated?:boolean}`。`epistemic=exact` 僅限經校驗的向聽、已知張數等**在指定資訊邊界下精確的結果**，不等於未知壁牌中抽牌機率。`epistemic=estimated` 的放槍率、期望得分必須有方法／樣本來源／適用局面／校準狀態與不確定區間；沒有模型就 `value:null,epistemic:"unknown"`，不可輸出編造百分比。`heuristic`（攻守特徵或排序）也不得顯示成精確機率。

驗證：輸入先驗證 `PlayerView` allowlist，輸出每個 actionId 皆存在於 legalActions，不可查 GameState／未知手牌／完整壁牌，重播同 view + 版本結果一致；如果 RuleProfile 不支援計分或 claim，不可量化台數／完整四人風險。`gradeAnswer` 仍是**既有何切**正式答題權威，StrategyAnalysis 不能悄悄覆寫原 v3 教學或評分。

## 4. Learning Academy：課程與題目引用可稽核結果

### SkillTag — owner: Learning Academy registry，V1，visibility: public

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`tagId` | V1、`string` | 必填且穩定，如 `efficiency.shanten`、`efficiency.ukeire`、`waits.enumeration`、`strategy.risk-awareness` |
| `labelZhTW` | `string` | 必填，UI 文案非規則證據 |
| `scope` | `"exact-structural"\|"strategy-heuristic"\|"unverified"` | 必填 |
| `prerequisiteTagIds` | `string[]` | 必填，registry 無環並指向既有 Tag |
| `status` | `"active"\|"experimental"\|"retired"` | 必填；retired 要可查歷史映射 |

### ErrorType — owner: Learning Academy registry，V1，visibility: public taxonomy

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`errorId` | V1、`string` | 必填穩定 id（如 `higher-shanten`、`lower-ukeire`、`missed-winning-tile`、`false-winning-tile`），直接保留舊 v3 字串 |
| `skillTagIds` | `string[]` | 必填且非空，指向 SkillTag |
| `descriptionZhTW`／`severity` | `string`／`"informational"\|"practice"\|"critical"` | 必填，不推導臨床或真人能力 |
| `source` | `"canonical-grade"\|"heuristic"\|"expert-reviewed"` | 必填；策略推斷錯因須註明不確定 |

### Lesson — owner: Learning Academy，V1，visibility: public learning material（答案須拆開）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`lessonId`／`lessonVersion` | V1、`string`／`string` | 必填；版本變動不覆蓋既有歷史 |
| `titleZhTW`／`objectives` | `string`／`string[]` | 必填，條理可檢 |
| `skillTagIds`／`prerequisiteLessonIds` | `string[]`／`string[]` | 必填，檢查 registry 與 DAG 無環 |
| `ruleRef` | `RuleRef` | 必填，所有示例牌例相同規則版 |
| `questionRefs` | `{questionId,questionVersion}[]` | 必填（可空表示純教學，不能假裝有測驗） |
| `evidenceRefs` | `{analysisId?:string,fixtureId?:string,sourceVersion:string}[]` | 必填，分析或 Golden 證據才可稱為可檢查 |
| `contentBlocks` | `{kind:"text"|"tile-example"|"explanation",content:string}[]` | 必填，不接受任意可執行 HTML |
| `status` | `"draft"\|"validated"\|"published"` | 必填；沒有正式題目驗證不得 `published` |

### AcademyQuestion — owner: Learning Academy，V1，split PUBLIC prompt / PRIVATE answerKey

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`questionId`／`questionVersion` | V1、`string`／`string` | 必填 |
| `lessonRef?`／`skillTagIds` | `{lessonId,lessonVersion}`／`string[]` | Tag 必填且非空；lesson 可選 |
| `ruleRef`／`taskType` | ref／`"discard"\|"tenpai"\|"multi_wait"\|"scenario"` | 必填 |
| `generator` | `{seed:string,index:integer≥0,generatorVersion:string,fixtureId?:string}` | 必填，**可重播** |
| `source` | `{kind:"legacy-exercise-v3"|"player-view-snapshot",snapshotRef:string}` | 必填，決定驗證途徑 |
| `prompt` | `{playerView?:PlayerView,legacyHand?:TileType[],visibleTiles?:TileType[],options:string[]}` | 必填，只可有一種入口；含真實玩家可見資訊 |
| `answerKey` | `{scorerId:string,scoringVersion:string,acceptedActionIds?:string[],acceptedTileTypes?:TileType[],sourceAnalysisRef?:{analysisId,engineVersion},correctnessBasis:"exact"|"expert-reviewed"|"unverified"}` | **僅 grading 層可讀；UI 初次輸出必須移除** |
| `explanationRef?` | `{analysisId,engineVersion,viewId}` | 若引用策略解說則三者必填，且需與題目 ruleRef/viewRef 對上 |
| `status` | `"draft"\|"validated"\|"unscorable"` | 必填；`unverified` 或未知 scoring 不可提供正式滿分判決 |
| `extensions?` | object | 可選，必須 namespaced |

**關鍵契約**：`source.kind=legacy-exercise-v3` 使用 `createExercise/replayExercise/validateExercise` 並以其 `answerRules.version` 及 `createDecisionRecord` 評分，**不得重新推導舊分數**；`scenario` 必須以 Rule Engine 合法 player-view-fixture + 支援的 scorer 產生答案，並另建通過驗證的 `AcademyDecisionRecord` V1（**不能**使用舊的 `createDecisionRecord` v3），否則標為 `unscorable`，不計入能力曲線。策略分析引用 `analysisId + viewId + asOfEventSeq + engineVersion + ruleRef` 的不可變來源；禁止 Lesson 把 model-estimate 當 Golden。給 UI 的 `QuestionPublic` 經 allowlist 移除 `answerKey`、未公開完整局面、grading internal fields，作答後才傳 `GradingResult`（包含原結果與授權的解說）。

**重播**：questionId 單獨不是種子，題目完整快照需存 `questionVersion`、`ruleRef`、`generator.seed/index/version`、對應 `source.snapshotRef`；相同輸入應生成同一題／同一答案，若 engine 版本變更仍能依原版本檢驗；缺舊版本只能顯示 frozen historical snapshot 並標「無法重算」，不能靜默升級。


### AcademyDecisionRecord — owner: Learning Academy grading + Adaptive storage adapter，V1，visibility: private-to-user

**必要的情境題新紀錄類型**：既有 `createDecisionRecord` / `validateDecisionRecord` v3 的 `Exercise.taskType` 只接受 `discard`、`tenpai`、`multi_wait`，且只接受現行結構 `ruleVersion/scoringVersion`。**絕不能傳入 `scenario` 假裝能通過 v3 驗證**。情境題若有可信 scorer，須由獨立的 `createAcademyDecisionRecord` / `validateAcademyDecisionRecord` 與新 sidecar 實作，未實作前一律 `unscorable`，不計入學習閉環。

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `schemaVersion`／`contractVersion` | V1 | 必填，**不是** legacy `RECORD_SCHEMA_VERSION=3` |
| `id`／`questionRef` | `string`／`{questionId,questionVersion}` | 必填、穩定且唯一，引用永久題目快照 |
| `ruleRef`、`scorerId`、`scoringVersion`、`engineVersion` | `RuleRef`、`string`、`string`、`string` | 必填；獨立評分器版本與規則版本逐項相等 |
| `sourceViewRef` | `{gameId,viewId,asOfEventSeq,audienceSeat}` | 必填，評分只依當時玩家可見資訊 |
| `chosenActionId`／`legalActionIds` | `string`／`string[]` | 必填，選擇必屬合法 action 集合且依原 snapshot 核對 |
| `timestamp`／`durationMs` | UTC／`integer≥0` | 必填，時間不是事件合法性的來源 |
| `grade`／`score` | `"perfect"\|"acceptable"\|"improve"`／`number in [0,1]` | 必填，須能由**同一版正式情境 scorer** 重新驗證 |
| `errorTypeIds`／`skillTagIds` | `string[]`／`string[]` | 必填，只能由已驗證 registry 映射，不得臆測 |
| `sourceAnalysisRef?` | `{analysisId,engineVersion,viewId}` | 若情境正解引用策略結果則必填；分析不得是未校準概率的「唯一正解」 |
| `scoringEvidence` | `{basis:"exact"|"expert-reviewed",fixtureId:string,answerSnapshotDigest:string}` | 必填；`fixtureId` 指向版本化且**受限保存**之答案/評分快照；digest 不證明秘密性 |
| `recordKind` | `"academy-scenario"` | 必填，供 record dispatcher 類型分辨 |

`RecordRef={kind:"legacy-v3"|"academy-v1",id:string}` 是新跨模組唯一引用型別。`kind="legacy-v3"` 只能對應已通過 `validateDecisionRecord` 的正式 v3，`kind="academy-v1"` 只能對應已通過 `validateAcademyDecisionRecord` 的 Academy V1；不可只憑 ID 前綴猜版本或混成同一 validator。`AcademyDecisionRecord` 僅供 `scenario`；其不可變原始資料和對應的 question snapshot 存新 `academy-state:v1` 命名空間，**不寫進舊 `archive:v3.records[]`**。未有可靠 scorer/RuleProfile/快照時拒絕生成此 record，UI 只可顯示「情境題尚無正式評分」。

**驗證與重播**：在原始 `questionVersion/ruleRef/scorerId/scoringVersion/engineVersion` 載入固定答題快照；比對 `legalActionIds`、`chosenActionId`、grade/score/errorTypeIds，禁止讀任何未公開 GameState；驗證失敗的紀錄不得供 AbilityProfile/ReviewPlan。舊版本 scorer 已不可用時保留 frozen record 並標註不能重算，**不可改成新版分數**。新實作要新增負面測試：把 scenario 傳給 v3 函式必須拒絕、使用錯誤版本/非法動作拒絕、重複 RecordRef 不重計能力、舊 v3 bytes 原樣保留。

## 5. Adaptive Training：避免把啟發式冒充人類能力量測

### AbilityProfile — owner: Adaptive Training，V1，visibility: private-to-user

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`profileId`、`updatedAt` | V1、`string`、UTC | 必填，不含遠端真實身分資訊 |
| `algorithmVersion`、`calibrationStatus` | `string`／`"uncalibrated"\|"human-calibrated"` | 必填；預設 `uncalibrated`，未經獨立校準不得更改 |
| `skills` | `{tagId,attempts:integer≥0,scoreSum:number,correct:integer≥0,meanDurationMs:number|null,evidenceRefs:RecordRef[],estimatedProficiency:number|null,uncertainty?:{low,high}}[]` | 必填；`estimatedProficiency` 非精確實力、不能保證提升 |
| `sourceRecordRefs` | `RecordRef[]` | 必填，去重，辨識 v3 舊題與 V1 情境題兩種紀錄家族 |
| `policyVersion` | `string` | 必填；同批資料重放必須得同結果 |
| `legacyImported` | `boolean` | 必填，legacy v1 stats 只有 aggregate，不得虛構逐題 tag |

**驗證**：只有 `validateDecisionRecord` 通過的 v3 紀錄，或 `validateAcademyDecisionRecord` 通過且有 verified scorer 的 V1 情境紀錄可提供逐題證據；由 `(recordKind,taskType,errorTypeIds或原errorTypes,question.skillTagIds)` 對照經審核 registry 產生唯一 skill evidence。單一 record 同一 tag 只算一次；批次更新順序固定、相同 ID 不重覆加權；不得由缺 `question.skillTagIds` 的未知資料臆造題目能力。歷史 aggregate 只可於 `legacyImported=true` 計入分離統計，不能反推錯誤類型／SkillTag。任何精熟度、學習成長曲線都標為 **估計**／`uncalibrated`，不能只靠刷題次數宣稱大師級。

### ReviewPlan — owner: Adaptive Training，V1，visibility: private-to-user

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`planId`、`profileId` | V1、`string`、`string` | 必填 |
| `generatedAsOf`／`algorithmVersion` | UTC／`string` | 必填，顯式時間輸入使重播穩定 |
| `items` | `{questionId,questionVersion,skillTagIds:string[],dueAt:UTC,priority:integer,sourceRecordRefs:RecordRef[],reasonCodes:string[]}[]` | 必填 |
| `settings` | `{dailyLimit:integer≥0,timezone:string}` | 必填；時區 IANA，如 `Asia/Taipei` |
| `method`／`calibrationStatus` | `"sm2-inspired"\|"rules-based"`／`"uncalibrated"\|"human-calibrated"` | 必填；不可說是臨床或已實測記憶模型 |

與現有 `advanceReview / buildReviewQueue(records,{asOf})` 相容方式是把其已核對 `dueAt/repetitions/ease/lapses` 轉換成 **ReviewPlan 快照**（保留 `sourceRecordRefs` 及其家族標記），而不是覆寫原始 `DecisionRecord`。如果題目不存在、題庫不支援該 ruleVersion，標 `unavailable` 並顯示具體原因，不得安排無法作答的題目。

### TrainingSession — owner: Adaptive Training orchestrator，V1，visibility: private-to-user

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| V1、`sessionId`、`profileId`、`ruleRef` | V1、`string`、`string`、ref | 必填 |
| `status` | `"planned"\|"active"\|"completed"\|"aborted"` | 必填，單向合法轉移 |
| `startedAt?`／`endedAt?` | UTC | active 起有 start；completed/aborted 有 end |
| `questionRefs` | `{questionId,questionVersion}[]` | 必填，原始順序不重排 |
| `recordRefs` | `RecordRef[]` | 必填，引用已驗證及持久化的 v3／Academy 紀錄，各 `(kind,id)` 唯一 |
| `seed`／`generatorVersions` | `string`／`string[]` | 必填，重播與來源一致 |
| `abilityProfileBeforeRef?`／`abilityProfileAfterRef?` | `string` | 如宣稱能力變化，兩者都必填且資料版本可追溯 |
| `reviewPlanRef?`／`statusReason?` | `string` | 明確引用復習計畫或中止原因 |
| `source` | `"academy"\|"legacy-migrated"` | 必填，不可將 v1 只有總計的紀錄偽造為 session |

**驗證**：`recordRefs` 依 `kind` 分別存在於既有 v3 archive 或 Academy V1 sidecar，通過對應 validator 且時間序合法，session/records/question/ruleRef 可對上；未作答 session 不得憑空增能力；失敗記錄寫入採**原子流程**：先持久化 record，再以 idempotent reducer 更新 AbilityProfile 與 ReviewPlan，若後步失敗允許由 records 重建衍生結果，不能讓一半寫入毀掉舊 archive。禁止把本型別直接存進原本 `tw-mahjong-trainer:archive:v3` 的 `records[]`；應用**獨立命名空間、獨立 schema／遷移器**（提議 `tw-mahjong-master-academy:state:v1`，正式命名前須檢查既有 key 衝突）。

## 6. 端到端 API 與責任邊界（提議介面，不代表程式已存在）

| Source → Consumer | 提議 pure function / data transfer | 契約限制 |
| --- | --- | --- |
| Rules Engine → Strategy | `createPlayerView(fullState, seat, eventSeq):PlayerView` → `analyzeStrategy(view, ruleProfilePublic):StrategyAnalysis` | 僅後者可存玩家視角，Strategy 不得取得 fullState 或 answerKey |
| Rules Engine → UI | `listLegalActions(state, seat):LegalAction[]` 經 PlayerView 投影；`applyAction(state,action):{state,event}` | UI 用 actionId + expectedRevision 送回引擎，絕非信任客戶端合法性 |
| Strategy → Academy | `StrategyAnalysis` immutable ref | 保存 engine/model/rule/view 版本；非精確量化不得用作確定答案 |
| Academy → UI | `toPublicQuestion(question):QuestionPublic`、`LessonPublic` | allowlist 清除 answerKey、full GameState、未公開 TurnEvent |
| UI → canonical grading | `submitAnswer(questionRef,choice)` → `GradingResult` → discriminated record dispatcher | 三種舊題 `createDecisionRecord` v3；經驗證 `scenario` 才能 `createAcademyDecisionRecord` V1；不合條件須 unscorable |
| Grading → persistence | `persistScoredRecord(record): RecordRef` | 分家族驗證與儲存：v3 只進原 archive，V1 只進 sidecar；之後才能做 adaptive reducer |
| RecordRef → Adaptive | `applyEvidence(profile,recordRef,validatedRecord,registry):AbilityProfile` | 檢查家族對應 validator + scorer；證據去重且版本化；純 reducer，同輸入同結果 |
| Adaptive → UI | `getTodayRecommendation(profile,reviewPlan,asOf):RecommendationPublic` | 限可實際產生的題目，標示估計；不能洩漏 answerKey |
| Persist → UI startup | `load archive:v3`（原實作） + `loadAcademyState`（新命名空間） | 舊 key/bytes 原樣保留，未知 schema 拒絕或隔離，不清空 |

### UI 交換的可行示例（非正式函式輸出）

```json
{
  "schemaVersion": 1,
  "contractVersion": "master-academy/1.0.0",
  "viewId": "view-g1-17-seat0",
  "gameId": "g1",
  "ruleRef": {"profileId": "tw16-demo", "ruleVersion": "structural-only-v1"},
  "audienceSeat": 0,
  "asOfEventSeq": 17,
  "round": {
    "schemaVersion": 1,
    "contractVersion": "master-academy/1.0.0",
    "roundId": "g1-r0",
    "handIndex": 0,
    "dealerSeat": 0,
    "currentSeat": 0,
    "phase": "await_discard",
    "lastPublicEventSeq": 16
  },
  "self": {"seat": 0, "concealed": [], "melds": [], "river": [], "flowers": []},
  "opponents": [
    {"seat": 1, "concealedCount": 16, "melds": [], "river": [], "flowers": []},
    {"seat": 2, "concealedCount": 16, "melds": [], "river": [], "flowers": []},
    {"seat": 3, "concealedCount": 16, "melds": [], "river": [], "flowers": []}
  ],
  "publicEvents": [],
  "legalActions": [],
  "knownUnavailableTypes": [],
  "capabilities": {"structuralScore": true, "roundActions": false, "settlement": false}
}
```

上例是**欄位／資訊隔離的示意物件**，不是具完整 17 張手牌的正式可遊玩局面，也不得用作已驗證合法牌局 fixture。對任何可評分 question，必須有獨立正式引擎證明手牌、turn 和 legalActions 均合法；`round.lastPublicEventSeq` 可能小於含私密事件的 `asOfEventSeq`，兩者不能混作同一計數。

## 7. 嚴格相容與遷移規則

1. **舊牌面**：既有 `public/tiles/0.svg` 至 `33.svg` 及 `src/tile-visuals.js` 繼續以 `TileType` 索引；`PhysicalTileId` 在 UI 只做唯一 key，渲染必先 `typeOf(id)`。花牌需新素材/文字 fallback，不准把 34 張 SVG 對應到花牌而造假。
2. **舊 v3 題目與紀錄**：`createExercise`、`validateExercise`、`replayExercise`、`createDecisionRecord`、`validateDecisionRecord`、`createLocalTrainingStore` 仍在既有 import path；既有 0–33 陣列保持數字。`AcademyQuestion` 只能以 immutable `legacy-exercise-v3` ref 包裝，原題、評分、Snapshot/ID 不變；`SkillTag` 與 `ReviewPlan` 存**新 sidecar** 而非默寫舊 records。
3. **v1 舊統計**：原 `tw-mahjong-trainer:session:v1` bytes 以及 v2/v3 archive history 不得刪、改寫或編造缺少的行為資料。升級需先 read→validate→write new key→readback，再允許 UI 使用新功能；失敗須保留舊資料及可回退的舊 UI。
4. **四人隱藏資訊**：隱藏牌與壁牌只留 GameState；`PlayerView`／Strategy／UI、公開題目永不含完整局面。測試要以對手暗牌置換造成 GameState 不同、Public projection 相同做非洩漏對照。
5. **固定結果**：引擎計算與估計策略以 `epistemic` 區分；任何向聽、剩餘張數、胡牌、合法動作判定需要 Golden 與物理守恆；沒有可信桌規就拒絕自動宣稱合法，沒有模型就 `unknown`，不做虛假的機率。
6. **PWA**：新的 JS、JSON、課程 manifest、正式訓練題庫和必要素材**只有在可離線取得且內容版本固定時**加入 `sw.js` precache 並同步提升 `CACHE_VERSION`；兩個版本之間驗證完整原子快取、GitHub Pages `/taiwan-mahjong-trainer/` 子路徑、無網路的新分頁訓練、歷史持續保存。絕不可把 `PR #26` 已固定的舊 V0.2 `SOURCE_SHA` 擅自換成 Academy 候選，也不得把實機 `NOT_RUN` 改成 PASS。
7. **無循環依賴**：`src/rules/` 不 import `strategy`／`academy`／`adaptive`／UI；`strategy` 只能 import public rule types/projections；`academy` 可以引用 Strategy **DTO/ID** 及 canonical grading；`adaptive` 只能讀已驗證 records/registries；`UI` 只 import façade。`src/storage` 不 import UI。違反時退回來源 PR 修復。
8. **資料來源**：所有 public Lesson content 和策略說明要附 `ruleRef/engineVersion/evidenceRefs`；外部供應、專家桌規與模擬統計未驗證時以 `experimental` 或 `unverified` 明確顯示，不稱「官方台麻通用規則」。

## 8. 驗證門檻（功能 PR 必須自行具體交付）

| Gate | 必要證據 | Owner |
| --- | --- | --- |
| R-01 牌組、發牌、吃碰槓／補花 | 對 profile 每一個可啟用動作、合法／非法邊界、四張上限、phase 的 Golden／property tests | Rules |
| R-02 視角不洩漏 | 對手 concealed/wall 任意置換、相同公開狀態的 PlayerView 相等；UI 不可引用 internal state | Rules + Strategy |
| S-01 策略 | 所有 recommendation actionId 皆合法；exact/estimated/unknown 分類正確；未知風險不能生百分比 | Strategy |
| L-01 課程 | Lesson 無依賴循環，題目 seed 重播同版；含未通過 scorer 的 scenario 必須 `unscorable` | Learning |
| A-01 自適應 | 同 record idempotent、相同 ordered records + asOf 同結果，legacy aggregated 不造逐題紀錄 | Adaptive |
| UI-01 真正可用閉環 | load→今日推薦→選課/題→合法重播題→作答→官方 scoring→解說→儲存 record→更新 profile→安排複習→顯示時間序能力資料；每一步自動化點擊 | UI + Integration |
| REG-01 核心回歸 | 保留 Golden Q-001/Q-002/I-003、兩套必跑 10,000 題獨立 Oracle、原三題型／v3 archive/v1 localStorage | Integration |
| REG-02 牌面與無障礙 | 34/34 SVG 全部可解析並渲染，390px、桌面鍵盤/焦點、無障礙語義（不得冒稱實機） | UI + QA |
| PWA-01 離線升版 | 新 runtime/data 皆 cache、`CACHE_VERSION` 同步、Chrome 真正斷網新分頁 + 作答 + 復原、Pages 子路徑 | UI + QA |

CI 必須在**當次組合 HEAD** 成功，獨立分支舊 CI 不可充當整合結果；效能、策略品質與人類能力變化需註明樣本偏差和未校準限制。原 V0.2 功能合併、Chrome PASS、公開預覽、iPhone/Android/VoiceOver/TalkBack 實機、正式 Release 是**不同的證據級別**。

## 9. 變更提案／併入條件

- 其他 AI 若已有不同欄位：在來源 PR 列出 `current→proposed` 字段對照、規則版本、相容性、測試與升版理由；必要時另開 **contract amendment PR**，不可由整合者靜默覆蓋已實作分支。
- 契約獨立 PR 先通過 `Verify / test`、由五位負責者用同一 link 對齊，再合併。新模組從已合併主線契約版開發；不支持的功能保持 Draft／Not Implemented。
- 整合時按 Rules → Strategy → Learning → Adaptive → UI，在跨模組 PR 經 QA 才納入；對應 `docs/quality/MASTER_ACADEMY_INTEGRATION_REPORT.md` 留下每次 HEAD、測試結果及未完成處。
- Contract V1 是**開發接口共識**，不是某一地方桌規的完成實作、不是 V0.2 發版授權，也不是「已達大師級」成效保證。
