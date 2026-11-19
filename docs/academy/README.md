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
