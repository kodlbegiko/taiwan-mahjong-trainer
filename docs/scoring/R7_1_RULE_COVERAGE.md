# R7.1 Scoring Rule Coverage and Settlement Contracts

**Status:** Independent Scoring source branch only; R7 Rules Agent #51 and Replay have not been merged into this source PR. The rules are named **experimental configurations**, never universal local standards.

| Rule family | Conventional example | 見花見字 example | Gate / mutually-exclusive handling |
| --- | --- | --- | --- |
| 門清 / 自摸 | 1 / 1 | 1 / 1 | 正式門清自摸 3 replaces individual components; concealed kong preserves closed status |
| 莊家 / 連莊 | dealer 1 + 2N per affected payment | same | Explicit dealerSeat/streak and prior-round references; never auto-infer handIndex |
| 圈風 / 門風 / 三元台 | 1 each eligible set | 見風 1 per wind set; dragons 1 each | Wind seat requires opening-seat evidence; big dragons supersede small/individual |
| 春夏秋冬、梅蘭竹菊、正花 | 2 per full flower family; selected seat flower 1 | each flower 1 + optional family 2 | Default family replaces matching flower, no guessed flower values |
| 明槓 / 暗槓 | 0 as normal mode | 1 / 2 each | Opt-in variant only; four actual physical copies and meld proof |
| 碰碰胡 / 清一色 / 混一色 / 字一色 | 4 / 8 / 4 / 8 | configured same | Highest valid five melds+eye decomposition; R7 does not claim another app's 16-tai 字一色 |
| 暗刻階梯 | 3=2,4=5,5=8 | same | One highest tier; ron-completed triplet excluded |
| 大小三元、大小四喜 | 8/4 and 16/8 | same | Suppress subordinate dragon/wind where selected variant says so |
| 平胡 | 2 | 2 | Five sequences, numbered pair, no honor/flower, ron, provable two-sided pre-win shape; no 無字無花 duplicate |
| 全求人 | 2 | 2 | Five *open* melds, ron pair completion; not an extra pair-wait award |
| 搶槓胡 | 1 | 1 | ONLY Agent 2 \`tw16-rob-added-kong@experimental-v1\`; event marker + proposal + single private WIN + matching public WIN/SETTLE, declarer pays alone; not self-draw |
| 槓上開花 | 1 | 1 | Private event ancestry: concealed/added kong tail replacement or post-discard flower replacement, selfdraw; unreviewed open-kong replacement fails closed |
| 海底撈月 | 1 | 1 | Exact final live draw with 16-tile reserved wall and winning draw provenance; source RuleProfile must match the experimental tail boundary |
| 0 台 | allowed | allowed | No fabricated minimum tai; payouts can still have base points |
| 流局 | no win transfers | same | Zero player transfer; separately configured independent fee possible |

## Explicitly excluded or unsupported

- **獨聽、邊張、中洞、單吊**: The scoring engine can identify a *two-sided Pinghu* in a complete ron hand, but does not yet award separate waits. Such awards can depend on alternative structural waits, previous visible cards and house-specific precedence. New caller-supplied \`waitShape\` is rejected rather than silently accepted or scored 0.
- **天聽、地聽、宣告聽牌**: No verified dated declaration sequence, pass-water lock and historical state evidence; not inferred from handIndex or final hand alone.
- **天胡、地胡、人胡**: Selected-platform values vary and exact dealing/first-turn proof is unmerged. No arbitrary bonus or fake declaration.
- **七搶一、八仙過海、配牌花胡**: Require distinct legal flower-only WIN transitions, private physical inventory, source seat and payout semantics. R5 ordinary five-melds+eye validator cannot authorize these.
- **河底撈魚、半求人**: Table variants and terminal evidence scope remain to be reviewed separately; do not infer from a generic discard or self-draw.
- **包牌 / 責任分配 / 一炮多響 / 多人同搶槓**: No accepted authenticated payer liability contract; reject unsupported capability. Rule Agent #51 rejects competing robbery WINs.
- **Initial-deal flower win / open-kong supplement win**: The intended GameTower policy is not identical to all table practices; source adapter fails closed when the source is not certified.

## Traceability

- GameTower tai table: https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx
- Mahjong Orchid Taiwanese tai variants: https://mahjongorchid.com/zh-tw/tai/
- Mahjong Orchid explicit rob-kong payer: https://mahjongorchid.com/zh-tw/tai/qianggang/
- Mahjong Orchid game turn events and tail/draw variants: https://mahjongorchid.com/zh-tw/rules/
- Rules Agent #51 source: https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/51
- Independent Scoring #52: https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/52

## Ledger API

\`scoreWinningHand(ScoringProfile, facts)\` returns \`scoringVersion,status,tai,breakdown[]\`: each applicable item includes \`name,evidence,tai,ruleVersion,source,scope\`.

\`settleWinningHand(profile,facts)\` creates explicit payer→winner payments. Ordinary ron **one sourceSeat**, selfdraw **three other seats**, rob-added-kong **one kong declarer**, all pay individually \`base+(handTai+dealerTai+streakTai)*perTai\`.

\`settleExhaustiveDraw(profile)\` returns no win payments. Optional external fixed fees create \`fees[]\` and \`houseDelta\` separate from player-to-player transfers; \`assertLedgerConservation\` checks each entry, integer overflow, canonical signed zero, transfer reconstruction, \`sum(playerTransferDeltas)=0\` and \`sum(playerDeltas)+houseDelta=0\`. Arrays and values remain stable under JSON serialization.

This is **not** monetary settlement and cannot replace \`tw16-minimal-tai-v1\` until independent full-match and Replay integration passes.
