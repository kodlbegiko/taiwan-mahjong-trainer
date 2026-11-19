import { createSeededRandom } from '../training/random.js';
import { replayExercise } from '../training/exercises.js';
import {
  V1, SESSION_ALGORITHM_VERSION, requireV1, requireUtc, requireId,
  requireObject, stableId, canonicalJson, localDayKey, uniqueRefs,
} from './core.js';
import { normalizeRecordEntries } from './records.js';

const MINUTES = [10, 20, 30, 60];
const SECTIONS = ['weakness-review', 'focused-practice', 'mixed-practice', 'mistake-recap'];
const LEGACY_QUESTION_VERSION = 'legacy-exercise-v3';
const clone = value => JSON.parse(JSON.stringify(value));

/**
 * Explicitly validate all answerable sources. Academy questions require an
 * independently injected question validator, never a naked 'available' flag.
 */
export function buildAnswerableCatalog({
  records = [], questionCatalog = [], validateAcademyDecisionRecord,
  validateAcademyQuestion,
} = {}) {
  const normalized = normalizeRecordEntries(records, { validateAcademyDecisionRecord });
  const candidates = [];
  for (const entry of normalized) {
    if (entry.kind !== 'legacy-v3') continue;
    const exercise = entry.record.exerciseSnapshot;
    try { replayExercise(exercise); } catch { continue; }
    candidates.push({
      questionId: exercise.id, questionVersion: LEGACY_QUESTION_VERSION,
      taskType: exercise.taskType, ruleRef: {
        profileId: 'legacy-exercise-v3', ruleVersion: exercise.ruleVersion,
      }, seed: exercise.seed, generatorVersion: exercise.generatorVersion,
      source: 'legacy-exercise-v3', available: true, estimatedMinutes: 3,
      questionSnapshot: exercise,
    });
  }
  for (const item of questionCatalog) {
    requireObject(item, 'catalog entry');
    if (item.available !== true) continue;
    if (item.source === 'legacy-exercise-v3') {
      try {
        replayExercise(item.questionSnapshot);
        if (item.questionId !== item.questionSnapshot.id ||
          item.questionVersion !== LEGACY_QUESTION_VERSION) continue;
      } catch { continue; }
    } else if (item.source === 'academy-v1') {
      const question = item.questionSnapshot;
      if (!question || question.status !== 'validated' ||
        typeof validateAcademyQuestion !== 'function' ||
        validateAcademyQuestion(question) !== true ||
        question.questionId !== item.questionId ||
        question.questionVersion !== item.questionVersion ||
        !['discard', 'tenpai', 'multi_wait', 'scenario'].includes(question.taskType) ||
        question.answerKey?.correctnessBasis === 'unverified') continue;
    } else continue;
    if (!Number.isSafeInteger(item.estimatedMinutes) || item.estimatedMinutes < 1 || item.estimatedMinutes > 60) continue;
    candidates.push(item);
  }
  const unique = new Map();
  for (const candidate of candidates) {
    const key = candidate.questionId + '@' + candidate.questionVersion;
    const meta = {
      questionId: candidate.questionId, questionVersion: candidate.questionVersion,
      taskType: candidate.taskType, ruleRef: candidate.ruleRef,
      seed: candidate.seed, generatorVersion: candidate.generatorVersion,
      source: candidate.source, available: true,
      estimatedMinutes: candidate.estimatedMinutes,
    };
    requireId(meta.questionId); requireId(meta.questionVersion);
    requireId(meta.seed); requireId(meta.generatorVersion);
    requireObject(meta.ruleRef, 'ruleRef');
    requireId(meta.ruleRef.profileId); requireId(meta.ruleRef.ruleVersion);
    if (!['discard', 'tenpai', 'multi_wait', 'scenario'].includes(meta.taskType)) throw new RangeError('Unknown task');
    if (unique.has(key) && canonicalJson(unique.get(key)) !== canonicalJson(meta)) {
      throw new RangeError('Conflicting question versions');
    }
    unique.set(key, meta);
  }
  return [...unique.values()].sort((a, b) =>
    a.questionId.localeCompare(b.questionId) || a.questionVersion.localeCompare(b.questionVersion));
}

/** Select only verified, replayable source questions; no simulated Bot or placeholder scenario. */
export function planDailyTraining({
  profile, reviewPlan, records = [], questionCatalog = [],
  validateAcademyDecisionRecord, validateAcademyQuestion,
  minutes = 30, seed, asOf, ruleRef,
} = {}) {
  requireV1(profile, 'AbilityProfile');
  requireV1(reviewPlan, 'ReviewPlan');
  if (profile.profileId !== reviewPlan.profileId) throw new RangeError('Profile/review mismatch');
  if (!MINUTES.includes(minutes)) throw new RangeError('Supported minutes: 10, 20, 30, 60');
  requireId(String(seed ?? ''), 'seed');
  const generatedAsOf = requireUtc(asOf);
  const catalog = buildAnswerableCatalog({
    records, questionCatalog, validateAcademyDecisionRecord, validateAcademyQuestion,
  });
  if (ruleRef !== undefined) {
    requireObject(ruleRef, 'ruleRef');
    requireId(ruleRef.profileId); requireId(ruleRef.ruleVersion);
  }
  const selectedRule = ruleRef ?? catalog[0]?.ruleRef;
  if (!selectedRule) throw new RangeError('No known replayable RuleRef; cannot plan a fake session');
  const allowed = catalog.filter(q => canonicalJson(q.ruleRef) === canonicalJson(selectedRule));
  const available = new Map(allowed.map(q => [q.questionId + '@' + q.questionVersion, q]));
  const today = localDayKey(generatedAsOf, reviewPlan.settings.timezone);
  const due = reviewPlan.items.filter(item =>
    available.has(item.questionId + '@' + item.questionVersion) &&
    localDayKey(item.dueAt, reviewPlan.settings.timezone) <= today &&
    !item.reasonCodes.some(r => r.startsWith('unavailable:')));
  const weakTags = profile.skills.filter(s => s.attempts > 0).sort((a, b) =>
    a.scoreSum / a.attempts - b.scoreSum / b.attempts || a.tagId.localeCompare(b.tagId))
    .slice(0, 3).map(x => x.tagId);
  const shuffled = [...allowed];
  const random = createSeededRandom(String(seed) + '|' + generatedAsOf + '|' + profile.profileId);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = [], used = new Set();
  let budget = minutes;
  const add = (entry, section) => {
    const id = entry.questionId + '@' + entry.questionVersion;
    if (used.has(id) || entry.estimatedMinutes > budget) return false;
    used.add(id); budget -= entry.estimatedMinutes;
    chosen.push({ ...entry, section });
    return true;
  };
  const targets = {
    'weakness-review': Math.ceil(minutes * 0.3),
    'focused-practice': Math.ceil(minutes * 0.3),
    'mixed-practice': Math.ceil(minutes * 0.25),
    'mistake-recap': minutes,
  };
  const pick = (list, section, target) => {
    let spent = 0;
    for (const q of list) {
      if (spent >= target) break;
      if (add(q, section)) spent += q.estimatedMinutes;
    }
  };
  pick(due.filter(q => q.skillTagIds.some(tag => weakTags.includes(tag)))
    .map(q => available.get(q.questionId + '@' + q.questionVersion)), SECTIONS[0], targets[SECTIONS[0]]);
  pick(shuffled.filter(q => due.some(d => d.questionId === q.questionId && d.skillTagIds.some(t => weakTags.includes(t)))),
    SECTIONS[1], targets[SECTIONS[1]]);
  pick(shuffled, SECTIONS[2], targets[SECTIONS[2]]);
  pick(due.filter(q => q.reasonCodes.includes('recent-mistake') || q.reasonCodes.includes('repeated-error'))
    .map(q => available.get(q.questionId + '@' + q.questionVersion)), SECTIONS[3], targets[SECTIONS[3]]);
  // A short bank is an honest short session. No duplicate or fictitious exercises.
  pick(shuffled, SECTIONS[2], budget);
  const questionRefs = chosen.map(({ questionId, questionVersion }) => ({ questionId, questionVersion }));
  const session = {
    ...V1,
    sessionId: stableId('session', profile.profileId, generatedAsOf, String(seed), String(minutes),
      questionRefs.map(q => q.questionId + '@' + q.questionVersion).join(',')),
    profileId: profile.profileId, ruleRef: clone(selectedRule), status: 'planned',
    questionRefs, recordRefs: [], seed: String(seed),
    generatorVersions: [...new Set(chosen.map(q => q.generatorVersion))].sort(),
    source: 'academy', reviewPlanRef: reviewPlan.planId,
    extensions: { 'adaptive.plan': {
      algorithmVersion: SESSION_ALGORITHM_VERSION, asOf: generatedAsOf, minutes,
      unallocatedMinutes: budget, orderedSources: chosen.map(q => ({
        questionId: q.questionId, questionVersion: q.questionVersion,
        section: q.section, source: q.source, seed: q.seed,
        generatorVersion: q.generatorVersion, estimatedMinutes: q.estimatedMinutes,
      })),
    } },
  };
  return { session, sections: SECTIONS.map(name => ({
    name, questions: chosen.filter(q => q.section === name).map(x => ({
      questionId: x.questionId, questionVersion: x.questionVersion, source: x.source,
    })),
  })), availableQuestionCount: allowed.length };
}
export function transitionTrainingSession(session, nextStatus, { at, recordRefs = [], reason } = {}) {
  requireV1(session, 'TrainingSession');
  const next = {
    planned: ['active', 'aborted'], active: ['completed', 'aborted'], completed: [], aborted: [],
  };
  if (!next[session.status]?.includes(nextStatus)) throw new RangeError('Illegal session status transition');
  const time = requireUtc(at);
  if (!Array.isArray(recordRefs)) throw new TypeError('recordRefs must be an array');
  const updated = clone(session);
  updated.status = nextStatus;
  updated.recordRefs = uniqueRefs([...session.recordRefs, ...recordRefs]);
  if (nextStatus === 'active') updated.startedAt = time;
  if (['completed', 'aborted'].includes(nextStatus)) {
    updated.endedAt = time;
    if (session.startedAt && time < session.startedAt) throw new RangeError('End before start');
    if (nextStatus === 'aborted') updated.statusReason = reason ?? 'user-aborted';
  }
  return updated;
}
