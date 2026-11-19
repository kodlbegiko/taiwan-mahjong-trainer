import {
  requireV1, requireObject, requireId, requireUtc, requireTimezone,
  recordKey, canonicalJson,
} from './core.js';
import { validateRecordRef } from './records.js';

function intAtLeast(n, low, name) {
  if (!Number.isSafeInteger(n) || n < low) throw new RangeError('Invalid ' + name);
}
function finite(n, name, low = 0, high = Infinity) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < low || n > high)
    throw new RangeError('Invalid ' + name);
}
function refs(refs, name) {
  if (!Array.isArray(refs)) throw new TypeError(name + ' must be RecordRef[]');
  const keys = new Set();
  for (const ref of refs) {
    validateRecordRef(ref);
    const key = recordKey(ref);
    if (keys.has(key)) throw new RangeError('Duplicate RecordRef in ' + name);
    keys.add(key);
  }
  return keys;
}
function ids(values, name) {
  if (!Array.isArray(values)) throw new TypeError(name + ' must be string[]');
  const seen = new Set();
  for (const value of values) {
    requireId(value, name);
    if (seen.has(value)) throw new RangeError('Duplicate value in ' + name);
    seen.add(value);
  }
}
export function validateAbilityProfile(profile) {
  requireV1(profile, 'AbilityProfile');
  requireId(profile.profileId, 'profileId');
  requireUtc(profile.updatedAt, 'updatedAt');
  requireId(profile.algorithmVersion, 'algorithmVersion');
  requireId(profile.policyVersion, 'policyVersion');
  if (!['uncalibrated', 'human-calibrated'].includes(profile.calibrationStatus) ||
    typeof profile.legacyImported !== 'boolean' || !Array.isArray(profile.skills)) {
    throw new RangeError('Invalid AbilityProfile header');
  }
  const sources = refs(profile.sourceRecordRefs, 'sourceRecordRefs');
  const tags = new Set();
  for (const skill of profile.skills) {
    requireObject(skill, 'AbilityProfile skill');
    requireId(skill.tagId, 'tagId');
    if (tags.has(skill.tagId)) throw new RangeError('Duplicate ability tag');
    tags.add(skill.tagId);
    intAtLeast(skill.attempts, 0, 'attempts');
    intAtLeast(skill.correct, 0, 'correct');
    if (skill.correct > skill.attempts) throw new RangeError('correct exceeds attempts');
    finite(skill.scoreSum, 'scoreSum', 0, skill.attempts + 1e-9);
    if (skill.meanDurationMs !== null) finite(skill.meanDurationMs, 'meanDurationMs');
    if (skill.attempts === 0 && skill.meanDurationMs !== null ||
      skill.attempts > 0 && skill.meanDurationMs === null) {
      throw new RangeError('Invalid empty/nonempty duration');
    }
    if (skill.estimatedProficiency !== null) finite(skill.estimatedProficiency, 'estimatedProficiency', 0, 1);
    if (skill.uncertainty !== undefined) {
      requireObject(skill.uncertainty, 'uncertainty');
      finite(skill.uncertainty.low, 'uncertainty.low', 0, 1);
      finite(skill.uncertainty.high, 'uncertainty.high', 0, 1);
      if (skill.uncertainty.low > skill.uncertainty.high) throw new RangeError('Reversed uncertainty');
    }
    const evidence = refs(skill.evidenceRefs, 'skill.evidenceRefs');
    if (evidence.size !== skill.attempts ||
      [...evidence].some(ref => !sources.has(ref))) throw new RangeError('Skill evidence provenance mismatch');
  }
  return true;
}
export function validateReviewPlan(plan) {
  requireV1(plan, 'ReviewPlan');
  requireId(plan.planId, 'planId'); requireId(plan.profileId, 'profileId');
  requireUtc(plan.generatedAsOf, 'generatedAsOf');
  requireId(plan.algorithmVersion, 'algorithmVersion');
  requireObject(plan.settings, 'ReviewPlan.settings');
  intAtLeast(plan.settings.dailyLimit, 0, 'dailyLimit');
  requireTimezone(plan.settings.timezone);
  if (!['rules-based', 'sm2-inspired'].includes(plan.method) ||
    !['uncalibrated', 'human-calibrated'].includes(plan.calibrationStatus) ||
    !Array.isArray(plan.items)) throw new RangeError('Invalid ReviewPlan');
  const items = new Set();
  for (const item of plan.items) {
    requireObject(item, 'ReviewPlan item');
    requireId(item.questionId, 'questionId');
    requireId(item.questionVersion, 'questionVersion');
    const key = item.questionId + '@' + item.questionVersion;
    if (items.has(key)) throw new RangeError('Duplicate review item');
    items.add(key);
    ids(item.skillTagIds, 'skillTagIds');
    requireUtc(item.dueAt, 'dueAt');
    intAtLeast(item.priority, 0, 'priority');
    refs(item.sourceRecordRefs, 'review sourceRecordRefs');
    ids(item.reasonCodes, 'reasonCodes');
  }
  return true;
}
export function validateTrainingSession(session) {
  requireV1(session, 'TrainingSession');
  requireId(session.sessionId, 'sessionId');
  requireId(session.profileId, 'profileId');
  requireObject(session.ruleRef, 'ruleRef');
  requireId(session.ruleRef.profileId, 'ruleRef.profileId');
  requireId(session.ruleRef.ruleVersion, 'ruleRef.ruleVersion');
  if (!['planned', 'active', 'completed', 'aborted'].includes(session.status) ||
    !['academy', 'legacy-migrated'].includes(session.source)) throw new RangeError('Unknown TrainingSession state/source');
  if (!Array.isArray(session.questionRefs)) throw new TypeError('questionRefs must be an array');
  const seen = new Set();
  for (const question of session.questionRefs) {
    requireObject(question, 'questionRef');
    requireId(question.questionId, 'questionId');
    requireId(question.questionVersion, 'questionVersion');
    const key = question.questionId + '@' + question.questionVersion;
    if (seen.has(key)) throw new RangeError('Duplicate questionRef');
    seen.add(key);
  }
  const recordKeys = refs(session.recordRefs, 'session.recordRefs');
  if (session.status === 'planned' && recordKeys.size > 0) throw new RangeError('Planned session cannot claim attempts');
  requireId(session.seed, 'seed');
  ids(session.generatorVersions, 'generatorVersions');
  if (session.startedAt !== undefined) requireUtc(session.startedAt, 'startedAt');
  if (session.endedAt !== undefined) requireUtc(session.endedAt, 'endedAt');
  if (session.status === 'planned' && (session.startedAt !== undefined || session.endedAt !== undefined) ||
    session.status === 'active' && (session.startedAt === undefined || session.endedAt !== undefined) ||
    session.status === 'completed' && (session.startedAt === undefined || session.endedAt === undefined) ||
    session.status === 'aborted' && session.endedAt === undefined) {
    throw new RangeError('Missing or invalid status timestamps');
  }
  if (session.startedAt !== undefined && session.endedAt !== undefined &&
    Date.parse(session.endedAt) < Date.parse(session.startedAt)) throw new RangeError('Session ended before start');
  if (session.abilityProfileBeforeRef !== undefined || session.abilityProfileAfterRef !== undefined) {
    requireId(session.abilityProfileBeforeRef, 'abilityProfileBeforeRef');
    requireId(session.abilityProfileAfterRef, 'abilityProfileAfterRef');
  }
  if (session.reviewPlanRef !== undefined) requireId(session.reviewPlanRef, 'reviewPlanRef');
  if (session.statusReason !== undefined) requireId(session.statusReason, 'statusReason');
  return true;
}
