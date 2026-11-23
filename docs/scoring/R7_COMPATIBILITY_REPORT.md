# R7 Scoring Compatibility & Acceptance Report

**Source base:** integration/mahjong-full-game `a29bebfc01e05c05450b964a41ce34cbecf40365`  
**Head:** `feat/r7-scoring-engine` (see GitHub PR #52 for current exact SHA)  
**Integration status:** Draft, experimental, **NO-GO for replacing R5 scoring**.

## Source-owned boundaries

| Surface | Changed by this PR? | Contract effect |
| --- | --- | --- |
| `src/scoring/**` | Added only | Opt-in versioned scoring profiles, win evaluator, zero-sum ledger, trusted Rules-host adapter |
| `tests/scoring/**` | Added only | Isolated Golden scenarios with ordinary, composite, incompatible, unsupported, tampered and real Rules settlement |
| `docs/scoring/**` | Added only | Audited source comparisons, schema and integration requirements |
| `src/rules/**` | No | No R5 RuleProfile or existing score/settle algorithm changed |
| `src/bots/**`, `src/strategy/**` | No | Never receives GameState/private scoring facts |
| `src/table-ui/**`, `src/replay/**`, `src/adaptive/**` | No | No UI contract, replay format, training score or storage key changes |
| `sw.js`, `package.json`, `main` | No | No production routing, asset manifest, package script, deployment or release changes |

## What can be tested now

- `tests/scoring/golden.test.js` comprises **26** source-owned Golden test callbacks.
- Deterministic subtest S22 evaluates **150** generated legal conventional wins and seat-permuted zero-sum settlements.
- S21 builds a real game using `tw16-single-winner-interception@experimental-v1`, submits its legal WIN action, checks Rules `validateGameState` and `replayGame` round trip, verifies original legacy [540,-180,-180,-180] points remain unchanged, then runs the **read-only** R7 scoring adapter.
- Others check zero tai, composite/mutual exclusions, dragon/wind families, concealed vs claimed triplets, ordinary and 見花見字 flowers/kongs including 無字無花 and complete flower set, per-payer dealer and streak, separate external fees, exhaustive draw, malformed/unavailable facts, corrupt account transfers and unsafe integer arithmetic.
- These Golden cases have passed a **non-Node isolated JavaScript execution** loading the real source modules into one sandbox with test-compatible assertions. This is useful evidence but **not** equivalent to `node --test`, `npm run check` or the official Github Actions exact-HEAD Verify gate. Do not label the latter PASS until their actual results are available.

## Compatibility acceptance: blocked until integration

1. Rules owns actual dealer streak: the scorer cannot attest previous round history; the existing R5 API exposes only handIndex and single preceding round reference.
2. Correct `seatWindType` comes from authoritative table seat-opening mapping, **not** from dealerSeat. The current R5 Rules state does not publish such a validated value; the scorer must reject missing proof when matching flowers/winds need it.
3. The scorer accepts five-meld-and-eye ordinary wins only. R5 special wins, rob added kong and multiple-winner liability are not implemented. No fabricated `specialWin` or payer fallback.
4. R5 `win` + `settle` events carry minimal tai/delta, not new scoring version/breakdown/evidence. A new RuleProfile and additive event namespace are necessary to publish R7 score as authoritative.
5. The Rules-facing proposed JSON schema is in `rules-scoring-event-proposal.schema.json`; its fact envelope is **not emitted in R5** and is not proof of the value merely by appearing in a client request.
6. A no-honor/no-flower winning hand can potentially qualify for 平胡, whose wait-shape constraints are unsupported. R7 must not be advertised as a complete table calculator or authoritative payout under that ambiguity.
7. Human review must resolve what it means for flower sets to coexist with the 見花見字 per-flower mode on the intended platform. The sample follows the GameTower text stating that mode replaces seat-matching flowers/winds while adding optional tai, but this is **one explicit policy**, not a Taiwan-wide default.

## Policy/source traceability

The bundled comparative profile is anchored primarily in [GameTower](https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx), with regional exceptions checked against [Mahjong Orchid](https://mahjongorchid.com/zh-tw/tai/). [CML](https://cml88.com/%E8%B3%BD%E4%BA%8B%E8%A6%8F%E5%89%87/) is a distinct tournament policy, *not* a source of unconditional extra sanctions. An externally agreed table policy must define any conflicting flower, wind, dealer, and special win precedence before opting in.

## Final gates for a source PR

- [x] Dedicated source ownership and independent base branch
- [x] Source-attributed configurable ScoringProfile and input validation
- [x] Itemized breakdown with rule version, evidence, source, amount
- [x] Strict payer-specific settlement ledger and house fee isolation
- [x] Unsupported special liabilities rejected explicitly
- [x] Golden scenarios and seeded 150-hand subtest
- [x] R5 legacy scoring, Rules replay and single-win integration remain stable in sandbox tests
- [x] Proposed Rules schema and event compatibility notes
- [ ] Official exact-HEAD `npm run check` / Github Actions Verify concludes and passes
- [ ] Rules-host publishes authoritative seat-wind/streak/special-win facts
- [ ] New Rules version pins ScoringProfile and emits versioned breakdown/ledger atomically
- [ ] UI/Replay/real-table end-to-end integrator acceptance

**Do not merge into main or replace R5 until the remaining integration gates pass.**
