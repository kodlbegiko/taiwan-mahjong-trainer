# R7 Mobile Web / PWA / Accessibility — acceptance and handoff

**Scope:** presentation-only CSS, semantic public rendering, keyboard focus continuity, offline shell and dedicated gates. **Not** Rules/Bot/Replay/Scoring/Academy logic or \`src/table-ui/main.js\`. Base: \`integration/mahjong-full-game\` at \`a29bebfc01e05c05450b964a41ce34cbecf40365\`.

## Status terminology

- **PASS** = evidence for this exact scenario and source SHA was actually executed.
- **FAIL** = observed error or violated assertion.
- **NOT_RUN** = not executed; never infer a pass from another browser or earlier R5 tests.
- **PENDING** = CI is defined but no completed run has been inspected.

This document is a test plan and initial audit. The workflow artifact \`r7-mobile-pwa-a11y-evidence\` contains reproducible per-viewport JSON, screenshots, error output and tested SHA after execution. A manually completed physical-device checklist is required to promote the release. No claimed physical-device results are included here.

## Changes and audit decisions

1. SW has a versioned cache and all 34 tiles; R7 waits for **all** precache requests, discards a failed staging cache, and fails closed on a missing versioned HTML/JS/CSS/SVG shell entry instead of fetching incompatible live bytes. It still waits for explicit user-triggered update; existing pages are reloaded by the existing \`src/app.js\` \`controllerchange\` path.
2. Mobile table buttons are at least 44×44 CSS px when actionable. Make focus outlines visible, reduce animation when requested, let narrow seat text wrap, and allow focus rings beyond containers without clipping.
3. The public table receives explicit labeled groups and announced selection status. \`src/table-ui/a11y.js\` only restores keyboard focus when a DOM redraw removes the selected control; it neither chooses nor submits LegalActions.
4. The manifest retains Pages-relative \`id\`, \`scope\` and \`start_url\`, standalone display and 192/512 icons. Safari home-screen installation (manual) and Android install prompt must be checked on physical devices.

## Automated acceptance matrix

| Gate | Coverage | Initial state |
|---|---|---|
| Responsive browser | 320, 375, 390, 430, 768, 1440 CSS px + 844×390 landscape | PENDING |
| Touch targets & reflow | enabled tile/action/nav buttons >=44×44, no document horizontal overflow; screenshots | PENDING |
| Keyboard/ARIA | keyboard Enter selection, \`aria-pressed\`, focus continuity, semantic group names, reduced motion | PENDING |
| V0.2 compatibility | traditional 17 tiles / training 34 wait options and legacy Academy navigation | PENDING |
| Real Phase 3 initialization | default R3 profile starts without exposed error; not full settlement | PENDING |
| PWA offline | initial activation, new **offline** tab, 34 SVG fetches, app usable | PENDING |
| Corrupt old shell | deleted shell JS must not load a live network replacement | PENDING |
| Broken update | missing required CSS must abort staging, retain old complete cache/session | PENDING |
| Explicit version update | old/new side-by-side during waiting, after opt-in reload only new shell with new JS/CSS bytes | PENDING |
| Existing regression | \`npm run check\`; existing V0.2/R5 workflows continue independently | PENDING |

Run locally with Chrome, Python Playwright 1.56, Node 22:

\`\`\`bash
npm run check
python tests/browser/mobile-pwa-a11y-gates.py --evidence r7-mobile-evidence
python tests/pwa/mobile-update-gates.py --evidence r7-mobile-evidence
\`\`\`

CI: \`.github/workflows/r7-mobile-pwa-a11y.yml\` (exact head SHA and ownership boundary checked).

## Physical-device and screen-reader release checklist

Record device model, OS version, browser version, portrait/landscape, network state, screen recording ID, observed result and tester. These rows are **NOT_RUN** until someone executes them. This is not equivalent to Chromium device emulation.

| Device/test | Required observation | State |
|---|---|---|
| iPhone Safari portrait, 320/375/390/430-equivalent | One-handed legal discard/confirm, no clipped hand/action/focus outline, 44px targets | NOT_RUN |
| iPhone Safari landscape | Scrollable full game, bot/flower/claim controls reachable, browser chrome and safe-area handling | NOT_RUN |
| Android Chrome portrait + landscape | Same game interaction, keyboard/gesture navigation, no ghost taps or page-level overflow | NOT_RUN |
| iOS Add to Home Screen | icon/title, standalone launch, new home screen app cold-start, return from app switcher | NOT_RUN |
| Android Chrome install | install prompt or browser menu install, correct icon, standalone launch | NOT_RUN |
| iOS + Android offline cold start | online fully install, kill process, airplane mode, relaunch from installed icon and enter game | NOT_RUN |
| iOS + Android network recovery | offline -> online -> refresh; saved session and training history unchanged | NOT_RUN |
| Installed app update | install version A, deploy B, open A, visibly offer update, approve, reload into only B, history intact | NOT_RUN |
| Interrupted update | B asset unavailable/network dropped; A remains operable and cache not half replaced | NOT_RUN |
| VoiceOver/Safari | rotor headings/landmarks, each tile spoken name and selection, no opponent secret information, focus after redraw | NOT_RUN |
| TalkBack/Chrome | swipe navigation, activate legal action, status announcements, no unintended double-submit | NOT_RUN |
| External keyboard | Tab/Shift+Tab/Enter/Space through game; focus does not vanish after selection, cancel or claim | NOT_RUN |
| 200% text and WCAG reflow | readable body/status, no clipped critical controls or inaccessible modal | NOT_RUN |
| Modal confirmation (new game) | native confirm usable/cancellable, screen reader label, focus returns to appropriate control | NOT_RUN |
| Contrast / forced colors | text and focus indicators remain visually discernible, disabled buttons differentiated | NOT_RUN |
| Network/background session concurrency | two existing tabs update and resume without mixed HTML/JS, no accidental mid-turn action | NOT_RUN |

## Known limitations and release decision

- **NO-GO for physical mobile / accessibility release** until physical iPhone, Android, VoiceOver, TalkBack, installed-PWA updates and R6 full-game end-to-end tests pass.
- Automated checks are **Chromium emulation only**, not Safari/WebKit or installed-PWA/OS-level evidence. No external screen reader or hardware is available to this workflow.
- A native \`window.confirm\` remains in \`src/table-ui/main.js\` for start-new. R6 PASS/補花 UI blockage requires Agent 1 to resolve and retest; this branch intentionally leaves that business/UI operation flow untouched.
- R5 100/100 fixed seeds and historical chromium results cover *earlier SHA*, not this R7 build, not real-device accessibility and not release approval.
- Site hosting/deployment can publish files non-atomically. SW staged cache failure and versioned cache guards reduce risk but do not cryptographically verify every asset is from the same deployment. A future build-time integrity manifest or atomic publish mechanism would be needed to guarantee integrity if files change during precache.
- Accessibility tests verify a subset of semantics, focus and target geometry, **not** complete WCAG 2.2 AA conformance. Screen reader, 200% text, contrast and modal evaluations remain manual.

## Integration handoff: proposed cross-owner change

**Agent 1 / integration agent** should examine \`src/table-ui/main.js\` new-game confirmation and PASS/補花 transitions against the R6 bug report. Prefer a correctly labeled, focus-trapped and cancellable in-DOM dialog or explicit accessible confirmation flow. Must retain Rules-issued LegalActions and two-step discard semantics; do not modify from this branch.

## R7.1 follow-up (2026-11-24)
- R7-003: original Chromium run 45228712475 job 137882121136 confirms 320px PASS and 375px timeout **after** discard-confirm exists. main.js explicitly focuses the confirmation after draw. a11y.js now records a real keyboard/AT native activation (detail=0) and restores the same still-legal tile after the synchronous redraw; pointer activation and declaration/restart confirmation focus are untouched. Existing assertion retained; exact action identity and unchanged revision added. Browser rerun required.
- R7-007: withdraw #50 ActionBar span change; #49 at ee2eda1a already owns the selection live region and confirm/cancel/busy guard. Only non-overlapping ARIA groups and CSS remain here. Coordination posted to #49. Cross-PR merge confirmation NOT_RUN.
- R7-002: existing #50 tree has 65 src JS files and all 65 are cached. #48 adds src/bots/strategy-r7.js (decision.js import), #46 adds src/replay/integrity.js (internal.js import), #52 adds five src/scoring modules (not yet connected to public entry), #47 adds two academy review/audit modules (not yet public imports), #51 adds no source module at audited head. Do not add absent paths to standalone SW. After combining branches, install pinned acorn (npm install --no-save --package-lock=false --ignore-scripts acorn@8.15.0), run node scripts/runtime-precache.mjs --write, commit generated sw.js and rerun node scripts/runtime-precache.mjs. All src JS is conservatively cached; parser checks static imports, re-exports and literal dynamic imports and module-relative asset URLs; computed cases fail closed except explicit 34 tiles. New graph workflow runs on integration merge/push and produces edge matrix. No integrated SHA or full integrated offline PASS yet.
- Separate existing full-match workflow covers full settlement, replay, daily and offline reload; standalone #50 and combined R7 evidence must not be conflated. Physical iPhone, Android, VoiceOver, TalkBack and installed update remain NOT_RUN. Keep Draft.
