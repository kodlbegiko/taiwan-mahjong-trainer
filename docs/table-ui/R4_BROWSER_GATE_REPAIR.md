# R4 Table UI / Daily Browser Gate Repair — 2026-11-20

**Owner:** AI5 Table UI. **Branch:** `feat/tw16-full-table-ui`; original Draft PR #42. **Release:** NO-GO for complete Taiwanese ruleset. No Rules/Bots/Replay/Adaptive source modifications.

## Verified evidence and failure diagnosis

- Integration baseline PR #44 `ca7ce4dd0d855ade1827873623e9e7eaf5c2bfb1`: full R3 Chromium job **SUCCESS**, run [44657599345](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599345), but the separate strict 100-seed Rules/Bots Node job **FAILED** (Seed87 unsupported multiple winners). The same SHA's legacy Table UI browser job [44657599219](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599219) failed on the **4-button navigation count** before reaching 17-hand checks. CI results from different SHA/job families must not be combined.
- The previous old Table UI test asserted 17 `[data-pick-action]` immediately after clicking Start. That is valid for the explicitly selected *draw/discard-only* `tw16-four-player-sandbox` (no flowers), but **not** for `tw16-configurable-table@experimental-full-v1`: its initial replacement phase may show 17 physical tile identities with zero legal discards and official `replace_flower` actions. There was also a race while waiting for dynamically mounted Daily navigation.
- Earlier Daily acceptance relied on a translated message `上一題正式評分` after a fixed sleep. UI output is **not** durability evidence; an official `already-answered` response need not include a new `gradingResult`. Furthermore initial Daily navigation loads modules asynchronously and a fixed sleep can inspect the wrong stage. The latest integrated CI already demonstrated a successful canonical v3/sidecar readback using Artifact [phase3-real-r3-match-evidence](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599345/artifacts/14594243515): one `legacy-v3` RecordRef in canonical archive, provenance and Session; pendingProvenance=0, AbilityProfile and ReviewPlan present. This does not prove the later PR #42 code has passed.

## UI corrections in this PR

1. `?table=sandbox` explicitly selects the *real* existing Sandbox Rules Profile for the legacy browser suite. Normal URL still requires authentic R3 Rules + Bot/Replay module integration; there is **no mock R3 fallback**.
2. The table displays three separately sourced values: `data-table-physical-count`, `data-table-discard-count`, `data-table-legal-count`. In flower replacement, the UI displays the actual Rules-issued `replace_flower` action and a phase-specific instruction. It never turns an invalid tile into a discard.
3. Daily panel states: `loading`, `ready`, `submitting`, `saved`, `recovery-required`, `failed`, emitted as `data-daily-state`. `saved` and public `data-daily-record-id` appear **only after** the official `submitSessionAnswerLocked` returns `saved` or `already-answered` AND the official `getDailyProgressLocked` readback confirms exact QuestionRef/RecordRef mapping, Session recordRefs and updated next-question state. No UI session or grade authority is created. Missing readback preserves the original attempt ID and enters recovery-required.
4. While API work runs, visible in-flight state is shown and duplicate clicks are blocked by the UI latch and underlying Web Lock. User-selected duration is captured before rerender.
5. `full-table-ui-gates.py` is an explicit legacy **Sandbox-only** test; it verifies all 17 physical and Rules-issued discard actions only on that genuine no-flower profile, 320/375/390/430/768/1440, old Academy V1, cold offline tab and 34 SVG.
6. `full-table-ui-r3-gates.py` remains a strict real-R3 browser gate. It now requires official saved UI data contract, exact one-record append on same-turn double click, canonical v3 RecordRef + sidecar provenance + Session readback, next QuestionRef and reload persistence. It is NOT fixture-only. It can execute only after AI6 pins latest Rules/Bots/Replay/Daily into the same runtime SHA.
7. `tests/browser/table-session.test.js` adds a **fixture-only pure renderer test** for replacement PlayerView: 17 physical / 0 legal discards / 1 official-shaped flower action; not an asserted real end-to-end PASS.
8. `.github/workflows/tw16-table-ui.yml` now runs direct branch-head push gates to produce traceable standalone Sandbox Node and Chromium screenshots. The Playwright R3 script remains independent; a sandbox green CI is not full-match certification.

## Commands and evidence requirements

```sh
node --test tests/browser/table-session.test.js
npm run check
python tests/browser/full-table-ui-gates.py --screenshots tw16-table-evidence
python tests/browser/full-table-ui-r3-gates.py --screenshots tw16-r3-real-evidence
```

The first three are directly runnable on PR #42's standalone Sandbox source. The fourth intentionally fails closed until AI6's **same combined SHA** includes supported R3/Bot/Replay/Daily. CI screenshots from GitHub Chromium are **390px emulation**, not an iPhone 17 Pro hardware check. Existing rules with multiple discard winners remain typed unsupported; no UI fake win/draw substitute.

## AI6 coordination and unresolved gates

- PR #44 must re-integrate the **current** source-owner versions, preserve Table UI filenames and public API invariants, and bump the **integrator-owned** atomic SW cache/version to include all current transitive imports. Do not overwrite this PR's UI source with earlier pinned SHA.
- Re-run actual combined Chromium (including Daily readback and cold offline new tab), 100-seed full Rules/Bots, legacy three Academy structural exercises and both Oracle suites on the **same** source SHA.
- Keep `RELEASE_GO=false` because R4 Seed87 multiwinner unsupported is a Rules capability decision outside Table UI ownership. No existing screenshots constitute evidence that this specific PR #42 R4 code has completed R3 full-match testing.
