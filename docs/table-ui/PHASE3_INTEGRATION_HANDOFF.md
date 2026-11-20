# Phase 3 Table UI — integration handoff (2026-11-20)

**Branch:** feat/tw16-full-table-ui / PR #42 (DRAFT)
**Release status:** EXPERIMENTAL — full R3 E2E NOT RUN, do not merge/release as complete.

## Source pin and provenance

| Source | Last verified source HEAD | Integration PR #44 snapshot |
|---|---|---|
| Rules #43 | 1f7badfefa50d97e4db4a9a689ea563eb3289232 | older be033d3e |
| Bots #40 | 273ccd9819fad4069540cdbd85021df1ad065ba3 | older 5f839d11 |
| Replay #41 | 147d99fd5dabe23a6c5d774b960a459f19767310 | older 8faf33f1 |
| Daily #45 | c4180ee595b72ae8801b3fb987e0036a15abbda8 | older 44e2dab1 |
| Integration #44 | 98af3a721f0100f725c6f26d44ffe5ff1e27585d | pinned older source revisions |

Do not treat a source PR's independently passing CI as combined, same-SHA UI E2E evidence.

## What the table-owned source does

- src/table-ui/full-round.js: guarded dynamic imports of real R3 Rules, Bot Controller and Replay Service. Full game starts **only** after registered R3 RuleProfile + explicit claim-host API detection. Bot Controller receives detached per-seat Rules PlayerViews; Rules alone validates LegalActions, transitions the GameState and adjudicates all claim priorities. No UI-generated action IDs or hidden-hand access. Uses an isolated versioned R3 localStorage key with validation and fail-closed corruption handling.
- src/table-ui/main.js and view.js: legal discard selection/confirmation, R3 claim combinations, human PASS/chi/pong/kong/win/draw/flower action buttons, stale revision recheck, bot progress/pause/resume/continue, terminal authoritative zero-sum delta and minimal tai experimental warnings, end-of-game Replay navigation.
- Replay uses createReplayService, saves **only settled** game archives and reads canonical historical PlayerView lazily via getReplayFrame; per-event getDecisionAnalysis is advisory and no fake performance rating is displayed. No future wall/opponent concealed or seed in UI.
- src/table-ui/daily.js: createDailyTrainingController with official Learning + registry, locked get/start/resume/submit/complete/abort and public QuestionPublic. v3 grading/provenance remains owned by Adaptive. UI has no second session database. Browser sessionStorage stores only a pending attempt ID to permit safe retry.
- src/table-ui/table.css: 320–1440px navigation, flower displays and Daily controls; preserve legacy SVG.
- sw.js: minimal coordinated cache-version bump and precache of two new Table UI modules only. **AI6 must finalize the same-SHA complete transitive offline dependency graph** after integrating latest Rules/Bots/Replay/Daily source versions.

## Hard gates and test commands

Sandbox regression (only Sandbox PASS, not full match):
```sh
node --test tests/browser/table-session.test.js
python tests/browser/full-table-ui-gates.py --screenshots tw16-table-sandbox
```

**Required combined-head real test (not yet run):**
```sh
npm run check
python tests/browser/full-table-ui-r3-gates.py --screenshots tw16-r3-real-evidence
```
The R3 browser script requires real registered full profile, real human LegalActions, three Bot orchestration, Rules-authoritative win/draw, four score deltas, real replay frame/next, locked Daily, offline new tab, 34 SVG and responsive widths 320, 390, 1440. It explicitly fails when deps are missing, and does not claim physical iPhone certification.

## Blockers

1. AI6 #44 has not incorporated latest #43/#40/#41/#45 source commits. PR #42 by itself has no Bot/Replay/Daily module and must remain a guarded sandbox fallback.
2. Real combined browser and offline new-tab PASS at the **new final head** is unavailable. Existing successful checks at older SHAs do not prove this change.
3. RuleProfile tw16-configurable-table@experimental-full-v1 and scoring tw16-minimal-tai-v1 are experimental. Multiple simultaneous winners, robbery of added kong, complete special hands/regional scoring/dealer transitions are unsupported or unverified.
4. iPhone 17 Pro Safari physical device evidence and screenshots are not available. Playwright 390px emulation is not equivalent.
5. Shared CSS/index/app/academy-ui ownership belongs to AI6; this source PR changes only its own Table UI files and a minimal coordinated SW shell edit. Any final merged SW edit must be reviewed against AI6's changes.

Release gate stays NO-GO until actual combined dependency pin, current CI and real E2E.
