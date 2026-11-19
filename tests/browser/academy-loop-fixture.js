/**
 * TEST-ONLY injected provider. Never bundled in sw.js and never called by the
 * production boot code. It uses canonical v3 math to check event flows, but is
 * NOT AI6's integrated Master Academy façade.
 */
import {createAcademyBridge,ACADEMY_CONTRACT} from '../../src/academy-ui/academy-bridge.js';
import {renderLiveAcademy} from '../../src/academy-ui/academy-live.js';
import {createExercise} from '../../src/training/exercises.js';
import {createLocalTrainingStore} from '../../src/storage/local.js';
import {buildReviewQueue} from '../../src/training/progress.js';

const lessons=Array.from({length:20},(_,i)=>{
  const level=Math.floor(i/4)+1,n=i%4+1,lessonId='academy-l'+level+'-'+String(n).padStart(2,'0');
  return {
    schemaVersion:1,contractVersion:ACADEMY_CONTRACT,lessonId,lessonVersion:'1.0.0',
    titleZhTW:'測試課程 '+(i+1),status:level<4?'published':'validated',
    objectives:['Fixture-only：確認整體 UI 可以操作'],
    skillTagIds:['efficiency.shanten'],
    prerequisiteLessonIds:i?['academy-l'+(Math.floor((i-1)/4)+1)+'-'+String((i-1)%4+1).padStart(2,'0')]:[],
    contentBlocks:[{kind:'text',content:'僅用於獨立瀏覽器流程，不是 AI3 正式 Lesson'}],
    questionRefs:[{questionId:'ui-fixture-q-'+(i+1),questionVersion:'1.0.0'}],
  };
});
const exercises=new Map(lessons.map((l,i)=>[l.questionRefs[0].questionId,
  createExercise({seed:'ui-fixture-canonical-'+i,index:0,taskType:'discard',level:'beginner'})]));
const clone=x=>JSON.parse(JSON.stringify(x));
const map=new Map(lessons.map(l=>[l.questionRefs[0].questionId,l]));
let refuseWrites=false;
const original=window.localStorage;
const storage={
  getItem:key=>original.getItem(key),
  setItem:(key,value)=>{
    if(refuseWrites)throw new Error('QuotaExceededError fixture');
    original.setItem(key,value);
  }
};
const facade={
  contractVersion:ACADEMY_CONTRACT,
  getLessons:()=>clone(lessons),
  getQuestionRefs:({lessonId}={})=>clone(lessonId?lessons.find(l=>l.lessonId===lessonId)?.questionRefs??[]:
    lessons.flatMap(x=>x.questionRefs)),
  getPublicQuestion:ref=>{
    const l=map.get(ref.questionId),e=exercises.get(ref.questionId);
    if(!l||!e||ref.questionVersion!=='1.0.0')throw Error('Unknown fixture question');
    return clone({
      schemaVersion:1,contractVersion:ACADEMY_CONTRACT,
      questionId:ref.questionId,questionVersion:ref.questionVersion,
      lessonRef:{lessonId:l.lessonId,lessonVersion:l.lessonVersion},
      taskType:'discard',status:'validated',
      prompt:{legacyHand:e.hand,visibleTiles:[],options:[...new Set(e.hand)].map(String)},
      instructionsZhTW:'Fixture-only：選牌後經原有 v3 正式演算法評分',
    });
  },
  submitStructuralAnswer:(ref,choice,{timestamp,durationMs,attemptId})=>{
    const exercise=exercises.get(ref.questionId);
    if(!exercise)throw Error('Unknown fixture exercise');
    const store=createLocalTrainingStore(storage);
    const record=store.addDecision(exercise,choice,{durationMs,timestamp,attemptId});
    return {
      gradingResult:{schemaVersion:1,contractVersion:ACADEMY_CONTRACT,
        questionRef:ref,status:'graded',scoringVersion:record.scoringVersion,
        grade:record.grade,score:record.score,
        explanation:{answerSummary:'Fixture-only：使用真正的 v3 決策紀錄。',
          primaryReason:'未啟用 AI6 完整整合。'}},
      recordRef:{kind:'legacy-v3',id:record.id},
      durable:true,derivedFresh:true,
    };
  },
  getDashboard:({asOf})=>{
    const archive=createLocalTrainingStore(storage).load();
    const records=archive.records.filter(x=>x.schemaVersion===3);
    const review=buildReviewQueue(records,{asOf,includeNotDue:true});
    const links=new Map([...exercises].map(([id,e])=>[e.id,id]));
    return clone({
      contractVersion:ACADEMY_CONTRACT,durable:true,
      profile:{schemaVersion:1,contractVersion:ACADEMY_CONTRACT,
        profileId:'fixture-profile',updatedAt:asOf,calibrationStatus:'uncalibrated',
        skills:[{tagId:'efficiency.shanten',attempts:records.length,
          meanScore:records.length?records.reduce((s,r)=>s+r.score,0)/records.length:null,
          estimatedProficiency:null,meanDurationMs:records.length?records.reduce((s,r)=>s+r.durationMs,0)/records.length:null,
          evidenceRefs:records.map(r=>({kind:'legacy-v3',id:r.id}))}]},
      reviewPlan:{schemaVersion:1,contractVersion:ACADEMY_CONTRACT,planId:'fixture-review',
        settings:{timezone:'Asia/Taipei',dailyLimit:20},
        items:review.map(r=>({questionId:r.exerciseId,questionVersion:'legacy-exercise-v3',
          dueAt:r.dueAt,reasonCodes:[],skillTagIds:['efficiency.shanten']}))},
    });
  },
  getTrainingSession:()=>({status:'active',source:'fixture-only'}),
};
const root=document.querySelector('#academy-root');
let bridge;
let page='today';
const error=document.querySelector('#fixture-status');
function paint(){
  root.innerHTML=renderLiveAcademy(page,{status:'ready',bridge});
  document.querySelector('#fixture-page').textContent=page;
}
function initialize(){
  bridge=createAcademyBridge(facade,storage,{fixtureOnly:true});
  paint();
}
root.addEventListener('click',e=>{
  const btn=e.target.closest('button[data-live-action]');
  if(!btn)return;
  const action=btn.dataset.liveAction;
  if(action==='open-legacy')return;
  try{
    if(action==='select-lesson'){bridge.selectedLessonId=btn.dataset.lesson;bridge.question=null;}
    if(action==='go-lesson'){bridge.selectedLessonId=btn.dataset.lesson;bridge.question=null;page='lessons';}
    if(action==='begin-lesson'){bridge.startLesson(btn.dataset.lesson);}
    if(action==='choose'){bridge.select(Number(btn.dataset.tile));}
    if(action==='submit'){bridge.submit();}
    if(action==='next'){bridge.startLesson(bridge.selectedLessonId);}
    if(action==='return-lesson'){bridge.question=null;bridge.phase='idle';}
    if(action==='reload'){window.location.reload();return;}
    if(action==='review-question'){bridge.startLesson(btn.dataset.lesson,{questionRef:{
      questionId:btn.dataset.question,questionVersion:btn.dataset.version}});page='lessons';}
    paint();
  }catch(err){error.textContent=err.message;error.hidden=false;}
});
document.querySelector('#go-today').addEventListener('click',()=>{page='today';paint();});
document.querySelector('#go-lessons').addEventListener('click',()=>{page='lessons';paint();});
document.querySelector('#go-growth').addEventListener('click',()=>{page='growth';paint();});
document.querySelector('#toggle-quota').addEventListener('click',()=>{refuseWrites=!refuseWrites;error.textContent='Fixture storage failure='+refuseWrites;error.hidden=false;});
initialize();
