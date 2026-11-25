import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditCombinedAcademyCoverage,summarizeObjectiveCoverage} from '../scripts/academy-combined-coverage.mjs';

test('R7.5 coverage combines both verified banks without credit or publication inflation',()=>{
  const r=auditCombinedAcademyCoverage();
  assert.deepEqual(r.curriculum,{lessons:20,published:12,validated:8,
    structuralOnlyCovered:10,combinedCovered:15,publishedCovered:12,scenarioAddsCoverage:5});
  assert.deepEqual(r.bank,{structural:100,scenario:5,total:105,
    scenarioOptionsChecked:87,scenarioAcceptedOptions:21});
  assert.equal(r.createsLearningEvidence,false);
  assert.equal(r.publicationApproved,false);
  assert.equal(r.humanCalibrationVerified,false);
  assert.equal(r.lessonRows.reduce((n,l)=>n+l.structuralQuestions+l.scenarioQuestions,0),105);
  assert.equal(r.lessonRows.filter(l=>l.missingObjectiveTags.length>0).length,5);
  assert.ok(r.lessonRows.every(l=>l.publicationApproved===false));
  for(const s of ['answerKey','acceptedActionIds','playerView','recordRef','prompt'])
    assert.ok(!JSON.stringify(r).includes('"'+s+'"'),s);
});
test('R7.5 coverage rejects duplicate, stale, unverified and non-exact evidence',()=>{
  const lessons=[{lessonId:'l',lessonVersion:'1',titleZhTW:'test',status:'validated',
    skillTagIds:['tiles.identity','structure.hand16']}];
  const a={questionRef:{questionId:'q',questionVersion:'1'},lessonRef:{lessonId:'l',lessonVersion:'1'},
    kind:'structural',verified:true,skillTagIds:['tiles.identity']};
  const b={...a,questionRef:{questionId:'s',questionVersion:'1'},kind:'scenario',
    skillTagIds:['structure.hand16']};
  const [r]=summarizeObjectiveCoverage(lessons,[a,b]);
  assert.equal(r.fullyAssessed,true);
  assert.equal(r.scenarioAddsCoverage,true);
  assert.equal(r.publicationApproved,false);
  assert.equal(summarizeObjectiveCoverage(lessons,[a])[0].fullyAssessed,false);
  for(const bad of [[a,a],[{...a,verified:false}],[{...a,kind:'unknown'}],
    [{...a,lessonRef:{lessonId:'l',lessonVersion:'2'}}],
    [{...a,lessonRef:{lessonId:'missing',lessonVersion:'1'}}],
    [{...a,skillTagIds:['strategy.synthesis']}],
    [{...a,skillTagIds:['unknown']}], [{...a,skillTagIds:[]}]])
    assert.throws(()=>summarizeObjectiveCoverage(lessons,bad));
});
test('R7.5 combined coverage script is QA-only and absent from offline shell',()=>{
  for(const name of ['../sw.js','../src/academy/index.js','../src/academy/questions.js',
    '../src/app.js','../index.html']){
    const source=readFileSync(new URL(name,import.meta.url),'utf8');
    assert.ok(!source.includes('academy-combined-coverage'),name);
  }
});
