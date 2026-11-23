/**
 * Reproducible Academy curriculum QA. This is a content/fixture audit,
 * NEVER a learner progress log, a certification, or a new score authority.
 * No answer keys or arbitrary GameState/PlayerView enter its public output.
 */
import { BANK_SPEC } from './catalog.js';
import { LESSONS, validateLessons } from './lessons.js';
import { getSkillTag, validateTaxonomy, CONTRACT_VERSION, SCHEMA_VERSION } from './registry.js';
import { getFullQuestion, getCanonicalExercise, validateAcademyQuestion } from './question-internal.js';
import { gradeAcademyQuestion } from './questions.js';
import { replayExercise } from '../training/exercises.js';

export const ACADEMY_CONTENT_AUDIT_VERSION = 'academy-content-audit/1.0.0';

// These are independently required release gates. Neither 100 valid structural
// exercises nor a validated lesson definition can satisfy strategy/scoring QA.
const UNPUBLISHED_GATES = Object.freeze({
  'academy-l4-01': ['public-visible-tile-fixtures-missing', 'independent-visible-count-review-missing'],
  'academy-l4-02': ['verified-open-meld-actions-missing', 'scenario-scorer-missing'],
  'academy-l4-03': ['validated-round-timing-and-risk-model-missing', 'scenario-scorer-missing'],
  'academy-l4-04': ['verified-tai-scoring-profile-missing', 'speed-value-tradeoff-fixtures-missing'],
  'academy-l5-01': ['multi-factor-strategy-fixtures-missing', 'scenario-scorer-missing'],
  'academy-l5-02': ['mastery-level-difficulty-calibration-missing', 'independent-editorial-review-missing'],
  'academy-l5-03': ['explanation-rubric-and-human-review-missing'],
  'academy-l5-04': ['integrated-master-challenge-fixtures-missing', 'scenario-scorer-missing']
});

const expectedDifficulty = ['beginner','intermediate','advanced'];
const key = ref => ref.questionId + '@' + ref.questionVersion;
const sorted = values => [...new Set(values)].sort();

function checkQuestion(spec) {
  const q = getFullQuestion(spec.questionId);
  validateAcademyQuestion(q);
  const exercise = getCanonicalExercise(spec.questionId);
  replayExercise(exercise);
  if(q.questionVersion!==spec.questionVersion || q.lessonRef.lessonId!==spec.lessonId ||
     q.taskType!==spec.taskType || q.generator.seed!==spec.seed ||
     q.generator.index!==spec.index || q.source.snapshotRef!==exercise.id ||
     q.answerKey.scoringVersion!==exercise.answerRules.version ||
     q.answerKey.correctnessBasis!=='exact' || q.status!=='validated')
    throw new RangeError('Academy source / scoring provenance mismatch');
  const d=exercise.estimatedDifficulty;
  if(!d || !expectedDifficulty.includes(d.label) || !d.method ||
     d.humanValidated!==false || exercise.requestedLevel!==spec.legacyLevel)
    throw new RangeError('Exercise difficulty is missing or claims human calibration');
  const available = new Set(exercise.answer.optimalTiles ?? exercise.answer.expectedTiles);
  if(available.size===0)throw new RangeError('Question has no accepted answer');
  if([...available].some(t=>!q.prompt.options.includes(String(t))))
    throw new RangeError('Accepted answer outside legal options');
  let representativeGrade=null;
  if(q.taskType==='discard') {
    const best=exercise.answer.ranking[0];
    const tieSet=exercise.answer.ranking.filter(x=>
      x.shanten===best.shanten&&x.copies===best.copies).map(x=>x.tile);
    if(JSON.stringify(sorted(tieSet))!==JSON.stringify(sorted([...available])))
      throw new RangeError('One or more equally optimal discard choices are rejected');
    // Check EACH optimum independently, not just the first answer in the key.
    for(const tile of available) {
      const graded=gradeAcademyQuestion({questionId:q.questionId,questionVersion:q.questionVersion},tile);
      if(graded.grade!=='perfect'||graded.score!==1 ||
         graded.scoringVersion!==exercise.answerRules.version)
        throw new RangeError('Tied optimal discard was not scored perfectly');
      representativeGrade??=graded;
    }
  } else {
    const graded=gradeAcademyQuestion({questionId:q.questionId,questionVersion:q.questionVersion},[...available]);
    if(graded.grade!=='perfect'||graded.score!==1 ||
       graded.scoringVersion!==exercise.answerRules.version)
      throw new RangeError('Complete winning-tile set was not scored perfectly');
    representativeGrade=graded;
  }
  const explanation=representativeGrade?.explanation;
  if(!explanation || explanation.correctnessBasis!=='exact' ||
     typeof explanation.primaryReason!=='string' || explanation.primaryReason.length<25 ||
     typeof explanation.answerSummary!=='string' || !explanation.answerSummary ||
     !Array.isArray(explanation.alternatives) ||
     !Array.isArray(explanation.conditionalStrategy) ||
     explanation.conditionalStrategy.length===0 ||
     explanation.evidence?.exerciseId!==exercise.id ||
     explanation.evidence?.ruleVersion!==exercise.ruleVersion ||
     explanation.evidence?.scoringVersion!==exercise.answerRules.version)
    throw new RangeError('Post-grade explanation has missing or stale replay evidence');
  return {
    questionRef:{questionId:q.questionId,questionVersion:q.questionVersion},
    lessonId:q.lessonRef.lessonId,taskType:q.taskType,
    source:'canonical-legacy-exercise-v3',
    scoringVersion:exercise.answerRules.version,
    requestedSamplingLevel:exercise.requestedLevel,
    estimatedDifficulty:{label:d.label,method:d.method,humanValidated:false},
    visibleTileCount:q.prompt.visibleTiles.length,
    acceptedAnswerCount:available.size, // Count only; never publish answer tiles.
    answerPolicy:q.taskType==='discard'?'all-min-shanten-max-ukeire-ties':'exact-winning-tile-set',
    skillTagIds:[...q.skillTagIds],
    structuralValidation:'pass'
  };
}

/**
 * Declarative status and actual assessment are separate dimensions.
 * "published" means accessible content, NOT proof of learner proficiency.
 * Failing question fixtures are reported, never silently counted as verified.
 */
export function auditAcademyContent() {
  validateTaxonomy();
  validateLessons(LESSONS,new Set(BANK_SPEC.map(key)));
  const questionRows=[], failures=[];
  const byType={}, byDifficulty={}, bySample={};
  const uniqueShapes=new Set(), seenIds=new Set();
  for(const spec of BANK_SPEC) {
    try{
      const row=checkQuestion(spec);
      if(seenIds.has(key(row.questionRef)))throw new RangeError('Duplicate question version');
      seenIds.add(key(row.questionRef));
      const q=getFullQuestion(spec.questionId);
      const shape=q.taskType+'|'+q.prompt.legacyHand.join(',')+'|'+q.prompt.visibleTiles.join(',');
      if(uniqueShapes.has(shape))throw new RangeError('Duplicate hand/visibility and task');
      uniqueShapes.add(shape);
      questionRows.push(row);
      byType[row.taskType]=(byType[row.taskType]??0)+1;
      byDifficulty[row.estimatedDifficulty.label]=(byDifficulty[row.estimatedDifficulty.label]??0)+1;
      bySample[row.requestedSamplingLevel]=(bySample[row.requestedSamplingLevel]??0)+1;
    }catch(error){
      failures.push({questionId:spec.questionId,message:String(error.message)});
    }
  }
  const lessonRows=LESSONS.map(lesson=>{
    const questions=questionRows.filter(q=>q.lessonId===lesson.lessonId);
    const assessed=sorted(questions.flatMap(q=>q.skillTagIds));
    const gaps=lesson.skillTagIds.filter(tag=>!assessed.includes(tag));
    const blockers=[...(UNPUBLISHED_GATES[lesson.lessonId]??[])];
    // Do not collapse "reviewed structure" into "editorially verified teaching".
    if(gaps.length)blockers.push('lesson-objectives-not-covered-by-scored-skills');
    if(questions.length!==lesson.questionRefs.length)blockers.push('fixture-validation-incomplete');
    return {
      lessonRef:{lessonId:lesson.lessonId,lessonVersion:lesson.lessonVersion},
      titleZhTW:lesson.titleZhTW,
      status:lesson.status,
      assessmentScope:'closed-hand-structural-only',
      lessonShapeValidated:true,
      questionCount:lesson.questionRefs.length,
      verifiedQuestionCount:questions.length,
      taskTypes:sorted(questions.map(q=>q.taskType)),
      assessedSkillTagIds:assessed,
      unassessedObjectiveTagIds:gaps,
      experimentalObjectiveTagIds:lesson.skillTagIds.filter(id=>getSkillTag(id)?.scope!=='exact-structural'),
      publicationBlockers:sorted(blockers),
      // A separate independent editorial decision is needed even when
      // structural fixtures pass. This is NOT an auto-publish flag.
      statusChangeApproved:false
    };
  });
  return {
    schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION,
    auditVersion:ACADEMY_CONTENT_AUDIT_VERSION,
    authority:'canonical-v3-decision-records-only',
    createsLearningEvidence:false,
    curriculum:{totalLessons:LESSONS.length,published:lessonRows.filter(x=>x.status==='published').length,
      validated:lessonRows.filter(x=>x.status==='validated').length,
      draft:lessonRows.filter(x=>x.status==='draft').length,
      fullyAssessedObjectives:lessonRows.filter(x=>x.unassessedObjectiveTagIds.length===0).length},
    bank:{totalQuestions:BANK_SPEC.length,structurallyVerified:questionRows.length,
      failed:failures.length,uniqueShapes:uniqueShapes.size,
      byTaskType:byType,byEstimatedDifficulty:byDifficulty,bySamplingLevel:bySample,
      tiedDiscardQuestions:questionRows.filter(x=>x.taskType==='discard'&&x.acceptedAnswerCount>1).length,
      withPublicVisibleTiles:questionRows.filter(x=>x.visibleTileCount>0).length,
      humanCalibratedQuestions:0},
    lessonRows,questionRows,failures
  };
}
