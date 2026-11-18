import { createDecisionRecord } from '../training/records.js';
import {
  ARCHIVE_STORAGE_KEY, V2_ARCHIVE_STORAGE_KEY, LEGACY_SESSION_KEY, emptyArchive, exportTrainingJSON,
  importTrainingJSON, mergeArchives, migrateArchive, validateArchive,
} from './archive.js';

/**
 * Optional browser adapter. Core generation and scoring work without storage.
 * No window/document access or network dependency during module import.
 */
export function createLocalTrainingStore(storage = null, {
  key = ARCHIVE_STORAGE_KEY,
  legacyKey = LEGACY_SESSION_KEY,
  v2Key = V2_ARCHIVE_STORAGE_KEY,
} = {}) {
  let memory = null;
  function load() {
    if (memory) return JSON.parse(JSON.stringify(memory));
    try {
      const current = storage?.getItem(key);
      if (current) memory = importTrainingJSON(current);
      else {
        const oldV2 = storage?.getItem(v2Key);
        const oldV1 = storage?.getItem(legacyKey);
        memory = oldV2 ? importTrainingJSON(oldV2)
          : oldV1 ? migrateArchive(JSON.parse(oldV1)) : emptyArchive();
        // A v2 archive could have been created independently without importing v1 stats.
        // Avoid overwriting either key; import the old sessions only if none were carried over.
        if (oldV2 && oldV1 && memory.legacySessions.length === 0) {
          memory.legacySessions = migrateArchive(JSON.parse(oldV1)).legacySessions;
        }
      }
    } catch {
      // Browsers can deny storage; malformed existing data stays untouched.
      memory = emptyArchive();
    }
    return JSON.parse(JSON.stringify(memory));
  }
  function save(archive) {
    validateArchive(archive);
    memory = JSON.parse(JSON.stringify(archive));
    try { storage?.setItem(key, exportTrainingJSON(memory)); }
    catch { /* Session still works in memory if private mode / quota fail. */ }
    return load();
  }
  function addDecision(exercise, choice, options) {
    const archive = load();
    const record = createDecisionRecord(exercise, choice, options);
    if (archive.records.some(item => item.id === record.id)) throw new RangeError('作答 ID 已存在，請提供不同 attemptId');
    const known = archive.exercises.find(item => item.id === exercise.id);
    if (known && JSON.stringify(known) !== JSON.stringify(exercise)) throw new RangeError('同 ID 的題目資料不一致');
    if (!known) archive.exercises.push(exercise);
    archive.records.push(record);
    save(archive);
    return record;
  }
  function importJSON(json, { merge = false } = {}) {
    const incoming = importTrainingJSON(json);
    return save(merge ? mergeArchives(load(), incoming) : incoming);
  }
  return { load, save, addDecision, importJSON, exportJSON: () => exportTrainingJSON(load()) };
}
