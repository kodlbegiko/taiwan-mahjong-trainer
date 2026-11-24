# R7.3 known issues and exact closure evidence

## R7-001 — PASS_R72_PENDING_R73

R7.2 Verify signed zero and forged -0 tests passed; rerun new full suite.

## R7-002 — PASS_R72_AND_PEER

R7.2 local full round offline PASS, current R7.3 graph PASS, peer ded444f upgrade/offline PASS; current full browser gate pending.

## R7-003 — PASS_R72_AND_PEER

All seven viewport orientations in R7.2 and peer source artifact; current integrated mobile gate pending.

## R7-004 — BLOCKED

Source Rules/Scoring/Replay pre-settlement implementation exists; #52 r73-rules-integration.test.js lacks trusted runtime and incorrectly expects raw ledger in public event; owner fix and strict native composition pending; no new policy enabled.

## R7-005 — PARTIAL

R7.2 224 paired matches re-executed; R7.3 source 340-game calibration completed; 2100 heldout not complete, no promotion.

## R7-006 — PARTIAL

Current app 100 formal v3, 12 published/8 validated, 10/20 formal target coverage. #47 source adds 5 registered questions, proposed 15/20; exact composition and review pending.

## R7-007 — PASS_R72_PUBLIC_PARTIAL_R73

R7.2 local complete round confirmation/cancel/duplicate/stale/replay/Daily/offline PASS; R7.3 public start and cancel/reconfirm/discard/chi/PASS observed, not terminal.

## R7-008 — PASS_R72_AND_R73_GRAPH

R7.2 Node test 33 and graph PASS. R7.3 graph job 138256067933 includes real QA import negative probe PASS; full npm check pending.

## R7-009 — PASS_R72_PENDING_R73

R7.2 test 278 and strict 67/67 no skips PASS; current test unchanged, full gate pending.

## R7-010 — PASS_PEER_BROWSER_AND_CURRENT_UNIT_PENDING_CURRENT_BROWSER

R7.2 rollback FAIL; peer first fix 317fcb91 rollback pass, healthy staging FAIL wrong -broken cache. Peer final ded444f1 all 11 browser upgrade cases PASS incl real game/Replay/Daily data after offline update. Current app 11/11 native Node verified exact SW/test blobs; current full browser gate pending.

All five release decisions NO-GO; no current application full CI claim.
