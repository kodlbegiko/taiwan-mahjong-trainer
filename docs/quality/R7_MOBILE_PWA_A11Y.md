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
