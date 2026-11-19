# Taiwan Mahjong Master Academy — Phase 3 Integration & Quality Report

> **As of 2026-11-20 Asia/Taipei. Phase 3 is NOT release-ready.** This report records actually observed GitHub states; later HEADs require independent revalidation.

## 1. V1 baseline (preserved)
- main `25870862b6499f7e699967aa76429ae5dcfc5db4` (protected).
- V1 integration [PR #33](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/33) HEAD **`68fb50bc43746a0e6ff9f2f90712904d06a2ccda`**, **OPEN / DRAFT / NOT MERGED**. Zero formal reviewer approvals at this query.
- All exact-HEAD required checks previously green: [Verify #44569665312](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665312), [combined R/S/L/A + real 12-step Chromium #44569665591](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665591) (207 tests, 206 pass, 0 fail, 1 optional stress skip; mandatory Rules+Strategy 3/3, Learning/Adaptive 6/6), [UI #44569665413](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665413), [tiles #44569665612](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665612), [old PWA #44569665476](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665476), [independent UI #44569668951](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569668951).
- Original [immutable SHA-specific V1 preview](https://taiwan-mahjong-academy-prerelease-ove792aqt-sign2.vercel.app/) Vercel deployment `dpl_8LM3D74xZB3Axuq7y6Xs7P8f5kvV`, state READY, Git SHA `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`. No change to PR #26 V0.2 Pages SOURCE_SHA.
- Legacy authority remains `tw-mahjong-trainer:archive:v3` plus original v1 storage, and V1 Academy provenance `tw-mahjong-master-academy:state:v1`. No automatic cross-origin localStorage migration.

## 2. Phase 3 source audit — current HEADs before integration

| Source | PR, base, HEAD | Exact-head source CI | Actual delivered vs incomplete |
| --- | --- | --- | --- |
| Daily Training | no branch / PR `feat/academy-daily-training` at baseline audit | NOT_RUN | New-player session generation still absent |
| Rules | [#43](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/43) on **`feat/mahjong-rule-engine`**, `2796b764dd5e397a0baa24f9dd2583149b1d3fa9` | [Verify #44579224150](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44579224150) SUCCESS; 140/139/0/1 | experimental configurable draw, chi/pong/kong, flowers, bounded win/pass, synthetic minimal tai/zero-sum settlement, seeded replay; missing many Taiwanese variant rules |
| Bots | [#40](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/40) on V1 integration, `5f839d11e52fd799a92ddd3bf2c59249af129872` | [Verify #44575100838](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44575100838) SUCCESS | PlayerView-only legal draw/discard, 24 deterministic first decisions; claim windows blocked; full-game completion N/A |
| Replay | [#41](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/41) on V1 integration, `8faf33f1a5aa05d54b3bb73ed258890858a6cf60` | [Verify #44575982105](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44575982105) SUCCESS | deterministic sandbox history, privacy projections/advisory only; real postgame/verified scorer unavailable |
| Table UI | [#42](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/42) on V1 integration, `bb2575e8c48bf35afaed8aae45f59c6d3c100d89` | [table UI #44577112161](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44577112161) SUCCESS | 4 seats, 17 tiles, Rules legal discard, sandbox persistence/390 offline; not complete Bots/claims/replay |

## 3. Source ownership / Git ancestry risk
- #40 changed only `docs/bots/**`, `src/bots/**`, `tests/bots/**`; #41 only `docs/replay/**`, `src/replay/**`, `src/scenario/**`, `tests/replay/**`. Each is an **ahead-only** descendant of V1 `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`, so owned blobs can be sourced exactly.
- #42 also changes `index.html`, `sw.js` and a standalone workflow; shell wiring must be reconciled atomically by integrator, avoiding PWA cache divergence.
- #43 changed `src/rules/**`, `tests/rules/**`, `docs/rules/**` only in its own PR, **but Git merge base with V1 integration is still main `25870862...`** (diverged; ahead 38 / behind 14). **Do not merge or retarget blindly**, as that may replay/erase V1 Rules and Academy integration. Source-owner rebasing or exact reviewed blob copying with file-grain provenance is mandatory. Its actual RuleProfile is `tw16-configurable-table@experimental-full-v1` and remains **experimental**.
- Combined Rules+Bot+Replay+UI full-match gates are **NOT_RUN** at this baseline stage. Standalone source success is not proof of cross-module compatibility.

## 4. Contract, runtime and source of truth
- Extension: [PHASE3_FULL_GAME_V1.md](../contracts/PHASE3_FULL_GAME_V1.md), `mahjong-full-game/0.1.0-experimental`, additive to existing `master-academy/1.0.0`.
- Rules owns full GameState and settlement; Bots receive only seat PlayerView; Replay owns authorized event projections; UI only consumes public façade; Adaptive only counts durable validated evidence; integrator owns cross-module bridge and Golden fixture orchestration.
- Source-specific DTO names/shapes may differ; any adapter must be validated, versioned and fail closed. The contract alone does **not** certify a complete ruleset.
- V1 `archive:v3` and historical v1 bytes remain immutable. Phase 3 rounds/Bots/replays use disjoint versioned keys; Daily sessions use Adaptive authority.

## 5. Acceptance matrix (baseline only)

| Gate | State | Evidence / gap |
| --- | --- | --- |
| V1 regression | PASS at `68fb50bc43746a0e6ff9f2f90712904d06a2ccda` | 12-step and legacy CI links above |
| Rules experimental Golden | SOURCE_PASS at `2796b764...` | #43 run #44579224150; **not** verified universal full rules |
| PlayerView privacy | SOURCE_PASS, COMBINED_NOT_RUN | Rules #43 and Replay #41 standalone contracts; no combined R3 + Bot + Replay proof |
| Bot simulation | SOURCE_PARTIAL | 24 first choices valid, no settled complete match |
| Replay determinism | SOURCE_PARTIAL | historical bounded sandbox only |
| DailySession | NOT_DELIVERED | new user still null on baseline |
| Four-player UI | SOURCE_PARTIAL | experimental drawable 4-seat sandbox, no 3-bot settled game |
| Browser full-match E2E | NOT_RUN | no full integrated game available |
| PWA combined | NOT_RUN | source UI only, not four-modules combined |
| Physical iPhone, Android, VoiceOver, TalkBack | NOT_RUN | deferred per user |
| Dedicated Phase 3 HTTPS Preview | BLOCKED | wait for required same-SHA full match, Chromium and offline |
| Formal Release | NO-GO | Rules policy is experimental, no complete verified match or device acceptance |

## 6. Integration decisions
- Create `integration/mahjong-full-game` from **`68fb50bc43746a0e6ff9f2f90712904d06a2ccda`**, not from main. All future source PRs should target this branch. V1 PR #33 remains untouched.
- Do not merge #40–#43 into main or Phase 3 merely because standalone tests passed. Retarget straightforward V1 descendants only when their reviewed file diff is preserved; #43 needs independent ancestry remediation.
- After V1 eventually merges main, use a merge-base/diff audit and fast-forward/rebase plan that preserves content identities and prevents duplicate patches. Never force-push main.
- No Phase 3 Preview Ready until actual complete settled four-player match, Bot legal action tests, Replay, Daily, legacy regression, PWA and public browser checks pass on **same integration HEAD**.
