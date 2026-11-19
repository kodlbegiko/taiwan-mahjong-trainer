# Master Academy V1 — Learning Academy

## Delivery scope

- Contract: \`master-academy/1.0.0\`; schemaVersion 1.
- 16 stable SkillTags; four canonical v3 ErrorTypes (no inferred player motives).
- Five **curriculum** levels, 20 lessons, four per level. Levels 4–5 are \`validated\`, not published, pending full strategy/rules verification. These levels include real structural exercises but do not certify real-world mahjong skill.
- 100 deterministic structural exercises with public metadata in \`data/academy/manifest-v1.json\` (40 discard, 40 tenpai, 20 multi_wait). The authored source is 100 distinct seed/index/task combinations, **not** 100 copied hand snapshots. \`auditBank()\` verifies actual generated hand uniqueness, legal tiles, answer replay and formal scoring at runtime; a failed audit blocks shipping.
- 0 verified scored scenarios; Rules Engine / Strategy have not supplied auditable legal PlayerView and scorer fixtures yet.
- No verified discard risk, fan points, chi/pong/kong / flower legality or real opponent model. This PR never writes into existing v3 archive and never changes the release service-worker cache.

## API — AI4 Adaptive

\`\`\`js
import { LEGACY_ERROR_TO_SKILLS, ERROR_TYPES, SKILL_TAGS,
  submitAcademyAnswer, validateAcademyDecisionRecord } from './src/academy/index.js';
import { validateDecisionRecord } from './src/training/records.js';

const ref = { questionId: 'academy-q-001', questionVersion: '1.0.0' };
const { gradingResult, record, recordRef } = submitAcademyAnswer(ref, chosenTile, {
  durationMs: 3500, timestamp: new Date().toISOString()
});
// recordRef.kind === 'legacy-v3'; persisted by existing v3 storage adapter.
validateDecisionRecord(record);
// AI4 may use the validated evidence and mappings in a separate adaptive sidecar.
\`\`\`

The record family dispatcher **must** use \`{kind:'legacy-v3'|'academy-v1',id}\`. Structural questions use the old, official v3 grading. \`AcademyDecisionRecord V1\` is exclusively for scored scenarios and must use AI4's independent sidecar. Without a verified scenario scorer and fixed rule/view/answer fixture, \`createAcademyDecisionRecord\` throws. Neither guessed scenario grades nor aggregated legacy session stats count as new ability evidence.

## API — AI5 Frontend

\`\`\`js
import { LEVELS, listLessons, getLessonPublic, listQuestionRefs,
  toPublicQuestion, gradeAcademyQuestion, submitAcademyAnswer
} from './src/academy/index.js';
const lesson = listLessons({level:2})[0];
const ref = listQuestionRefs({lessonId:lesson.lessonId})[0];
const visible = toPublicQuestion(ref); // answerKey absent
const feedback = gradeAcademyQuestion(ref, choice); // after submitting a choice
\`\`\`

For \`discard\`, \`choice\` is an integer 0–33 that occurs in the hand. For \`tenpai\` / \`multi_wait\`, \`choice\` is an array of distinct legal integer tile types; the authoritative v3 scorer grades omissions and extras. The proper persisted submission uses \`submitAcademyAnswer(ref,choice,{durationMs,timestamp})\`, which returns the official v3 record plus gradingResult and RecordRef.

Normal pre-answer UI must not import \`src/academy/question-internal.js\`, which owns internal answerKey and source Exercise snapshots for official grading and tests. A PWA's downloaded JS remains inspectable and **cannot** provide true anti-cheat secrecy.

## API — AI6 Integration and release gate

\`\`\`js
import {validateTaxonomy,validateLessons,QUESTION_REFS} from './src/academy/index.js';
import {auditBank} from './src/academy/question-internal.js';
validateTaxonomy();
validateLessons();
const evidence = auditBank({verifyAnswers:true});
if(evidence.total !== 100 || evidence.verified !== 100 ||
   evidence.duplicates !== 0 || evidence.failures.length) {
  throw new Error('Learning Academy release gate failed');
}
\`\`\`

The RuleRef \`{profileId:'legacy-exercise-v3-structural', ruleVersion:'taiwan-16-standard-v1'}\` labels existing **structural Exercise v3** and is not a claim that AI1's full RuleProfile is implemented. Question.source.snapshotRef is the official Exercise v3 ID; the question's generatorVersion and scoringVersion refer to the exact original generator and scorer. Grades and detailed explanations derive from current canonical v3 results, never from invented probabilistic strategy estimates.

## Remaining gaps

Integration with AI1 Rules and legal PlayerView; AI2 independently verified StrategyAnalysis; real scenario scorer fixtures; AI4 sidecar storage/ability evidence; AI5 UI, PWA cache and offline flow; AI6 cross-module regression/browser/device validation. Existing legacy APIs, storage keys and \`sw.js\` must stay unchanged in this source PR.


## Durable provenance repair (PR #35, Learning owner)

**Problem:** official \`DecisionRecord v3.exerciseId = ex3-*\` is not itself the curriculum
\`AcademyQuestion.questionId = academy-q-*\`. A lesson cannot be reconstructed by
guessing the string prefix, and an existing legacy attempt is not automatically
an Academy course attempt.

**Design:** \`src/academy/provenance.js\` owns a bank-validated, JSON-serializable
\`AcademyProvenance\` snapshot, separately associated with a **durable** legacy
RecordRef. It never mutates a v3 record or any storage key.

### Provenance schema (Learning-owned V1)

\`\`\`json
{
  "schemaVersion": 1,
  "contractVersion": "master-academy/1.0.0",
  "provenanceVersion": "academy-provenance/1.0.0",
  "legacyExerciseId": "<actual ex3-* id>",
  "questionRef": {"questionId":"academy-q-001","questionVersion":"1.0.0"},
  "lessonRef": {"lessonId":"academy-l1-01","lessonVersion":"1.0.0"},
  "skillTagIds": ["efficiency.shanten","efficiency.ukeire","efficiency.discard"],
  "ruleRef": {"profileId":"legacy-exercise-v3-structural","ruleVersion":"taiwan-16-standard-v1"},
  "generator": {"seed":"academy-v1-structural-0001","index":0,"generatorVersion":"<actual v3 generator version>"},
  "scoringVersion": "efficiency-v2",
  "scorerId": "legacy-exercise-v3",
  "source": {"kind":"legacy-exercise-v3","snapshotRef":"<the same exact ex3-* id>"},
  "recordRef": {"kind":"legacy-v3","id":"<actual v3 attempt id>"}
}
\`\`\`

The angle-bracket placeholders above are **illustrative**; construct the actual
immutable object using the API, never hand-author/fill or infer values.

### APIs — Learning, AI4, AI5 and AI6

\`\`\`js
import {
  getAcademyExerciseMapping,
  findAcademyQuestionByExerciseId,
  createAcademyProvenance,
  validateAcademyProvenance,
  validateAcademyProvenanceBatch,
  resolveAcademyProvenance,
  submitAcademyAnswer, toPublicQuestion, getLessonPublic
} from './src/academy/index.js';

// AI5 chooses a real questionRef from listQuestionRefs(); never sends answerKey to UI.
const questionRef={questionId:'academy-q-001',questionVersion:'1.0.0'};
const mapping=getAcademyExerciseMapping(questionRef);
const back=findAcademyQuestionByExerciseId(mapping.legacyExerciseId);
// back is proof of a bank fixture, NOT proof that a historical attempt belonged to a lesson.

// After official grading, submitAcademyAnswer additionally returns provenance.
// AI6 must FIRST persist \`record\` through legacy v3 storage and read it back:
const {record,recordRef,gradingResult,provenance} =
  submitAcademyAnswer(questionRef,chosenTile,{durationMs:1000,timestamp:new Date().toISOString()});

// AI4 then receives the *durably read back* official record from archive:v3:
validateAcademyProvenance(provenance,storedRecord); // true or throw (fail closed)
// Sidecar persist/readback and revalidation belong EXCLUSIVELY to AI4.
const restored=resolveAcademyProvenance(parsedSidecarLink,reloadedCanonicalV3Record);
const questionPublic=toPublicQuestion(restored.questionRef);
const lessonPublic=getLessonPublic(restored.lessonRef.lessonId);
\`\`\`

\`validateAcademyProvenance\` requires the **actual** v3 record and verifies it
with the official v3 validator, then checks the exact original Exercise replay,
question version, source ID, lesson's questionRefs, ruleRef, generator seed/index/
version, scorer, scoringVersion and SkillTag registry. It compares the complete
provenance object by JSON structural content (key order irrelevant). A fake
question alias, stale score version, missing archive record or unknown contract
version fails closed.

\`validateAcademyProvenanceBatch(links,canonicalArchiveV3Records)\` is a pure
idempotent readback validator: duplicate IDENTICAL RecordRef links collapse to
one, conflicting links and missing records are rejected. Multiple real attempts
at one exercise remain separate by distinct RecordRef IDs.

### Storage contract for AI4 (not implemented in Learning)

- The **original v3 archive remains authoritative** for full attempts; existing
  \`tw-mahjong-trainer:archive:v3\` and \`session:v1\` must remain byte-for-byte
  untouched by provenance association.
- AI4 owns durable sidecar persistence. Prefer a **namespaced, versioned**
  \`extensions['learning.provenance']\` within its
  \`tw-mahjong-master-academy:state:v1\`, containing ordered links with
  \`provenanceVersion\`. AI4 must add strict structural/semantic validation,
  migration handling, idempotence and length limits; do NOT silently add
  unrecognized top-level fields to the V1 contract.
- Write sequence: official v3 record → archive:v3 write/readback → Learning
  \`createAcademyProvenance\` or \`submitAcademyAnswer(...).provenance\` → AI4
  sidecar persist/readback → \`validateAcademyProvenanceBatch\` with the
  independently reloaded canonical archive. On any error keep prior bytes and
  mark the curriculum link unavailable; do not invent links on reload.
- Group \`ReviewPlan\` / \`buildAnswerableCatalog\` with
  \`provenance.questionRef\` **only for successfully validated links**. For other
  legacy records continue to use the existing
  \`{questionId:exerciseId,questionVersion:'legacy-exercise-v3'}\` fallback.
  Don't duplicate attempts in AbilityProfile or confuse replayable v3 task
  mapping with completed curriculum Lessons.
- Learning's test \`tests/academy/provenance.test.js\` simulates an independent
  JSON sidecar readback and validates it against the original archive record;
  this proves serialized mapping, **not** that AI4's production sidecar/review
  has been updated. Full UI resume and refresh remain integration gates.

### Stable lookup and invariants

- 20 Lessons, 100 unchanged question IDs/seeds, 16 SkillTags, four ErrorTypes.
- No scenario scorer is registered; unsupported scenario still fails closed.
- \`getAcademyExerciseMapping\` returns immutable deep-frozen metadata without
  answerKey, and the reverse map is built only from 100 replayed canonical
  Exercise v3 fixtures, rejecting collisions and unknown IDs.
- No contract/source migration, no modified legacy grading or historical
  attempt data.
