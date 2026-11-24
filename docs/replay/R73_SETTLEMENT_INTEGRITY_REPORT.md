# R7.3 — deterministic historical settlement & authoritative integration gate

Inputs: integration 793bbb1caeef79b94e0bb29bf2ea66b3f7c43f4d (R7-009); Agent 8 handoff #46 comment 7121875501; Rules #51 ff27c52526acfdf5fb905b4dd72a229289b8d734; Scoring #52 1b27d5b9cf0c6e3bb7aff894288adfbf309c1b48.

| Rule/Scoring identity | FNV | SHA | authoritative status |
| --- | --- | --- | --- |
| Sandbox experimental-move-v1 / unavailable | legacy | supported | no settlement |
| R3 experimental-full-v1 / tw16-minimal-tai-v1 | legacy | supported | unchanged |
| R5 experimental-v1 / tw16-minimal-tai-v1 | frozen historical win | frozen historical win | unchanged; actual exhaustive DRAW regression |
| R7 robbery experimental-v1 / tw16-minimal-tai-v1 + public contract 1.0.0 | legacy optional digest | supported | R7.1 legal WIN/PASS/robbery; new comparison scorer separate |
| R7.3 authoritative new RuleProfile + ScoringProfile | NOT DEFINED | NOT DEFINED | BLOCKED — missing upstream implemented contract |
| Missing or unknown archive scoring version | reject | reject | missing CORRUPT_REPLAY; unavailable UNSUPPORTED_SCORING_PROFILE; no storage mutation |

R7-009 exact integration patch copied into source test, including both negative version negotiation assertions. Historical archived policy is never replaced by comparative scorer. Strict single terminal settlement, win+settle atomic linkage, reason, tai/breakdown sum, payer responsibility, amount, signed-zero and final score equality audited against original pinned minimal policy. No latest scorer invocation or new event fabricated. Old archive layout and digest format unchanged. Fixed historical FNV and SHA fixtures were generated from actual pre-R7/R7 source modules, not the current serializer. The deterministic Rules replay remains the authority; an unsupported scoring failure cannot create or recover a terminal archive. SHA detects corruption, not signature/authenticity.

## Authoritative integration contract — dependency, NOT implemented by Replay

Rules must publish distinct RuleRef + immutable versioned ScoringProfile reference/config snapshot (not reused ID with changed configuration), evidence contract and accepted scorer dispatch. Pre-settlement evidence derived from validated private host prefix and issued action, winning tile/source/dealer, proposal/reply provenance, replacement provenance, verified wind/streak only; no invented terminal state. Scoring produces pure deterministic ledger with version, breakdown and payer lines, transfer deltas, fee ledger, house delta and net player deltas, +0 normalization, typed unsupported cases. Rules commits WIN/SETTLE or DRAW atomically and replays original exact policy; raw event + authoritative result + final scores must agree. Private evidence stays out of PlayerView, public breakdown only explicit allowlist. No unsupported scoring version fallback.

Minimal reproduction of blocker:
`REPLAY_REQUIRE_R73_AUTHORITATIVE=1 node --test tests/replay/r73-historical-settlement.test.js`
fails explicitly with BLOCKED if distinct authoritative RuleProfile absent (or newly introduced without reviewed Replay integration). Do not waive this test. Combined existing R7 gate:
`REPLAY_REQUIRE_R7_RULES=1 REPLAY_REQUIRE_R7_SCORING=1 node --test tests/replay/*.test.js`.
Both gates and full npm run check, strict R5 100/100, physical browser SHA parity mandatory before promotion. Standalone source lacks upstream modules; historical tests run independently. No new runtime imports.

Public HTTPS: integration #53 reports R7.2 pinned preview READY, public browser observed nonterminal play only; no terminal WIN/DRAW Replay or exact asset-byte parity. #49/#50 handoff requests terminal Replay/reload/cold offline/update and original historical bytes. Standalone #46 offline failure is not a current combined result. No release approval.
