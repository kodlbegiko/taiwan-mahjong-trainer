import { validateExercise } from '../training/exercises.js';
import { validateDecisionRecord } from '../training/records.js';

export const ARCHIVE_SCHEMA_VERSION = 2;
export const ARCHIVE_FORMAT = 'taiwan-mahjong-training-archive';
export const LEGACY_SESSION_KEY = 'tw-mahjong-trainer:session:v1';
export const ARCHIVE_STORAGE_KEY = 'tw-mahjong-trainer:archive:v2';
const MAX_JSON_LENGTH = 20 * 1024 * 1024;
const MAX_ENTRIES = 10000;

export function emptyArchive() {
  return { format: ARCHIVE_FORMAT, schemaVersion: ARCHIVE_SCHEMA_VERSION, exercises: [], records: [], legacySessions: [] };
}

function isLegacyEntry(entry) {
  return entry && typeof entry === 'object' && !Array.isArray(entry) &&
    ['perfect', 'acceptable', 'improve'].includes(entry.grade) &&
    Number.isFinite(entry.seconds) && entry.seconds >= 0 &&
    ['beginner', 'intermediate', 'advanced'].includes(entry.difficulty) &&
    typeof entry.date === 'string' && Number.isFinite(Date.parse(entry.date));
}

function legacySessions(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES || !entries.every(isLegacyEntry)) {
    throw new RangeError('舊版 session:v1 資料格式不正確');
  }
  // Preserve rather than invent missing hand / exercise ID / chosen tile.
  return entries.map(({ grade, seconds, difficulty, date }) => ({ grade, seconds, difficulty, date }));
}

export function validateArchive(archive, { verifyAnswers = true } = {}) {
  if (!archive || typeof archive !== 'object' || Array.isArray(archive) ||
    archive.schemaVersion !== ARCHIVE_SCHEMA_VERSION || archive.format !== ARCHIVE_FORMAT) {
    throw new RangeError('不支援的訓練資料封存格式');
  }
  if (![archive.exercises, archive.records, archive.legacySessions].every(Array.isArray)) {
    throw new TypeError('exercises、records、legacySessions 必須為陣列');
  }
  if ([archive.exercises, archive.records, archive.legacySessions].some(list => list.length > MAX_ENTRIES)) {
    throw new RangeError('封存資料項目數超出上限');
  }
  const exerciseById = new Map();
  for (const exercise of archive.exercises) {
    validateExercise(exercise, { verifyAnswers });
    if (exerciseById.has(exercise.id)) throw new RangeError('題目 ID 重複');
    exerciseById.set(exercise.id, exercise);
  }
  const recordIds = new Set();
  for (const record of archive.records) {
    validateDecisionRecord(record, { verifyAnswers });
    if (recordIds.has(record.id)) throw new RangeError('作答 ID 重複');
    if (exerciseById.has(record.exerciseId)) {
      const saved = exerciseById.get(record.exerciseId);
      if (JSON.stringify(saved) !== JSON.stringify(record.exerciseSnapshot)) throw new RangeError('紀錄題目與題庫快照衝突');
    }
    recordIds.add(record.id);
  }
  legacySessions(archive.legacySessions);
  return true;
}

/** Explicit v1 -> v2 migration. Unknown future versions are rejected, not downgraded. */
export function migrateArchive(input) {
  if (Array.isArray(input)) return { ...emptyArchive(), legacySessions: legacySessions(input) };
  if (!input || typeof input !== 'object') throw new TypeError('封存資料必須為 JSON 物件或舊版陣列');
  if (input.schemaVersion === 1) {
    const sessions = input.sessions ?? input.stats;
    return { ...emptyArchive(), legacySessions: legacySessions(sessions) };
  }
  if (input.schemaVersion !== ARCHIVE_SCHEMA_VERSION) throw new RangeError('未知的 schemaVersion，不能直接匯入');
  validateArchive(input);
  return structuredClonePortable(input);
}

function structuredClonePortable(obj) { return JSON.parse(JSON.stringify(obj)); }

export function importTrainingJSON(json) {
  if (typeof json !== 'string' || json.length > MAX_JSON_LENGTH) throw new RangeError('JSON 文字超出限制或類型不正確');
  return migrateArchive(JSON.parse(json));
}

export function exportTrainingJSON(archive) {
  validateArchive(archive);
  const json = JSON.stringify(archive, null, 2);
  if (json.length > MAX_JSON_LENGTH) throw new RangeError('JSON 匯出大小超過限制');
  return json;
}

export function mergeArchives(existing, incoming) {
  validateArchive(existing);
  validateArchive(incoming);
  const merged = emptyArchive();
  for (const type of ['exercises', 'records']) {
    const entries = new Map();
    for (const item of [...existing[type], ...incoming[type]]) {
      if (entries.has(item.id) && JSON.stringify(entries.get(item.id)) !== JSON.stringify(item)) {
        throw new RangeError(`${type} 中存在相同 ID 的不同資料`);
      }
      entries.set(item.id, item);
    }
    merged[type] = [...entries.values()];
  }
  // Legacy sessions lack stable per-answer IDs; retain both without deduplicating.
  merged.legacySessions = [...existing.legacySessions, ...incoming.legacySessions];
  validateArchive(merged);
  return merged;
}
