import { sortTiles, toCounts } from '../tiles.js';
import { shanten, improvingDraws } from '../shanten.js';
import { generateHand, gradeAnswer, rankDiscards } from '../practice.js';
import { createSeededRandom, GENERATOR_VERSION, hashSeed } from './random.js';
import { generateTenpaiHand, winningTiles } from './waits.js';

export const EXERCISE_SCHEMA_VERSION = 3;
export const LEGACY_EXERCISE_SCHEMA_VERSION = 2;
export const RULESET_VERSION = 'taiwan-16-standard-v1';
export const SCORING_VERSION = 'efficiency-v2';
export const LEGACY_SCORING_VERSION = 'efficiency-v1';
export const ALGORITHM_VERSION = 'five-meld-one-pair-v2-discard-visible';
export const LEGACY_ALGORITHM_VERSION = 'five-meld-one-pair-v1';
export const TASK_TYPES = Object.freeze(['discard', 'tenpai', 'multi_wait']);
const LEVELS = ['beginner', 'intermediate', 'advanced'];

function validateHand(hand, length, visible = []) {
  if (!Array.isArray(hand) || hand.length !== length) throw new RangeError(`手牌必須為 ${length} 張`);
  if (!Array.isArray(visible)) throw new TypeError('visibleTiles 必須是陣列');
  const owned = toCounts(hand);
  const seen = toCounts(visible);
  for (let i = 0; i < 34; i++) if (owned[i] + seen[i] > 4) throw new RangeError('手牌與已知明牌超過四張');
}

function measureDifficulty(type, ranking, wins) {
  // Synthetic labels only. NEVER assume these are calibrated against humans.
  const best = ranking?.[0];
  const estimate = type === 'discard'
    ? best.shanten <= 1 ? 'beginner' : best.shanten <= 3 ? 'intermediate' : 'advanced'
    : wins.length > 1 ? 'intermediate' : 'beginner';
  return {
    label: estimate,
    method: type === 'discard' ? 'min-discard-shanten-v1' : 'winning-tile-count-v1',
    humanValidated: false,
  };
}


/** Historical Q-002 ranking, retained ONLY to verify/replay persisted efficiency-v1
 *  snapshots. Never use this to score newly generated exercises. */
function legacyRankDiscards(hand17, visible = []) {
  if (!Array.isArray(hand17) || hand17.length !== 17) throw new RangeError('題目必須提供 17 張手牌');
  validateHand(hand17, 17, visible);
  return [...new Set(hand17)].map(tile => {
    const hand16 = [...hand17];
    hand16.splice(hand16.indexOf(tile), 1);
    return { tile, ...improvingDraws(hand16, visible) };
  }).sort((a, b) =>
    a.shanten - b.shanten || b.copies - a.copies || b.kinds - a.kinds || a.tile - b.tile
  );
}

function supportedSchema(version) {
  if (version !== EXERCISE_SCHEMA_VERSION && version !== LEGACY_EXERCISE_SCHEMA_VERSION) {
    throw new RangeError('不支援的 Exercise schemaVersion');
  }
  return version === LEGACY_EXERCISE_SCHEMA_VERSION;
}

function exerciseId(effectiveSeed, index, schemaVersion) {
  // ex2 IDs are intentionally preserved byte-for-byte; ex3 cannot alias ex2.
  return `ex${schemaVersion}-${hashSeed(effectiveSeed).toString(16).padStart(8, '0')}-${index}`;
}

/** Create one deterministic, fully scored exercise from a seed and stable index. */
export function createExercise({ seed, index = 0, taskType = 'discard', level = 'intermediate', visibleTiles = [], schemaVersion = EXERCISE_SCHEMA_VERSION } = {}) {
  const legacy = supportedSchema(schemaVersion);
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('index 必須是非負安全整數');
  if (!TASK_TYPES.includes(taskType)) throw new RangeError(`不支援的題型：${taskType}`);
  if (!LEVELS.includes(level)) throw new RangeError(`不支援的抽樣層級：${level}`);
  const seedString = String(seed);
  hashSeed(seed); // Reject missing, non-integer or empty seeds before use.
  toCounts(visibleTiles);
  const normalizedVisible = sortTiles(visibleTiles);
  const effectiveSeed = `${GENERATOR_VERSION}|${seedString}|${index}|${taskType}|${level}|${normalizedVisible.join(',')}`;
  const rng = createSeededRandom(effectiveSeed);
  let hand = null, wins = null;
  for (let attempts = 0; attempts < 100; attempts++) {
    const candidate = taskType === 'discard'
      ? generateHand(level, rng)
      : generateTenpaiHand(rng, { multiple: taskType === 'multi_wait' });
    try { validateHand(candidate, taskType === 'discard' ? 17 : 16, normalizedVisible); }
    catch (error) { if (!(error instanceof RangeError)) throw error; continue; }
    const candidateWins = taskType === 'discard' ? null : winningTiles(candidate, normalizedVisible);
    if (candidateWins && (candidateWins.length < (taskType === 'multi_wait' ? 2 : 1) || shanten(candidate) !== 0)) continue;
    hand = candidate; wins = candidateWins; break;
  }
  if (!hand) throw new RangeError('無法在目前明牌限制下產生合法題目');
  const ranking = taskType === 'discard'
    ? (legacy ? legacyRankDiscards(hand, normalizedVisible) : rankDiscards(hand, normalizedVisible)) : null;
  const answer = ranking ? {
    optimalTiles: ranking.filter(entry =>
      entry.shanten === ranking[0].shanten && entry.copies === ranking[0].copies
    ).map(entry => entry.tile).sort((a, b) => a - b),
    ranking: ranking.map(({ tile, shanten: distance, copies, kinds, draws }) =>
      ({ tile, shanten: distance, copies, kinds, draws })),
  } : { winningTiles: wins, expectedTiles: wins.map(entry => entry.tile) };
  const sampleSource = taskType !== 'discard' ? 'constructed-tenpai'
    : level === 'beginner' ? 'constructed-tenpai-plus-wall'
    : level === 'intermediate' ? 'meld-seeded-wall-rejection' : 'uniform-136-wall';

  return {
    schemaVersion,
    id: exerciseId(effectiveSeed, index, schemaVersion),
    seed: seedString,
    index,
    taskType,
    sampleSource,
    requestedLevel: level,
    estimatedDifficulty: measureDifficulty(taskType, ranking, wins),
    generatorVersion: GENERATOR_VERSION,
    ruleVersion: RULESET_VERSION,
    algorithmVersion: legacy ? LEGACY_ALGORITHM_VERSION : ALGORITHM_VERSION,
    hand: sortTiles(hand),
    visibleTiles: normalizedVisible,
    answerRules: taskType === 'discard'
      ? { version: legacy ? LEGACY_SCORING_VERSION : SCORING_VERSION, metric: 'min-shanten-then-max-ukeire-copies', acceptsTies: true }
      : { version: legacy ? LEGACY_SCORING_VERSION : SCORING_VERSION, metric: 'exact-winning-tile-set', acceptsTies: false },
    answer,
  };
}

/** Validate full answers, not just their JSON shape. */
export function validateExercise(exercise, { verifyAnswers = true } = {}) {
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) throw new TypeError('Exercise 必須是物件');
  const legacy = supportedSchema(exercise.schemaVersion);
  if (typeof exercise.id !== 'string' || !exercise.id) throw new TypeError('Exercise.id 不合法');
  if (!TASK_TYPES.includes(exercise.taskType)) throw new RangeError('未知題型');
  if (!Number.isSafeInteger(exercise.index) || exercise.index < 0 || !LEVELS.includes(exercise.requestedLevel)) throw new RangeError('無效題目索引或層級');
  hashSeed(exercise.seed);
  const identity = `${GENERATOR_VERSION}|${exercise.seed}|${exercise.index}|${exercise.taskType}|${exercise.requestedLevel}|${sortTiles(exercise.visibleTiles).join(',')}`;
  if (exercise.id !== exerciseId(identity, exercise.index, exercise.schemaVersion)) throw new RangeError('題目 ID 與種子不一致');
  if (exercise.ruleVersion !== RULESET_VERSION ||
      exercise.algorithmVersion !== (legacy ? LEGACY_ALGORITHM_VERSION : ALGORITHM_VERSION) ||
      exercise.generatorVersion !== GENERATOR_VERSION ||
      exercise.answerRules?.version !== (legacy ? LEGACY_SCORING_VERSION : SCORING_VERSION)) {
    throw new RangeError('不支援的規則、評分或演算法版本');
  }
  validateHand(exercise.hand, exercise.taskType === 'discard' ? 17 : 16, exercise.visibleTiles);
  if (!exercise.answer || typeof exercise.answer !== 'object') throw new TypeError('缺少答案');
  if (!exercise.estimatedDifficulty || exercise.estimatedDifficulty.humanValidated !== false) {
    throw new RangeError('缺少可核對的難度來源或錯誤宣稱已由真人驗證');
  }
  if (!verifyAnswers) return true;
  if (exercise.taskType === 'discard') {
    if (exercise.answerRules.metric !== 'min-shanten-then-max-ukeire-copies') throw new RangeError('評分指標不符');
    const ranked = legacy
      ? legacyRankDiscards(exercise.hand, exercise.visibleTiles)
      : rankDiscards(exercise.hand, exercise.visibleTiles);
    const expected = ranked.filter(x => gradeAnswer(ranked, x.tile).grade === 'perfect').map(x => x.tile).sort((a,b) => a-b);
    if (JSON.stringify(expected) !== JSON.stringify(exercise.answer.optimalTiles) ||
      JSON.stringify(ranked.map(({ tile, shanten: distance, copies, kinds, draws }) => ({ tile, shanten: distance, copies, kinds, draws }))) !== JSON.stringify(exercise.answer.ranking)) {
      throw new RangeError('捨牌答案與演算法結果不一致');
    }
  } else {
    if (exercise.answerRules.metric !== 'exact-winning-tile-set') throw new RangeError('評分指標不符');
    if (shanten(exercise.hand) !== 0) throw new RangeError('題目不是聽牌');
    const expected = winningTiles(exercise.hand, exercise.visibleTiles);
    if (expected.length < (exercise.taskType === 'multi_wait' ? 2 : 1) ||
      JSON.stringify(expected) !== JSON.stringify(exercise.answer.winningTiles) ||
      JSON.stringify(expected.map(x => x.tile)) !== JSON.stringify(exercise.answer.expectedTiles)) {
      throw new RangeError('胡牌張與獨立驗證不一致');
    }
  }
  return true;
}

/** Reconstruct any known exercise version and check all fields, including its answers. */
export function replayExercise(exercise) {
  validateExercise(exercise);
  const reconstructed = createExercise({
    seed: exercise.seed, index: exercise.index, taskType: exercise.taskType,
    level: exercise.requestedLevel, visibleTiles: exercise.visibleTiles,
    schemaVersion: exercise.schemaVersion,
  });
  if (JSON.stringify(reconstructed) !== JSON.stringify(exercise)) {
    throw new RangeError('Exercise 快照與 seed / 版本重播結果不一致');
  }
  return reconstructed;
}

/** Stable bank generation; no network and no wall-clock input. */
export function generateExerciseBank({ seed, count = 200, tasks = TASK_TYPES, levels = LEVELS, schemaVersion = EXERCISE_SCHEMA_VERSION } = {}) {
  hashSeed(seed);
  supportedSchema(schemaVersion);
  if (!Number.isInteger(count) || count < 1 || count > 5000) throw new RangeError('count 必須介於 1–5000');
  if (!Array.isArray(tasks) || !tasks.length || tasks.some(task => !TASK_TYPES.includes(task))) throw new RangeError('無效題型清單');
  if (!Array.isArray(levels) || !levels.length || levels.some(level => !LEVELS.includes(level))) throw new RangeError('無效層級清單');
  const exercises = [];
  for (let index = 0; index < count; index++) {
    exercises.push(createExercise({ seed, index, taskType: tasks[index % tasks.length], level: levels[index % levels.length], schemaVersion }));
  }
  return exercises;
}
