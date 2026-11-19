import {
  V1, ABILITY_ALGORITHM_VERSION, requireId, requireUtc, requireObject,
  validateRegistry, uniqueRefs, recordKey,
} from './core.js';
import { normalizeRecordEntries, makeRecordRef } from './records.js';

const MIN_ESTIMATE_ATTEMPTS = 5;

function mappedTags(entry, registry, registryById) {
  let ids = [];
  if (entry.kind === 'academy-v1') {
    // The semantic scoring validator has already checked the Academy record.
    ids = entry.record.skillTagIds;
  } else {
    // Only explicit, Learning Academy-approved mappings. Never guess from error strings.
    const mapping = registry.legacyMappings;
    if (mapping) {
      requireObject(mapping, 'registry.legacyMappings');
      ids.push(...(mapping.taskTypes?.[entry.record.taskType] ?? []));
      for (const error of entry.record.errorTypes) ids.push(...(mapping.errorTypes?.[error] ?? []));
    }
  }
  if (!Array.isArray(ids) || ids.some(x => typeof x !== 'string')) throw new RangeError('Invalid explicit SkillTag mapping');
  const distinct = [...new Set(ids)].sort();
  for (const id of distinct) {
    const tag = registryById.get(id);
    if (!tag || tag.status === 'retired' && entry.kind === 'academy-v1') {
      throw new RangeError('Unknown/retired scored SkillTag: ' + id);
    }
  }
  return distinct;
}

/**
 * Fully reconstructible, deterministic reducer. Only validated scored records
 * become evidence; legacy session:v1 aggregates cannot yield per-question tags.
 * Assessment identities are supplied explicitly by an independent held-out set.
 */
export function buildAbilityProfile({
  records = [], registry, asOf, profileId = 'local-academy-profile',
  legacySessions = [], assessmentRefs = [], validateAcademyDecisionRecord,
} = {}) {
  requireId(profileId, 'profileId');
  const updatedAt = requireUtc(asOf);
  const byTag = validateRegistry(registry);
  if (!Array.isArray(legacySessions)) throw new TypeError('legacySessions must be an array');
  for (const session of legacySessions) {
    requireObject(session, 'legacy session');
    if (!['perfect', 'acceptable', 'improve'].includes(session.grade) ||
      !Number.isFinite(session.seconds) || session.seconds < 0 ||
      !Number.isFinite(Date.parse(session.date))) throw new RangeError('Invalid historical v1 aggregate');
  }
  const normalized = normalizeRecordEntries(records, { validateAcademyDecisionRecord });
  if (normalized.some(x => Date.parse(x.record.timestamp) > Date.parse(updatedAt))) {
    throw new RangeError('Future record cannot be used in an asOf ability snapshot');
  }
  const assessment = new Set();
  for (const ref of assessmentRefs) {
    if (!ref || !['legacy-v3', 'academy-v1'].includes(ref.kind)) throw new RangeError('Invalid assessment RecordRef');
    requireId(ref.id);
    assessment.add(recordKey(ref));
  }
  const buckets = new Map([...byTag.keys()].sort().map(tagId => [tagId, {
    tagId, attempts: 0, correct: 0, scoreSum: 0, totalDuration: 0,
    evidenceRefs: [], questionIds: new Set(), practiceAttempts: 0,
    assessmentAttempts: 0, unseenAssessmentAttempts: 0,
    contaminatedAssessmentAttempts: 0, assessmentQuestionIds: new Set(),
  }]));
  const seenPracticeQuestions = new Set(), seenAssessmentQuestions = new Set();
  for (const entry of normalized) {
    const ref = makeRecordRef(entry.kind, entry.record);
    const questionKey = entry.kind === 'academy-v1'
      ? entry.record.questionRef.questionId + '@' + entry.record.questionRef.questionVersion
      : entry.record.exerciseId + '@legacy-exercise-v3';
    const isAssessment = assessment.has(recordKey(ref));
    const trulyUnseen = isAssessment && !seenPracticeQuestions.has(questionKey) &&
      !seenAssessmentQuestions.has(questionKey);
    const tags = mappedTags(entry, registry, byTag);
    for (const tagId of tags) {
      const bucket = buckets.get(tagId);
      bucket.attempts++;
      bucket.scoreSum += entry.record.score;
      if (entry.record.score === 1) bucket.correct++;
      bucket.totalDuration += entry.record.durationMs;
      bucket.evidenceRefs.push(ref);
      const questionId = entry.kind === 'academy-v1' ? entry.record.questionRef.questionId : entry.record.exerciseId;
      bucket.questionIds.add(questionId);
      if (isAssessment) {
        bucket.assessmentAttempts++;
        if (trulyUnseen) bucket.unseenAssessmentAttempts++;
        else bucket.contaminatedAssessmentAttempts++;
        bucket.assessmentQuestionIds.add(questionId);
      } else bucket.practiceAttempts++;
    }
    if (isAssessment) seenAssessmentQuestions.add(questionKey);
    else seenPracticeQuestions.add(questionKey);
  }
  const skills = [...buckets.values()].map(bucket => {
    const n = bucket.attempts;
    const mean = n ? bucket.scoreSum / n : null;
    // Distribution-free conservative bounds on bounded [0,1] score means.
    const margin = n ? Math.sqrt(Math.log(40) / (2 * n)) : 1;
    return {
      tagId: bucket.tagId, attempts: n, correct: bucket.correct,
      scoreSum: bucket.scoreSum, meanDurationMs: n ? bucket.totalDuration / n : null,
      evidenceRefs: uniqueRefs(bucket.evidenceRefs),
      estimatedProficiency: n >= MIN_ESTIMATE_ATTEMPTS && bucket.questionIds.size >= 3 ? mean : null,
      uncertainty: { low: n ? Math.max(0, mean - margin) : 0, high: n ? Math.min(1, mean + margin) : 1 },
    };
  });
  return {
    ...V1, profileId, updatedAt,
    algorithmVersion: ABILITY_ALGORITHM_VERSION, calibrationStatus: 'uncalibrated',
    skills, sourceRecordRefs: uniqueRefs(normalized.map(x => makeRecordRef(x.kind, x.record))),
    policyVersion: 'explicit-registry-evidence/1.0.0',
    legacyImported: legacySessions.length > 0,
    extensions: { 'adaptive.evidence': {
      legacyAggregateCount: legacySessions.length,
      unmappedRecordCount: normalized.filter(x => mappedTags(x, registry, byTag).length === 0).length,
      skillBreakdown: [...buckets.values()].map(b => ({
        tagId: b.tagId, practiceAttempts: b.practiceAttempts,
        assessmentAttempts: b.assessmentAttempts,
        unseenAssessmentAttempts: b.unseenAssessmentAttempts,
        contaminatedAssessmentAttempts: b.contaminatedAssessmentAttempts,
        uniqueQuestionCount: b.questionIds.size,
        assessmentQuestionCount: b.assessmentQuestionIds.size, humanCalibrated: false,
      })),
    } },
  };
}
/** Explicit non-mutating recompute API; removal/repair is handled by rebuilding from raw entries. */
export function applyEvidence({ records, ...rest }) {
  return buildAbilityProfile({ records, ...rest });
}
export function toAbilityPublic(profile) {
  requireObject(profile, 'AbilityProfile');
  return {
    schemaVersion: profile.schemaVersion, contractVersion: profile.contractVersion,
    profileId: profile.profileId, updatedAt: profile.updatedAt,
    calibrationStatus: profile.calibrationStatus,
    skills: profile.skills.map(skill => ({
      tagId: skill.tagId, attempts: skill.attempts, correct: skill.correct,
      meanScore: skill.attempts ? skill.scoreSum / skill.attempts : null,
      meanDurationMs: skill.meanDurationMs,
      estimatedProficiency: skill.estimatedProficiency,
      uncertainty: skill.uncertainty,
      evidenceRefs: skill.evidenceRefs,
    })),
    evidenceBreakdown: profile.extensions?.['adaptive.evidence'] ?? null,
  };
}
