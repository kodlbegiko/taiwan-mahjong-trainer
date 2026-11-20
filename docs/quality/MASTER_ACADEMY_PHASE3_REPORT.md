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
