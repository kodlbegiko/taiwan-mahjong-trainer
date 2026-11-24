# R7.2 candidate — independent release audit / NO-GO

2026-11-24 Asia/Taipei. Existing [PR #53](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/53), application `793bbb1caeef79b94e0bb29bf2ea66b3f7c43f4d`, prior tested `1b73e7565411ac2df9d93652c21f217c5fdf5d0d`. No main merge or production promotion.

## Source pins and handoffs

| PR | Module | SHA | CI pass/fail/pending (snapshot) | Handoff |
|---|---|---|---|---|
| #51 | Rules | `ff27c52526acfdf5fb905b4dd72a229289b8d734` | 3/0/0 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/51#issuecomment-7121874381) |
| #52 | Scoring | `1b27d5b9cf0c6e3bb7aff894288adfbf309c1b48` | 0/0/1 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/52#issuecomment-7121874927) |
| #48 | Bot | `2c98f31e51f5cd5d2f208d95210559976fc7854f` | 1/0/2 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/48#issuecomment-7121876697) |
| #46 | Replay | `deb0bfaafa1a50ad7b112aa3e53078a98b14d195` | 1/1/0 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46#issuecomment-7121875501) |
| #49 | Table UI | `d471f020d673de0e8916ae44b83b8d4a1db0aa04` | 3/0/1 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/49#issuecomment-7121877886) |
| #47 | Academy | `0994b657868233ece711cb4403c0248ce260976f` | 0/0/2 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/47#issuecomment-7121876142) |
| #50 | PWA | `d02eb508a0c302997f5e10a4eaf01c85bf0e6fb7` | 5/2/3 | [owner](https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/50#issuecomment-7121877307) |

## Evidence from previous integrated application

[Verify log](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717326/job/138204830745): 466 tests, 463 pass, 2 fail, 1 opt-in stress skip. R5 strict 100/100, 89 WIN, 11 DRAW, 100 Replay matches, no illegal/stall. Required mixed and uniform 10k Oracle plus integration 10k subtests pass. 224 paired benchmark matches, no illegal actions, all replayed. Advanced not proven stronger (4 seed clusters, 2/16 candidate wins vs 4/16 baseline). [Phase3 strict](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717480/job/138204831716) 66/67, one comparison-contract failure, zero skip. [Local Chromium full-round](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717480/job/138204831477) SUCCESS, artifact 14888732622 includes acceptance JSON, 8 screenshots, trace ZIP, confirmation and daily durable evidence. Academy browser job SUCCESS (https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45322717106/job/138204830473). Do not reuse these as current SHA passes.

## Actual fixes

- R7-008: conservative precache explicitly excludes 3 unpublished QA-only Academy modules, 72 JS/MJS and 118 shell entries, original negative assertion retained and extended, graph negative probe rejects runtime dependency on QA-only path.
- R7-009: Replay comparison call negotiates Rules-owned publicEventContractVersion; asserts missing/unknown version rejection. No scorer guard relaxed, no score authority changed.
- R7-010: new independent rollback issue from #50 and separately composed candidate; cache cleanup root cause not yet determined. Owner handoff posted. Both evidence ZIPs show seven viewport passes, cold offline, missing/unlisted module fail-closed PASS; broken update rollback FAIL; explicit upgrade not reached.

## Current application CI

- [R7 Runtime Precache Contract](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631534) — queued/pending
- [V0.2 Browser UI & PWA](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631686) — queued/pending
- [Master Academy combined — real E2E & provenance gates](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631568) — queued/pending
- [V0.2 Realistic Tile Faces — Integration QA](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631545) — in_progress/pending
- [Master Academy UI — canonical v3 and Chromium](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631412) — queued/pending
- [R7 Mobile PWA Accessibility Regression](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631455) — queued/pending
- [Phase 3 Table UI — sandbox legal actions, Chromium and offline](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631398) — queued/pending
- [V0.2 Independent UI Release Gates](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631507) — queued/pending
- [Verify](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45324631410) — queued/pending

Required workflow count 10. Phase3 full-match workflow not yet listed for this SHA. Do not use earlier run as replacement. Current totals unknown. No final release decision based on queued runs.

## HTTPS and real UI

[Preview](https://taiwan-mahjong-phase3-r5-experimental-iotn3v964-sign2.vercel.app/) READY, Vercel Git metadata SHA matches candidate. [Actual public browser run](https://agent.tinyfish.ai/runs/5d15e9ed-859e-4b72-bfaf-537487278646) started Beginner and observed two flower replacements, draw/discard and PASS confirmations, nonterminal Replay refusal; stopped at claim window around event 37, no terminal. Intermediate/Advanced, terminal scoring, Replay, Daily, offline and byte parity not run. No production changes. Local DNS failed for Github and Vercel; no local clone.

## Issues

- R7-001 — PASS_PREVIOUS_SHA: Signed zero S08 and additional zero/tamper tests pass on 1b73e756 Verify; candidate regression pending.
- R7-002 — PASS_PREVIOUS_SHA: Integrated local Chromium full-round offline and Replay passed on 1b73e756; runtime graph workflow passed. Current SHA pending; source #46 standalone offline remains FAIL.
- R7-003 — PASS_SOURCE_ONLY: Source #50 d02eb508 and separately composed candidate pass all six portrait/desktop widths plus landscape; 375px focus gate passed. Current integrated SHA pending.
- R7-004 — BLOCKED: R7 Rules robbery, Bot projection, minimal-liability Replay and Scoring golden tests passed separately within prior integration suite; comparison caller failed. R7.2 passes negotiated version to test, retains missing/unknown rejection. Rules still uses minimal-tai settlement; authoritative versioned scorer pair and replay migration not implemented.
- R7-005 — PARTIAL: 224 actual paired games on prior SHA, 224 replay matches, 0 invalid actions; difficulty option wired, public Beginner opened. Intermediate/Advanced browser terminal NOT_RUN. Advanced strength not established.
- R7-006 — BLOCKED: 12 published / 8 validated, 100 canonical v3 questions; 27 draft review assessments, 11 review bundles, formal scored tag coverage 10/20. No formal scenario scorer or record authority migration.
- R7-007 — PASS_PREVIOUS_SHA: Prior integrated Chromium full round passed confirmation, cancel/retry, duplicate and expired token, restored result, no native dialogs. Current public browser observed legal confirmation only; full candidate regression pending.
- R7-008 — FIX_COMMITTED_NOT_RUN: QA-only cache policy conflict caused Verify test 33 failure. Explicitly exclude three draft Academy modules, keep original test and extend it, add runtime import negative probe.
- R7-009 — FIX_COMMITTED_NOT_RUN: Replay comparison test 278 failed unnegotiated public event contract. Test obtains Rules-owned capability; missing/unknown version negative tests added. Scoring fail-closed unchanged.
- R7-010 — FAIL_SOURCE_AND_PEER_COMPOSITION: Source #50 and separately pinned combined candidate fail tests/pwa/mobile-update-gates.py:115 on broken update cache rollback. Actual viewport, cold offline and missing/unlisted module checks passed. Independent issue, exact root cause unverified. Handoff to PWA owner.

## Gate matrix

| Gate | Status |
|---|---|
| sourcePins | PASS |
| codeFixCommit | PASS |
| previousVerify | FAIL |
| currentNpmCheck | NOT_RUN |
| currentR5Strict100 | NOT_RUN |
| currentOracleA | NOT_RUN |
| currentOracleB | NOT_RUN |
| currentStrictR7 | NOT_RUN |
| current224Benchmark | NOT_RUN |
| currentTenWorkflows | BLOCKED |
| previousLocalChromium | PASS |
| currentPublicStart | PASS |
| currentPublicTerminal | NOT_OBSERVED |
| currentPublicReplayDailyOffline | NOT_RUN |
| currentPublicAssetParity | NOT_RUN |
| pwaRollback | BLOCKED |
| currentMobileViewports | NOT_RUN |
| physicalDevices | NOT_RUN |
| authoritativeScoring | BLOCKED |
| fullRules | BLOCKED |
| fullAcademy | BLOCKED |
| formalReview | BLOCKED |

All five release decisions NO-GO/NO. Full rules/Academy require separate authoritatively versioned scorer, formal records, physical-device and independent review gates. Minimum next: finish ten exact-SHA workflows, resolve rollback, run fixed-SHA real terminal WIN/DRAW for 3 difficulties with Replay/Daily/offline screenshots/trace and asset byte parity. Continue only existing PR #53. Documentation-only commit does not replace required application tests or grant merge approval.
