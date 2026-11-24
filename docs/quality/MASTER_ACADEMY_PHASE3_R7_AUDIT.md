# Phase 3 R7 Independent Release Audit — NO-GO

Date: 2026-11-24 (Asia/Taipei). Audit-only branch: `integration/mahjong-r7-release-audit`, pinned base `a29bebfc01e05c05450b964a41ce34cbecf40365`. No integrated application SHA exists. Source PRs remain Draft; none merged. Main and production unchanged by this audit.

## Source intake

| Module | PR | HEAD | Changed paths | CI pass/fail/pending |
|---|---|---|---:|---|
| Rules | [#51](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/51) | `633d20faf7f9c305b8d972bd0e3f44b639d4d798` | 6 | 3/0/0 |
| Scoring | [#52](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/52) | `202e007de599cd265b1b1b22d645d95914c311c1` | 10 | 0/1/0 |
| Bot | [#48](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/48) | `e98a7446c13074bcf7aa84d8449449279a4872c8` | 5 | 1/1/0 |
| Replay | [#46](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46) | `f6da1d2ba15c1938963bbb4096a737319c8f784b` | 5 | 2/0/0 |
| Table UI | [#49](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/49) | `8473586f0ded87c43d34a48fe40c8e6bacd6e7d1` | 6 | 1/0/3 |
| Academy | [#47](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/47) | `f2cc6e3f5f17acd865c6914b314695c253b6eb97` | 4 | 2/0/0 |
| PWA | [#50](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/50) | `287fb00b65053957dea5795e217f86e53a7ca807` | 10 | 8/1/0 |

All seven compare results show identical merge base and behind=0. 46 changed-path entries, 45 distinct paths. The only direct overlap is `src/table-ui/view.js` (#49/#50); ActionBar overlapping hunk needs manual reconciliation preserving both behaviors. GitHub reports source PR mergeability individually, not combined mergeability. Source CI: 17 success, 3 failure, 3 in progress at snapshot. No full diff/ownership approval or actual merge test claimed.

## Findings and remaining minimum fixes

- **R7-001 FAIL (Scoring):** S08 exhaustive draw: strict deep equal sees -0 rather than 0. settleExhaustiveDraw maps -fee.points, including zero. Node tests 384, pass 382, fail 1, skip 1. Normalize zero in implementation, not expected values. [Log](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45230043177/job/137886799508)
- **R7-002 FAIL (Bot/PWA):** Chromium full-match gate line 257: offline real R3 result unavailable. decision.js statically imports new strategy-r7.js; SW precache lacks this path. Strong candidate cause, not isolated proof. Replay internal.js also imports new integrity.js missing from PWA branch precache. Add both runtime paths and bump cache version, verify offline cold reload/settlement/Replay. [Log](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228437663/job/137881146918)
- **R7-003 FAIL (PWA/Table UI):** 320x640 baseline passed; 375px Enter selection wait_for_function at line 105 timed out after 30s: activeElement not a hand action button. Diagnose focus/rerender; do not weaken assertion. Include new confirm/cancel controls in focus design. [Log](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228712475/job/137882121136)
- **R7-004 BLOCKED (Rules/Scoring/Replay/Bot/Table UI):** New opt-in rob-added-kong profile and kong_proposed/robAddedKong need cross-owner contract review. Scoring explicitly excludes robbery, multiple winners and other special tai; Replay/Strategy legacy profile and event handling need verification. No production activation.
- **R7-005 BLOCKED (Bot/Table UI):** full-round.js currently instantiates all opponents as Beginner; R7 changes Intermediate/Advanced only. Public default strategy improvement not demonstrated.
- **R7-006 BLOCKED (Academy):** 12 published / 8 validated, objective-to-scored-SkillTag 10/20 per source PR. No scenario scorer or L4/L5 certification. Keep unpublished.
- **R7-007 BLOCKED (Table UI/PWA):** Shared view.js ActionBar hunk: preserve revision-bound confirmation, cancel/busy guards and ARIA status/group attributes. Actual merge conflict and runtime behavior not tested. Public HTTPS terminal+Replay and physical devices not run.

## Release gate matrix (integrated target)

| Gate | State |
|---|---|
| source_pr_inventory | PASS |
| common_merge_base | PASS |
| main_protection | PASS |
| source_workflows | FAIL |
| source_reviews_and_ownership | BLOCKED |
| textual_merge_and_contract_review | BLOCKED |
| integrated_application_sha | BLOCKED |
| r5_goldens | NOT_RUN |
| strict_100_seed | NOT_RUN |
| oracle_10k_a | NOT_RUN |
| oracle_10k_b | NOT_RUN |
| npm_check | NOT_RUN |
| same_sha_all_actions | NOT_RUN |
| public_https_full_match | NOT_RUN |
| public_https_settlement | NOT_RUN |
| public_https_replay | NOT_RUN |
| daily_reload | NOT_RUN |
| offline | NOT_RUN |
| mobile_viewports | NOT_RUN |
| physical_iphone_android | NOT_RUN |
| voiceover_talkback_installed_update | NOT_RUN |
| profile_legacy_compatibility | BLOCKED |
| private_player_view_security_performance | NOT_RUN |
| full_rules_certification | BLOCKED |

## Decision

- EXPERIMENTAL_PREVIEW_GO = NO (new R7 candidate).
- FULL_RULES_VERIFIED = NO.
- FORMAL_RELEASE_GO = NO.

Integration admission held until source blockers and cross-owner contracts are resolved. Integrate in Rules → Scoring → Bot → Replay → Table UI → Academy → PWA order on this independent branch after review. Run Goldens, 100 strict seeds, both 10k Oracles, npm check and all required workflows on one immutable application SHA. Then public HTTPS actual terminal, settlement, Replay, Daily reload, offline, viewport/device and privacy/performance gates. Preserve existing historical R5/R6 evidence, never substitute it. Main ruleset [Protect main](https://github.com/kodlbegiko/taiwan-mahjong-trainer/rules/27611325) remains active; no bypass, force push, merge or release/promotion. Local Git clone/ls-remote could not resolve github.com in this environment, so no executable integrated worktree or new browser/device proof was obtained.
