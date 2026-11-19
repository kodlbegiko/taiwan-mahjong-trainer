# PR #38 — Academy UI → AI 6 Public Façade integration contract

Source UI branch: \`feat/mahjong-academy-ui\`. The production UI imports only the **public** AI6 boundary via optional dynamic import:

\`src/integration/master-academy-facade.js\` → \`createMasterAcademyFacade(storage)\`.

The module is absent from PR #38's own branch because PR #33 has not merged. The page **fails closed** (shows unavailability) instead of fabricating an Academy lesson, estimated ability, or daily quota. Existing V0.2 three-mode training remains independently usable.

## Required façade methods (source PR #33 reviewed)

| UI call | Expected source contract | Notes |
| --- | --- | --- |
| \`getLessons()\` | \`LessonPublic[]\` | 20 unique IDs across five levels in PR #35; no static fake lesson treated as official |
| \`getQuestionRefs({lessonId})\` | versioned refs | Each ID must be included in that public Lesson's \`questionRefs\` |
| \`getPublicQuestion(ref)\` | \`QuestionPublic\` | Required public \`prompt.legacyHand/options/visibleTiles\`; UI recursive denylist rejects \`answerKey\`, GameState, private wall/events |
| \`submitStructuralAnswer(ref,choice,{timestamp,durationMs,attemptId,asOf})\` | \`{gradingResult,recordRef,durable,derivedFresh,errorCode?}\` | Only canonical v3, never user-written scoring; success **only** if canonical archive readback is valid and source reports durable + derivedFresh |
| \`getDashboard({asOf})\` | \`{profile:AbilityProfilePublic,reviewPlan:ReviewPlan,...}\` | Display only source-backed attempts, evidenceRefs, estimatedProficiency with explicit uncalibrated label |
| **Required AI6 addition** \`getTrainingSession({asOf})\` | \`TrainingSession V1 \| null\` | PR #33 currently has no public TrainingSession accessor; UI shows **not provided** until real session source exists |

## Persistence / provenance bridge

- Original v3 source is \`tw-mahjong-trainer:archive:v3\` and continues to own canonical v3 scoring.
- UI-only progress link key: \`tw-mahjong-master-academy:ui-links:v1\`. Stores \`{questionId,questionVersion,lessonId,recordRef}\` with its version and selected lesson; no answerKey, GameState or grading internals.
- A link is counted only after verified underlying v3 \`recordRef\` readback, matching public \`QuestionPublic\` hand, visible tiles, task type, immutable \`generator\` metadata, and the official Lesson's own \`questionRefs\`. Corrupt/newer link schema fails closed without overwriting it.
- This **UI-side linkage is temporary** until AI3/AI4/AI6 supply a formally validated durable question→exercise→record→lesson association. It must never be promoted to an anti-cheat credential: localStorage is user-editable.
- On partial failure: \`durable=false\` or missing record readback → no completion; \`derivedFresh=false\` → raw record remains but ability/review not confirmed; UI-link write failure → raw record retained, progress unconfirmed. Do not auto-resubmit with a new attempt ID after uncertain persistence.
- PR #33 currently maps Adaptive ReviewPlan's \`ex3-*\` questions rather than Academy's \`academy-q-*\` question refs. UI only maps due review to Academy through verified record→public question links, never an invented 1:1 ID mapping.
- No simulated \`TrainingSession\`, self-assigned proficiency, invented lesson progress or fake attack-defense/bot scoring.

## Source branch verification vs required composition

**Standalone PR #38** can prove source-shape validation, original V0.2 v3 and PWA gates, plus an explicitly labeled **Fixture-only** Chromium 12-step UI test at \`tests/browser/academy-learning-loop-gates.py\`. Its fixture is not shipped in \`sw.js\`, and cannot certify formal Learning/Adaptive integration.

**AI6 combined HEAD must prove**:

1. Mount the exact pinned PR #35/#37 source and PR #33 façade alongside PR #38 with no private UI imports.
2. \`getLessons\` returns 20 real lessons; a fresh player can choose first lesson; generate true canonical \`QuestionPublic\` and verify no answer key before submission.
3. Click 17/34 original SVG tile options, submit with real \`submitStructuralAnswer\`, assert correct \`GradingResult\`, durable \`RecordRef\`, readback of original immutable v3 bytes, ability/review sidecar update, reload-safe Lesson association, then next question.
4. Test storage write denied/Quota and corrupt sidecar, idempotent attempt and restart, 390px/320px, keyboard/ARIA, new-tab offline at \`/taiwan-mahjong-trainer/\`.
5. Add all **actually present and required** upstream runtime files (\`src/integration/**\`, \`src/academy/**\`, \`src/adaptive/**\`, \`data/academy/manifest-v1.json\`) to a new atomic \`sw.js\` version. Do not precache absent upstream files in source PR #38; do not edit PR #26 pinned V0.2 preview.
6. \`TrainingSession\` public accessor and durable question identity should come from AI6 (or appropriate source PR), not be invented in UI.
7. Scenario/PlayerView remains unscorable and fixture-labeled until independent Rule Engine + Strategy scorer and legal action composite verification.

Release remains **Draft / not authorized** even if the standalone UI CI is green. iPhone 17 Pro Safari/VoiceOver/PWA install is still a separate real-device acceptance gate.
