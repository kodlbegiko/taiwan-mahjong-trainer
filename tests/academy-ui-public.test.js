import test from 'node:test';
import assert from 'node:assert/strict';
import {createExercise} from '../src/training/exercises.js';
import {createDecisionRecord} from '../src/training/records.js';
import {emptyArchive, ARCHIVE_STORAGE_KEY} from '../src/storage/archive.js';
import {getAcademySnapshot,readLegacyArchive,ACADEMY_LESSONS,getScenarioLayoutFixture} from '../src/academy-ui/public-facade.js';
import {projectScenarioForUI} from '../src/academy-ui/scenario.js';

function storage(items) {
  const map = new Map(Object.entries(items));
  return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),data:map};
}
test('Academy adapter is read-only and uses canonical v3 evidence',()=>{
  const exercise=createExercise({seed:'academy-public-golden',index:0,taskType:'discard',level:'beginner'});
  const decision=createDecisionRecord(exercise,exercise.answer.optimalTiles[0],
    {durationMs:8500,timestamp:'2026-11-17T10:00:00.000Z',attemptId:'academy-v3-golden'});
  const raw=JSON.stringify({...emptyArchive(),exercises:[exercise],records:[decision]});
  const store=storage({[ARCHIVE_STORAGE_KEY]:raw});
  const snap=getAcademySnapshot(store,'2026-11-19T10:00:00.000Z');
  assert.equal(snap.stats.attempts,1);
  assert.equal(snap.stats.perfectRate,1);
  assert.equal(snap.review.length,1);
  assert.equal(snap.review[0].available,true);
  assert.equal(snap.review[0].isDue,true);
  assert.equal(snap.recommendation.kind,'review');
  assert.equal(store.data.get(ARCHIVE_STORAGE_KEY),raw);
  assert.equal(store.data.size,1);
  assert.equal(JSON.stringify(snap).includes('answerKey'),false);
  assert.equal(JSON.stringify(snap).includes('optimalTiles'),false);
  assert.equal(snap.capability.adaptive,false);
});
test('Corrupt archive blocks fallback without overwriting originals',()=>{
  const raw='{"broken":';
  const store=storage({[ARCHIVE_STORAGE_KEY]:raw,'tw-mahjong-trainer:session:v1':'[]'});
  assert.equal(readLegacyArchive(store).status,'error');
  assert.equal(getAcademySnapshot(store,'2026-11-19T11:00:00Z').stats,null);
  assert.equal(store.data.get(ARCHIVE_STORAGE_KEY),raw);
});
test('Lessons are limited to V0.2 guide paths; no fabricated V1 courses',()=>{
  assert.deepEqual(ACADEMY_LESSONS.map(x=>x.mode),['discard','tenpai','multi_wait']);
  assert.equal(ACADEMY_LESSONS[2].prerequisites[0],ACADEMY_LESSONS[1].id);
});
test('Unverified PlayerView fixture has no legal moves or opponent secrets',()=>{
  const fixture=getScenarioLayoutFixture();
  const view=projectScenarioForUI(fixture);
  assert.equal(view.fixtureOnly,true);
  assert.equal(view.hand.length,17);
  assert.deepEqual(view.legalActions,[]);
  assert.equal(view.canScore,false);
  assert.equal(JSON.stringify(fixture).includes('"wall"'),false);
  assert.equal(JSON.stringify(fixture).includes('"answerKey"'),false);
  const tampered=structuredClone(fixture);
  tampered.opponents[0].concealed=['t:0:0'];
  assert.throws(()=>projectScenarioForUI(tampered),/PlayerView/);
});
