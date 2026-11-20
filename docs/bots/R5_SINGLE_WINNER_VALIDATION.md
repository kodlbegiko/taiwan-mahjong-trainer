# R5 — Three-Bot single-winner interception: source adapter and pending acceptance

Status: **SOURCE-ONLY / NOT FULL-MATCH ACCEPTED / DRAFT**.
Owner: Bots PR #40, branch `feat/tw16-opponent-bots`.
Dependency: Rules PR #43 at `684df00afac540c082713c152d06e80e72eea3de` when investigated.
Replay PR #41 and Integration PR #44 require independent versioned-source integration.

## Profiles (not interchangeable)

| RuleProfile | multipleDiscardWins | Seed 87 expected terminal result |
| --- | --- | --- |
| `tw16-configurable-table@experimental-full-v1` | typed unsupported | `UNSUPPORTED_RULE_CAPABILITY / multiple_winners`; revision 162, NOT settled |
| `tw16-single-winner-interception@experimental-v1` | experimental single-winner | winner seat 3; intercepted seat 0; final revision 165, Rules-only delta `[0,0,-100,100]` |

The new policy does **not** implement a general multiple-winner payout or added-kong robbery; those remain unsupported by the Rules capability schema. The experimental minimal tai scorer is not a verified venue scoring policy.

## Changes owned by Bots

- `src/bots/view.js` recognizes only the two exact versioned RuleRefs; initial flower replacement still requires Rules-issued, seat-specific LegalActions. Controller-only settled views accept publicly released WIN `claimResolution` after arbitration, while refusing wall/private payloads/opponent concealed tiles.
- `src/bots/controller.js` keeps all responders' legal submissions, including multiple WIN. There is no Bot-selected winner, claim suppression, WIN→PASS rewrite, fabricated draw or Bot-side scoring. Every action carries Rules-issued `actionId`, `actorSeat`, `expectedRevision`. Final `settled` is recognized without giving post-game metadata to decision strategy.
- `src/bots/decision.js` uses unchanged seeded public-only heuristics on both profiles; Rules-issued WIN remains highest priority. Exact-version profile matching applies to claims; no special-case for Seed 87.
- The controller's existing max-action/event budget, stale revision, duplicate tick, pause/resume and sticky unsupported behavior remain in force.

## Tests

1. `node --test tests/bots/r5-profile-wiring.test.js` — adapter-only tests on a relabeled, previously valid Legacy Rules PlayerView. They prove schema compatibility and redaction, **not** R5 adjudication. This test must run on the Bot branch before Rules arrives.
2. `node --test tests/bots/r5-single-winner-full-match.test.js` — automatically runs when the **real** R5 `getRuleProfile` and `getRuleCapabilities` are available in the same checkout. Before then, its R5 cases are explicitly skipped with dependency reason; a skip is neither PASS nor FULL_MATCH_GO.
3. Real R5 tests: independent static capabilities, exact Seed 87 Legacy vs R5 comparison and unmodified action prefix, same-revision counterfactual opponent WIN vs PASS PlayerViews, representative Seeds `0,1,6,19,37,42,50,72,87,99`, and original fixed `0..99` 100 full hands. No Seed exclusion or changed strategy strength.
4. For every test hand, emit `BOT_R5_FIXED_SEED` including seed, profile, completed, finish, winnerSeat, claimWindows, claimResponses, legalActions, legalChoicesOffered, invalidActions, stalls, unsupportedCapability, replayMatch, SettlementResult and elapsedMs. `BOT_R5_FAILED_TRACE` prints action provenance only; no GameState, wall or opponent concealed cards. Global `BOT_R5_100_SUMMARY` counts wins, exhaustive draws, unsupported, invalid, stalled, replay mismatches, total completion, decision timings on the test runner and failing seed IDs.
5. Strict `FULL_MATCH_GO` assertion requires 100/100 settled, 100/100 replay matches, zero illegal actions and zero stalls. Any unsupported Seed is a failed Seed. Preserve the original Legacy R4 strict 100-seed test, including its intentionally unresolved no-go assertion.

## R5 dependency handoff

The new Rules Profile is in **Rules #43 source**, not yet proven in the Bot #40 branch ancestry or Integration #44 on this update. The Rules source mentions independently executed V8 tests, but **no exact-head GitHub Actions result** was confirmed for #43 during the initial check. The R5 Bot 100-seed full-match tests cannot be reported as executed while the dependency is absent. Do not merge, certify the scorer, claim iPhone performance or mark FULL_MATCH_GO / REPLAY_GO / RELEASE_GO on this source-only adapter.

When #43 passes its own exact-head tests and the integrator pins exact reviewed Rules and Bot blobs, the **same-SHA CI** must execute the above R5 test file with no skips. Replay #41 still has its own hardcoded Legacy profile gate and requires separate owner approval before the replay end-to-end acceptance is valid. Do not edit Rules, Replay, UI, integrator tests or CI from this PR.
