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

- `tests/scoring/golden.test.js` comprises **40** source-owned Golden test callbacks.
- Deterministic subtest S22 evaluates **150** generated legal conventional wins and seat-permuted zero-sum settlements.
- S21 builds a real game using `tw16-single-winner-interception@experimental-v1`, submits its legal WIN action, checks Rules `validateGameState` and `replayGame` round trip, verifies original legacy [540,-180,-180,-180] points remain unchanged, then runs the **read-only** R7 scoring adapter.
- Others check zero tai, composite/mutual exclusions, dragon/wind families, concealed vs claimed triplets, ordinary and 見花見字 flowers/kongs including 無字無花 and complete flower set, per-payer dealer and streak, separate external fees, exhaustive draw, malformed/unavailable facts, corrupt account transfers and unsafe integer arithmetic.
- These Golden cases have passed a **non-Node isolated JavaScript execution** loading the real source modules into one sandbox with test-compatible assertions. This is useful evidence but **not** equivalent to `node --test`, `npm run check` or the official Github Actions exact-HEAD Verify gate. Do not label the latter PASS until their actual results are available.

## Compatibility acceptance: blocked until integration

1. Rules owns actual dealer streak: the scorer cannot attest previous round history; the existing R5 API exposes only handIndex and single preceding round reference.
2. Correct `seatWindType` comes from authoritative table seat-opening mapping, **not** from dealerSeat. The current R5 Rules state does not publish such a validated value; the scorer must reject missing proof when matching flowers/winds need it.
3. The scorer still requires five-meld-and-eye ordinary wins. An opt-in R7 RuleProfile marker can now establish **single robbery**, with a verified `kong_proposed`, one private WIN, matching public WIN/SETTLE, and declarer-only liability. Full flower-only wins and multiwinner liability remain unimplemented; the Rules PR #51 is separate and not merged to the base.
4. R5 `win` + `settle` events carry minimal tai/delta, not new scoring version/breakdown/evidence. A new RuleProfile and additive event namespace are necessary to publish R7 score as authoritative.
5. The Rules-facing proposed JSON schema is in `rules-scoring-event-proposal.schema.json`; its fact envelope is **not emitted in R5** and is not proof of the value merely by appearing in a client request.
6. Strict structural 平胡 now requires the provable two-sided pre-win shape, discard win, suited eye, five sequences and no flower/honor; a missing generic wait declaration is **not** converted into a 0-tai flag. Unique/edge/middle/pair wait awards still require separately approved definition and event proof. 槓上開花/海底 are gated by private Rules event ancestry and the experimental tail boundary.
7. Human review must resolve what it means for flower sets to coexist with the 見花見字 per-flower mode on the intended platform. The sample follows the GameTower text stating that mode replaces seat-matching flowers/winds while adding optional tai, but this is **one explicit policy**, not a Taiwan-wide default.

## R7.1 signed-zero regression and rule evidence

- Root R7-001: `settleExhaustiveDraw` produced `-0` from `-fee.points` when fee=0, so strict Node `deepEqual` failed. The shared ledger now canonicalizes zero *before emitting account amounts*, including fees, sums and transfer deltas. Signed-zero corruption in external ledger input fails validation; JSON roundtrips are checked.
- New scoring Goldens: R7-001 zero/positive/-0 fees and conservation; Rules R7 `kong_proposed` → WIN/PASS arbiter marker, strict one-payer robbery, marker/replay order tamper; deterministic Pinghu and full exposed hand; authenticated kong/flower replacement, source last-live draw and unsupported variants.
- Reused S22 seeded 150 legal winning hands and S21 real R5 Rules win/replay proving old [540,-180,-180,-180] remains untouched. The R7 robbery tests are **contract fixtures based on Agent 2 source**, not yet an end-to-end joint-branch CI execution.
- Cross-module matrix: baseline R5 Rules = unchanged scorer + no robbery, baseline Replay = unchanged historical frames, new R7 Rules profile = staged proposal + marker (requires integrator), R7 Scoring = opt-in event validation, Replay R7 marker = NOT acceptance-tested jointly yet. No merge to main.

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
- [ ] Official exact-HEAD `npm run check` / Github Actions Verify concludes and passes (R7-001 historic 382 PASS / 1 FAIL / 1 SKIP was fixed in source; previous red CI cannot count as pass)
- [ ] Rules-host publishes authoritative seat-wind/streak/special-win facts
- [ ] New Rules version pins ScoringProfile and emits versioned breakdown/ledger atomically
- [ ] UI/Replay/real-table end-to-end integrator acceptance

**Do not merge into main or replace R5 until the remaining integration gates pass.**


## Latest CI evidence / independent deployment warning (R7.1)

- Historical failing exact SHA \`202e007d\`: 384 tests, 382 PASS, 1 FAIL (S08 signed zero), 1 SKIP.
- Post-accounting-fix SHA \`11c76c3\`: GitHub Verify completed **SUCCESS**. This confirms the corrected R7-001 implementation at that SHA, **not** the later scoring expansions.
- Latest code and documentation SHAs have new Verify runs; until one concludes SUCCESS at **the final PR HEAD**, the source PR retains the CI gate unchecked, regardless of isolated 40/40 Golden outcomes.
- Vercel may report a separate deployment failure whose GitHub target is \`https://vercel.com/sign2?upgradeToPro=build-rate-limit\`: provider build rate quota, NOT demonstrated application or Scoring logic failure. Treat deployment as its own unresolved gate; do not change unrelated deployment configuration in this Scoring PR.
- Agent 2 current public event contract version: \`tw16-rob-added-kong-public/1.0.0\`. The scoring adapter rejects robbery if this capability is not provided by the trusted Rules host. Versioned public projections exclude private trigger action IDs. Combined Replay/UI validation remains out of scope.
