import { validateDecisionRecord } from './records.js';

const DAY = 86_400_000;

/** Human-unvalidated task/difficulty labels are kept separate from performance. */
export function summarizeWeaknesses(records) {
  if (!Array.isArray(records)) throw new TypeError('records 必須是陣列');
  const byTask = {};
  const byError = {};
  let totalScore = 0, totalDurationMs = 0, perfect = 0;
  for (const record of records) {
    validateDecisionRecord(record, { verifyAnswers: false });
    const task = byTask[record.taskType] ??= { attempts: 0, perfect: 0, totalScore: 0, durationMs: 0 };
    task.attempts++; task.totalScore += record.score; task.durationMs += record.durationMs;
    if (record.grade === 'perfect') { perfect++; task.perfect++; }
    for (const error of record.errorTypes) byError[error] = (byError[error] ?? 0) + 1;
    totalScore += record.score;
    totalDurationMs += record.durationMs;
  }
  const taskMetrics = Object.fromEntries(Object.entries(byTask).map(([key, value]) => [key, {
    attempts: value.attempts,
    perfectRate: value.perfect / value.attempts,
    meanScore: value.totalScore / value.attempts,
    meanDurationMs: value.durationMs / value.attempts,
  }]));
  return {
    attempts: records.length,
    perfectRate: records.length ? perfect / records.length : 0,
    meanScore: records.length ? totalScore / records.length : 0,
    meanDurationMs: records.length ? totalDurationMs / records.length : 0,
    byTask: taskMetrics,
    byError,
  };
}

/** Stateless SM-2-inspired scheduling: not an empirical memory/ability model. */
export function advanceReview(previous, record) {
  validateDecisionRecord(record, { verifyAnswers: false });
  const prior = previous ?? { repetitions: 0, intervalDays: 0, ease: 2.5, lapses: 0 };
  const score = record.score;
  const success = score >= 0.8;
  const repetitions = success ? prior.repetitions + 1 : 0;
  const lapses = prior.lapses + (success ? 0 : 1);
  const ease = Math.max(1.3, Math.min(3, prior.ease + (success ? 0.1 : -0.2)));
  const intervalDays = success
    ? repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(1, Math.round(prior.intervalDays * ease))
    : 1;
  const dueAt = new Date(Date.parse(record.timestamp) + intervalDays * DAY).toISOString();
  return { exerciseId: record.exerciseId, repetitions, intervalDays, ease, lapses, dueAt, lastScore: score };
}

/** Replay ordered attempts per exercise. asOf is explicit for deterministic tests. */
export function buildReviewQueue(records, { asOf, includeNotDue = false } = {}) {
  if (typeof asOf !== 'string' || !Number.isFinite(Date.parse(asOf))) throw new TypeError('asOf 日期不可省略');
  if (!Array.isArray(records)) throw new TypeError('records 必須是陣列');
  const sorted = [...records].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
  const latest = new Map();
  for (const record of sorted) {
    const prev = latest.get(record.exerciseId);
    if (prev && Date.parse(record.timestamp) < Date.parse(prev.lastAttemptAt)) throw new Error('紀錄排序錯誤');
    const advanced = advanceReview(prev, record);
    latest.set(record.exerciseId, { ...advanced, lastAttemptAt: record.timestamp });
  }
  return [...latest.values()]
    .filter(item => includeNotDue || Date.parse(item.dueAt) <= Date.parse(asOf))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.exerciseId.localeCompare(b.exerciseId));
}
