# CHANGELOG

## Unreleased — V0.2 product candidate merged, release blocked (2026-11-19)

- **Engineering only, NOT a v0.2.0 release**. QA-only [PR #10](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/10) merged `bd0759b945ad85fabb1333c435773cfbe2f74ac8` (post-main Verify #44453401006 success: 88/87 pass/0 fail/1 skipped).
- Player feature [PR #21](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/21) merged `7903ab14ffda01da281e8023daf37db385323226`: discard/tenpai/multi_wait interactive UI, canonical teach/grade and tie-best results, immutable v3 DecisionRecord history/export with v1 preservation, keyboard controls and installable/offline-capable SW shell (post-main Verify #44454192502 success: 91/90 pass/0 fail/1 skipped).
- Independent QA [PR #22](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/22) merged `745d89d5cf6f8754563660ede9c92b836048efae`. Final main Verify #44454406093 success: 94/93 pass/0 fail/0 TODO/1 optional skipped. Same-SHA Independent UI/PWA #44454406103 success: Chrome 1440px/mobile-emulated 390px, canonical tie/wrong/multi-wait, v3 archive/export/reload, real offline fresh tab, record preservation and atomic SW/core asset updates.
- Reviewed release staging [Draft PR #23](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/23) `b4f6410b89302a6ef916f9bffb12ade9c4021b57` passed Verify #44453751858, UI browser #44453751914, Independent #44453751860; its Git Tree `164a67e8915352034e3f293cc4e867dacb332785` is **identical** to merged main tree. Closed as superseded **without duplicate merge**.
- Release still **NO-GO**: #12 physical iPhone/Android PWA and assistive-technology evidence missing; #13 main `protected=false` and rulesets `[]`; no v0.2.0 tag, GitHub Release or version bump. `package.json.version` stays `0.1.0`.


## Unreleased — V0.2 verified integration work (2026-11-19, third audit)

### Actually merged to main
- PR #1 `f15e8fc3404ec380b65bc1493a87e76da6b4a1c2`: exact 5-meld/1-eye shanten respecting four physical copies, Q-001 mandatory golden and 10k+ seeded numerical oracle; main Verify #44363444102 SUCCESS.
- PR #5 `9f74e528291e3a2a945ed5d63b99fdaa3eba5d35`: canonical Q-002 discard visibility, scoring v2 / Exercise v3, 200 reproducible exercises, v1/v2 historic snapshot migration without rescoring; main Verify #44364507850 SUCCESS.
- PR #3 `ed47593c0f209d295e9e0da941f0d0d1aa6b5638`: explainability consumes canonical practice ranking and grade without double subtraction; main Verify #44364857547 SUCCESS.
- PR #16 and #17 merged **into their respective source branches first**, not separately to main; their hard golden tests arrived on main through PR #1/#5 respectively.

### Integration evidence and release restrictions
- Draft staging PR #10, SHA `7564f0c840129c8bc20b4ca86c74aa253f12f4b3`: [Verify #44365221250](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221250) 81 tests, 80 pass, 0 fail, 1 opt-in skip, 0 TODO; Q-001/Q-002/I-003 hard regression and independent 10k numerical oracle pass.
- PR #4 `fa1646111178c668ee2744b72546692ff148e850`: responsive V0.1-compatible practice and accessible keyboard/storage handling; [Verify #44365062359](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365062359) succeeded at exact feature HEAD, staging [Verify #44365221250](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221250) + [Chromium #44365221412](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44365221412) both passed at the same integration SHA; final main [Verify #44366663851](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44366663851) passed, 75 tests/74 pass/0 fail/0 TODO/1 skipped.
- V0.2 browser teaching and multi-wait question navigation, versioned DecisionRecord wiring, actual mobile devices and PWA offline installation are **not** claimed complete. Branch protection Issue #13 still requires admin action. No V0.2 release tag or version bump has been created.

## Unreleased — V0.2 re-audit (2026-11-19, round 2)

- Revalidated `main` at `53981149d5f632db8d8dbbf3bd11fbd0999d48e3`; feature PR #1/#3/#4/#5 unchanged, still open, unmerged.
- Safely reconciled Draft #10 with latest main and reintroduced exact feature blobs without crossing file ownership; added always-on 10,000-case numerical oracle cross-check.
- On staging SHA `4f673f97a137a886d6e0b14617a42e889a59d391`, [Verify #44358617174](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44358617174) reports 67 tests, 61 pass, 3 fail, 1 skip, 2 TODO. Numerical oracle 10k PASS; Q-001/Q-002/I-003 still FAIL. V0.2 remains NO-GO.
- Staging-only [Chromium browser smoke #44359395885](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44359395885) **passed** on staging SHA `808e245ec99ec7512a544ae6beac1ee77f4b40cb`: desktop 1440px and mobile emulation 390px, exercise/grade/next/keyboard/v1 persistence. Screenshot artifacts available. Real device, offline PWA and v2 UI record wiring remain unverified; same SHA's Verify check still **failed** on P0 gates.
- Issue #13 branch-protection manual configuration documented; ruleset still not enabled by this action.

## Unreleased — V0.2 integration audit (2026-11-19)

### Merged to main (development infrastructure only)
- PR #6: Cross-module API contract, staged integration plan, README/ROADMAP links and quality report. Merge: `ad18998c021f5fa6b896c33ffe6013665c56b410`.
- PR #2: Independent 16-tile shanten oracle, golden fixtures, seeded benchmark suite, known defect records. Merge: `6415e6c72b307858d1d1e41e2be7bdc76635079d`.

### Validation and blockers
- Draft PR #10 overlays unmerged features #1/#3/#5/#4 for test only: 66 tests; 60 passed, 3 failed, 1 skipped, 2 TODO; `npm run check` failed.
- Q-001: four-quad honors shanten actual 2 vs expected 4.
- Q-002: discarded tile excluded incorrectly from visible count in `rankDiscards`.
- I-003: practice ranking and explanation disagree on effective draw kinds and grading.
- No V0.2 production features were merged or shipped. Do not claim full offline PWA or v2 UI decision history.

## v0.1.0 — existing baseline
- 17-tile discard practice, structural shanten and improving draws, browser-local summary statistics and Node tests.
- Existing limitations and exercise sampling bias documented in README / ROADMAP.

### Third audit final decision / unfinished items
- All feature PR #1/#5/#3/#4 have merged and source/main automated regression checks passed. Issues Q-001 #7, Q-002 #8 and I-003 #9 closed with evidence. However, the new advanced explanation / tenpai / multi-wait exercise UI, v3 DecisionRecord end-to-end UI persistence, physical-device validation and installable offline PWA are **NOT** shipped; main ruleset Issue #13 remains open. Do not mark V0.2 release as GO, do not bump package version or tag a release without explicit scope acceptance and testing.


## Unreleased — Independent adversarial QA (2026-11-19)

- PR #15 test-only merge `067c8bbcc5026e542ae5b6688a7aceb5dd33e5b7`: new mandatory 10k numerical Oracle, 60% uniform/20% constructed/20% adversarial four-quads, stronger Q-001/Q-002/I-003 hard gates and reproducible performance benchmarks; no production algorithm change. [main Verify #44444529115](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444529115) 82 total /81 pass/0 fail/0 TODO/1 optional skip.
- Draft staging #10 at `b62979a0cd2fec75451f37a4f5e594a0a7e820ea`: [Verify #44444678634](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678634) 88 total/87 pass/0 fail/0 TODO/1 optional skip (two independent mandatory 10k suites); [Chromium #44444678821](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44444678821) desktop/mobile emulation passed on exact same SHA.
- V0.2 remains **NO-GO**, with incomplete advanced UI, v3 DecisionRecord UI, actual phone and offline PWA (Issue #12), and missing main branch ruleset (Issue #13). No release or version bump.
