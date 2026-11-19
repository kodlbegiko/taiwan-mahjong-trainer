# Adaptive V1 — Durable Learning Provenance and Restart Recovery

This source-PR repair implements Tech Lead's L-01/A-01 blocker for `academy-q-*` ↔ `ex3-*`, without changing `DecisionRecord v3`, `archive:v3`, `session:v1`, or any AI3-owned code.

## Versions / storage

- Contract `master-academy/1.0.0`; sidecar `schemaVersion:1`, `contractVersion`.
- Key: `tw-mahjong-master-academy:state:v1`.
- `provenanceLinks[]` schema: `academy-provenance/1.0.0`.
- `pendingProvenance[]`: write-ahead **intent** entries with `{link,record}`. They are **not** scored evidence. They exist solely because the original archive and the Academy sidecar are two separate localStorage keys and cannot be committed atomically.
- Earlier V1 sidecars without these optional new arrays read as empty lists. Unsupported `provenanceVersion`, invalid JSON, invalid record or snapshot, duplicate mapping or conflicting aliases fail closed. No silent rewrite of unknown schemas.

A finalized provenance entry contains:

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `contractVersion`, `provenanceVersion` | Version-gated immutable mapping |
| `recordRef` | Canonical `{kind:"legacy-v3", id}` |
| `underlyingExerciseId`, `sourceSnapshotRef` | Original v3 `ex3-*` ID; no record format extension |
| `academyQuestionRef` | Official `questionId + questionVersion`, never guessed from exercise name |
| `lessonRef` | Official `lessonId + lessonVersion` |
| `skillTagIds` | Exact Learning question tags, not a heuristic lookup |
| `ruleRef` | Original signed-off structural rule profile/version |
| `generatorVersion`, `seed`, `generatorIndex` | Deterministic replay inputs |
| `scoringVersion` | Canonical v3 scoring version |
| `publicQuestion` | Immutable, sanitized `QuestionPublic` snapshot including correct public choices; no `answerKey` |
| `sessionId?` | Explicit session association; omitted for standalone attempts |

Proof: full legacy `validateDecisionRecord(...,{verifyAnswers:true})` + `replayExercise` and independent `createExercise` replay + input/rule/seed/scoring/hand/options equality + **AI3-injected trusted `toPublicQuestion` and `getLessonPublic`**, including lesson.questionRefs membership. An unrecognized lesson or unexpected version cannot create a link. An existing recognized source with mismatched persisted data rejects load/rebuild. A genuinely retired/unavailable question version remains inspectable but `unavailable:source-lookup` and is not rescheduled or assigned curriculum evidence.

## Write-ahead and recovery protocol

1. AI3 public `submitAcademyAnswer(questionRef,choice,{timestamp,durationMs,attemptId})` returns official v3 `record`, tagged `recordRef`, grading.
2. Independently validate the scored v3 record and official public question+lesson+exact replay against that record.
3. Write a **prepared intent** (not finalized provenance) to Academy sidecar and read back; if quota denied here, **do not** append a new v3 record. This extra step is necessary to recover lesson identity if the process crashes before final provenance.
4. Write the canonical v3 record with the original `createLocalTrainingStore.addDecision` API, or accept an *identical* previously durable record, never overwrite a conflicting attempt ID.
5. Independently read `archive:v3`, revalidate and compare the canonical record. If quota/permissions prevented the canonical append, leave only the intent; it is never counted.
6. Commit immutable `provenanceLinks[]` while removing that intent **in one sidecar write**, then read back and revalidate.
7. Recompute `AbilityProfile` using the exact Academy SkillTag list only for verified links. Unlinked legacy attempts may use separately approved legacy mapping; `legacySessions` cannot synthesize tags.
8. Recompute `ReviewPlan` with the real `academy-q-* @ version`, grouping idempotently by immutable question ref. Absent source => unavailable, not a fabricated lesson or another hand.
9. Append verified `recordRef` to the declared `TrainingSession`; reject duplicates, different question, another session or a terminal session. Keep original question order, seed and generator versions. Mark completed only when all declared questions have canonical source evidence.
10. On adapter restart, `rebuild({asOf})` first calls `recoverPending({asOf})`, checking pending record against the **durable** canonical v3 record, then finalizes provenance, recomputes derivatives and reconciles `planned/active` sessions by persisted provenance links. A pending intent with no canonical record stays pending, not counted.

At no point is a successful browser-memory-only write described as durable. `QuotaExceededError` and blocked localStorage report errors. If a record is already durable when provenance fails, it remains intact and the write-ahead intent supports reconstruction. Future-version, conflict or corruption failures do not overwrite existing bytes.

## AI6-facing public adapter (no internal Learning imports)

`src/adaptive/learning-adapter.js` exports:

```js
import {
  createAdaptiveLearningAdapter,
  planDailyTraining,
  getTodayRecommendation,
} from '../adaptive/index.js';
import {
  SKILL_TAGS, LEGACY_ERROR_TO_SKILLS,
  submitAcademyAnswer, toPublicQuestion, getLessonPublic,
} from '../academy/index.js';

const registry = {
  skills: SKILL_TAGS,
  legacyMappings: {
    taskTypes: {
      discard: ['efficiency.shanten', 'efficiency.discard'],
      tenpai: ['waits.enumeration'],
      multi_wait: ['waits.enumeration', 'waits.multi'],
    },
    errorTypes: LEGACY_ERROR_TO_SKILLS,
  },
};
const adapter = createAdaptiveLearningAdapter(window.localStorage, {
  registry,
  learning: { submitAcademyAnswer, toPublicQuestion, getLessonPublic },
  timezone: 'Asia/Taipei',
});
// UI obtains clock ONCE; no hidden global time inside Adaptive.
const asOf = new Date().toISOString();
const restored = adapter.rebuild({ asOf });
// restored.profile, restored.reviewPlan, restored.recommendation
const next = restored.reviewPlan.items.find(item =>
  !item.reasonCodes.some(code => code.startsWith('unavailable:')));
if (next) {
  const resolved = adapter.resolveReviewQuestion(next);
  // resolved.available === true => { question: public QuestionPublic,
  //   lesson: public Lesson, skillTagIds, recordRef, scoringVersion }
  // Display only resolved.question.prompt.options before submission.
}
const ref = { questionId: 'academy-q-001', questionVersion: '1.0.0' };
const graded = adapter.submitAnswer(ref, choice, {
  timestamp: asOf, durationMs, attemptId: stableAttemptId, asOf,
  // sessionId: already-persisted TrainingSession id, if applicable
});
// Check durable/provenanceDurable/derivedFresh/sessionFresh before success UI.
```

`adapter` exposes `submitAnswer`, `rebuild`, `resolveReviewQuestion`,
`recoverPending`, `reconcileSession`, `saveSession`, `getSession`,
`getProvenance`, `readLegacy`, `load`, `loadStatus`.

Daily-session generation, if desired, consumes `planDailyTraining({profile,reviewPlan,records,provenanceLinks,learning,registry,seed,asOf,ruleRef,minutes})`: it uses valid Academy refs rather than `ex3` when the record is linked. Save the `session` with `adapter.saveSession`, and **use a stable attempt ID per question** to make repeat submission idempotent; the adapter will reject a different completed answer to the same question within the session.

## Verified boundaries, release status

- The Learning #35 public exports used above are real at `deceed51c156284607367a2592dae32f9808e736`: `submitAcademyAnswer`, `toPublicQuestion`, `getLessonPublic`, `SKILL_TAGS`, `LEGACY_ERROR_TO_SKILLS`. That PR presently exports no separate `getProvenanceByExerciseId` endpoint. This adapter builds a strict provenance bridge from the official API **at grading time**, without duplicating AI3 implementation.
- This source PR uses an AI3 V1-contract fixture for restart and crash-injection tests, not a claim of paired-PR production integration. Full L-01/A-01/UI-01 PASS still requires **exact combined SHA** in integration #33 and clickable UI #38.
- Real device, Academy PWA precache and offline 12-step UI are NOT_RUN. No scenario scorer exists in Learning #35; no `scenario` score can be counted until official scorer and fixtures are installed.
