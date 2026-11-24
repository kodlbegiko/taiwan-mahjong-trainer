# R7 known issues — independent audit snapshot

These are additive to KNOWN_ISSUES.md and the R6 record. No previously documented issue is silently closed.

## R7-001 — Scoring (FAIL)

S08 exhaustive draw: strict deep equal sees -0 rather than 0. settleExhaustiveDraw maps -fee.points, including zero. Node tests 384, pass 382, fail 1, skip 1. Normalize zero in implementation, not expected values.

Evidence: https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45230043177/job/137886799508

## R7-002 — Bot/PWA (FAIL)

Chromium full-match gate line 257: offline real R3 result unavailable. decision.js statically imports new strategy-r7.js; SW precache lacks this path. Strong candidate cause, not isolated proof. Replay internal.js also imports new integrity.js missing from PWA branch precache. Add both runtime paths and bump cache version, verify offline cold reload/settlement/Replay.

Evidence: https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228437663/job/137881146918

## R7-003 — PWA/Table UI (FAIL)

320x640 baseline passed; 375px Enter selection wait_for_function at line 105 timed out after 30s: activeElement not a hand action button. Diagnose focus/rerender; do not weaken assertion. Include new confirm/cancel controls in focus design.

Evidence: https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228712475/job/137882121136

## R7-004 — Rules/Scoring/Replay/Bot/Table UI (BLOCKED)

New opt-in rob-added-kong profile and kong_proposed/robAddedKong need cross-owner contract review. Scoring explicitly excludes robbery, multiple winners and other special tai; Replay/Strategy legacy profile and event handling need verification. No production activation.

## R7-005 — Bot/Table UI (BLOCKED)

full-round.js currently instantiates all opponents as Beginner; R7 changes Intermediate/Advanced only. Public default strategy improvement not demonstrated.

## R7-006 — Academy (BLOCKED)

12 published / 8 validated, objective-to-scored-SkillTag 10/20 per source PR. No scenario scorer or L4/L5 certification. Keep unpublished.

## R7-007 — Table UI/PWA (BLOCKED)

Shared view.js ActionBar hunk: preserve revision-bound confirmation, cancel/busy guards and ARIA status/group attributes. Actual merge conflict and runtime behavior not tested. Public HTTPS terminal+Replay and physical devices not run.
