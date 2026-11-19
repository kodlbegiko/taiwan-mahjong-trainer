import test from 'node:test';
import assert from 'node:assert/strict';
import { shanten, analyzeDiscards, improvingDraws } from '../src/shanten.js';
import { generateHand, rankDiscards, gradeAnswer } from '../src/practice.js';
import { explainDiscard } from '../src/analysis/explain.js';
import { createExercise, validateExercise } from '../src/training/exercises.js';
import { createDecisionRecord, validateDecisionRecord } from '../src/training/records.js';

const hand17 = [0,0,0,0,1,2,9,10,11,18,19,20,27,27,27,28,28];
const quad16 = [27,27,27,27,28,28,28,28,29,29,29,29,30,30,30,30];

test('P0 Q-001: 16-tile four-quad honors exact shanten is 4', () => {
  assert.equal(shanten(quad16), 4);
});

test('P0 Q-002: canonical ranking must exclude just-discarded physical tile', () => {
  const oldShape = rankDiscards(hand17);
  const canonical = analyzeDiscards(hand17);
  assert.deepEqual(oldShape, canonical, 'practice ranking must equal corrected core candidate analysis');
  assert.equal(oldShape.find(row => row.tile === 0).copies, 6);
});

test('P0 I-003: explanations and graded answers must agree on per-discard metrics and best status', () => {
  const ranking = rankDiscards(hand17);
  for (const tile of new Set(hand17)) {
    const explained = explainDiscard(hand17, tile);
    const picked = ranking.find(row => row.tile === tile);
    const score = gradeAnswer(ranking, tile);
    assert.equal(explained.selected.metrics.shanten, picked.shanten, 'shanten mismatch for tile '+tile);
    assert.equal(explained.selected.metrics.kinds, picked.kinds, 'kinds mismatch for tile '+tile);
    assert.equal(explained.selected.metrics.copies, picked.copies, 'copies mismatch for tile '+tile);
    assert.deepEqual(
      explained.selected.metrics.draws.map(({tile,count})=>({tile,count})),
      picked.draws,
      'draws mismatch for tile '+tile,
    );
    assert.equal(
      explained.decision.grade === 'optimal',
      score.grade === 'perfect',
      'teaching and grading disagree on optimality for tile '+tile,
    );
  }
});

test('v0.1 synchronous imports and result shape remain usable in integrated branch', () => {
  let seed = 2654435761;
  const rng = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const generated = generateHand('beginner', rng);
  assert.equal(generated.length, 17);
  const rank = rankDiscards(generated);
  assert.ok(rank.length > 0);
  assert.deepEqual(Object.keys(gradeAnswer(rank,rank[0].tile)), ['grade','title','best','answer']);
  assert.equal(typeof improvingDraws(generated.slice(1)).copies,'number');
});

test('v2 exercise can deterministically score and validate a decision record', () => {
  const opts={seed:'integration-20261119', index:0,taskType:'discard',level:'beginner'};
  const a=createExercise(opts), b=createExercise(opts);
  assert.deepEqual(a,b);
  assert.equal(validateExercise(a),true);
  const chosen=a.answer.optimalTiles[0];
  const record=createDecisionRecord(a,chosen,{durationMs:1200,timestamp:'2026-11-19T00:00:00.000Z',attemptId:'integration-attempt-1'});
  assert.equal(validateDecisionRecord(record),true);
  assert.equal(record.grade,'perfect');
});
