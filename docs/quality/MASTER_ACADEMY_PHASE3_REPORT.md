# Taiwan Mahjong Master Academy — Phase 3 Integration & Quality Report

> **Latest verified acceptance is §12 (R5), tested application SHA `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`: experimental one-winner preview READY; formal rules and RELEASE still NO-GO.** Sections §1–11 are historical R3/R4 audit snapshots, not assertions about R5. Every CI claim below binds to the actual tested application SHA.

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


---

## 9. 2026-11-20 measured combined-source R3 acceptance and repairs (supersedes §8 preliminary estimates)

**Measured CI SHA:** `dda2624f8900701b577ecc90745e02a5845c6c0d`. Only results attributed explicitly to that SHA are empirical. Newer source fixes are candidates and **do not** retroactively change prior failures.

### Same-SHA Node Verify — 305 / 301 PASS / 3 FAIL / 1 SKIP

[Combined Node run #44645403753](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44645403753) failed:
1. `tests/adaptive/daily-training.test.js:162` — simulated v3 quota failure leaves a durable `pendingProvenance`; reusing original `attemptId` wrongly returns `recovery-required` with `作答 ID 已存在`, rather than `saved`. Diagnosed underlying source: `src/storage/local.js` intentionally retains its unsaved in-memory archive as fallback on quota failure; reusing the same store instance on a **durability-critical Daily retry** creates an in-memory phantom duplicate. Fix is now source-owned [Daily PR #45 `4d91a537`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/4d91a537156dd25e22569f6025acc2b63ec0e251): Adaptive `src/adaptive/learning-adapter.js` creates a fresh legacy writer for every canonical submit and checks its durable readback. No change to original V1 archive schema. Await same-SHA rerun; don't infer PASS.
2. `tests/bots/r3-full-round.test.js:168` — 100 fixed seeds executed, **99 terminal** (88 win, 11 draw), 1 `unsupported-rule-capability` at **Seed `87`** (game `bot-r3-87`, seed `fixed-round-87`, 162 events, 157 steps, 32 Claim Windows, 95 responses). `invalidActions=0`, `stalls=0`, `replayMatched=99`. Full 100/100 gate **FAIL**. This unsupported event must be treated as an explicit Rules capability gap. In particular multiple simultaneous legitimate winner intents are intentionally fail-closed under experimental RuleProfile: no invented arbitration or forged win. Preserve seed and event trace, retest if Rules separately adds a real table-policy authority.
3. `tests/tile-assets-integrity.test.js:75` — integrator-only cache version `tmt-phase3-...` violates V1 `tmt-v02-realistic-tiles-` prefix assertion. Fixed in integrator `sw.js` (retains full precache + added R3/Daily/Bot dependencies); rerun pending.

**Independent earlier V1 Chromium:** on that SHA, the Master Academy combined 12-step browser job passed, and the master Academy UI browser job passed. Their matching Node workflows were red due to the three global failures; do not report full V1 latest combined Gate PASS without green Node.

### Same-SHA real Chromium R3 result

[Full-match workflow #44645403861](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44645403861) reached a real **human + 3 Bot** Rules-owned terminal state, displayed authoritative experimental `tw16-minimal-tai-v1` zero-sum settlement (**310 events**), persisted the completed match, loaded historical own-seat Replay and advanced the frame. [Three real screenshots artifact #14588736118](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44645403861/artifacts/14588736118). This is concrete full-round browser evidence, but **the workflow FAILED** in Daily route after Replay: the test looked for `[data-daily-start]` or `[data-daily-resume]` before asynchronous Daily route import finished and timed out; root cause and official Daily persistence must be verified, not assumed. Offline new tab / 34 SVG after Daily **NOT_RUN** in this failed flow.

Source-owned corrections:
- [Replay PR #41 `b5f64675`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/b5f64675b51ac5515329bb4d758dbff6df707ab1) exposes an owner-only `listReplayFrameBoundaries()` that skips intermediate partial legal-action event groups (e.g. `win` before `settle`).
- [Table UI PR #42 `11974be1`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/11974be1b59e2fd12c61f5761f123ae429af2a6d) navigates those exact event boundaries rather than naively `eventSeq=index+1`.
- [Table UI PR #42 `9a0b35ad`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/9a0b35ad4ee5b18cca7a0861bbf8fcc5d77cc76c) adds explicit async Daily route readiness and failure screenshot/error reporting. CI Chromium now installs Noto CJK to display Chinese text correctly. Source-specific browser test is **not** a successful combined gate until the final exact integration SHA is tested.

### Current source pin and strict gate matrix

| Item | Exact source HEAD as observed | Combined evidence |
| --- | --- | --- |
| Rules #43 | `1f7badfefa50d97e4db4a9a689ea563eb3289232` | Experimental only |
| Bots #40 | `273ccd9819fad4069540cdbd85021df1ad065ba3` | 99/100 combined; unsupported seed 87 |
| Replay #41 | `b5f64675b51ac5515329bb4d758dbff6df707ab1` | Corrected group-atomic timeline, rerun pending |
| Table #42 | `9a0b35ad4ee5b18cca7a0861bbf8fcc5d77cc76c` | Full round + replay observed on prior SHA; Daily browser rerun pending |
| Daily #45 | `4d91a537156dd25e22569f6025acc2b63ec0e251` | Retry repair staged; rerun pending |

| Status | Current adjudication |
| --- | --- |
| V1_BASELINE_PASS | Historical V1 source PASS; newest combined regression PENDING |
| EXPERIMENTAL_RULES_PASS | Rules golden source evidence; combined follow-up PENDING |
| CLAIM_ARBITRATION_PASS | Implemented; same-SHA Rule/Bot tests PENDING |
| THREE_BOT_MATCH_PASS | **FAIL: 99/100, Seed 87 unsupported** |
| REPLAY_PASS | Historical full-round browser observed; final group-boundary gate PENDING |
| DAILY_UI_PASS | **FAIL on measured head**; durable retry and browser navigation retest PENDING |
| TABLE_UI_PASS | Browser terminal game observed; full required E2E PENDING |
| PWA_PASS | Browser Gate aborted before offline; PENDING |
| PREVIEW_DEPLOYED | NO |
| FULL_RULES_VERIFIED | NO — unsupported capabilities/experimental minimal scoring |
| RELEASE_GO | **NO-GO** |

**Do not conflate a single 310-event settled browser match with 100/100 completion or verified full Taiwanese rules.** The final integration commit must pass the exact-source Node/Chromium/PWA/legacy gates before any Full Game Preview designation. Physical iPhone, Android, VoiceOver and TalkBack remain NOT_RUN.


### 2026-11-20 Seed 87 reproducibility instrumentation and runner reliability

The deterministic unsupported path above was corroborated on another same-SHA R3 Node run [#44646674494](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44646674494): 24 targeted Node tests, 23 passed, 1 failed (the 100 fixed-seed completion assertion), and again 99/100 terminal, 88 wins, 11 draws, seed 87 `unsupported-rule-capability`, 4,449 Claim Windows. This is evidence of repeatability, not permission to relabel the unsupported hand as a draw.

Bot source [#40 `47f63464d8de224ad7043b46c495ff62d1d0cbcb`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/47f63464d8de224ad7043b46c495ff62d1d0cbcb) now retains `unsupportedCapability`, failing Action ID and a replayable sequence of submitted public `{actorSeat,actionId,expectedRevision}` values for unsuccessful seeds; it does **not** put private wall or concealed state in logs. Its source-owned test blob was staged on integration for the next exact-SHA run. The Chromium workflow no longer depends on potentially stalled Linux package-mirror CJK font installation: functional acceptance and screenshots take precedence; text typography coverage is assessed separately. Newest combined CI is PENDING; no other release gate is promoted.

---

## 8. R4 CI recovery audit — 2026-11-20 Asia/Taipei (integration-only evidence; not release certification)

### 8.1 Exact refs and blob provenance

- Protected main: `25870862b6499f7e699967aa76429ae5dcfc5db4`.
- V1 PR #33 Draft: `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`.
- Phase 3 PR #44 Draft, **first audited failing HEAD**: `232c9457350c69224f12b346f2a1e4b528dd0b65`.
- Latest source HEADs checked on 2026-11-20: Rules #43 `1f7badfefa50d97e4db4a9a689ea563eb3289232`; Bots #40 `47f63464d8de224ad7043b46c495ff62d1d0cbcb`; Replay #41 `b5f64675b51ac5515329bb4d758dbff6df707ab1`; Table UI #42 `9a0b35ad4ee5b18cca7a0861bbf8fcc5d77cc76c`; Daily #45 `4d91a537156dd25e22569f6025acc2b63ec0e251`.
- Full Git tree blob-identity comparison at integration test-fix HEAD `d4dd0533fa27514d8018f0ee8b6d35936d4dc2ad`: Rules 14/14 source-owned paths identical; Bots 10/10; Replay 7/7; Daily 18/18; UI 7/9. The **only two intentional deviations** from latest UI source are integrator browser tests `tests/browser/full-table-ui-gates.py` and `tests/browser/full-table-ui-r3-gates.py`. No source-owned Rules/Bots/Replay/Adaptive implementation blobs were overwritten; `src/table-ui/**`, `index.html` and `sw.js` are unchanged by this R4 recovery.
- Historical source PR branch ancestry is **diverged** from integration; matching blobs is stronger evidence than commit ancestry here. No blind full-branch merge or cherry-pick was performed.

### 8.2 Failure Matrix — first independently observed blocker, audited SHA `232c945...`

| Workflow / run | Failed Job / first assertion | Root owner | Shared npm check propagation? | R4 disposition / exact validation |
| --- | --- | --- | --- | --- |
| [Verify #44647873450](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873450) | `test`: `tests/bots/r3-full-round.test.js:220` | Rules #43 + Bots #40 | Direct failure | 305 tests / 303 PASS / 1 FAIL / 1 optional SKIP at **232c945 only** |
| [Full Match #44647873497](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873497) | Rules + Bots Node: `fixed-round-87`, assert `failures=[]` | Rules #43 + Bots #40 | Direct | 99/100 settled, 1 typed `multiple_winners` unsupported; separate Chromium Job: Daily assertion |
| [Full Match #44647873497](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873497) | Full human+3bot Chromium: `Daily canonical grading was not durably recorded` | Daily #45 + Table UI #42 integration | No | R4 updated browser assertions to require canonical v3 RecordRef + sidecar provenance/session + derivations, pending same-HEAD CI |
| [Table UI #44647875434](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647875434) | Chromium: `initial real engine 17 legal physical tiles missing` | UI / obsolete sandbox acceptance contract | No | R4 replaced incorrect immediate-discard-only assumption with real R3 flower-phase transition + 17 legal discards, pending same-HEAD Chromium |
| [Table UI #44647875434](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647875434) | Table UI / legal action / persistence Job: `npm run check` | Seed 87 common fail | Yes | Not independent UI failure |
| [Tile QA #44647874205](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647874205) | Real Chromium 1440/768/390/320 + SVG/PWA Job: Node prerequisite | Seed 87 common fail | Yes | Browser itself not reached; no separate SVG verdict |
| [V0.2 PWA #44647874247](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647874247) | chromium Job: `npm run check` | Seed 87 common fail | Yes | Browser itself not reached |
| [V0.2 independent #44647873483](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873483) | Both Node and Chrome Jobs: `npm run check` / candidate P0 prerequisite | Seed 87 common fail | Yes | No independent V0.2 defect established |
| [Academy UI #44647873609](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873609) | Node Job: `npm run check` | Seed 87 common fail | Yes | Independent Academy mobile/desktop/offline Chromium Job **SUCCESS on 232c945**, not same as total workflow PASS |
| [Academy combined #44647873473](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873473) | R/S/L/A Node Job prerequisite | Seed 87 common fail | Yes | Independent real Lesson/v3/Adaptive/Review/offline Chromium Job **SUCCESS on 232c945**; total workflow still failure |

The eight failed Workflows are **not eight independent bugs**. The first proven independent blockers are: 100-seed RuleProfile capability; R3 Daily browser durability; outdated table sandbox browser assertion. Previous SW cache-prefix regression was repaired before 232c945; no new independent cache-prefix failure was observed in these logs.

### 8.3 Seed 87 — mandatory preserved NO-GO

- Deterministic game seed `fixed-round-87`; game `bot-r3-87`. Trace shows seat 2 discards physical tile `t:26:0` at revision 159; seat 3 submits a valid Rules `DISCARD_WIN` at revision 160; seat 0 submits a distinct valid `DISCARD_WIN` at revision 161; resolution at revision 162 returns typed `UNSUPPORTED_RULE_CAPABILITY / multiple_winners`. 162 events, 32 claim windows, 95 claim responses, **0 invalid actions, 0 stalls**, no forged Bot action ID. No valid settlement and no complete Replay for this seed.
- Source `src/rules/complete-engine.js` and `getRuleCapabilities` explicitly reject multiple discard-win intents; `tests/rules/claim-arbitration.test.js` asserts typed fail-closed. Meanwhile `docs/rules/TW16_TABLE_POLICY.md` documents nearest-seat single-winner tie-break. This is a **policy/capability discrepancy requiring Rules-owner adjudication**. It is unsafe for the integrator to silently erase `unsupported` or select a winner without publishing a coherent, versioned policy and Golden settlement/replay/privacy tests.
- Observed fixed-seed totals at **232c945**: 100 executed, 99 settled, 1 unsupported, 99 replay matches. Exact win/draw breakdown on the 99 successes must be read from the individual seed log; no absent data is inferred. **THREE_BOT_MATCH_PASS=false**.
- Keep seed 87 unmodified and red. If Rules eventually implements a reviewed single-winner nearest-seat policy, new exact-head full 100 seeds + replay + independent Golden + settlement verification are mandatory. A genuine multi-winner settlement needs separate versioned RuleProfile/ScoringPolicy and tests.

### 8.4 R4 browser test repairs, source ownership, and limits

- `c554c253fcdf47f48fc919b9919e0d4075ad41d0`: R3 Daily Chromium test now explicitly checks durable canonical `archive:v3` records, Adaptive sidecar provenance, Session RecordRefs, no pending provenance and derived AbilityProfile/ReviewPlan. It includes safe metadata diagnostics if the submission still fails. This does **not** manufacture official records.
- `185ffee7a509c41aacf732d849f61ca810dbc0b7`, `1a968d5c8c3b6e4df8ce642e1a7ea284680517c7`, `d4dd0533fa27514d8018f0ee8b6d35936d4dc2ad`: update the obsolete *sandbox-only* Browser gate to require real R3 profile, complete actual flower replacements via Rules-issued LegalActions, then 17 physical eligible dealer discards; preserve keyboard, touch, reduced motion, 320/375/390/430/768/1440 widths, two-step discard, authenticated Rules checkpoint readback, reload, redacted opponents, legacy Academy, 34 SVG and cold offline tab. No fake Bot decisions or fixture-only acceptance. The separately required real full-match R3 Chromium E2E remains unchanged except stricter Daily durability.
- All four are **test/diagnostic commits**, not source Rules/Adaptive behavioral fixes. CI results must refer to the exact candidate HEAD; queued/in-progress are NOT PASS.
- Independent historical public real Chromium R3 evidence exists at 232c945: one real terminal game, experimental settlement and verified Replay frames with [screenshots in run #44647873497 artifact](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873497). The **overall R3 job failed at Daily before offline**. The images are not proof of full R4 acceptance.

### 8.5 Oracle, schema, security, and remaining release gates

- At 232c945, required independent 10,000 mixed 16/17-tile physical oracle, 10,000 sampled 17-tile win oracle and 10,000 seeded shanten oracle are individually reported PASS inside the 303 passing Node tests. The separate opt-in `MAHJONG_STRESS=1` additional 10,000+ oracle remains **SKIP**, not silently passed.
- V1 PR #33 baseline historically passed at its own exact SHA, and both standalone combined Academy/V1 Chromium jobs succeeded at 232c945. Neither certifies all R4 code changes after 232c945.
- Rules remain `experimental`, with simplified `tw16-minimal-tai-v1` scoring, unverified full Taiwanese venue tai/penalty/rob-kong/multi-winner semantics. No official scenario scorer or Bot-derived Adaptive evidence is certified.
- 320/390/1440 Chromium, Replay privacy, cold-tab PWA, new SW Update, 34 SVG, legacy archive bytes and Daily reload require final same-SHA CI evidence. Physical iPhone Safari, Android, VoiceOver and TalkBack: **NOT_RUN**.
- No fresh Phase 3 immutable-SHA Vercel HTTPS acceptance preview was published by this audit. Existing V1 independent Preview and V0.2 must remain unchanged.
- Gate state at audit: `V1_BASELINE_PASS`=historical only / new integration not certified; `EXPERIMENTAL_RULES_PASS`=bounded Rules Node PASS at 232c945; `THREE_BOT_MATCH_PASS`=FAIL; `REPLAY_PASS`=partial/old SHA only; `DAILY_UI_PASS`=FAIL; `TABLE_UI_PASS`=FAIL/repair awaiting run; `PWA_PASS`=NOT_VERIFIED for full R3; `FULL_GAME_PREVIEW_READY`=false; `FULL_RULES_VERIFIED`=false; `RELEASE_GO`=false.
- PR #44 remains Draft; no protected main change, new PR, official release/tag or production deployment. **Release decision: NO-GO** until the same final SHA passes all mandatory gates.

## 9. R4 browser verification recovered and exact-SHA CI repair (2026-11-20)

### Genuine new browser PASS, anchored to older concrete integration SHAs

1. **Full R3 Chromium** Job SUCCESS at integration source HEAD `c554c253fcdf47f48fc919b9919e0d4075ad41d0`, [Actions run 44655383603](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44655383603), job `136020194573`, artifact `14592058541`. It completed the real four-seat UI/Bot/Rules terminal match, experimental settlement, saved/reloaded Replay, canonical Daily v3 + sidecar provenance/Session evidence, offline new tab and 34 SVG. Four screenshots include started table, settled table, Replay and offline. The **Node 100-seed Job still FAILS** for seed 87 on the same source. The full Workflow is therefore FAIL.
2. **Phase 3 Table UI Chromium** Job SUCCESS at `d4dd0533fa27514d8018f0ee8b6d35936d4dc2ad`, [Actions run 44655616188](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44655616188), job `136020972734`, artifact `14593197711`. Real R3 phase-aware flower replacement proceeded to 17 legal dealer discard buttons, responsive widths 320/375/390/430/768/1440, touch/keyboard, two-step discard, persisted Rules revision, restore, redacted opponents, legacy Academy, offline cold tab and 34 SVG. This is not proof that the entire Table UI Workflow passed its shared `npm run check` prerequisite.
3. **Full R3 Chromium** independently SUCCESS again at `d4dd0533fa27514d8018f0ee8b6d35936d4dc2ad`, [Actions run 44655616340](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44655616340), browser artifact `14592613994`. The historical artifact has the wrong `testedSourceSHA` label (GitHub pull_request `GITHUB_SHA` merge ref `496700f...`) while source checkout `git rev-parse HEAD` is `d4dd0533...`. This metadata bug was corrected in a later workflow commit.
4. R4 integrator commit `db2338f3686c2a143cd1c3a9cc639d28a549457c` changed the R3 acceptance manifest's `testedSourceSHA` to **actual checked-out `git rev-parse HEAD`**, retained a separate `workflowTriggerSHA` for GitHub-generated merge refs. Earlier evidence remains labeled as historical; do not relabel it retroactively.
5. R4 integrator commit `a67c1f338c05c34dd5be2b576dafb59ddea6dc04` added **post-refresh Daily screenshot, post-reload screenshot, and machine-readable `daily-durable-evidence.json`** with canonical RecordRef IDs, provenance IDs, Session IDs and derived-profile presence to the R3 Chromium artifact. This is new test code; it requires its own execution before asserting PASS.
6. R4 integrator commit `96c6327803175e4cd92199e2535f23a8eaa943ce` atomically updated all eight other GitHub Actions Workflow definitions (`ci`, V1 combined, V1 Academy UI, Table UI, V0.2 Browser UI, V0.2 Independent UI, V0.2 Tile Faces and browser smoke) to checkout **the exact `github.event.pull_request.head.sha || github.sha`** and assert `git rev-parse HEAD` equals that SHA. This removes the previous ambiguity in which GitHub default checkout used synthetic PR merge commits; it **does not** relax any test or convert a FAIL to PASS.
7. The last three commits are only CI/test evidence improvements, not engine behavior changes. Every final integration Gate still requires all Workflow/Job results on **the same final HEAD**. On the latest audit, final same-SHA runs were queued or in progress. **Seed 87 remains blocked, so release status remains NO-GO.**

Reviewer coordination posted in source PR #43 (Rules, issue comment `7027901182`) and #40 (Bots, comment `7027901776`) requiring versioned policy resolution and no fictitious settlement. PR #44 stays Draft. All iPhone Safari, Android, VoiceOver and TalkBack remain NOT_RUN; no official Phase 3 immutable-SHA preview, tag, or release authorized.

## 10. R4 newest Rules/Bots source integration (supersedes earlier source pins)

**Newer source PR heads were discovered by a second live GitHub check after §9 was written.** Rules #43 advanced to `bedab27a8a39565cb62fdbcdc9abb868cf1dadac`; Bots #40 advanced to `b872f3529fc76dc76dc7f4d01bfdb66f306f4c71`. Both remain Draft. Replay #41 remains `b5f64675b51ac5515329bb4d758dbff6df707ab1`, UI #42 remains `9a0b35ad4ee5b18cca7a0861bbf8fcc5d77cc76c`, Daily #45 remains `4d91a537156dd25e22569f6025acc2b63ec0e251`.

**Safe exact-blob integration commit:** `ede7dc94ad516e751001921f7d1a91cf1f5c7be9` (parent `beaf84d07466924c791fdfd65ee6b9ba39a3660f`). Cherry-picked by matching Git blob IDs via a single tree+commit and checked fast-forward ref, **not by blind merging diverged branch histories**. The following 12 source-owned files were copied byte-identically:

- Rules (7): `docs/rules/CLAIM_ARBITRATION_API.md`, `docs/rules/TW16_TABLE_POLICY.md`, `src/rules/complete-engine.js`, `src/rules/engine.js`, `src/rules/index.js`, `tests/rules/fixtures/seed-87-r4-trace.js`, `tests/rules/r4-seed-87.test.js`.
- Bots (5): `docs/bots/R4_SEED87_RELIABILITY.md`, `docs/bots/README.md`, `src/bots/controller.js`, `tests/bots/r3-full-round.test.js`, `tests/bots/r4-capability.test.js`.

New Rules tests preserve a fixed 157 legal-action trace ending revision 162 with two separately valid private WIN intents and unchanged source state on an unsupported final PASS. The revised documented RuleProfile explicitly distinguishes **single-winner experimental settlement** from **multiple legal discard WINs: `UNSUPPORTED_RULE_CAPABILITY/multiple_winners`**. The prior documentation's misleading nearest-seat tie-break language has been constrained to supported claim types. No new multiwinner payout/settlement was created.

New Bot code latches typed Rules rejection with game/revision/seat and persists a minimal redacted checkpoint; subsequent ticks and retries fail closed. The source-owned 100-seed test still requires `summary.fullMatchGo===true`, intentionally failing with 99/100 settled until policy is implemented. It does not normalize unsupported to settlement. Additional `r4-capability.test.js` tests typed blocked state and no duplicate submissions.

**Historical measured 100-seed classification at `232c9457350c69224f12b346f2a1e4b528dd0b65`:** 100 executed, 88 wins, 11 exhaustive draws, 1 `unsupported` (seed 87), 0 invalid legal actions, 0 stalled, 99 complete Replay matches, 4,449 claim windows. **Do not reuse as test results for `ede7dc94...` or a later report-only commit.**

Both new source heads had no newer directly associated full integration Workflow result during the source audit. Their integration commit triggered new verification on PR #44; report only what actually completes at that exact SHA. **V1 baseline still SHA-scoped, experimental source safety improved, FULL_MATCH_GO=false, RELEASE_GO=false, PR #44 Draft.** Physical device, screen-reader and final Preview gates remain NOT_RUN / NO-GO.


---

## 11. R4 exact-source CI recovery audit (2026-11-20 Asia/Taipei; status is SHA-scoped)

**Final tested code candidate at this audit:** `b53a998f21ffe17e43f1b81175551a51378a6623`. **Prior composed-source app HEAD:** `7104ba9134794a44d9511472f6eae591d1281ab2`. These are different commits; do **not** transfer a browser PASS or FAIL between them. The *report-writing commit itself is documentation only* and must not be silently treated as a fresh same-HEAD app/CI PASS.

### 11.1 Live source provenance and ancestry

| Component | PR | Latest source HEAD inspected / integrated | Last action |
| --- | --- | --- | --- |
| Rules | #43 | `bedab27a8a39565cb62fdbcdc9abb868cf1dadac` | All owned Git blobs already identical at `ca7ce4d` |
| Bots | #40 | `b872f3529fc76dc76dc7f4d01bfdb66f306f4c71` | All owned Git blobs already identical at `ca7ce4d` |
| Replay | #41 | `20e3f72112cbeaa64843e290ff167c8e136eb3dc` | 5 owned files copied byte-for-byte by `7104ba9` |
| Table UI | #42 | `ea655ff2100609fe923ec731c335fa1fd14e1c42` | 7 owned R4 files copied by `7104ba9`; one E2E selector source fix synchronized by `b53a998` |
| Daily | #45 | `f7bca678c010377aaf187b4291f8d5b49d4b0aea` | 3 owned source files copied byte-for-byte by `7104ba9` |
| Master Academy V1 | #33 | `68fb50bc43746a0e6ff9f2f90712904d06a2ccda` | Untouched Draft, separate pinned baseline |
| protected main | — | `25870862b6499f7e699967aa76429ae5dcfc5db4` | Untouched |

GitHub commit-comparison at `ca7ce4d`: Rules and Bots diverged; UI and Daily diverged; Replay was ahead-only. All five source review-thread checks reported **zero unresolved threads** at audit. To avoid replaying entire unrelated branch histories, the integration used exact owner-file blob SHAs in a new Git tree and an **expected-HEAD, non-forced fast-forward**. Integrator-owned `index.html` matched the UI source blob exactly, so it was preserved. The full integrator `sw.js` transitive precache list was preserved; only the integrated cache version advanced from `...-r6` to `...-r7`. The UI source's shorter standalone `sw.js` was **not** copied over it. An independent installed-PWA update on physical iPhone is **NOT_RUN**.

- [Integrate source blobs / SW invalidate `7104ba9`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/7104ba9134794a44d9511472f6eae591d1281ab2).
- [Source UI E2E fix `ea655ff`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/ea655ff2100609fe923ec731c335fa1fd14e1c42).
- [Integrate same UI fix `b53a998`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/b53a998f21ffe17e43f1b81175551a51378a6623).

### 11.2 Failure Matrix — do not count fan-out as independent defects

The eight rows below all refer to **GitHub checkout source HEAD `ca7ce4dd0d855ade1827873623e9e7eaf5c2bfb1`**. Synthetic PR merge-ref SHA is not the tested checkout. Jobs are distinguished from workflows. One workflow may have both a shared-check failure and a separate browser result.

| Workflow / run | Job / first actual failure | Test or assertion / root owner | Shared `npm run check` failure? | R4 repair and same-SHA revalidation |
| --- | --- | --- | --- | --- |
| Verify [#44657599223](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599223) | `test` / `not ok 113` | `tests/bots/r3-full-round.test.js:307`; `FULL_MATCH_GO=false: unsupported is not settled`; Rules #43 multiwinner capability / Bots #40 strict 100-seed gate | **Original direct failing assertion** | **NOT FIXED**: 99/100 real settlements; new exact-HEAD CI required |
| Master Academy combined [#44657599391](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599391) | `R/S/L/A, Golden & both 10k Oracles` | Shared full unit suite reaches same Bot Seed 87 | Yes | Browser Academy E2E separately SUCCESS at `ca7ce4d`; Node remained NO-GO |
| Academy UI [#44657599256](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599256) | `Academy public boundary / canonical Node` | Same Bot Seed 87, inherited from `npm run check` | Yes | Academy mobile/desktop/offline Chromium separately SUCCESS at `ca7ce4d` |
| V0.2 Browser [#44657599237](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599237) | `chromium`, step `Run npm run check` | Same Bot Seed 87, **before** independent browser stage | Yes | No separate V0.2 behavior regression established by this failure |
| V0.2 Independent UI [#44657599240](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599240) | Node `Run npm run check` and Chrome `Validate candidate P0` | Same strict Bot failure in shared preflight | Yes | Independent V0.2 regression not established by a preflight-only FAIL |
| V0.2 Tile Faces [#44657599284](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599284) | `Full existing Node gates plus SVG contract tests` | Same shared `npm run check` before full browser gate | Yes | Existing 34-SVG Node assertion individually passed; workflow remained failed |
| Phase 3 Table UI [#44657599219](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599219) | Node `Run npm run check`; **separate browser** `AssertionError: table / Replay / Daily / Academy navigation missing` | Shared Seed 87 **plus** independent async navigation/sandbox test mismatch; UI #42 | Node yes; browser **no** | R4 UI source fixes navigation and explicit sandbox route; at `7104ba9` [Table UI Chromium job passed](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44664800689). Full workflow still depends on Node |
| Phase 3 full match [#44657599345](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599345) | `Rules, three Bots, 100 fixed seeds`, `FULL_MATCH_GO=false` | Direct Bot Seed 87 test — same unsupported Rules capability | Direct separate Node invocation, **same underlying assertion**, not a second bug | **NO-GO**. Separate real R3 Browser job **SUCCESS at `ca7ce4d`** |

**Independent R4 browser regression after latest source import:** At **`7104ba9`**, [Phase 3 run #44664800653](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44664800653) browser failed at `tests/browser/full-table-ui-r3-gates.py:185` after reload. The selector used `querySelector('#full-table-root [role="status"]')`, which returned the **submission-status** node; the **date/progress** status is a separate later node. It waited for '日期 ' on the wrong first node for 25 seconds. This is a genuine test-selector error, **not evidence that canonical grading failed**. Source UI PR #42 and integrated `b53a998` replace that single-node lookup with `querySelectorAll(...).some(...)`, preserving *all* archive, provenance, Session RecordRef and ability/review storage assertions, with no extended timeout or faked data.

### 11.3 Seed 87 forensic classification (do not normalize unsupported)

At exact source checkout `ca7ce4d`, [Verify logs](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599223) recorded **315 tests, 313 PASS, 1 FAIL, 1 optional SKIP**. The 100-seed benchmark recorded:

| Category | Actual count |
| --- | ---: |
| Executed | 100 |
| Legal win settlements | 88 |
| Legal exhaustive draws | 11 |
| Unsupported `multiple_winners` | **1 — fixed-round-87** |
| Invalid actions | 0 |
| Stalls | 0 |
| Settled outcomes | **99** |
| Complete replay matches | 99 |
| Replayable valid prefixes (including Seed 87) | 100 |
| Claim windows | 4,449 |

Actual Seed 87: 157 successful legal submissions, 162 accepted Rules events. Seat 2 discarded `t:26:0`, Seat 3 and Seat 0 each issued an individually legal discard `WIN`, then Seat 1's legal final `CLAIM_WINDOW_PASS` attempted arbitration. **Only the multi-WIN settlement is unsupported:** `RuleCapabilityError: UNSUPPORTED_RULE_CAPABILITY / multiple_winners`; no state mutation, no settlement, no imaginary event 163. Rules #43 public `getRuleCapabilities` discloses this limitation. Bot #40 retains typed blocked checkpoint rather than retrying/forging PASS. Replay #41 stores an explicitly **incomplete** rejected-submission proof, not a complete match. Claim priority, multi-WIN payout, table policy and four-seat conservation need an explicit versioned Rules design plus new Golden tests before Seed87 can legitimately pass.

### 11.4 Same application SHA browser, Daily, Replay and PWA evidence

At exact `b53a998f21ffe17e43f1b81175551a51378a6623`:
- [Phase 3 Full human + three Bots / settlement / Replay / Daily / PWA Chromium job **SUCCESS**](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180727), job `136052621113`. Actual checkout log confirms `b53a998`, real `tests/browser/full-table-ui-r3-gates.py` execution, the complete success path and uploaded artifact.
- [Real Chromium screenshots + machine-readable Daily evidence artifact #14596933806](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180727/artifacts/14596933806). Browser test checks the official `archive:v3` RecordRef, Academy `provenanceLinks`, `trainingSessions[].recordRefs`, AbilityProfile, ReviewPlan, reload readback, session continuity, offline new tab and 34 SVG. Artifact upload confirmed; the ZIP contents were not separately opened by this audit.
- Academy V1 original suite and legacy V0.2 UI/PWA are **separate jobs**, not implied by this single browser PASS. A Chromium 390px viewport is **not** an iPhone Safari hardware result.
- At the time this section was authored, [full source Verify #44665180689](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180689), [Phase3 100-seed Node job #44665180727](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180727) and other [exact-SHA checks](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/44/checks) were still in progress; **do not mark them PASS by extrapolation**. Two 10,000-case Oracle suites passed in older scoped logs, but a whole `npm run check` cannot be PASS while fixed-round-87 deliberately fails.

### 11.5 Explicit gates and release boundary

| Gate | At R4 audit |
| --- | --- |
| `V1_BASELINE_PASS` | Historical PINNED_PASS at #33 SHA only; current full Node suite pending/affected by Bot failure |
| `EXPERIMENTAL_RULES_PASS` | Bounded Golden / safety tests on older SHA passed; entire experimental RuleProfile not full Taiwanese table rules |
| `THREE_BOT_MATCH_PASS` | **FAIL / NO-GO:** 99/100 settled at last measured complete 100-seed run |
| `REPLAY_PASS` | Real settled replay browser PASS at `b53a998`; unsupported prefix explicitly incomplete |
| `DAILY_UI_PASS` | Real Chromium formal answer + durable reload PASS at `b53a998`; all parallel Node gates not complete |
| `TABLE_UI_PASS` | Real R3 Chromium PASS at `b53a998`; source Sandbox Chromium PASS at `7104ba9`, other combined checks pending |
| `PWA_PASS` | Real new-tab offline Chromium PASS at `b53a998`; installed device SW-update **NOT_RUN** |
| `FULL_GAME_PREVIEW_READY` | **false** — strict full-match 100/100 is blocked |
| `FULL_RULES_VERIFIED` | **false** — `multiple_winners`, robbery-of-added-kong and venue-dependent tai/penalties unverified |
| `RELEASE_GO` | **false** — PR #44 remains Draft |

**Deployment:** no new Phase 3 immutable HTTPS preview authorized; existing separate V1 Vercel preview and V0.2 remain untouched. **Physical devices / accessibility:** iPhone Safari, Android, VoiceOver and TalkBack **NOT_RUN**. No protected main push, force push, PR #33/#44 merge, formal tag/release or fake certified settlement.


### 11.6 Final observed R4 CI outcomes: all eight workflows completed at code SHA `b53a998`

**GitHub verified actual checkout:** `b53a998f21ffe17e43f1b81175551a51378a6623`. This is the latest application-changing commit; this quality-report append is docs-only, not an additional executed application test. At 2026-11-20 approximately 11:12 Asia/Taipei, **all eight workflow runs had completed with overall conclusion FAILURE**. Their actual first failing Node test was the **same strict Seed87 unsupported capability**, not eight separate regressions.

| Workflow (exact `b53a998`) | Browser or other independent job | First failing required Job | Root classification |
| --- | --- | --- | --- |
| [Verify #44665180689](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180689) | — | `test` — `not ok 119` | `tests/bots/r3-full-round.test.js` Seed87 |
| [Master Academy combined #44665180705](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180705) | **PASS** real Lesson / v3 / Adaptive / review / offline 390/1440 | `R/S/L/A, Golden & both 10k Oracles` | Shared `npm run check` Seed87 |
| [Academy UI #44665180740](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180740) | **PASS** Academy mobile/desktop/offline Chromium | `Academy public boundary / canonical Node` | Shared check Seed87 |
| [V0.2 Browser #44665180672](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180672) | Not reached after preflight | `chromium`, `Run npm run check` | Shared check Seed87; not a new V0.2 UI assertion |
| [V0.2 Independent UI #44665180712](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180712) | Chrome UI job failed in `Validate candidate P0` shared preflight | Node `Run npm run check`; Chrome preflight | Same Seed87, not independent visual proof |
| [V0.2 Tile Faces #44665180718](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180718) | Not reached after shared Node | `Full existing Node gates plus SVG contract tests` | Shared check Seed87 |
| [Table UI #44665180885](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180885) | **PASS** 320–1440px Chromium / real sandbox / offline | Node `Run npm run check` | Shared check Seed87, no independent Browser failure remaining |
| [Phase 3 real full match #44665180727](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180727) | **PASS** actual Rules + human + three Bots + Replay + durable Daily reload + cold offline PWA | `Rules, three Bots, 100 fixed seeds, Replay and integrity` | Direct strict 100-seed gate Seed87 |

**Exact latest Node totals:** Verify and the combined `npm run check` jobs: **327 tests / 325 PASS / 1 FAIL / 1 optional SKIP**. The standalone Phase 3 full-match Node subset: **26 tests / 25 PASS / 1 FAIL / 0 SKIP**. The single FAIL is `R3 100 fixed-seed complete hands: observed coverage, settlements and replay`, strict `FULL_MATCH_GO=false` because `UNSUPPORTED_RULE_CAPABILITY/multiple_winners`. The latest exact-code 100-seed result **again** reports 100 executed, 88 WIN, 11 exhaustive DRAW, one unsupported Seed87, 0 illegal, 0 stalled, 99 settled, 99 complete replay matches, 100 valid-prefix replays and 4,449 claim windows. No FULL_MATCH_GO.

**Required independent Oracle subtests actually PASS** in Verify logs at `b53a998`: 10,000 mixed physical 16/17-tile independently oracled hands; 10,000 complete 17-tile win oracle; 10,000 seeded uniform shanten oracle; 10,000 integration legal 16/17-tile shanten oracle. An additional opt-in 10,000+ numerical stress cross-check remained **SKIP** (requires `MAHJONG_STRESS=1`). Oracle subtest PASS does **not** turn the overall `npm run check` green.

**Actual uploaded real-browser artifacts, pinned to the exact R4 code test run:**
- [Full R3 settled round + Replay + formal Daily storage/reload + offline screenshots and `daily-durable-evidence.json` artifact #14596933806](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180727/artifacts/14596933806).
- [320–1440px Table UI sandbox / 17 legal physical discard / offline screenshots artifact #14597577655](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180885/artifacts/14597577655).
- [Academy official v3 provenance/review/offline browser artifact #14597597245](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180705/artifacts/14597597245).
- [Independent Academy mobile/desktop/offline screenshot artifact #14597607170](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44665180740/artifacts/14597607170).

**Final gate semantics:** `V1_BASELINE_PASS` historically true at #33's separate pinned SHA, Academy R4 browser regression PASS; `EXPERIMENTAL_RULES_PASS` bounded Golden/Oracle subtests PASS; `THREE_BOT_MATCH_PASS=false` (100-seed NO-GO); settled `REPLAY_PASS`, `DAILY_UI_PASS`, `TABLE_UI_PASS` and Chromium offline `PWA_PASS` have positive exact-code browser-job evidence, but their encompassing workflows remain RED because of the shared Seed87 check. Complete `FULL_GAME_PREVIEW_READY=false`, `FULL_RULES_VERIFIED=false`, `RELEASE_GO=false`. Physical iPhone Safari, Android, VoiceOver, TalkBack and installed-device PWA upgrades **NOT_RUN**. No Phase3 preview, main mutation, tag, PR merge or official release.

## 12. R5 Final Acceptance — Single-Winner / 100 Seeds / Public Experimental Preview (2026-11-20)

**Acceptance policy:** This section supersedes previous R3/R4 NO-GO observations for the R5 *experimental single-winner profile only*. The old capability policy remains intentionally unsupported. All runtime and Node/Chromium results below are pinned to the **same application source HEAD `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`**. Subsequent changes to this report and companion acceptance JSON are **documentation-only commits**, not retested application changes.

### 12.1 Exact source pins, ownership, review and integration

| Source | GitHub PR | Latest audited SHA | Integration and status |
| --- | --- | --- | --- |
| V1 base | [#33](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/33) | `68fb50bc43746a0e6ff9f2f90712904d06a2ccda` | existing Draft baseline, unchanged |
| Rules | [#43](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/43) | `684df00afac540c082713c152d06e80e72eea3de` | exact path-owned R5 engine/profile/Golden integrated |
| Bots | [#40](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/40) | `2dc05b381211b7ccdbe84c3fe2fd1f4f6f353aba` | version-aware controller; legacy/R5 strict seeds integrated |
| Replay | [#41](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/41) | `aff59e61042389eea3a7b11f012aeb25031dc68c` | R5 private claims, group-atomic replay and postgame allowlist integrated |
| UI | [#42](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/42) | `f4814bcce387fb94b7f9266d981845ff0cda70b0` | visible Chinese R5 profile and legacy ID; real Chromium selector integrated |
| Daily | [#45](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/45) | `f7bca678c010377aaf187b4291f8d5b49d4b0aea` | source-owned blobs already identical in integration; no unnecessary overwrite |
| Integration | [#44](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/44) | **`7c4b08a4fce6d7ad2458f23397489ea7f6e2c042` tested application** | Draft, OPEN, not merged |
| Protected main | main | `25870862b6499f7e699967aa76429ae5dcfc5db4` | unchanged; no force push, merge, tag, formal release |

First source overlay was [`563fbd3812d7e4e718e91eb028ecff5eeba3f424`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/563fbd3812d7e4e718e91eb028ecff5eeba3f424). Latest tested application [`7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/7c4b08a4fce6d7ad2458f23397489ea7f6e2c042) additionally restores the profile-ID selector and bumps the offline SW cache to `tmt-v02-realistic-tiles-master-academy-phase3-r5-interception-20261120-r8`. CI on `563fbd3` is **not** substituted for exact-head `7c4b08a` evidence. Six source/integration PRs had zero unresolved GitHub inline review threads when checked; **zero unresolved threads is not reviewer approval**. Source branch standalone checks are not accepted as combined tests.

### 12.2 Distinct RuleProfile policy, Golden and Seed 87

| | Legacy fail-closed Gate | R5 single-winner full-match Gate |
| --- | --- | --- |
| RuleRef | `tw16-configurable-table@experimental-full-v1` | `tw16-single-winner-interception@experimental-v1` |
| Discard WIN policy | multiple winners **unsupported**, typed fail-closed | **single winner** closest clockwise from discarder, experimental |
| Seed87 source WIN intents | seat 3 WIN, seat 0 WIN, both unchanged | same two private WIN intents preserved; never transformed into PASS |
| Third responder | PASS is the legal rejected submission | seat 1 PASS is legal, completes the claim window |
| Adjudication | `UNSUPPORTED_RULE_CAPABILITY: multiple_winners`, revision 162, state unchanged | seat 3 wins; seat 0 intercepted; discarder seat 2; revision 165 |
| Settlement | **none**, cannot count as settled | `WIN`, `[0,0,-100,100]`, sum **0** |
| Replay | valid 162-event **prefix**, not a terminal replay | deterministic canonical final-state replay; 162→165 atomic action boundary |
| Privacy | private pre-resolution WIN declarations withheld from other PlayerViews | same information boundary; selected/intercepted seats released only via allowlisted postgame disclosure |

Rules Golden and versioned capability tests: **PASS** on the exact tested HEAD. R5 `getRuleCapabilities` respects the experimental single-win policy, while unsupported additions, including rob-added-kong, remain fail-closed. Experimental `tw16-minimal-tai-v1` is **not** a certified Taiwanese regional payout standard. No assumption that 一炮一響 is the sole standard across Taiwan.

### 12.3 All 100 fixed Seeds (true denominator, deterministic)

Source: exact-HEAD [Phase3 Node #44706640239](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640239) and [Verify #44706640204](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640204); both were independently completed **SUCCESS** at `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`.

| Measure | Legacy profile (expected fail-closed) | R5 single-winner (strict acceptance) |
| --- | ---: | ---: |
| Requested / executed | 100 / 100 | **100 / 100** |
| Legally settled | 99 | **100** |
| WIN | 88 | **89** |
| DRAW | 11 | **11** |
| UNSUPPORTED | 1 (Seed 87, correctly rejected) | **0** |
| INVALID | 0 | **0** |
| STALLED | 0 | **0** |
| Illegal Bot actions | 0 | **0** |
| Replay mismatches | 0 on legitimate terminals; unsupported prefix matches | **0** |
| Complete Replay match | 99 settled; 100 prefixes | **100** |
| Failed Seeds | 87 is an expected typed refusal, not success | **none** |
| Full-match accepted | **NO** (not an acceptance denominator) | **YES — 100/100** |

Strict Bot result on `7c4b08a` explicitly prints `BOT_R5_100_SUMMARY`: `requested:100,executed:100,completed:100,wins:89,draws:11,unsupported:0,invalid:0,stalled:0,replayMismatch:0,invalidActions:0,replayMatches:100,failedSeeds:[],fullMatchGo:true`. No seed removed, denominator redefined, or unsupported converted into DRAW/settled.

### 12.4 Node, Golden, Oracles, Replay, Daily and backwards compatibility

- **`npm run check` on `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`: 358 tests / 357 PASS / 0 FAIL / 1 SKIP**, [Verify #44706640204](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640204). The sole SKIP is the optional `MAHJONG_STRESS=1` extra numerical cross-check, **not** the R5 100-Seed acceptance; strict R5 tests are executed and PASS.
- Standalone Phase3 Node scopes on the same HEAD: legacy R3 26/26 PASS, legacy/R5 Rules–Replay 33/33 PASS, independent strict R5 100 seeds 5/5 PASS. The two 10,000-case mandatory Oracle families and additional independent 10k win/shanten comparisons are **PASS** on [combined #44706640119](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640119); opt-in extra stress remains SKIP.
- **Replay PASS:** exact Rules action-group boundaries; Seed 87 private multi-WIN declarations; completed window; single chosen winner; experimental zero-sum SettlementResult; canonical deterministic event reconstruction; historical owner-only PlayerView; public postgame disclosure separate from coaching and historical decisions.
- **Daily PASS:** official QuestionPublic, canonical v3 grading, durable RecordRef and provenance, Session Progress, AbilityProfile, ReviewPlan and reload readback; [combined #44706640119](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640119) real Chromium and [Academy UI #44706640254](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640254). No reintroduction of historical asynchronous selector regression.
- **V1/V0.2 PASS:** old Academy, both required 10k Oracles, V0.2 training flows, independent UI/PWA and existing SVG contract; no original archive overwrite; source contract remains `master-academy/1.0.0`.
- **34 SVG and SW PASS:** Chromium 320/390/1440 real table; 1440/768/390/320 tile-face regression, offline new tab and atomic cache upgrade; see independent CI links below.

### 12.5 All eight GitHub Actions workflows on the same application source SHA

Each run below had **whole-workflow conclusion SUCCESS**, not merely a green browser subjob.

| Required workflow | Run ID / link | Final result |
| --- | --- | --- |
| Phase 3 real full-match + strict 100 Seeds + browser/PWA | [44706640239](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640239) | **SUCCESS** (both jobs) |
| `Verify` full Node `npm run check` | [44706640204](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640204) | **SUCCESS** |
| V1 combined R/S/L/A Golden, 10k Oracles, real Daily | [44706640119](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640119) | **SUCCESS** |
| Academy UI / canonical v3 / Chromium | [44706640254](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640254) | **SUCCESS** |
| Table UI / Sandbox / Chromium and offline | [44706640142](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640142) | **SUCCESS** |
| V0.2 Independent UI Release Gates | [44706640348](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640348) | **SUCCESS** |
| V0.2 Browser UI & PWA | [44706640148](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640148) | **SUCCESS** |
| V0.2 Realistic Tile Faces Integration QA | [44706640306](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640306) | **SUCCESS** |

**Chrome browser evidence:** [artifact #14614609533](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640239/artifacts/14614609533), `phase3-real-r3-match-evidence`, 7,307,606 bytes: screenshots, durable Daily readback and `acceptance.json` with checkout SHA `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`. Real Chromium ran `PHASE3_REQUIRE_SINGLE_WINNER=1`: 320px, 390px, 1440px, actual one-human/three-Bot game, experimental settlement, atomic Replay, Daily saved/reloaded, cold offline new tab and 34 SVG. No fixtures or fabricated actions were used in the browser acceptance. **This Chromium evidence is not physical iPhone/Android accessibility evidence**.

**Consolidated machine-readable acceptance:** [`docs/quality/MASTER_ACADEMY_PHASE3_R5_ACCEPTANCE.json`](https://github.com/kodlbegiko/taiwan-mahjong-trainer/blob/integration/mahjong-full-game/docs/quality/MASTER_ACADEMY_PHASE3_R5_ACCEPTANCE.json), `release:false`, 8 exact-SHA CI URLs, source pins, dual-profile results, preview ID and explicit NOT_RUN fields.

### 12.6 Separate publicly reachable HTTPS experimental preview

| Deployment property | R5 verified staging preview |
| --- | --- |
| URL | **https://taiwan-mahjong-phase3-r5-experimental-q4g6cft27-sign2.vercel.app/** |
| Vercel project | `taiwan-mahjong-phase3-r5-experimental`, ID `prj_8vpKCNHxLKWMUyw02ZU6DaWRPLYp` |
| Accepted deployment ID | `dpl_EGeDz9KozJVR51PMii4QTMEd3jmR` |
| Vercel target | **staging**, NOT formal release |
| Source | pinned `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`; identical application code to all eight CI runs |
| Vercel state | **READY**, HTTPS |
| Access | public; Vercel Authentication and password protection disabled **on this isolated project only** |
| Public HTTP | homepage and `/sw.js` externally retrieved; SW confirms R5 r8 cache |
| Real live deployed browser smoke | [run `ab845369-537f-49a2-98db-f7f2e051da0c`](https://agent.tinyfish.ai/runs/ab845369-537f-49a2-98db-f7f2e051da0c) **PASS** for homepage, no auth/404, navigation, exact R5 selector, correct profile start, 17 real tiles and all three Bot seats |
| Live-deployment **full settled hand / offline** | **NOT_RUN on public URL**; those complete gates were executed on local-served exact-SHA Chromium CI |
| Release metadata | **`release:false`** in this acceptance policy/JSON; not a tag, GitHub Release, or verified formal rules |

An earlier independent-project default deployment `dpl_DtuGoN39Nc6j62rE68sCQruBUhEr` targeted Vercel production implicitly and an initial staging deployment `dpl_EsVqkTnt4EDd5afjySCCDoN9XcQ1` were **unacceptable** despite READY: public URL and `sw.js` returned 404 due missing static build output. Those deployments **are not claimed as accepted previews**. The isolated project was corrected to build a static `dist/` with `index.html`, `style.css`, `sw.js`, `src/`, `public/` and `data/` files. The new staging deployment above was externally read and browser-smoked successfully. **No existing V1 Vercel Preview or V0.2 GitHub Pages site was changed.**

### 12.7 Experimental gates vs. formal release gates

| Gate | R5 result and evidence scope |
| --- | --- |
| `EXPERIMENTAL_RULES_PASS` | **true** — new policy Golden, capability, Legacy refusal, Seed87 R5 settlement |
| `THREE_BOT_MATCH_PASS` | **true** — 100/100 strict settled, 89 WIN + 11 DRAW, 0 illegal/stall |
| `REPLAY_PASS` | **true** — 100/100 matches, atomic Seed87, privacy/postgame separation |
| `DAILY_UI_PASS` | **true** — canonical v3 durable grading/reload Chromium |
| `TABLE_UI_PASS` | **true** — 17 tiles, flowers, Bot claims and settlement on exact-SHA Chromium |
| `PWA_PASS` | **true** — Chromium SW r8/34 SVG/offline cold new tab; physical-device NOT_RUN |
| `FULL_GAME_PREVIEW_READY` | **true, EXPERIMENTAL ONLY** — same-SHA 8/8 CI SUCCESS, public staging READY + live smoke |
| `FULL_RULES_VERIFIED` | **false** — Taiwanese venue rules, rob-added-kong, house tai/scoring/penalties not certified |
| `RELEASE_GO` | **false** — keep #44 DRAFT; outstanding source review/formal device QA and rules certification |

**NOT_RUN / explicit remaining limitations:** physical iPhone 17 Pro Safari, physical Android, VoiceOver, TalkBack, installed-device PWA update and a complete live-public-URL settlement/offline replay remain NOT_RUN. Legacy unsupported Seed87 remains an expected hard refusal and is never counted in new profile's 100/100. The preview is a bounded, experimental table policy—not a certified complete Taiwanese Mahjong rule standard. No protected main write/force push, no PR #33/#44 merge, no Release Tag, no formal publication.


---

## 13. 2026-11-20 R6 public HTTPS live-preview acceptance — **NOT YET GO**

**R6 machine-readable evidence:** [MASTER_ACADEMY_PHASE3_R6_ACCEPTANCE.json](./MASTER_ACADEMY_PHASE3_R6_ACCEPTANCE.json), written at 2026-11-20 22:11 Asia/Taipei. **This section adds public-origin audit evidence; it does not supersede the validated R5 application source SHA or convert an incomplete browser run into PASS.** R6 files are documentation-only changes. Keep `release:false` and `fullyCertifiedTaiwaneseRules:false`.

### 13.1 Re-fetched Source Pin Matrix, reviews and CI

| Ref | Exact queried HEAD | Review / merge state |
| --- | --- | --- |
| main | `25870862b6499f7e699967aa76429ae5dcfc5db4` | unchanged |
| Academy V1 [#33](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/33) | `68fb50bc43746a0e6ff9f2f90712904d06a2ccda` | DRAFT |
| Phase3 Integration [#44](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/44) | `80298a3c6b0564c84de3206c7223a36b0c95a9a5` **before R6 docs** | DRAFT |
| Rules [#43](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/43) | `684df00afac540c082713c152d06e80e72eea3de` | DRAFT |
| Bots [#40](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/40) | `2dc05b381211b7ccdbe84c3fe2fd1f4f6f353aba` | DRAFT |
| Replay [#41](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/41) | `aff59e61042389eea3a7b11f012aeb25031dc68c` | DRAFT |
| Table UI [#42](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/42) | `f4814bcce387fb94b7f9266d981845ff0cda70b0` | DRAFT, GitHub `mergeable=false` |
| Daily [#45](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/45) | `f7bca678c010377aaf187b4291f8d5b49d4b0aea` | DRAFT |

All seven PRs had **zero inline review threads and zero submitted reviewer approvals** at this query. Lack of unresolved comments is **not** formal approval. Full line-by-line review of every changed source file was **NOT_RUN**. Individual source PR workflow status is not a substitute for integration CI, and some lacked workflow results.

**Verified application source: `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`.** Git compare against `80298a3c6b0564c84de3206c7223a36b0c95a9a5` showed *two documentation-only commits*, touching only this report and R5 acceptance JSON. The eight completed **SUCCESS** GitHub Actions on **application SHA 7c4b08a** are the exact links in §12.5. Previously recorded `npm run check`: 358 tests / 357 PASS / 0 FAIL / 1 optional SKIP. R5 strict 100/100 seed terminal result: 89 WIN, 11 DRAW, zero unsupported/invalid/stall/replay mismatch. These are **R5 exact-SHA CI results, not newly executed R6 CI or public-site terminal results**. As R6 does not modify executable code, new app-SHA gates are not automatically claimed.

### 13.2 Vercel deployment and independent public HTTP

- Pinned fixed deployment: `dpl_EGeDz9KozJVR51PMii4QTMEd3jmR`, project `prj_8vpKCNHxLKWMUyw02ZU6DaWRPLYp`, target **staging**, `READY`, Vercel commit `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`.
- Fixed URL: https://taiwan-mahjong-phase3-r5-experimental-q4g6cft27-sign2.vercel.app/
- **Pre-existing stable Alias** https://taiwan-mahjong-phase3-r5-experimental-sign2.vercel.app/ resolves to that same deployment; HTTP **200**. No new Alias assignment, deployment or production promotion was performed. Aliases/fixed hostnames are distinct localStorage Origins; data does not automatically sync.
- Independently fetched fixed HTTPS homepage **200**, `src/table-ui/main.js` **200**, `src/table-ui/table.css` **200**, `sw.js` **200**, and `public/manifest.webmanifest` **200**.
- Independently requested **all 34** `/public/tiles/0.svg` through `33.svg`: **34/34 HTTP 200 with SVG markup**. SW script declares all 34 and version `tmt-v02-realistic-tiles-master-academy-phase3-r5-interception-20261120-r8`.
- **HTTP/SW script presence is not proof of Service Worker registration, Cache Storage coverage, or cold-origin offline boot.**

### 13.3 Actual public-origin browser actions, errors and limits

| Test | Live result | Concrete evidence and scope |
| --- | --- | --- |
| Load / navigate / R5 profile | **PASS** | Independent HTTP checks and [live full-match browser run](https://agent.tinyfish.ai/runs/77f5af62-2afb-4bfb-83dd-c45154f17b22) opened fixed Vercel URL, entered four-seat mode and selected one-winner experimental RuleProfile |
| 17 real tiles, three Bot seats, flower display, legal discard | **PASS for those steps only** | Same run used ordinary UI and confirmed a legal discard; **not** a terminal match |
| Complete online WIN/DRAW, settlement, zero-sum | **BLOCKED / NOT VERIFIED** | The run stalled at a claim window after clicking `pass`; no terminal or settlement data was obtained |
| Native confirm / Claim Window diagnosis | **BLOCKED; root cause NOT ESTABLISHED** | [Diagnostic run](https://agent.tinyfish.ai/runs/35c0bdf3-5116-4781-a7d1-6715365c1322) could not advance a fresh player's `replace_flower` action, so did not reach claim. Source `src/table-ui/main.js` calls native `window.confirm` before **every non-discard action** (including `replace_flower` and `pass`). Automated clicks may not have accepted the native dialog; **do not assert a Rules/Bot defect without confirming the dialog and a rejected legal action** |
| Settled-match Replay API / frames / findings | **NOT_RUN** | No completed public-origin match. The UI's `目前只支援已結束的 R3 正式事件複盤` refusal **before settlement is expected**, not evidence that Replay Engine was never implemented |
| Academy lesson exercise | **PASS, distinct from Daily** | [Separate Academy run](https://agent.tinyfish.ai/runs/92c9bb95-f440-4532-89f6-4968c1203e3d) submitted five published course questions; **not** counted as the dedicated Daily TrainingSession gate |
| Dedicated Daily official submission / reload | **PASS for durable subset** | [Targeted Daily browser run](https://agent.tinyfish.ai/runs/6e087d8a-a7d5-4878-ae92-42ac59c62991): `data-table-nav=daily` → create 30-minute Session → submit `academy-q-003@1.0.0` through formal UI → RecordRef `table-7e755b03-01d1-4a66-a101-52823483592e` → F5 same browser / same Origin → same RecordRef and progress **1/5**, session `active`, next question `academy-q-004`. No double-count observed. Specific AbilityProfile values and ReviewPlan contents not separately observed, so **whole Daily feature is PARTIAL** |
| Public Origin offline | **LIVE_OFFLINE_NOT_RUN** | [Offline inspection](https://agent.tinyfish.ai/runs/edddc663-3b1a-4c55-9814-44b9e9920185) could not control offline network or inspect Cache Storage; R5 local Chromium offline PASS remains historical only |
| Mobile sizes 320/375/390/430/768/1440 | **NOT_RUN at exact widths** | [Mobile inspection](https://agent.tinyfish.ai/runs/6ee53cf1-c6e0-4da6-832c-e3b7442477ac) exercised tile selection/cancel and displayed seats on ~1000×990 desktop viewport; no exact viewport switching was possible. Do not report all widths PASS. Real iPhone/Android Safari/Chrome remain NOT_RUN |

**Evidence-quality check:** One web automation offline report described `/manifest.json`, a Next.js `/_next/` script and a different theme color, inconsistent with the independently retrieved actual HTML and `public/manifest.webmanifest`. These uncorroborated claims were **excluded** from acceptance. Browser-run URLs are audit trails; no Playwright trace ZIP or R6 screenshots were exported. Do not invent artifacts. No direct GameState changes, forged settlement, source rewrite, Vercel promotion, source PR merges, or formal Release.

### 13.4 R6 gates (distinct from R5 historical readiness)

| Gate | R6 result | Evidence / reason |
| --- | --- | --- |
| `R5_EXPERIMENTAL_FULL_MATCH` | **PASS — prior exact-SHA CI** | §12, 100/100, [run 44706640239](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44706640239) |
| `LIVE_PREVIEW_FULL_MATCH` | **BLOCKED** | Public browser attempted, did not reach terminal; native confirm handling needs reproduction |
| `LIVE_PREVIEW_REPLAY` | **NOT_RUN** | No settled live game |
| `LIVE_PREVIEW_DAILY` | **PARTIAL** | Real official submit, same-Origin F5 readback, and next question PASS; AbilityProfile and ReviewPlan detailed live inspection NOT_RUN |
| `LIVE_PREVIEW_OFFLINE` | **NOT_RUN** | Offline network control unavailable |
| `MOBILE_BROWSER_UX` | **PARTIAL** | ~1000px desktop UI exercised; all six requested exact widths NOT_RUN |
| `SOURCE_REVIEW_READY` | **NO** | Seven Draft PRs, zero submitted approvals, #42 mergeable=false; complete cross-source review not done |
| `EXPERIMENTAL_PREVIEW_GO` | **NO for R6 expanded acceptance** | Existing R5 experimental preview remains reachable; public terminal and Replay not certified |
| `FULL_RULES_VERIFIED` | **NO** | One-winner and simplified tai are experimental |
| `FORMAL_RELEASE_GO` | **NO** | Public complete match, devices, rules certification and review gates incomplete |

**Release controls:** `release:false`; `fullyCertifiedTaiwaneseRules:false`. PR #33 and #44 remain Draft, unmerged. Preserve the old V1 and V0.2 sites; do not assert cross-Origin migration. Formal or experimental R6 promotion requires new **direct live-origin** complete terminal/Replay evidence, not a relabelled CI PASS.
