# R7 ScoringProfile: experimental, opt-in scoring specification

Status: DRAFT. Not a universal Taiwanese 16-tile ruleset. Not a certified competition scorer.

## Baseline audit at integration/mahjong-full-game a29bebfc

| Existing surface | Audited behavior | R7 compatibility |
| --- | --- | --- |
| src/rules/scoring.js | tw16-minimal-tai-v1 scores concealed 1, self-draw 1, combined bonus 1; dealer-involved payer adds 1; abstract 100+20*tai | Unchanged bytes |
| src/rules/profiles.js | RuleProfile pins old scoring policy for both full-game R5 profiles | Not modified |
| src/rules/complete-engine.js | Rules computes canonical five melds plus pair; emits public win and settle; kong events public, flower event is seat-private but projected to public without replacement tile | Read-only adapter; not wired into R5 |
| PlayerView | Other players' concealed, undeclared claims and wall are hidden | Scoring must execute only in trusted Rules host, never Bot/UI |
| startNextRound | Keeps previousRoundRef and handIndex, does not prove consecutive dealer results | Explicit authenticated historical streak necessary |
| Tests | Existing R5 100/100 and fixed Golden payout values are for the old experimental policy | New tests isolated in tests/scoring |

## Rule provenance and competing policies

- [GameTower platform tai table](https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx): self-draw, closed, closed self-draw 3, wind/dragon, flower, all pongs 4, suits, concealed pongs 2/5/8, dealer 1+2N, special wins. Its kong tai 1/2 are given in the optional **見花見字** setting, not the default setting.
- [Mahjong Orchid comparative tai catalogue](https://mahjongorchid.com/zh-tw/tai/): documents local and platform differences in all-honors, flower set stacking, concealed-self-draw, wind stacking, dealer count, special hands.
- [Chinese Mahjong Competition League](https://cml88.com/%E8%B3%BD%E4%BA%8B%E8%A6%8F%E5%89%87/): competition rules including penalties, which are not automatically applicable to a home table.
- [Gogogame rules](https://www.gogogame.com.tw/htm/rule_3000.html): says Taipei, Taichung and Southern variants differ; its optional 10% commercial fee cannot be assumed on other tables.

Sample profiles:
- tw16-gametower-comparative@1.0.0-experimental: seat-matched correct flowers, flower-set replacement, round/seat winds; no separate kong bonus.
- tw16-gametower-see-flower-wind@1.0.0-experimental: opt-in alternative where each flower and wind triplet counts, open kong 1 and concealed kong 2; all flower tiles count individually, complete four-flower sets retain the documented 2 tai, and **無字無花** adds 2 tai when there are no honor tiles or flowers.
- createScoringProfile(customJson): validates a source-attributed copy. All inputs must have explicit sourceRefs and ruleRefs, and status remains experimental. The code never merges Taipei, Taichung, Southern and tournament variations by assumption.

Both bundled profiles use points.base=0 and perTai=1 abstract-points, purely to expose normalized arithmetic; no currency or agreed wager is implied. An authorized Rules integrator can specify a different safe-integer base and per-tai value in a custom ScoringProfile.

## Evidence contract and explainability

Import from src/scoring/index.js. Public exports: createScoringProfile, getScoringProfile, listScoringProfiles, validateScoringProfile, scoreWinningHand, settleWinningHand, settleExhaustiveDraw, assertLedgerConservation, evidenceFromSettledRulesState, scoreRulesState, settleRulesState.

scoreWinningHand(profile, evidence) requires exact RuleProfile ref, valid winner/source/dealer seats, self-draw or discard mode, winning player's concealed tile inventory, valid melds, flower IDs, claimed winning tile for discards, explicitly supplied dealerStreak. Matching seat/round wind is mandatory when needed for relevant tai. Dealer streak >0 requires referenced previous rounds but the references must be independently checked against prior authoritative Rules events by the integrator; arbitrary caller-provided strings are not cryptographically verified proof.

The alternative 見花見字 mode retains 2 tai for each complete four-flower family on top of its 1 tai per flower, following the source statement that this mode replaces seat-aligned flowers and winds, not the pre-existing flower-set tai. The optional **無字無花** item is disabled in the conventional profile. Flat-hand (平胡) precedence and wait-shape evidence are not yet implemented, so this experimental calculation remains incomplete in ambiguous five-sequence cases.

The solver checks physical tile ID uniqueness when provided, each standard tile type <=4, exact physical kong/meld shape, five completed melds plus pair, and every valid concealed-hand decomposition. It selects the highest legal tai decomposition, with the discarder-provided last tile attributed to pair/sequence/triplet as needed for concealed-triplet logic.

Each item exposes code, Traditional Chinese name, evidence, tai, ruleVersion, source URL, scope=hand. Pairwise dealer/streak items live in payments[].dealerItems with scope=payment and are never multiplied into the winning hand's tai prematurely.

Mutual exclusions: concealed-selfdraw 3 replaces the separate concealed/selfdraw entries; small/big dragons suppress each individual dragon fan; big winds suppress matching wind fan; three/four/five concealed-triplet tiers replace lower tiers; flower set in default mode replaces the matching seat flower in that set; normal/見花見字 modes differ by an explicit profile switch. Full ordinary hand with no eligible tai remains zero tai rather than fabricated baseline.

Unsupported additional fields such as `waitShape`, `firstTurnWin`, `readyDeclaration`, `liabilityPolicy` and `winReason` fail closed instead of being silently ignored. A self-draw cannot carry a contradictory discard `winningTile`. Unknown evidence throws RangeError. Unknown requested capabilities throw ScoringCapabilityError with code UNSUPPORTED_SCORING_CAPABILITY and capability field. R7 does not infer unique wait, two-sided flat-hand, earthly/heavenly wins, seven flower grab, eight flower wins, rob added kong, pass-winner liability, multiple simultaneous winners, or ready-hand announcements from insufficient data.

## Accounting

A legal self-draw creates three payments; a discard win creates one payer payment. Each points amount is safe-integer base + (hand tai + payer-specific dealer 1 + 2*streak) * perTai. All player-to-player transfers sum to exactly zero. Optional fixed-per-player table fee is recorded as separate fees[], playerDeltas[], houseDelta (not a win payment). assertLedgerConservation verifies transfer reconstruction, fees and the equation sum(playerDeltas)+houseDelta=0. Exhaustive draws carry zero win transfers. Liability overrides including 包牌 are explicitly unsupported until separately sourced and tested.

## Safety and release boundary

No changes to src/rules, src/bots, src/table-ui, src/replay, sw.js, package.json, old Golden expected results, integration branch or main. The R7 contract is a read-only opt-in module and not an immediate live-rule replacement.

To integrate later: Rules must publish versioned, verified wind/round/dealer streak/last-draw facts, own the profile change, call Scoring from the authoritative private host, publish breakdown and per-payer settlement atomically, preserve old replay history, and gate all new rules behind a separately versioned RuleProfile and Golden acceptance. A passing new golden suite cannot authorize release by itself.

Run node --test tests/scoring/golden.test.js, then npm run check on the *exact* R7 head. A CI result from a different commit SHA is not sufficient evidence.
