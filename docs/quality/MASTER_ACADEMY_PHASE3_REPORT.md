# Taiwan Mahjong Master Academy — Phase 3 Integration & Quality Report

> **As of 2026-11-20 Asia/Taipei. Phase 3 is NOT release-ready. Latest information: §7; §§1–6 are prior baseline audit.** This report records actually observed GitHub states; later HEADs require independent revalidation.

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

---

## 7. 2026-11-20 updated Phase 3 composed-source audit (supersedes early baseline-status rows above)

**Candidate application + PWA HEAD: `bc92d153b4904dbb9d819572ad7cf95c1dc5e283`**. These are **integration-staged source blobs**, NOT merged source PRs or formally verified four-player rules. [Integration Draft PR #44](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/44) targets `integration/mahjong-academy`, not protected main. Relative to V1 pinned `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`, latest application history is **ahead 11, behind 0**, with **39 changed files** (before this documentation revision). This avoids duplicate unmerged V1 patches.

### 7.1 Exact source provenance, ownership and PR bases

| Owner / source | Current PR source HEAD | Exact source files staged into Phase 3 | Stage commit |
| --- | --- | --- | --- |
| Rules [#43](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/43) | `be033d3e51eaa78e0c04abf6ce49bcb64640e93e` | 10 files: `src/rules/**`, `tests/rules/**`, `docs/rules/**` only | `536311057810785105d00b24dbf0a5a63fbc4ba2` |
| Bot [#40](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/40) | `5f839d11e52fd799a92ddd3bf2c59249af129872` | 6 files: `src/bots/**`, `tests/bots/**`, `docs/bots/**` only | `060f3c1b025c26de157bcefd6ed11e26436c4500` |
| Replay [#41](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/41) | `8faf33f1a5aa05d54b3bb73ed258890858a6cf60` | 5 files in `src/replay/**`, `src/scenario/**`, `tests/replay/**`, `docs/replay/**` | `ac273330bcd86b8036e2c662122f5e45b334ddbf` |
| Table UI [#42](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/42) | `bb2575e8c48bf35afaed8aae45f59c6d3c100d89` | 9 files: table UI/test/docs, reviewed `index.html`, `sw.js` and own workflow | `82e5e9b38d54bca651eb3cb87fbb4a9e52fb9d2f` |
| Daily [#45](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/45) | `44e2dab10ec16b10a1ecb7f93faeecca85d850b5` | 4 source files: `src/adaptive/**`, `tests/adaptive/**`, `docs/adaptive/**` | `c35179e7cec7eda23bc49c6d3bc4422e0ad34a03` |

**All five source PRs currently OPEN / DRAFT, with base `integration/mahjong-full-game`.** Rules #43 changed ancestry to share the Phase 3 baseline; its diff against the integration base is only the 10 Rules-owned files. No force-push main, source PR merge, duplicate cherry-pick or hidden source logic rewrite was performed. Files are staged by the exact source tree blob SHA. Subsequent integrator changes are separately owned and traceable.

**Integrator-only owned commits:**
- `6985861fa162a193b3584de4a5b8a956d9f46c57`: add extension `docs/contracts/PHASE3_FULL_GAME_V1.md` and initial QA report.
- `fae91159abc6914661ebc587d8f28eacd388fcc9`: atomic Service Worker cache for Rules/Bots/Replay.
- `7c73871a6ddfcf8bc63aab113e771c0fb19b4de2`: five actual cross-source boundary tests.
- `318c2127614f0f4dd2771bf258ffdc48716559f8`: add Daily JS to atomic offline cache.
- `3ecd3d395c78b132cbd62ba8f2ec3a5d8ce2bc60`: public-only `createPhase3PublicFacade` composition and tests.
- `bc92d153b4904dbb9d819572ad7cf95c1dc5e283`: cache added Phase 3 public façade, version `tmt-v02-realistic-tiles-master-academy-phase3-integrated-facade-20261120-r4`.

### 7.2 Real source API and useful product scope

- **Rules:** R3 `tw16-configurable-table@experimental-full-v1`, `rules-engine/0.2.0-experimental` includes 136 base + optional eight flower physical tiles, claim windows, pass, chi/pong/kong, replacement, a bounded win/settlement model and seeded event replay. Source Golden tests run, but its *house rules and comprehensive Taiwanese tai are not independently certified*. Verified legacy V1 structural RuleProfile remains distinct.
- **Bots:** `createBot`, `chooseBotAction`, `validateBotDecision`, `createBotController` choose only original Rules-issued action IDs on a **detached PlayerView**. Fixed-seed first decisions tested. Controller currently **returns `claim-adjudication-unavailable`** for a real R3 claim window: no automated multi-seat claim arbitration or settled three-Bot full-match proof. Integrator cross-test asserts the fail-closed outcome rather than manufacturing `FULL_MATCH_PASS`.
- **Replay:** `createReplayService` can persist and reconstruct older bounded sandbox PlayerView histories, enforcing owner-only historical visibility and deterministic replay. Current source API explicitly rejects unverified `postgame` disclosure. Advice is structural / heuristic and cannot add scored Adaptive evidence.
- **Daily:** `createDailyTrainingController` selects exclusively officially `published` Learning QuestionPublic with working canonical grading, starts a new-user `planned` TrainingSession within the original Adaptive `trainingSessions[]` authority, reuses an existing same-Taiwan-local-day Session, saves formal v3 score with provenance and rejects duplicate QuestionRef. The controller is now exposed via `src/integration/phase3-public-facade.js`; new-user API/start and readback verified in Node. **No production Daily Session UI submit journey or cross-tab transaction gate yet**, do not call it complete user-facing Daily training.
- **Table UI:** four-seat 16/17 physical tile sandbox, legal discard, local save/reload and experimental replay page; source `src/table-ui/main.js` constructs `createSandboxSession({storage})` with **no real `botAdapter` or `replayAdapter` injected**. User-facing full three-Bot game, legal claim handling, settlement, and postgame replay are not functional.
- **Composition:** `createPhase3PublicFacade` exposes original V1 Academy, official Daily controller, historical Replay read-only projection, and explicit sandbox table; `capabilities.fullGamePreviewReady=false`, `settledThreeBotMatchVerified=false`, `scenarioScorerVerified=false` and `completeTaiwanRuleProfileVerified=false`.

### 7.3 Latest test evidence; separate program CI from game acceptance

| Gate | Evidence on tested integration code | Status/scope |
| --- | --- | --- |
| V1 protected baseline | [V1 Verify #44569665312](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665312) and [real 12-step E2E #44569665591](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44569665591) | Historical exact V1 HEAD: PASS |
| Rules R3 source Golden | [#43 Verify #44581484883](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44581484883) | PASS for **experimental profile only** |
| Daily source after correcting malformed legacy test fixture | [#45 Verify #44583470130](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583470130) | PASS; source-only [combined browser #44583470138](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583470138) FAIL at offline new-tab, because source branch omitted integrator-owned SW cache; **never mislabel as source PWA PASS** |
| Actual 5-source + cross-module PlayerView/Bot, Rules, Replay, storage tests | [Verify #44583983402](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983402) | **270 tests / 269 PASS / 0 FAIL / 1 optional SKIP** on `318c2127...` |
| Repaired same-SHA combined V1 12-step and real Rules+Strategy | [#44583983398](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983398) | **SUCCESS** both Node and live Chromium 390/1440 offline jobs on `318c2127...` |
| Table UI iPhone-sized Chromium, legal discard, offline shell | [#44583983344](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983344) | **SUCCESS** sandbox-only |
| V0.2 regressions | [Tile #44583983348](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983348), [V0.2 PWA #44583983466](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983466), [Academy UI #44583983339](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44583983339) | source app gate SUCCESS, not physical device |
| New public façade Node validation at latest source | [Verify #44584697484](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44584697484) | **273 tests / 272 PASS / 0 FAIL / 1 optional SKIP** on `bc92d153b4904dbb9d819572ad7cf95c1dc5e283` |
| Latest SHA combined V1 12-step | [#44584697047](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44584697047) | both jobs **SUCCESS** on `bc92d153b4904dbb9d819572ad7cf95c1dc5e283` |
| Latest SHA experimental table Chromium | [#44584696716](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44584696716) | both jobs **SUCCESS** on `bc92d153b4904dbb9d819572ad7cf95c1dc5e283` |
| Full settled 3-Bot game and claim arbitration | no same-SHA end-to-end completion proof | **NO-GO**, not covered by the above passing tests |
| Real settled R3 postgame Replay + official Coach scorer | not implemented/verified | **NO-GO** |
| Daily new-user UI → submit → reopen | API Node verified, browser UI flow not wired | **NOT_RUN / PRODUCT BLOCKED** |
| Real physical iPhone, Android, VoiceOver, TalkBack | no device execution | **NOT_RUN** |

**Known historical failure must remain visible:** integration checkout `82e5e9b...` [combined browser #44582090649](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44582090649) timed out at offline new-tab `live_ready`; the later atomic cache repair `fae91159...` [combined #44582303562](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44582303562) subsequently passed. This does not imply any future SHA automatically passes.

### 7.4 PWA, legacy data and deployment isolation
- The V1 `tw-mahjong-trainer:archive:v3`, `session:v1` and existing `tw-mahjong-master-academy:state:v1` record/provenance semantics remain authoritative. Separate `tw-mahjong-master-academy:table-sandbox:v1` and Replay-prefixed keys hold experimental data; no automatic migration from the V1 Vercel origin or legacy GitHub Pages origin is claimed.
- Service Worker atomic shell now includes real new Rules, Bot, Replay, Daily, Phase3 Façade JS and all 34 original SVG; the version was bumped for each added dependency. CI Chromium offline is **not** an iOS Safari installed PWA/device test.
- Original V1 immutable deployed URL [Vercel deployment pinned to V1 SHA](https://taiwan-mahjong-academy-prerelease-ove792aqt-sign2.vercel.app/) remains untouched. Do **not** reuse that deployment or change PR #26 V0.2 Pages SOURCE_SHA.
- Dedicated Phase 3 public Preview: **BLOCKED / NOT DEPLOYED** because complete Rules certification, claim-aware three-Bot settled match, official postgame Replay, player-facing Daily UI and public browser full-game E2E all fail the ready gate. No speculative URL, no false `release:true` or V0.2.0 tag.

### 7.5 Release matrix
**V1 baseline:** PASS and preserved. **Phase 3 integration branch/source management:** ESTABLISHED. **Experimental Rules and source-level Bot/Replay/Table UI:** bounded/partial PASS. **Daily canonical session API:** NODE PASS, UI incomplete. **Verified Taiwanese full four-player rules:** NO-GO. **Three-Bot settled full match:** NO-GO. **Postgame Replay/Coach:** NO-GO. **Full-match browser/PWA:** NOT_RUN. **Phase3 preview:** BLOCKED. **Formal Release:** NO-GO. All open PRs remain Draft; no protected main writes.


---

## 8. 2026-11-20 latest five-source integration candidate (supersedes older source pins)

**Latest source-staged commit:** [dc8e7af215f5131e07622e482588d8aa7c6f5ffd](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/dc8e7af215f5131e07622e482588d8aa7c6f5ffd); parent `98af3a721f0100f725c6f26d44ffe5ff1e27585d`. No protected `main` change, no PR merge or preview publication. Candidate is experimental; this section records pending and blocked gates, not false passes.

| Source | Latest inspected HEAD | Exact owned files staged |
| --- | --- | --- |
| Rules #43 | `1f7badfefa50d97e4db4a9a689ea563eb3289232` | 12 |
| Bots #40 | `273ccd9819fad4069540cdbd85021df1ad065ba3` | 7 |
| Replay #41 | `147d99fd5dabe23a6c5d774b960a459f19767310` | 5 |
| Table #42 | `701081ab893316dd8ed70ef27b4d487d722eb818` | 12 (source `sw.js` deliberately excluded) |
| Daily #45 | `c4180ee595b72ae8801b3fb987e0036a15abbda8` | 6 |

The 42 source-owned files are copied by their exact Git blob identities, not a cherry-pick of divergent ancestry. Their changed-file scopes and merge bases were audited. Rules #43, UI #42, and Daily #45 diverge from integration HEAD; avoid blind merges. All seven PRs remain Draft; zero formal review submissions were found at this audit. Being free of unresolved threads is not approval. Changes to `sw.js` are integrator-owned: preserve the prior Phase3 transitive precache and explicitly add `src/table-ui/full-round.js`, `src/table-ui/daily.js` and `src/bots/view.js`, with a cache version bump.

**CI evidence before this candidate:** Bots #40 exact-source Verify [#44638412070](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44638412070) reported 281 tests / 279 PASS / 1 FAIL / 1 SKIP. It printed a real source-local `BOT_FULL_ROUND_SUMMARY` for seeds 0..99: 100 executed, 100 completed (89 wins, 11 exhaustive draws), 4,449 Claim Windows, zero illegal actions/stalls and 100 replay matches; **these counts are source-branch-only, not combined-source passing CI**. The failing old integrator test expected `claim-adjudication-unavailable`, but the new controller returned `acted`. In the candidate, `tests/integration/phase3-source-boundaries.test.js` now checks three actual authoritative Rules claim submissions, revision progression, automatic arbitration and deterministic state replay. Replay #41 source Verify [#44637928438](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44637928438) passed. #43/#42/#45 had no exact-source PR workflow runs returned by the queried commit-run endpoint.

**New exact-head acceptance workflow:** `.github/workflows/phase3-full-match.yml` runs real R3 Rules, three Bot fixture/100 seeds, Replay and cross-module state tests; separately runs `tests/browser/full-table-ui-r3-gates.py` in Chromium including human controls, settlement, saved Replay, Daily UI, 34 SVG and offline PWA. Uploads screenshot/action evidence even if the browser gate fails. The existing `tw16-table-ui.yml` remains specifically a sandbox gate; its green result cannot be misreported as full-match acceptance.

| Required status | Assessment at source staging | Pass rule |
| --- | --- | --- |
| V1_BASELINE_PASS | PASS on separately pinned #33 | Existing 12-step E2E/Oracle evidence; retest latest candidate pending |
| EXPERIMENTAL_RULES_PASS | SOURCE_EVIDENCE; COMBINED_PENDING | Latest Rules golden + source pinned |
| CLAIM_ARBITRATION_PASS | COMBINED_PENDING | Three responders, Rules adjudication, no private intent leak |
| THREE_BOT_MATCH_PASS | SOURCE_100_SEEDS; COMBINED_PENDING | Same SHA, 100 seeded terminal games and replay equality |
| REPLAY_PASS | SOURCE_CI_PASS; COMBINED_PENDING | Same SHA settled R3 Replay and privacy |
| DAILY_UI_PASS | COMBINED_PENDING | Official v3/provenance and browser refresh |
| TABLE_UI_PASS | COMBINED_PENDING | Actual human+three Bots completed browser game |
| PWA_PASS | COMBINED_PENDING | Offline R3 new tab and full dependency graph |
| PREVIEW_DEPLOYED | NO | Isolated verified HTTPS deployment not yet available |
| FULL_RULES_VERIFIED | NO | Experimental simplified scoring, unsupported venue variants |
| RELEASE_GO | NO | Full match/preview/device/complete-rules gates not met |

**Do not promote any PENDING gate by inference.** Full Game Preview: NO-GO until same-HEAD terminal browser+replay evidence exists. Formal release: NO-GO. Physical iPhone, Android, VoiceOver, TalkBack: NOT_RUN by request.
