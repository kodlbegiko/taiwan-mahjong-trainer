# R7.1 Replay cross-owner compatibility (Draft / integration NO-GO)

Pinned inputs: Replay baseline f6da1d2ba15c1938963bbb4096a737319c8f784b (Verify + Phase 3 SUCCESS); Rules PR #51 633d20faf7f9c305b8d972bd0e3f44b639d4d798; Scoring PR #52 202e007de599cd265b1b1b22d645d95914c311c1. No Rules, Scoring, Strategy, Table UI or SW changes in this PR.

| Case | Replay contract | Acceptance |
| --- | --- | --- |
| Legacy R3 / R5 | Unchanged rule IDs, original minimal score, canonical event replay, FNV-only archives readable | Baseline CI green; exact new HEAD CI required |
| R7 added kong proposal | Public kong_proposed maps to Rules LegalAction kong, no premature meld mutation | Conditional combined-source test |
| R7 robbery WIN/PASS | Private replies; final pass + win + settle atomic; robAddedKong marker matches terminal result, original minimal discard liability | Conditional combined-source test |
| R7 all PASS | final pass + kong atomic, proposalEventId preserved, next tail draw separate | Conditional combined-source test |
| R7 competing robbers | Typed unsupported, original accepted prefix only | Conditional combined-source test |
| New ScoringProfile | NO authoritative Rules integration; reject unknown scoring config/version, never run comparison scorer or silently change old scores | BLOCKED by #51/#52 contract |
| Fees / responsibility / detailed new scorer ledger | Proposed payments, playerTransferDeltas, fees, houseDelta, playerDeltas; player transfers zero sum, net players + house zero sum | BLOCKED until Rules emits versioned immutable result and event |
| Cross-runtime digest | Unchanged canonical sorted keys / UTF-8 SHA-256, Node crypto oracle, JSON order and Unicode boundary vectors | Browser-specific comparison NOT RUN |
| Public HTTPS / offline | R7.1 exact combined deployment and live terminal Replay/reload/offline evidence unavailable | BLOCKED (Agent 1 / integrator) |

The R7 robbery profile still uses tw16-minimal-tai-v1. Replay verifies original Rules settlement deltas, event and score totals, and preserves the full original private result via canonical Rules reconstruction (including breakdown), never runs a second scorer. Public postgame includes only explicitly allowed public robbery marker and settlement outcome. Strategy V1 cannot parse kong_proposed, proposalEventId, robAddedKong and the public proposed-tile semantics: Replay displays authoritative historical PlayerView but uses legal-only coaching for this exact new profile, no fabricated structural metrics or review question. Unknown profiles fail closed.

Scoring PR #52 standalone comparison adapter is not historical authority; it requires actual discard event provenance and does not yet handle rob-added-kong. Request a distinct immutable RuleProfile + ScoringProfile ID/version/config snapshot and Rules-issued versioned terminal ledger; historical Rules replay must dispatch to the original scorer rather than the latest scorer. No speculative implementation of unapproved scoring facts. Full private result equality and settlement event equality are mandatory; public breakdown needs a separate audited visibility allowlist. Special payer responsibility unsupported until versioned verified evidence and policy. SHA-256 is corruption detection, not signature, access control or proof of authenticity.

Run npm run check on exact PR #46 HEAD. Standalone robbery tests deliberately skip with named dependency if #51 absent; combined acceptance MUST run REPLAY_REQUIRE_R7_RULES=1 node --test tests/replay/*.test.js on actual integration SHA, with no robbery skip. Existing R5 fixed 100/100 gate remains required. Do not count separate #51/#52 tests as Replay integration.

Agent 7: include ./src/replay/index.js, ./src/replay/internal.js, ./src/replay/integrity.js in the precache manifest; integrity.js is the new direct runtime import from internal.js. Bump cache version after source changes, check all transitive imports (Rules/Strategy/Scenario/Academy) and verify fresh install + offline update on exact combined SHA. No new R7.1 runtime file.

Agent 1: obtain public fixed HTTPS deployment SHA, complete a real legal hand, open Replay from settlement, inspect initial/intermediate/terminal boundaries and score consistency, refresh and reopen, go offline and reload/reopen; report exact SHA, URL, trace/screenshot, status and sanitized diagnostics. Previous R6 native-dialog blocker and old R5 staging are not R7.1 evidence. No GameState injection.

