/** Instructor-only legal-action literacy review. Never grants strategy credit. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getR71Question, gradeR71Question, validateR71Question } from '../src/academy/r71-assessments.js';
import { readPlayerView } from '../src/strategy/view.js';

export const MELD_REVIEW_CASES=Object.freeze([
  Object.freeze({key:'chi',kind:'chi',reason:'NEXT_SEAT_CHI',goal:'合法吃牌'}),
  Object.freeze({key:'pong',kind:'pong',reason:'OPEN_PONG',goal:'合法碰牌'}),
  Object.freeze({key:'kong',kind:'kong',reason:'OPEN_KONG',goal:'合法明槓'}),
  Object.freeze({key:'concealed-kong',kind:'kong',reason:'CONCEALED_KONG',goal:'合法暗槓'})
]);
const canonical=x=>x===null||typeof x!=='object'?JSON.stringify(x):
  Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
const digest=x=>'sha256:'+createHash('sha256').update(canonical(x)).digest('hex');

export function verifyMeldReview(q, spec, grade) {
  assert.equal(q.questionId,'academy-r71-'+spec.key);
  assert.equal(q.questionVersion,'1.0.0');
  assert.equal(q.lessonRef.lessonId,'academy-l4-02');
  assert.equal(q.targetSkillTagId,'strategy.open-meld');
  assert.equal(q.scope,'explicit-conditional-goal');
  assert.equal(q.officialCredit,false);
  assert.equal(q.publicationStatus,'instructor-review');
  assert.equal(q.taskType,'legal-action');
  assert.equal(validateR71Question(q),true);
  const {view}=readPlayerView(q.playerView);
  assert.deepEqual(q.ruleRef,view.ruleRef);
  const byId=new Map(view.legalActions.map(a=>[a.actionId,a]));
  assert.equal(byId.size,view.legalActions.length);
  const ids=q.options.map(o=>o.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual([...ids].sort(),[...byId.keys()].sort(),'incomplete legal action domain');
  const accepted=[];
  for(const id of ids){
    const a=byId.get(id);
    const expected=a.kind===spec.kind && a.legalityBasis.reasonCodes.includes(spec.reason);
    const g=grade(q,id);
    assert.equal(g.score,expected?1:0,'legal-action objective mismatch');
    assert.equal(g.grade,expected?'perfect':'improve');
    assert.equal(g.scope,'explicit-conditional-goal');
    assert.equal(g.officialCredit,false);
    assert.equal(g.recordRef,null);
    assert.deepEqual(g.questionRef,{questionId:q.questionId,questionVersion:q.questionVersion});
    assert.equal(g.evidence.viewId,view.viewId);
    assert.equal(g.evidence.asOfEventSeq,view.asOfEventSeq);
    assert.equal(g.evidence.audienceSeat,view.audienceSeat);
    assert.deepEqual(g.evidence.ruleRef,view.ruleRef);
    if(expected)accepted.push(id);
  }
  assert.ok(accepted.length>0 && accepted.length<ids.length,'meaningful legal alternatives required');
  for(const id of ids){
    const g=grade(q,id);
    assert.deepEqual([...g.acceptedOptionIds].sort(),[...accepted].sort());
  }
  // Export only counts and reproducible fingerprints, never answer IDs or player snapshots.
  return {questionRef:{questionId:q.questionId,questionVersion:q.questionVersion},
    goal:spec.goal,actionKind:spec.kind,reasonCode:spec.reason,ruleRef:q.ruleRef,
    engineVersion:q.engineVersion,options:ids.length,accepted:accepted.length,
    snapshotDigest:digest(q),answerDomainDigest:digest([...accepted].sort()),
    evidenceScope:'specified-legal-action-only',officialCredit:false,
    strategyOptimalityVerified:false};
}

export function auditMeldReview(){
  const cases=MELD_REVIEW_CASES.map(spec=>verifyMeldReview(
    getR71Question({questionId:'academy-r71-'+spec.key,questionVersion:'1.0.0'}),
    spec,gradeR71Question));
  return {schema:'academy-meld-literacy-review/1.0.0',lessonId:'academy-l4-02',
    cases,caseCount:cases.length,optionsChecked:cases.reduce((n,r)=>n+r.options,0),
    officialCredit:false,publicationApproved:false,formalCoverageAdded:0,
    strategyOptimalityVerified:false,proposedSkill:'rules.legal-meld-action-literacy',
    limitations:['指定操作的合法性不等於實戰副露取捨。','新能力標籤僅提案，尚未註冊。']};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(auditMeldReview(),null,2));
