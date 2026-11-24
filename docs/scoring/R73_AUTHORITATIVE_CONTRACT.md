# R7.3 authoritative scoring host contract

Agreed source-owner proposal: Rules #51 / Scoring #52 / Replay #46; exact versioned pairing.

- RuleRef: `tw16-authoritative-scoring@experimental-v1`.
- ScoringRef: `tw16-gametower-authoritative@1.0.0-experimental`.
- Private input contract: `tw16-pre-settlement/1.0.0`.
- Public event negotiation: `tw16-rob-added-kong-public/1.0.0`.
- Schema: `pre-settlement.schema.json`. Runtime checks cross-field constraints beyond schema.

## Runtime entry

`settlePreSettlement(getAuthoritativeScoringProfile(), envelope)` is synchronous, deterministic, read-only, and returns a recursively frozen canonical ledger. It requires no committed WIN/SETTLE or current scores. Rules obtains legal-action evidence from the cloned, validated pre-terminal raw ledger, not public PlayerView. The scorer is a pure boundary, not an independent legal-action verifier or cryptographic attestation. Rules validates actual event membership, order, all three WIN/PASS replies, physical inventory, opening wind mapping, continuation chain, and exact replacement/last-draw ancestry. Never trust an envelope submitted by a client. Unknown facts, profile versions, substituted configuration, or payer mismatch reject before commit.

Fields: contractVersion, ruleRef, scoringRef, publicEventContractVersion, gameId, roundId, sourceRevision, settlementId (=roundId), reason, winType, payerSeats, evidence, evidenceEventIds, winningTileId. Event refs are ordered unique raw event IDs belonging to gameId and ending at sourceRevision. WIN evidence contains existing scoreWinningHand facts with actual RuleRef, physical concealed/meld IDs, flower IDs, winner/source/dealer, exact prevailing wind, explicit streak and optional verified wind/robbery/specialDraw. DRAW has null evidence/winType/winningTileId and empty payerSeats. Selfdraw must name the actual owned tile; ron uses exact external winning tile; robbery uses proposal marker. Missing applicable wind or flower proof rejects. Rules must reject unsupported special timing, declarations, liability before calling; omission is not authorization. No fabricated first-turn or flower-only wins. No public private evidence payload.

## Output / atomic ownership

Canonical output extends settlement.js result with settlementId/gameId/roundId/sourceRevision/ruleRef/scoringRef/preSettlementContractVersion/publicEventContractVersion/winType/evidenceEventIds. Contains score (tai/breakdown), payments, transfer deltas, fees, houseDelta, playerDeltas, scoringVersion. Fixed canonical registered profile (zero external fee; abstract base 0, 1 point/tai) cannot be substituted. Comparison profiles retain configurable independent fees; authoritative future fee variant requires new version/identity. Strict +0 and JSON round-trip conserved. Rules alone applies returned playerDeltas and stores ledger in terminal result and settle event as one atomic action group. On any exception no state/revision/event commit. Never publish private evidence or hidden draw IDs via UI projection; public breakdown policy owned by Rules/Replay. Replay uses original pinned scorer/profile and raw LegalActions, verifies canonical stored ledger and event groups; it never upgrades prior versions or uses comparative adapter to overwrite old result.

## Coverage delta

See `R7_1_RULE_COVERAGE.md` for existing source-attributed pattern matrix. New authoritative profile adds **獨聽 1 tai**, exactly one possible structural winning tile type after removing the actual winning tile from the pre-win inventory; counts own physical copies including fixed melds, not opponent hidden inventory or live availability. Suppressed by 全求人, mutually exclusive with 平胡. Source: https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx (獨聽、全求、平胡). In authoritative mode 平胡 also requires sequence completion role, not pair. The two historical comparison profiles keep their previous calculation and version; old R5 unchanged. No separate bonus for edge/closed/pair labels. Heavenly/earthly/human wins, declaration wins, flower-only wins, open-kong replacement variations, special liability and additional regional types remain unsupported unless Rules supplies reviewed legal facts and a separately versioned profile. GameTower heavenly 24 and earthly 16 are source-documented but their precedence and exact initial-deal/first-draw facts are not agreed in this contract. Do not infer from absence of a flag.

## Verification

Preserve original 40 golden callbacks and 150 seeded legal wins. Add A01–A10 pure pre-settlement tests for registered identity, immutability, ron/selfdraw/robbery/draw, payer/dealer/streak/flower, negative refs and strict +0. Contract tests are not evidence of actual Rules commit or Replay archival; run exact cross-source LegalAction acceptance when #51/#46 publish their implementations. No main merge.

## Additional authoritative coverage matrix (fixed table, not the two comparison presets)

| Name | Tai | Qualification / evidence / precedence | Source |
| --- | ---: | --- | --- |
| 門清 | 1 | all melds concealed (concealed kongs permitted), not self-draw | GameTower |
| 自摸 | 1 | actual own winning tile, other three pay; combined award supersedes | GameTower |
| 門清自摸 | 3 | no open meld + actual own draw; replaces previous two | GameTower |
| 莊家 | 1 | per payment only if winner or payer is dealer | GameTower |
| 連莊 | 2 × streak | per dealer-involved payment, host-verified prior round chain, max 10 | GameTower |
| 圈風 | 1 | prevailing wind triplet/kong, authenticated round fact | GameTower |
| 門風 | 1 | opening-seat mapped wind triplet/kong; missing applicable fact rejects | GameTower |
| 三元牌 | 1 each | dragon triplet/kong, superseded by small/big dragons | GameTower |
| 小三元 / 大三元 | 4 / 8 | 2 dragon triplets + dragon eye / 3 dragon triplets | GameTower |
| 小四喜 / 大四喜 | 8 / 16 | 3 wind triplets + wind eye / 4 wind triplets; big suppresses wind items, small retains them | GameTower / Orchid variants |
| 正花 | 1 each | actual flower ID matches authenticated opening-seat wind | GameTower |
| 春夏秋冬 / 梅蘭竹菊 | 2 each | full family, replaces corresponding correct flower in fixed conventional policy | GameTower / Orchid variants |
| 明槓 / 暗槓 | 0 separate | no independent bonus in conventional profile; meld still contributes to structural/other tai | GameTower alternative mode distinction |
| 碰碰胡 | 4 | all five groups triplet/kong; suppressed by 字一色 | GameTower / Orchid |
| 混一色 / 清一色 / 字一色 | 4 / 8 / 8 | disjoint one suit+honors / one suit / honors-only | GameTower / Orchid |
| 三暗刻 / 四暗刻 / 五暗刻 | 2 / 5 / 8 | highest concealed tier, ron-completed triplet not concealed | GameTower |
| 平胡 | 2 | five sequences, suited eye, no honor/flower, ron sequence completion and two-sided proof | GameTower |
| 全求人 | 2 | five open melds, one concealed eye tile before ron; suppresses 獨聽 | GameTower |
| 獨聽 | 1 | all structural waits enumerated with own four-copy cap; exactly one type, no duplicate edge/middle/pair award; excludes 全求人/平胡 | GameTower / Orchid |
| 搶槓胡 | 1 | authoritative proposal ID, physical tile, source/payer seat, host verified sole WIN and two PASS | GameTower |
| 槓上開花 | 1 | host verified supplemental self-draw ancestry (concealed/added kong or supported flower chain) | GameTower |
| 海底撈月 | 1 | actual last live draw at pinned reserve boundary; private proof | GameTower |

GameTower source: https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx . Structural single wait own-copy cap: https://mahjongorchid.com/zh-tw/tai/duting/ . Orchid's separate edge/middle/pair names are not additional GameTower awards. The fixed authority selects conventional rather than 見花見字; the two earlier configurable comparison profiles remain available.

## Combined checkout test gate

`SCORING_REQUIRE_R73_RULES=1 node --test tests/scoring/r73-rules-integration.test.js` is mandatory when combining #51/#52. It runs actual later-turn selfdraw, ron, robbery and exhaustive draw through Rules-issued LegalActions, requires the same complete canonical `scoringLedger` in terminal result and settle event, checks strict conservation and exact deterministic `replayGame` reconstruction. In a standalone Scoring checkout the missing Rules opt-in dependency is explicitly skipped, never counted as integration pass. The separate `pre-settlement.test.js` now includes a further 150 physical seeded authority cases, two-sided Pinghu, special event reference checks, and dragon-vs-wind missing proof distinction. Replay Agent's archive acceptance is a distinct gate.
