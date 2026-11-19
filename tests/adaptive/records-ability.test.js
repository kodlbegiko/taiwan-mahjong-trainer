import test from 'node:test';
import assert from 'node:assert/strict';
import { createExercise } from '../../src/training/exercises.js';
import { createDecisionRecord } from '../../src/training/records.js';
import {
  V1, buildAbilityProfile, normalizeRecordEntries, makeRecordRef,
  validateScoredRecord, toAbilityPublic, validateAcademyRecordShape,
} from '../../src/adaptive/index.js';

const registry = {
  skills: [
    { schemaVersion: 1, contractVersion: 'master-academy/1.0.0', tagId: 'waits.enumeration',
      labelZhTW: '聽牌進張', scope: 'exact-structural', prerequisiteTagIds: [], status: 'active' },
    { schemaVersion: 1, contractVersion: 'master-academy/1.0.0', tagId: 'efficiency.ukeire',
      labelZhTW: '進張效率', scope: 'exact-structural', prerequisiteTagIds: [], status: 'active' },
    { schemaVersion: 1, contractVersion: 'master-academy/1.0.0', tagId: 'strategy.risk-awareness',
      labelZhTW: '風險觀念', scope: 'strategy-heuristic', prerequisiteTagIds: [], status: 'active' },
  ],
  legacyMappings: {
    taskTypes: { tenpai: ['waits.enumeration'], multi_wait: ['waits.enumeration'] },
    errorTypes: { 'missed-winning-tile': ['waits.enumeration'] },
  },
};
const at = '2026-11-19T03:00:00.000Z';
const exercise = createExercise({ seed: 'adaptive-evidence-fixture', taskType: 'multi_wait' });
const good = createDecisionRecord(exercise, exercise.answer.expectedTiles, {
  attemptId: 'good', timestamp: '2026-11-17T03:00:00Z', durationMs: 1500,
});
const bad = createDecisionRecord(exercise, [], {
  attemptId: 'bad', timestamp: '2026-11-18T03:00:00Z', durationMs: 2000,
});
const asEntry = record => ({ kind: 'legacy-v3', record });
function profile(records, extra = {}) {
  return buildAbilityProfile({ records, registry, asOf: at, ...extra });
}
function scenario(overrides = {}) {
  return {
    schemaVersion: 1, contractVersion: 'master-academy/1.0.0',
    id: 'sc-1', questionRef: { questionId: 'q-1', questionVersion: '1.0' },
    ruleRef: { profileId: 'r-1', ruleVersion: 'v-1' },
    scorerId: 'known-fixture', scoringVersion: 'known-v1', engineVersion: 'known-v1',
    sourceViewRef: { gameId: 'g1', viewId: 'v1', asOfEventSeq: 2, audienceSeat: 0 },
    chosenActionId: 'a1', legalActionIds: ['a1', 'a2'],
    timestamp: at, durationMs: 2000, grade: 'perfect', score: 1,
    errorTypeIds: [], skillTagIds: ['strategy.risk-awareness'],
    scoringEvidence: { basis: 'exact', fixtureId: 'golden-1', answerSnapshotDigest: 'sha256:fixed' },
    recordKind: 'academy-scenario', ...overrides,
  };
}
const fixtureValidator = (record) => record.scorerId === 'known-fixture' &&
  record.scoringVersion === 'known-v1' && record.scoringEvidence.fixtureId === 'golden-1' &&
  record.chosenActionId === 'a1' && record.score === 1 && record.grade === 'perfect';

test('new user: all ability estimates unknown, not zero or master', () => {
  const actual = profile([]);
  assert.equal(actual.calibrationStatus, 'uncalibrated');
  assert.equal(actual.skills.length, 3);
  assert(actual.skills.every(s => s.attempts === 0 && s.estimatedProficiency === null &&
    s.meanDurationMs === null && s.uncertainty.low === 0 && s.uncertainty.high === 1));
  assert.deepEqual(actual.sourceRecordRefs, []);
});
test('v1 aggregates remain separate, no fabricated tags or records', () => {
  const legacy = [{ grade: 'perfect', seconds: 2, date: at, difficulty: 'beginner' }];
  const actual = profile([], { legacySessions: legacy });
  assert.equal(actual.legacyImported, true);
  assert.equal(actual.extensions['adaptive.evidence'].legacyAggregateCount, 1);
  assert.equal(actual.skills[0].attempts, 0);
  assert.deepEqual(actual.sourceRecordRefs, []);
});
test('v3 records: canonical score, distinct question count and no double weight', () => {
  const actual = profile([asEntry(bad), asEntry(good), asEntry(bad)]);
  assert.deepEqual(actual.sourceRecordRefs.map(x => x.id), ['bad', 'good']);
  const skill = actual.skills.find(x => x.tagId === 'waits.enumeration');
  assert.equal(skill.attempts, 2);
  assert.equal(skill.correct, 1);
  assert.equal(skill.scoreSum, 1);
  assert.equal(skill.meanDurationMs, 1750);
  assert.equal(skill.evidenceRefs.length, 2);
  assert.equal(skill.estimatedProficiency, null);
  assert.equal(actual.extensions['adaptive.evidence'].skillBreakdown
    .find(x => x.tagId === 'waits.enumeration').uniqueQuestionCount, 1);
});
test('random order is deterministic; repeat record and same tag counted once', () => {
  const a = profile([asEntry(good), asEntry(bad), asEntry(good)]);
  const b = profile([asEntry(bad), asEntry(good)]);
  assert.deepEqual(a, b);
  const restored = profile([asEntry(good)]);
  assert.equal(restored.skills.find(x => x.tagId === 'waits.enumeration').attempts, 1);
});
test('conflicting duplicate ID, tampered v3 score and unsupported old v2 reject', () => {
  const altered = { ...good, durationMs: good.durationMs + 1 };
  assert.throws(() => profile([asEntry(good), asEntry(altered)]));
  assert.throws(() => profile([asEntry({ ...good, score: 0 })]));
  assert.throws(() => profile([asEntry({ ...good, schemaVersion: 2 })]));
});
test('missing explicit AI3 legacy map produces unknown, not inferred abilities', () => {
  const actual = profile([asEntry(bad)], { registry: { skills: registry.skills } });
  assert(actual.skills.every(s => s.attempts === 0));
  assert.equal(actual.extensions['adaptive.evidence'].unmappedRecordCount, 1);
  assert.equal(actual.sourceRecordRefs.length, 1);
});
test('scenario cannot masquerade as legacy v3 or bypass semantic scorer', () => {
  const record = scenario();
  assert.equal(validateAcademyRecordShape(record), true);
  assert.throws(() => validateScoredRecord(makeRecordRef('legacy-v3', record), record));
  assert.throws(() => validateScoredRecord(makeRecordRef('academy-v1', record), record));
  assert.throws(() => profile([{ kind: 'academy-v1', record }]));
  assert.throws(() => profile([{ kind: 'academy-v1', record: scenario({ score: 0.4 }) }],
    { validateAcademyDecisionRecord: fixtureValidator }));
  const goodProfile = profile([{ kind: 'academy-v1', record }],
    { validateAcademyDecisionRecord: fixtureValidator,
      assessmentRefs: [{ kind: 'academy-v1', id: record.id }] });
  const skill = goodProfile.skills.find(x => x.tagId === 'strategy.risk-awareness');
  assert.equal(skill.attempts, 1);
  assert.equal(goodProfile.extensions['adaptive.evidence'].skillBreakdown
    .find(x => x.tagId === skill.tagId).assessmentAttempts, 1);
});
test('invalid illegal action, bad version, unknown registry tags and stale question all reject', () => {
  const record = scenario();
  assert.throws(() => validateAcademyRecordShape(scenario({ chosenActionId: 'forged' })));
  assert.throws(() => validateAcademyRecordShape(scenario({ contractVersion: '2.0' })));
  assert.throws(() => profile([{ kind: 'academy-v1', record: scenario({ skillTagIds: ['unregistered'] }) }],
    { validateAcademyDecisionRecord: fixtureValidator }));
  const question = { schemaVersion: 1, contractVersion: 'master-academy/1.0.0',
    questionId: 'q-1', questionVersion: '1.0', status: 'unscorable', taskType: 'scenario',
    skillTagIds: ['strategy.risk-awareness'], ruleRef: record.ruleRef };
  assert.throws(() => validateScoredRecord(makeRecordRef('academy-v1', record), record,
    { question, validateAcademyDecisionRecord: fixtureValidator }));
});
test('independent held-out counts and public DTO keep calibration honest', () => {
  const refs = [{ kind: 'legacy-v3', id: good.id }];
  const actual = profile([asEntry(good), asEntry(bad)], { assessmentRefs: refs });
  const info = actual.extensions['adaptive.evidence'].skillBreakdown.find(x => x.tagId === 'waits.enumeration');
  assert.equal(info.assessmentAttempts, 1);
  assert.equal(info.practiceAttempts, 1);
  assert.equal(toAbilityPublic(actual).calibrationStatus, 'uncalibrated');
  assert.equal(toAbilityPublic(actual).skills.find(x => x.tagId === 'waits.enumeration').estimatedProficiency, null);
});
test('registry validates cycles, type mismatches and repeated SkillTag', () => {
  assert.throws(() => profile([], { registry: { skills: [...registry.skills, registry.skills[0]] } }));
  const a = { ...registry.skills[0], prerequisiteTagIds: ['efficiency.ukeire'] };
  const b = { ...registry.skills[1], prerequisiteTagIds: ['waits.enumeration'] };
  assert.throws(() => profile([], { registry: { skills: [a, b] } }));
});

test('five repeated answers to one question still cannot establish ability', () => {
  const attempts = Array.from({ length: 5 }, (_, i) => ({
    kind: 'legacy-v3',
    record: { ...good, id: 'repeat-' + i,
      timestamp: '2026-11-18T01:0' + i + ':00Z' },
  }));
  const result = profile(attempts);
  const score = result.skills.find(x => x.tagId === 'waits.enumeration');
  assert.equal(score.attempts, 5);
  assert.equal(score.estimatedProficiency, null);
  assert.equal(result.extensions['adaptive.evidence'].skillBreakdown
    .find(x => x.tagId === 'waits.enumeration').uniqueQuestionCount, 1);
});
