/** R7.5 combined content coverage: QA-only, never imported by runtime.
 * No learner records, storage writes, answer keys or publication decisions.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { auditAcademyContent } from '../src/academy/content-audit.js';
import { listLessons, listScenarioQuestionRefs, toPublicQuestion,
  validateScenarioQuestion, gradeScenarioQuestion, getSkillTag,
  VERIFIED_SCENARIO_SCORER_COUNT } from '../src/academy/index.js';

const key=r=>r.questionId+'@'+r.questionVersion;
const sorted=xs=>[...new Set(xs)].sort();

export function summarizeObjectiveCoverage(lessons, rows) {
  const byLesson=new Map(), seen=new Set();
  for (const l of lessons) {
    assert.ok(l.lessonId && l.lessonVersion && !byLesson.has(l.lessonId),'duplicate/invalid lesson');
    assert.ok(Array.isArray(l.skillTagIds) && l.skillTagIds.length &&
      l.skillTagIds.every(id=>getSkillTag(id)), 'invalid lesson skill tags');
    byLesson.set(l.lessonId,{lesson:l,structural:[],scenario:[]});
  }
  for (const r of rows) {
    assert.ok(r.questionRef?.questionId && r.questionRef?.questionVersion,'missing question ref');
    assert.ok(!seen.has(key(r.questionRef)),'duplicate question version');
    seen.add(key(r.questionRef));
    const bucket=byLesson.get(r.lessonRef?.lessonId);
    assert.ok(bucket && bucket.lesson.lessonVersion===r.lessonRef.lessonVersion,'unknown/stale lesson');
    assert.ok(['structural','scenario'].includes(r.kind),'unknown evidence kind');
    assert.equal(r.verified,true,'unverified question');
    assert.ok(Array.isArray(r.skillTagIds) && r.skillTagIds.length &&
      r.skillTagIds.every(id=>getSkillTag(id)?.scope==='exact-structural'),'non-exact assessment tag');
    bucket[r.kind].push(r);
  }
  return [...byLesson.values()].map(({lesson:l,structural,scenario})=>{
    const structuralTags=sorted(structural.flatMap(r=>r.skillTagIds));
    const scenarioTags=sorted(scenario.flatMap(r=>r.skillTagIds));
    const assessed=sorted([...structuralTags,...scenarioTags]);
    const missing=l.skillTagIds.filter(id=>!assessed.includes(id));
    return {lessonRef:{lessonId:l.lessonId,lessonVersion:l.lessonVersion},
      titleZhTW:l.titleZhTW,status:l.status,structuralQuestions:structural.length,
      scenarioQuestions:scenario.length,structuralTags,scenarioTags,
      assessedObjectiveTags:l.skillTagIds.filter(id=>assessed.includes(id)),
      missingObjectiveTags:missing,fullyAssessed:missing.length===0,
      scenarioAddsCoverage:missing.length===0 && !l.skillTagIds.every(id=>structuralTags.includes(id)),
      publicationApproved:false};
  });
}

export function auditCombinedAcademyCoverage() {
  const legacy=auditAcademyContent();
  assert.equal(legacy.bank.failed,0,'legacy audit failed');
  assert.equal(legacy.bank.structurallyVerified,legacy.bank.totalQuestions,'incomplete legacy bank');
  const lessons=listLessons();
  const byId=new Map(lessons.map(l=>[l.lessonId,l]));
  const rows=legacy.questionRows.map(r=>({
    questionRef:r.questionRef,
    lessonRef:{lessonId:r.lessonId,lessonVersion:byId.get(r.lessonId)?.lessonVersion},
    kind:'structural',verified:r.structuralValidation==='pass',skillTagIds:r.skillTagIds
  }));
  let options=0, accepted=0;
  const refs=listScenarioQuestionRefs();
  assert.equal(refs.length,VERIFIED_SCENARIO_SCORER_COUNT);
  for (const ref of refs) {
    const q=toPublicQuestion(ref);
    assert.equal(key(q),key(ref));
    assert.equal(q.taskType,'scenario');
    assert.equal(q.status,'validated');
    assert.equal(validateScenarioQuestion(q,{publicOnly:true}),true);
    assert.ok(!Object.hasOwn(q,'answerKey'));
    const ids=q.prompt.options;
    assert.ok(ids.length && new Set(ids).size===ids.length,'invalid options');
    const legal=new Set(q.prompt.playerView.legalActions.map(a=>a.actionId));
    let good=0;
    for (const id of ids) {
      assert.ok(legal.has(id),'option not offered by Rules');
      const g=gradeScenarioQuestion(ref,id);
      assert.equal(key(g.questionRef),key(ref));
      assert.equal(g.status,'graded');
      assert.equal(g.explanation.correctnessBasis,'exact');
      assert.deepEqual(sorted(g.skillTagIds),sorted(q.skillTagIds));
      assert.ok(g.scoringVersion && g.scorerId && g.explanation.evidence.fixtureId===key(ref));
      assert.ok(g.score===0||g.score===1,'nonbinary scenario grade');
      assert.equal(g.grade,g.score===1?'perfect':'improve');
      good+=g.score;
    }
    assert.ok(good>0 && good<ids.length,'scenario requires both accepted and rejected options');
    options+=ids.length; accepted+=good;
    rows.push({questionRef:ref,lessonRef:q.lessonRef,kind:'scenario',verified:true,skillTagIds:q.skillTagIds});
  }
  const lessonRows=summarizeObjectiveCoverage(lessons,rows);
  const full=lessonRows.filter(l=>l.fullyAssessed);
  return {schema:'academy-combined-coverage/1.0.0',scope:'content-fixture-audit-only',
    createsLearningEvidence:false,publicationApproved:false,humanCalibrationVerified:false,
    curriculum:{lessons:lessonRows.length,published:lessonRows.filter(l=>l.status==='published').length,
      validated:lessonRows.filter(l=>l.status==='validated').length,
      structuralOnlyCovered:legacy.curriculum.fullyAssessedObjectives,
      combinedCovered:full.length,publishedCovered:full.filter(l=>l.status==='published').length,
      scenarioAddsCoverage:lessonRows.filter(l=>l.scenarioAddsCoverage).length},
    bank:{structural:legacy.bank.structurallyVerified,scenario:refs.length,total:rows.length,
      scenarioOptionsChecked:options,scenarioAcceptedOptions:accepted},
    lessonRows};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(auditCombinedAcademyCoverage(),null,2));
