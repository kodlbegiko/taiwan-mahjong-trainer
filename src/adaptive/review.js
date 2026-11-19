import { buildReviewQueue } from '../training/progress.js';
import { replayExercise } from '../training/exercises.js';
import {
  V1, DEFAULT_TIMEZONE, REVIEW_ALGORITHM_VERSION, requireUtc, requireId, requireV1, canonicalJson,
  requireTimezone, localDayKey, addLocalCalendarDays, stableId, uniqueRefs, recordKey,
} from './core.js';
import { makeRecordRef, normalizeRecordEntries } from './records.js';

function questionRef(entry) {
  return entry.kind === 'legacy-v3'
    ? { questionId: entry.record.exerciseId, questionVersion: 'legacy-exercise-v3' }
    : { ...entry.record.questionRef };
}
function questionKey(ref) { return ref.questionId + '@' + ref.questionVersion; }
function categoryTags(profile, refs) {
  const keys = new Set(refs.map(recordKey));
  return profile.skills.filter(skill => skill.evidenceRefs.some(ref => keys.has(recordKey(ref))))
    .map(skill => skill.tagId).sort();
}
function stepScenario(prior, entry) {
  // Equivalent documented SM-2-inspired transition for a non-v3 record; not a calibrated memory model.
  const score = entry.record.score;
  const success = score >= 0.8;
  const repetitions = success ? (prior?.repetitions ?? 0) + 1 : 0;
  const lapses = (prior?.lapses ?? 0) + (success ? 0 : 1);
  const ease = Math.max(1.3, Math.min(3, (prior?.ease ?? 2.5) + (success ? 0.1 : -0.2)));
  const intervalDays = success
    ? repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round((prior?.intervalDays ?? 0) * ease))
    : 1;
  return { repetitions, lapses, ease, intervalDays, lastScore: score };
}
function replayableLegacy(snapshot) {
  try { replayExercise(snapshot); return true; } catch { return false; }
}

/**
 * All items remain inspectable, including not-yet-due and unavailable questions.
 * reasonCodes includes "unavailable:*" when replay cannot be provided.
 * Date comparisons for "today" use local calendar days, not UTC day numbers.
 */
export function buildReviewPlan({
  profile, records = [], asOf, timezone = DEFAULT_TIMEZONE, dailyLimit = 20,
  questionCatalog = [], reservedQuestionRefs = [],
  validateAcademyDecisionRecord, validateAcademyQuestion,
} = {}) {
  requireV1(profile, 'AbilityProfile');
  requireId(profile.profileId, 'profileId');
  const generatedAsOf = requireUtc(asOf);
  requireTimezone(timezone);
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 10000) throw new RangeError('Invalid dailyLimit');
  if (!Array.isArray(questionCatalog)) throw new TypeError('questionCatalog must be an array');
  if (!Array.isArray(reservedQuestionRefs)) throw new TypeError('reservedQuestionRefs must be an array');
  const reserved = new Set(reservedQuestionRefs.map(q => {
    requireId(q?.questionId); requireId(q?.questionVersion);
    return q.questionId + '@' + q.questionVersion;
  }));
  const catalog = new Map();
  for (const question of questionCatalog) {
    requireId(question.questionId, 'questionId'); requireId(question.questionVersion, 'questionVersion');
    const key = questionKey(question);
    if (catalog.has(key)) throw new RangeError('Duplicate catalog question');
    catalog.set(key, question);
  }
  const normalized = normalizeRecordEntries(records, { validateAcademyDecisionRecord });
  if (normalized.some(x => Date.parse(x.record.timestamp) > Date.parse(generatedAsOf))) {
    throw new RangeError('Future record cannot be used in an asOf review snapshot');
  }
  const groups = new Map();
  for (const entry of normalized) {
    const qref = questionRef(entry);
    const key = questionKey(qref);
    if (!groups.has(key)) groups.set(key, { qref, entries: [], refs: [] });
    const group = groups.get(key);
    group.entries.push(entry);
    group.refs.push(makeRecordRef(entry.kind, entry.record));
  }
  const legacy = normalized.filter(x => x.kind === 'legacy-v3').map(x => x.record);
  const queue = new Map(buildReviewQueue(legacy, { asOf: generatedAsOf, includeNotDue: true })
    .map(x => [x.exerciseId, x]));
  const today = localDayKey(generatedAsOf, timezone);
  const items = [];
  for (const group of groups.values()) {
    const attempts = group.entries;
    const first = attempts[0];
    const recent = attempts.at(-1);
    let state;
    if (first.kind === 'legacy-v3') {
      const legacyState = queue.get(first.record.exerciseId);
      state = { repetitions: legacyState.repetitions, lapses: legacyState.lapses,
        intervalDays: legacyState.intervalDays, lastScore: legacyState.lastScore };
    } else {
      state = null;
      for (const entry of attempts) state = stepScenario(state, entry);
    }
    const dueAt = addLocalCalendarDays(recent.record.timestamp, state.intervalDays, timezone);
    const tags = categoryTags(profile, group.refs);
    const sourceRecordRefs = uniqueRefs(group.refs);
    const catalogEntry = catalog.get(questionKey(group.qref));
    // Legacy snapshots can replay without Academy's as-yet-unmerged question bank.
    const available = !reserved.has(questionKey(group.qref)) && (first.kind === 'legacy-v3'
      ? replayableLegacy(recent.record.exerciseSnapshot) && catalogEntry?.available !== false
      : catalogEntry?.available === true && catalogEntry.taskType === 'scenario' &&
        catalogEntry.questionSnapshot?.status === 'validated' &&
        catalogEntry.questionSnapshot.questionId === group.qref.questionId &&
        catalogEntry.questionSnapshot.questionVersion === group.qref.questionVersion &&
        canonicalJson(catalogEntry.questionSnapshot.ruleRef) === canonicalJson(recent.record.ruleRef) &&
        canonicalJson([...(catalogEntry.questionSnapshot.skillTagIds ?? [])].sort()) ===
          canonicalJson([...recent.record.skillTagIds].sort()) &&
        catalogEntry.questionSnapshot.answerKey?.correctnessBasis !== 'unverified' &&
        typeof validateAcademyQuestion === 'function' &&
        validateAcademyQuestion(catalogEntry.questionSnapshot) === true);
    const isDue = localDayKey(dueAt, timezone) <= today;
    const reasons = [];
    if (isDue) reasons.push('due');
    if (state.lapses) reasons.push('repeated-error');
    if (recent.record.score < 0.8) reasons.push('recent-mistake');
    if (state.repetitions >= 3) reasons.push('interval-extended');
    if (reserved.has(questionKey(group.qref))) reasons.push('unavailable:held-out');
    else if (!available) reasons.push(first.kind === 'legacy-v3' ?
      'unavailable:legacy-replay' : 'unavailable:question-catalog');
    const priority = (isDue ? 100 : 0) + Math.min(state.lapses, 10) * 20 +
      (recent.record.score < 0.8 ? 15 : 0) + (state.repetitions === 0 ? 5 : 0);
    items.push({
      ...group.qref, skillTagIds: tags, dueAt, priority,
      sourceRecordRefs, reasonCodes: reasons,
    });
  }
  items.sort((a, b) => b.priority - a.priority || a.dueAt.localeCompare(b.dueAt) ||
    a.questionId.localeCompare(b.questionId) || a.questionVersion.localeCompare(b.questionVersion));
  return {
    ...V1, planId: stableId('review', profile.profileId, generatedAsOf, timezone, canonicalJson(items)),
    profileId: profile.profileId, generatedAsOf, algorithmVersion: REVIEW_ALGORITHM_VERSION,
    items, settings: { dailyLimit, timezone }, method: 'sm2-inspired',
    calibrationStatus: profile.calibrationStatus,
  };
}
export function getTodayRecommendation(profile, reviewPlan, asOf) {
  requireV1(profile, 'AbilityProfile'); requireV1(reviewPlan, 'ReviewPlan');
  const day = localDayKey(asOf, reviewPlan.settings.timezone);
  const available = reviewPlan.items.filter(x =>
    !x.reasonCodes.some(r => r.startsWith('unavailable:')) &&
    localDayKey(x.dueAt, reviewPlan.settings.timezone) <= day);
  const due = available.slice(0, reviewPlan.settings.dailyLimit);
  const weakSkills = profile.skills.filter(x => x.attempts > 0)
    .sort((a, b) => (a.estimatedProficiency ?? a.scoreSum / a.attempts) -
      (b.estimatedProficiency ?? b.scoreSum / b.attempts) || a.tagId.localeCompare(b.tagId));
  return {
    ...V1, generatedAsOf: requireUtc(asOf),
    dueQuestions: due.map(item => ({ ...item })),
    weakSkillTags: weakSkills.map(x => x.tagId),
    unknownSkillTags: profile.skills.filter(x => x.attempts === 0).map(x => x.tagId),
    unavailableCount: reviewPlan.items.filter(x => x.reasonCodes.some(r => r.startsWith('unavailable:'))).length,
    calibrationStatus: profile.calibrationStatus,
  };
}
