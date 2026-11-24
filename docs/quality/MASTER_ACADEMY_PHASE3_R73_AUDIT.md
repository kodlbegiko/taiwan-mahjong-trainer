# R7.3 narrow candidate acceptance — NO-GO

Date: 2026-11-24 Asia/Taipei. PR #53; actual application `0be7222cdd3020346c7a909c51e34cc7e6576099`, R7.2 `793bbb1caeef79b94e0bb29bf2ea66b3f7c43f4d`. Existing branch only. No production promotion or main change.

## Source pin matrix

| PR | Module | Integrated baseline | Latest reviewed source | Disposition |
|---|---|---|---|---|
| #51 | Rules | `ff27c52526acfdf5fb905b4dd72a229289b8d734` | `7b03057180194064826832759472bd87de49ea42` | DEFERRED_CONTRACT; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/51#issuecomment-7123716609) |
| #52 | Scoring | `1b27d5b9cf0c6e3bb7aff894288adfbf309c1b48` | `aa2535499377f4e3fc625506f1150f493191b791` | DEFERRED_CONTRACT; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/52#issuecomment-7123715985) |
| #48 | Bot | `2c98f31e51f5cd5d2f208d95210559976fc7854f` | `03f23344d0316dbbbf9e0bb1b61320397180a312` | DEFERRED_HOLDOUT; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/48#issuecomment-7123719232) |
| #46 | Replay | `deb0bfaafa1a50ad7b112aa3e53078a98b14d195` | `b58bd3a7e279b65c8fbba30b8b0b7f5a6c5d53ab` | DEFERRED_CONTRACT; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46#issuecomment-7123717356) |
| #49 | Table UI | `d471f020d673de0e8916ae44b83b8d4a1db0aa04` | `40f70666c74b75671b469834ad83c39d1cc512e5` | DEFERRED_UI_MATRIX; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/49#issuecomment-7123718027) |
| #47 | Academy | `0994b657868233ece711cb4403c0248ce260976f` | `cc24672989795d2838f37393ccde70ccc3e1bffe` | DEFERRED_SCENARIO_INTEGRATION; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/47#issuecomment-7123719868) |
| #50 | PWA | `d02eb508a0c302997f5e10a4eaf01c85bf0e6fb7` | `4dbe74a379c924744048e167dd8791265beaced8` | SELECTIVE_LIFECYCLE_AND_TESTS_INTEGRATED; [handoff](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/50#issuecomment-7123718632) |

## Exact R7.2 completion

9/10 workflows SUCCESS, only Mobile PWA rollback FAIL. Verify 465/466 PASS, 0 FAIL, 1 optional stress SKIP. Strict 67/67, zero skips; R5 100/100, 89 wins/11 draws, 100 Replay matches, zero invalid/stall; required two 10k Oracles PASS. [Verify](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631410); [Phase 3](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631397) local Chromium artifact 14889792680, public job skipped. PWA artifact 14890880387. R7-008/009 verified at R7.2. No reuse as R7.3 full CI.

## Actual R7.3 implementation

[Commit](https://github.com/kodlbegiko/taiwan-mahjong-trainer/commit/0be7222cdd3020346c7a909c51e34cc7e6576099): selective #50 lifecycle + browser test changes; keep 72 modules/118 assets and QA exclusions and strict negative probe. Current local native Node 22.16.0, exact Git blobs a61732a945557a2c443b0e4c8f42e9ed81b220d2 and da1eba152efc4c89d40f250f52f2534a4cc1c510, 11/11 PASS 0 FAIL/SKIP. Current [graph](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469176) SUCCESS, including QA import negative probe. Independent peer first fix `317fcb91a8422e88e47505c29c4424395f8f5f0c` rollback passed but healthy upgrade chose stale -broken worker. Final peer `ded444f1fa3be65d5315990e21adb779b8df16e4` [run](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45335300541) SUCCESS; artifact 14895416632 contains all 11 browser PWA cases PASS, seven viewport results, trace, immediate cache names and hashes, successful -upgraded activation, and actual game/Replay/Daily bytes preserved after offline upgrade. SW source matches current apart from cache version; distinct tested SHA, no exact-app browser claim.

## Exact R7.3 workflows

- [Master Academy UI — canonical v3 and Chromium](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469116) — queued/pending
- [V0.2 Browser UI & PWA](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469368) — queued/pending
- [V0.2 Independent UI Release Gates](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469241) — queued/pending
- [Master Academy combined — real E2E & provenance gates](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469055) — queued/pending
- [Phase 3 Real Full-Match Acceptance — experimental R3](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469255) — queued/pending
- [R7 Mobile PWA Accessibility Regression](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469239) — queued/pending
- [Phase 3 Table UI — sandbox legal actions, Chromium and offline](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469083) — queued/pending
- [V0.2 Realistic Tile Faces — Integration QA](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469111) — in_progress/pending
- [Verify](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469212) — in_progress/pending
- [R7 Runtime Precache Contract](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45338469176) — completed/success

All ten listed, full test totals pending. No required check waiver.

## Authority / Bot / Academy

Rules 7b030571, Scoring aa253549, Replay b58bd3a7 agree on host-only pre-settlement version pair. Actual Scoring test still omits runtime and expects obsolete public scoringLedger; owner handoff. Do not expose raw ledger. Strict native composition, new public Bot parser and opt-in UI not integrated. Four source-overlay terminal examples preserved in acceptance JSON; not native candidate result.

Bot exact calibration 03f23344, artifact 14895250648: 340/340 replay, 0 illegal; 20 seed clusters, selected combined 30% wins / 10% deal-in / +39.25 points vs old Advanced 17.5% /11.25% /-17.75. Score gain +57, calibration cluster CI [36.25,77.5]. Heldout 2100 pending; no promotion. Academy #47 proposed 105 formal questions and 15/20 target coverage vs current 100 and 10/20; five newly registered scenarios, no promotion of 8 validated lessons. Need independent review and offline composition. No QA imports.

## Public HTTPS

[Existing Vercel preview](https://taiwan-mahjong-phase3-r5-experimental-hmcol69s3-sign2.vercel.app/) READY, exact Git source metadata, no additional deployment creation. [Browser run](https://agent.tinyfish.ai/runs/375d96cd-b399-4b43-86f2-206394e541cb) real Beginner game 34 steps / 214s, draw/discard/cancel/reconfirm/PASS/chi observed, last revision 52 claim_window; terminal NOT_OBSERVED. Other difficulties, settlement, Replay, Daily, offline and served-byte parity NOT_RUN; no current trace/screenshot artifact. No physical-device claim. Agent #49 has exact-origin Playwright harness; asked to require WIN and DRAW, use current exact deployment and preserve evidence.

## Issues and release gates

- R7-001: PASS_R72_PENDING_R73 — R7.2 Verify signed zero and forged -0 tests passed; rerun new full suite.
- R7-002: PASS_R72_AND_PEER — R7.2 local full round offline PASS, current R7.3 graph PASS, peer ded444f upgrade/offline PASS; current full browser gate pending.
- R7-003: PASS_R72_AND_PEER — All seven viewport orientations in R7.2 and peer source artifact; current integrated mobile gate pending.
- R7-004: BLOCKED — Source Rules/Scoring/Replay pre-settlement implementation exists; #52 r73-rules-integration.test.js lacks trusted runtime and incorrectly expects raw ledger in public event; owner fix and strict native composition pending; no new policy enabled.
- R7-005: PARTIAL — R7.2 224 paired matches re-executed; R7.3 source 340-game calibration completed; 2100 heldout not complete, no promotion.
- R7-006: PARTIAL — Current app 100 formal v3, 12 published/8 validated, 10/20 formal target coverage. #47 source adds 5 registered questions, proposed 15/20; exact composition and review pending.
- R7-007: PASS_R72_PUBLIC_PARTIAL_R73 — R7.2 local complete round confirmation/cancel/duplicate/stale/replay/Daily/offline PASS; R7.3 public start and cancel/reconfirm/discard/chi/PASS observed, not terminal.
- R7-008: PASS_R72_AND_R73_GRAPH — R7.2 Node test 33 and graph PASS. R7.3 graph job 138256067933 includes real QA import negative probe PASS; full npm check pending.
- R7-009: PASS_R72_PENDING_R73 — R7.2 test 278 and strict 67/67 no skips PASS; current test unchanged, full gate pending.
- R7-010: PASS_PEER_BROWSER_AND_CURRENT_UNIT_PENDING_CURRENT_BROWSER — R7.2 rollback FAIL; peer first fix 317fcb91 rollback pass, healthy staging FAIL wrong -broken cache. Peer final ded444f1 all 11 browser upgrade cases PASS incl real game/Replay/Daily data after offline update. Current app 11/11 native Node verified exact SW/test blobs; current full browser gate pending.

All five decisions NO-GO. Minimal narrow preview blockers: exact application remaining nine CI, browser update/history, public asset parity and real three-difficulty WIN/DRAW/Replay/Daily/offline. Full product separately requires authority, full Academy, calibrated Bot evaluation, actual devices and independent review. Prepare merge sequence on #53 -> full-game with authorization, then downstream #44/main review; never duplicate source merges. Preserve immutable preview URLs, approved rollback must have new cache version and history readback. No formal release/promotion. Docs-only snapshot is not an application test.
