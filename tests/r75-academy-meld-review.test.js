import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getR71Question,gradeR71Question} from '../src/academy/r71-assessments.js';
import {auditMeldReview,verifyMeldReview,MELD_REVIEW_CASES} from '../scripts/academy-meld-review.mjs';

test('R7.5 meld review verifies all four real Rules-issued action domains',()=>{
  const r=auditMeldReview();
  assert.equal(r.caseCount,4);
  assert.equal(r.formalCoverageAdded,0);
  assert.equal(r.officialCredit,false);
  assert.equal(r.publicationApproved,false);
  assert.equal(r.strategyOptimalityVerified,false);
  assert.deepEqual(r.cases.map(x=>x.reasonCode),
    ['NEXT_SEAT_CHI','OPEN_PONG','OPEN_KONG','CONCEALED_KONG']);
  assert.ok(r.cases.every(x=>x.options>x.accepted&&x.accepted>0));
  assert.ok(r.cases.every(x=>/^sha256:[a-f0-9]{64}$/.test(x.snapshotDigest)));
  assert.deepEqual(r,auditMeldReview());
  assert.equal(new Set(r.cases.map(x=>x.snapshotDigest)).size,4);
  for(const key of ['playerView','acceptedOptionIds','answerKey','recordRef','legalActions'])
    assert.ok(!JSON.stringify(r).includes('"'+key+'"'));
});
test('R7.5 meld review rejects false credit, wrong action reason and forged scoring',()=>{
  const spec=MELD_REVIEW_CASES[0];
  const q=getR71Question({questionId:'academy-r71-chi',questionVersion:'1.0.0'});
  assert.throws(()=>verifyMeldReview({...q,officialCredit:true},spec,gradeR71Question));
  assert.throws(()=>verifyMeldReview({...q,options:q.options.slice(1)},spec,gradeR71Question));
  assert.throws(()=>verifyMeldReview(q,{...spec,reason:'OPEN_PONG'},gradeR71Question));
  assert.throws(()=>verifyMeldReview(q,spec,(r,id)=>({...gradeR71Question(r,id),score:2})));
  assert.throws(()=>verifyMeldReview(q,spec,(r,id)=>({...gradeR71Question(r,id),officialCredit:true})));
  assert.throws(()=>verifyMeldReview(q,spec,(r,id)=>({...gradeR71Question(r,id),acceptedOptionIds:[]})));
});
test('R7.5 meld review remains QA-only',()=>{
  for(const name of ['../sw.js','../src/academy/index.js','../src/academy/questions.js','../src/app.js','../index.html']){
    assert.ok(!readFileSync(new URL(name,import.meta.url),'utf8').includes('academy-meld-review'),name);
  }
});
