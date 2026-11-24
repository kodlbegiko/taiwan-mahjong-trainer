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


test('Official UI bridge uses strict public Q shape and fails closed on answer keys', async ()=>{
  const {createAcademyBridge,ACADEMY_CONTRACT}=await import('../src/academy-ui/academy-bridge.js');
  const fakeStorage=new Map();
  const storage={getItem:k=>fakeStorage.get(k)??null,setItem:(k,v)=>fakeStorage.set(k,v)};
  const lesson={schemaVersion:1,contractVersion:ACADEMY_CONTRACT,lessonId:'academy-l1-01',
    lessonVersion:'1.0.0',titleZhTW:'正式介面測試',objectives:['test'],
    prerequisiteLessonIds:[],questionRefs:[{questionId:'academy-q-001',questionVersion:'1.0.0'}],
    contentBlocks:[],status:'published'};
  const q={schemaVersion:1,contractVersion:ACADEMY_CONTRACT,questionId:'academy-q-001',
    questionVersion:'1.0.0',status:'validated',taskType:'discard',
    prompt:{legacyHand:[...Array(17)].map((_,i)=>i),options:['0','1'],visibleTiles:[]}};
  let bad=false;
  const source={contractVersion:ACADEMY_CONTRACT,getLessons:()=>[lesson],
    getQuestionRefs:()=>lesson.questionRefs,
    getPublicQuestion:()=>bad?{...q,answerKey:{acceptedTileTypes:[0]}}:q,
    getDashboard:({asOf})=>({contractVersion:ACADEMY_CONTRACT,
      profile:{schemaVersion:1,contractVersion:ACADEMY_CONTRACT,profileId:'fixture',
        updatedAt:asOf,calibrationStatus:'uncalibrated',skills:[]},
      reviewPlan:{schemaVersion:1,contractVersion:ACADEMY_CONTRACT,planId:'fixture',
        settings:{timezone:'Asia/Taipei'},items:[]}}),
    submitStructuralAnswer:()=>{throw new Error('test-only no grade')},
  };
  const bridge=createAcademyBridge(source,storage,{fixtureOnly:true});
  assert.equal(bridge.lessons.length,1);
  bad=true;
  assert.throws(()=>bridge.startLesson(lesson.lessonId),/QuestionPublic/);
  bad=false;
  const publicQ=bridge.startLesson(lesson.lessonId);
  assert.equal(Object.hasOwn(publicQ,'answerKey'),false);
  assert.deepEqual(bridge.select(0),[0]);
  assert.equal(bridge.submit(),null);
  assert.equal(bridge.phase,'failed');
  assert.equal(bridge.result,null);
});

test('R7.4 diagnosis UI renders only versioned coherent public evidence, never mastery',async()=>{
  const {renderSkillDiagnostics}=await import('../src/academy-ui/academy-live.js');
  const at='2026-11-25T00:00:00Z';
  const skills=[
    {tagId:'efficiency.ukeire',attempts:8,meanScore:0.5,estimatedProficiency:0.5},
    {tagId:'efficiency.shanten',attempts:6,meanScore:1,estimatedProficiency:null},
    {tagId:'strategy.defense',attempts:0,meanScore:null,estimatedProficiency:null},
    {tagId:'waits.enumeration',attempts:10,meanScore:0.9,estimatedProficiency:0.9},
  ];
  const rows=skills.map((s,i)=>({tagId:s.tagId,attempts:s.attempts,observedMean:s.meanScore,
    uniqueQuestionCount:[4,1,0,8][i],status:['practice-priority','insufficient-evidence','unobserved','observed-high-score'][i]}));
  const dashboard={durable:true,pendingRecovery:{remaining:0,results:[]},profile:{updatedAt:at,calibrationStatus:'uncalibrated',skills},
    recommendation:{generatedAsOf:at,calibrationStatus:'uncalibrated',skillDiagnostics:rows,
      diagnosticPolicy:{version:'observed-practice-priority/1.0.0',minAttempts:5,minUniqueQuestions:3,practiceScoreThreshold:0.8,calibratedMastery:false}}};
  const html=renderSkillDiagnostics(dashboard);
  for(const text of ['優先練習','證據不足','尚未評估','觀察表現良好','50%','100%','未經真人校準'])
    assert.ok(html.includes(text),text);
  assert.ok(html.includes('data-skill-diagnostics="verified"'));
  for(const mutate of [
    d=>{delete d.recommendation;},d=>{d.durable=false;},d=>{d.pendingRecovery={remaining:1,results:[{recovered:false}]};},
    d=>{d.pendingRecovery=null;},d=>{d.pendingRecovery={remaining:0,results:[{recovered:false}]};},
    d=>{d.recommendation.generatedAsOf='2026-11-24T00:00:00Z';},
    d=>{d.recommendation.skillDiagnostics[0].observedMean=0.99;},
    d=>{d.recommendation.skillDiagnostics[1].status='observed-high-score';},
    d=>{d.recommendation.skillDiagnostics.push(d.recommendation.skillDiagnostics[0]);},
    d=>{d.recommendation.diagnosticPolicy.calibratedMastery=true;},
  ]){
    const d=structuredClone(dashboard);mutate(d);
    assert.match(renderSkillDiagnostics(d),/data-skill-diagnostics="unavailable"/);
  }
});
