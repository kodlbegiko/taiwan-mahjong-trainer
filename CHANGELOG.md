# CHANGELOG

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
