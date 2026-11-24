/**
 * Deterministic scenario discovery ONLY. Uses actual host and Rules/Controller
 * legal actions, never fixtureDeck, state injection, localStorage mutation or
 * fabricated Bot outcomes. Browser must independently click every issued token.
 */
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createFullRoundSession} from '../../src/table-ui/full-round.js';
import {createBot,chooseBotAction} from '../../src/bots/index.js';
const required=['WIN','DRAW','replace_flower','chi','pong','kong','pass','win','draw','discard'];
const arg=key=>process.argv[process.argv.indexOf(key)+1];
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};};
const keys=p=>new Set([p.outcome,...p.actions.map(a=>a.kind)]);
async function scenario(difficulty,seed,index){
  const host=await createFullRoundSession({storage:storage()});
  host.start({difficulty,fixedSeed:seed});
  const trainer=createBot({seat:0,difficulty:'Advanced',seed:'r73-qa-human'});
  const actions=[];
  for(let i=0;i<320;i++){
    const advance=await host.advanceBots({maxActions:2048});
    const s=host.snapshot(),v=s.view;
    if(v.round.phase==='settled'){
      if(!s.result?.publicSummary)throw Error('Missing actual Rules settlement');
      const r=s.result.publicSummary;
      if(!['win','exhaustive-draw'].includes(r.outcome))throw Error('Unknown terminal outcome');
      return {difficulty,seed,actions,outcome:r.outcome==='win'?'WIN':'DRAW',
        scoreDelta:r.scoreDelta,eventCount:r.eventCount,winnerSeats:r.winnerSeats};
    }
    if(advance.status!=='human-turn'||!v.legalActions.length)throw Error('No actual human legal action: '+advance.status);
    const legal=v.legalActions;
    const immediate=['win','replace_flower','draw','kong'].map(k=>legal.find(a=>a.kind===k)).find(Boolean);
    let action=immediate;
    if(!action&&index%3===1)action=legal.find(a=>a.kind==='pong')??legal.find(a=>a.kind==='chi');
    if(!action&&index%3===2)action=legal.find(a=>a.kind==='pass')??legal.find(a=>a.kind==='discard');
    if(!action){
      const decision=chooseBotAction(trainer,v);
      action=legal.find(a=>a.actionId===decision.actionId&&a.expectedRevision===decision.expectedRevision);
    }
    if(!action||action.actorSeat!==0||action.expectedRevision!==v.asOfEventSeq)throw Error('Discovery decision not actually legal');
    actions.push({kind:action.kind,actionId:action.actionId});
    await host.submit({actorSeat:0,actionId:action.actionId,expectedRevision:action.expectedRevision});
  }
  throw Error('Discovery exhausted human action budget');
}
if(process.argv.includes('--output')){
  const difficulty=arg('--difficulty'),output=arg('--output'),limit=Number(arg('--limit')||12);
  if(!['Beginner','Intermediate','Advanced'].includes(difficulty)||!Number.isInteger(limit)||limit<3||limit>24)throw Error('Invalid discovery options');
  const report={sourceSHA:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    difficulty,discoveryOnly:true,attempts:[],selected:[],errors:[]};
  const eligible=[];
  for(let i=0;i<limit;i++){
    const seed='r73-case-'+i;
    try{
      const p=await scenario(difficulty,seed,i),k=keys(p);
      report.attempts.push({seed,outcome:p.outcome,actions:p.actions.length,kinds:[...k],winnerSeats:p.winnerSeats});
      // Existing real E2E must still exercise actual discard/PASS and at least
      // two non-discard actions for the mandatory cancel/stale/duplicate probes.
      if(k.has('discard')&&k.has('pass')&&p.actions.filter(a=>a.kind!=='discard').length>=2)eligible.push(p);
      console.log('R73_DISCOVERY',JSON.stringify(report.attempts.at(-1)));
      const found=new Set(eligible.flatMap(p=>[...keys(p)]));
      if(required.every(k=>found.has(k))&&eligible.length>=2)break;
    }catch(e){report.errors.push({seed,message:e.message});console.error('R73_DISCOVERY_ERROR',seed,e.message);}
  }
  const remaining=new Set(required),pool=[...eligible];
  while(pool.length&&report.selected.length<5){
    pool.sort((a,b)=>[...keys(b)].filter(k=>remaining.has(k)).length-[...keys(a)].filter(k=>remaining.has(k)).length);
    const p=pool.shift(),gain=[...keys(p)].filter(k=>remaining.has(k));
    if(!gain.length&&report.selected.length)break;
    report.selected.push(p);for(const k of gain)remaining.delete(k);
  }
  report.notObserved=[...remaining];
  mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));
  console.log('R73_DISCOVERY_SUMMARY',JSON.stringify({difficulty,selected:report.selected.map(p=>p.seed),notObserved:report.notObserved,errors:report.errors}));
  if(!report.selected.length)throw Error('No genuine complete eligible seeded scenarios found');
}
