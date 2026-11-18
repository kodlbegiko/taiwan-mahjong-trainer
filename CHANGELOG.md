# CHANGELOG

## Unreleased — V0.2 re-audit (2026-11-19, round 2)

- Revalidated `main` at `53981149d5f632db8d8dbbf3bd11fbd0999d48e3`; feature PR #1/#3/#4/#5 unchanged, still open, unmerged.
- Safely reconciled Draft #10 with latest main and reintroduced exact feature blobs without crossing file ownership; added always-on 10,000-case numerical oracle cross-check.
- On staging SHA `4f673f97a137a886d6e0b14617a42e889a59d391`, [Verify #44358617174](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44358617174) reports 67 tests, 61 pass, 3 fail, 1 skip, 2 TODO. Numerical oracle 10k PASS; Q-001/Q-002/I-003 still FAIL. V0.2 remains NO-GO.
- Staging-only Chromium/mobile browser smoke workflow added for verification; do not confuse pending/failed tooling setup with product validation. Latest result tracked in quality report.
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
