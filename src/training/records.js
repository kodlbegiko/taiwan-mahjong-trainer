import { toCounts } from '../tiles.js';
import { gradeAnswer } from '../practice.js';
import { EXERCISE_SCHEMA_VERSION, validateExercise } from './exercises.js';
import { hashSeed } from './random.js';

export const RECORD_SCHEMA_VERSION = 2;
const SCORES = { perfect: 1, acceptable: 0.5, improve: 0 };

function evaluate(exercise, choice) {
  if (exercise.taskType === 'discard') {
    if (!Number.isInteger(choice)) throw new TypeError('捨牌答案須為單張牌碼');
    const ranking = exercise.answer.ranking;
    const result = gradeAnswer(ranking, choice);
    return {
      grade: result.grade,
      score: SCORES[result.grade],
      errorTypes: result.grade === 'perfect' ? [] : result.grade === 'acceptable'
        ? ['lower-ukeire'] : ['higher-shanten'],
      answerMetadata: {
        optimalTiles: [...exercise.answer.optimalTiles],
        chosenShanten: result.answer.shanten,
        bestShanten: result.best.shanten,
        chosenCopies: result.answer.copies,
        bestCopies: result.best.copies,
        ukeireLoss: result.best.copies - result.answer.copies,
        shantenLoss: result.answer.shanten - result.best.shanten,
      },
    };
  }
  if (!Array.isArray(choice)) throw new TypeError('聽牌答案須為牌碼陣列');
  toCounts(choice); // Also reject invalid tile codes.
  if (new Set(choice).size !== choice.length) throw new RangeError('聽張選項不可重複');
  const target = exercise.answer.expectedTiles;
  const selected = [...choice].sort((a, b) => a - b);
  const missed = target.filter(tile => !selected.includes(tile));
  const extra = selected.filter(tile => !target.includes(tile));
  const correct = selected.length - extra.length;
  const union = target.length + extra.length;
  const score = union ? correct / union : 0;
  return {
    grade: missed.length === 0 && extra.length === 0 ? 'perfect' : score >= 0.5 ? 'acceptable' : 'improve',
    score,
    errorTypes: [...(missed.length ? ['missed-winning-tile'] : []), ...(extra.length ? ['false-winning-tile'] : [])],
    answerMetadata: {
      expectedTiles: [...target],
      missedTiles: missed,
      extraTiles: extra,
      correctTiles: correct,
    },
  };
}

/** Pure function: time, duration, and optional distinct attemptId supplied by caller. */
export function createDecisionRecord(exercise, choice, { durationMs, timestamp, attemptId } = {}) {
  validateExercise(exercise, { verifyAnswers: false });
  if (!Number.isFinite(durationMs) || durationMs < 0) throw new RangeError('durationMs 必須是非負毫秒數');
  if (typeof timestamp !== 'string' || !Number.isFinite(Date.parse(timestamp))) throw new TypeError('timestamp 必須是 ISO 日期字串');
  if (attemptId !== undefined && (typeof attemptId !== 'string' || !attemptId)) throw new TypeError('attemptId 無效');
  const selected = Array.isArray(choice) ? [...choice].sort((a, b) => a - b) : choice;
  const result = evaluate(exercise, selected);
  const identity = `${exercise.id}|${timestamp}|${durationMs}|${JSON.stringify(selected)}`;
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    id: attemptId ?? `dr2-${hashSeed(identity).toString(16).padStart(8, '0')}`,
    exerciseId: exercise.id,
    taskType: exercise.taskType,
    timestamp,
    durationMs,
    chosen: selected,
    grade: result.grade,
    score: result.score,
    errorTypes: result.errorTypes,
    answerMetadata: result.answerMetadata,
    algorithmVersion: exercise.algorithmVersion,
    scoringVersion: exercise.answerRules.version,
    exerciseSnapshot: JSON.parse(JSON.stringify(exercise)),
  };
}

export function validateDecisionRecord(record, { verifyAnswers = true } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('DecisionRecord 必須是物件');
  if (record.schemaVersion !== RECORD_SCHEMA_VERSION || typeof record.id !== 'string' || !record.id) throw new RangeError('不支援的 DecisionRecord');
  if (typeof record.timestamp !== 'string' || !Number.isFinite(Date.parse(record.timestamp)) ||
    !Number.isFinite(record.durationMs) || record.durationMs < 0) throw new RangeError('無效紀錄時間');
  if (!['perfect', 'acceptable', 'improve'].includes(record.grade) ||
    !Number.isFinite(record.score) || record.score < 0 || record.score > 1 ||
    !Array.isArray(record.errorTypes)) throw new RangeError('無效評分結果');
  validateExercise(record.exerciseSnapshot, { verifyAnswers });
  if (record.exerciseId !== record.exerciseSnapshot.id || record.taskType !== record.exerciseSnapshot.taskType ||
    record.algorithmVersion !== record.exerciseSnapshot.algorithmVersion || record.scoringVersion !== record.exerciseSnapshot.answerRules.version) {
    throw new RangeError('作答紀錄與題目版本不一致');
  }
  if (verifyAnswers) {
    const check = evaluate(record.exerciseSnapshot, record.chosen);
    if (record.score !== check.score || record.grade !== check.grade ||
      JSON.stringify(record.errorTypes) !== JSON.stringify(check.errorTypes) ||
      JSON.stringify(record.answerMetadata) !== JSON.stringify(check.answerMetadata)) {
      throw new RangeError('作答紀錄的評分資料不一致');
    }
  }
  return true;
}
