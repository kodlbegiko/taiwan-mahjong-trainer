/** Public Learning Academy API for AI4 (adaptive), AI5 (UI), AI6 (integration). */
export { CONTRACT_VERSION,SCHEMA_VERSION,SKILL_TAGS,ERROR_TYPES,LEGACY_ERROR_TO_SKILLS,
  getSkillTag,getErrorType,validateTaxonomy } from './registry.js';
export { LEVELS,LESSONS,listLessons,getLessonPublic,validateLessons } from './lessons.js';
export { ACADEMY_QUESTION_VERSION,QUESTION_REFS } from './catalog.js';
export { listQuestionRefs,toPublicQuestion,listPublicQuestions,gradeAcademyQuestion,
  submitAcademyAnswer } from './questions.js';
export { createAcademyDecisionRecord,validateAcademyDecisionRecord,toRecordRef } from './records.js';
export { VERIFIED_SCENARIO_SCORER_COUNT } from './scenario-scorers.js';
export {
  ACADEMY_PROVENANCE_VERSION, getAcademyExerciseMapping,
  findAcademyQuestionByExerciseId, createAcademyProvenance,
  validateAcademyProvenance, validateAcademyProvenanceBatch,
  resolveAcademyProvenance,
} from './provenance.js';

export { ACADEMY_CONTENT_AUDIT_VERSION, auditAcademyContent } from './content-audit.js';
