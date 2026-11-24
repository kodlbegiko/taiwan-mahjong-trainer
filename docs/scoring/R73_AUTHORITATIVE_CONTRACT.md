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
