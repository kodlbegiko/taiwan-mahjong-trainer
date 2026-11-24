# R7.1 — actual integrated candidate / NO-GO

Date: 2026-11-24 Asia/Taipei. [Draft #53](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/53). Application SHA: `1b73e7565411ac2df9d93652c21f217c5fdf5d0d`; source assembly `78e6a18151993f53934303ed0c361a5fd4c26c1a`; base `a29bebfc01e05c05450b964a41ce34cbecf40365`. Seven ordered Git parents retain source provenance; all source PRs remain Draft. 58 unique source paths, plus three historical audit files. Source tree scope inspected and sole overlap resolved. No protected main merge.

## Pin matrix

| PR | Module | SHA | Source workflows pass/fail/pending |
|---|---|---|---|
| [#51](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/51) | Rules | `ff27c52526acfdf5fb905b4dd72a229289b8d734` | 2/0/1 |
| [#52](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/52) | Scoring | `1b27d5b9cf0c6e3bb7aff894288adfbf309c1b48` | 0/0/1 |
| [#48](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/48) | Bot | `2c98f31e51f5cd5d2f208d95210559976fc7854f` | 0/0/3 |
| [#46](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46) | Replay | `deb0bfaafa1a50ad7b112aa3e53078a98b14d195` | 0/0/2 |
| [#49](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/49) | Table UI | `d471f020d673de0e8916ae44b83b8d4a1db0aa04` | 1/0/3 |
| [#47](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/47) | Academy | `0994b657868233ece711cb4403c0248ce260976f` | 0/0/2 |
| [#50](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/50) | PWA | `d02eb508a0c302997f5e10a4eaf01c85bf0e6fb7` | 0/0/10 |

All seven share the base and behind=0; no formal review or inline thread. Source checks are not integrated checks.

## Integrated changes

- #49 ActionBar retained (legal action ID/seat/revision/kind, cancel, busy, ARIA group/status); #50 withdrew overlapping live-region implementation; focus helper retained. Source ownership check now verifies pinned PWA source ancestry and its scoped diff, not unrelated integrated paths. Full Node and browser tests remain intact.
- SW inventory rebuilt from actual integrated tree, 75 JS/MJS and 121 distinct existing shell entries; cache version bumped. AST graph, cold offline and rollback remain pending.
- Strict R7 cross-module job enables REPLAY_REQUIRE_R7_RULES and REPLAY_REQUIRE_R7_SCORING, requires the opt-in Rules profile and runs Rules/Scoring/Bot/Replay tests. Existing R5 goldens and 100-seed gates retained. New rule/scoring policies not enabled in default public table; Bot difficulty explicitly selected with Beginner default.

## Application SHA Actions snapshot

- [Verify](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717326): queued, no result.
- [R7 Mobile PWA Accessibility Regression](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717427): queued, no result.
- [Master Academy UI](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717501): queued, no result.
- [V0.2 Independent UI Release Gates](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717247): queued, no result.
- [V0.2 Browser UI & PWA](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717181): queued, no result.
- [V0.2 Realistic Tile Faces](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717200): queued, no result.
- [Phase 3 Table UI](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717110): queued, no result.
- [Phase 3 Real Full-Match Acceptance](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717480): queued, no result.
- [R7 Runtime Precache Contract](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717384): queued, no result.
- [Master Academy combined](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717106): queued, no result.

No integrated test totals or browser screenshots/trace available. Two Oracle suites scheduled through Academy combined; no historical R5 results counted. Vercel preview creation rejected (402 free daily API deployment limit); list by SHA returned zero. No public URL for this SHA. Local Git DNS failed; Node and Playwright installed but no checkout, Vercel CLI absent. Do not substitute another SHA or older deployment.

## Issue disposition

- **R7-001 NOT_RUN:** Canonical signed zero normalization present in latest Scoring settlement; S08 regression needs combined CI.
- **R7-002 NOT_RUN:** Combined SW generated JS inventory regenerated from Git tree: 75 modules / 121 unique existing shell entries; AST graph and cold offline browser tests queued.
- **R7-003 NOT_RUN:** Keyboard/AT click capture restores the same tile across DOM replacement; confirm/cancel focus retained. Full 375px regression not yet executed on integrated SHA.
- **R7-004 BLOCKED:** Rules public event contract plus Scoring comparison adapter, Bot parser and Replay tests included; strict R7 tests scheduled. Public table still restricts profiles to legacy R3/R5 and minimal-tai. No formal rules certification.
- **R7-005 NOT_RUN:** Table UI exposes persisted opt-in Bot difficulty; Beginner remains default, R5 compatibility retained by design. Benchmark and live difficulty selection require integrated tests.
- **R7-006 BLOCKED:** 20 standalone plans / 27 review questions per Academy delivery; 12 published, 8 validated, formal scored SkillTag coverage 10/20, no official scenario scorer. Blocks full Academy release, not scoped table preview.
- **R7-007 NOT_RUN:** Only overlap view.js resolved by preserving #49 ActionBar/confirmation/revision/busy and common group ARIA; #50 focus helper and CSS retained. Browser confirmation and keyboard interaction pending.

## Release gates

| Gate | Status |
|---|---|
| source_pin | PASS |
| source_scope_and_tree_assembly | PASS |
| source_review | BLOCKED |
| source_ci | NOT_RUN |
| integrated_application_commit | PASS |
| actionbar_reconciliation_static | PASS |
| precache_inventory_static | PASS |
| precache_ast_graph | NOT_RUN |
| r5_goldens | NOT_RUN |
| strict_100_seed | NOT_RUN |
| oracle_10k_a | NOT_RUN |
| oracle_10k_b | NOT_RUN |
| npm_check | NOT_RUN |
| strict_r7_cross_module | NOT_RUN |
| all_app_sha_workflows | NOT_RUN |
| https_staging | BLOCKED |
| public_win_draw_settlement_replay | BLOCKED |
| daily_reload | NOT_RUN |
| offline | NOT_RUN |
| mobile_viewports | NOT_RUN |
| physical_iphone_android | NOT_RUN |
| voiceover_talkback_install_update | NOT_RUN |
| legacy_profile_archive_compatibility | NOT_RUN |
| privacy_and_performance | NOT_RUN |
| full_rules_certification | BLOCKED |
| full_academy | BLOCKED |

EXPERIMENTAL_PREVIEW_GO = NO; FULL_RULES_VERIFIED = NO; FORMAL_RELEASE_GO = NO. Minimum next steps: obtain exact application-SHA workflow outcomes and fix failures; provision isolated fixed-SHA HTTPS preview and run real terminal WIN/DRAW/settlement/Replay/Daily/offline with screenshots and trace; formal reviews; physical device and full rules/Academy before formal release. An explicitly scoped experimental table preview need not wait for the eight unpublished advanced lessons if its own gates pass. No production promotion/release.
