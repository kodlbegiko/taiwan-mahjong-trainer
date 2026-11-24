/**
 * R7.4 complete shuffled authority-host acceptance.
 * No fixtureDeck, checkpoint injection, synthetic scores or skipped seeds.
 * Each seed receives an independent storage instance and the actual public
 * host/Controller/Rules/Scoring/Replay path. Record every attempt, including
 * declared unsupported capabilities. This is native evidence, not browser QA.
 */
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createFullRoundSession,AUTHORITY_EXPERIMENT_KEY} from '../../src/table-ui/full-round.js';
import {createBot,chooseBotAction,validateBotDecision} from '../../src/bots/index.js';

const levels=['Beginner','Intermediate','Advanced'];
const seeds=['r74-authority-full-0','r74-authority-full-1','r74-authority-full-2'];
const argument=k=>process.argv[process.argv.indexOf(k)+1];
const difficulty=argument('--difficulty'),output=argument('--output');
assert.ok(levels.includes(difficulty),'Explicit known difficulty required');
assert.ok(process.argv.includes('--output')&&output,'Output required');
const sourceSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={sourceSHA,difficulty,scope:'native-shuffled-authority-host',release:false,
  seeds,attempts:[],plans:[],totals:{settled:0,unsupported:0,unexpected:0}};
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))};};
const checkpoint=s=>JSON.parse(s.getItem(AUTHORITY_EXPERIMENT_KEY));
const privacy=v=>{
  assert.equal(v.audienceSeat,0);
  assert.ok(v.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  assert.ok(!Object.hasOwn(v,'wall')&&!Object.hasOwn(v,'rng'));
};
function flush(){
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
}
async function match(seed){
  const storage=store();
  const host=await createFullRoundSession({storage,enableAuthoritative:true});
  const trainer=createBot({seat:0,difficulty:'Advanced',seed:'r74-authority-human'});
  const actions=[];
  let phase='start';
  try{
    const initial=host.start({difficulty,fixedSeed:seed});
    assert.equal(initial.profile.profileId,'tw16-authoritative-scoring');
    privacy(initial.view);
    for(let i=0;i<320;i++){
      phase='advance';
      const advance=await host.advanceBots({maxActions:2048});
      const s=host.snapshot(),v=s.view;
      privacy(v);
      if(v.round.phase==='settled'){
        phase='terminal';
        const publicSummary=s.result?.publicSummary;
        assert.equal(publicSummary?.scoringPolicy,'tw16-gametower-authoritative@1.0.0-experimental');
        const dto=publicSummary.settlement;
        assert.ok(dto);
        assert.ok(['win','exhaustive-draw'].includes(dto.reason));
        assert.equal(dto.unit,'abstract-points');
        assert.equal(dto.playerDeltas.length,4);
        assert.ok(dto.playerDeltas.every(n=>Number.isSafeInteger(n)&&!Object.is(n,-0)));
        assert.equal(dto.playerDeltas.reduce((a,b)=>a+BigInt(b),0n),0n);
        assert.equal(v.legalActions.length,0);
        assert.deepEqual(v.publicEvents.at(-1).payload.settlement,dto);
        assert.equal(s.replayConnected,true,s.replayWarning);
        const raw=storage.getItem(AUTHORITY_EXPERIMENT_KEY);
        const reloaded=await createFullRoundSession({storage,enableAuthoritative:true});
        assert.equal(reloaded.restore(),true);
        assert.deepEqual(reloaded.snapshot().result,s.result);
        assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),raw);
        phase='replay';
        const timeline=await reloaded.replay();
        assert.equal(timeline.verified,true);
        assert.equal(timeline.boundaries[0],1);
        assert.equal(timeline.boundaries.at(-1),v.asOfEventSeq);
        const first=timeline.getFrame(0),last=timeline.getFrame(timeline.total-1);
        privacy(first.view);privacy(last.view);
        assert.deepEqual(last.legalActions,[]);
        assert.deepEqual(last.view.publicEvents.at(-1).payload.settlement,dto);
        const summary={seed,status:'SETTLED',outcome:dto.reason,winType:dto.winType,
          eventCount:v.asOfEventSeq,humanActions:actions.length,delta:dto.playerDeltas,
          kinds:[...new Set(actions.map(a=>a.kind))],replayVerified:true};
        return {summary,plan:{seed,difficulty,actions,settlement:dto,eventCount:v.asOfEventSeq}};
      }
      assert.equal(advance.status,'human-turn');
      assert.ok(v.legalActions.length);
      phase='select-human';
      const legal=v.legalActions;
      let chosen=['win','replace_flower','draw','kong'].map(k=>legal.find(a=>a.kind===k)).find(Boolean);
      if(!chosen){
        const decision=chooseBotAction(trainer,v);
        assert.equal(validateBotDecision(trainer,v,decision),true);
        chosen=legal.find(a=>a.actionId===decision.actionId&&a.expectedRevision===decision.expectedRevision);
      }
      assert.ok(chosen,'No actual legal human action');
      assert.equal(chosen.actorSeat,0);
      assert.equal(chosen.expectedRevision,v.asOfEventSeq);
      actions.push({kind:chosen.kind,actionId:chosen.actionId,expectedRevision:chosen.expectedRevision});
      phase='submit-human';
      await host.submit({actorSeat:0,actionId:chosen.actionId,expectedRevision:chosen.expectedRevision});
    }
    throw Error('Exhausted human decision budget without terminal result');
  }catch(error){
    if(error?.code!=='UNSUPPORTED_RULE_CAPABILITY')throw error;
    // A declared unsupported outcome is NOT a completed game or a pass.
    const saved=checkpoint(storage),snapshot=host.snapshot(),stop=saved.botCheckpoint.blocked;
    assert.ok(stop,'Capability rejection was not durably saved');
    assert.equal(stop.gameId,saved.gameState.gameId);
    assert.equal(stop.expectedRevision,saved.gameState.revision);
    assert.equal(stop.capability,error.capability);
    assert.equal(snapshot.result,null);
    assert.equal(snapshot.replayConnected,false);
    assert.notEqual(snapshot.view.round.phase,'settled');
    const raw=storage.getItem(AUTHORITY_EXPERIMENT_KEY);
    const reopened=await createFullRoundSession({storage,enableAuthoritative:true});
    assert.equal(reopened.restore(),true);
    assert.deepEqual(reopened.snapshot().capabilityBlock,stop);
    await assert.rejects(reopened.advanceBots(),e=>e.code===error.code&&e.capability===error.capability);
    assert.equal(storage.getItem(AUTHORITY_EXPERIMENT_KEY),raw);
    return {summary:{seed,status:'UNSUPPORTED',capability:stop.capability,
      eventCount:stop.expectedRevision,humanActions:actions.length,phase,checkpointPreserved:true}};
  }
}
for(const seed of seeds){
  try{
    const {summary,plan}=await match(seed);
    report.attempts.push(summary);
    if(plan){report.plans.push(plan);report.totals.settled++;}
    else report.totals.unsupported++;
  }catch(error){
    report.attempts.push({seed,status:'UNEXPECTED',message:String(error.message)});
    report.totals.unexpected++;
  }
  console.log('R74_AUTHORITY_MATCH',JSON.stringify(report.attempts.at(-1)));
  flush();
}
report.status=report.totals.settled===seeds.length?'PASS':'FAIL';
flush();
console.log('R74_AUTHORITY_MATRIX',JSON.stringify({difficulty,...report.totals,status:report.status}));
assert.equal(report.attempts.length,seeds.length);
assert.equal(report.totals.settled,seeds.length,'Every scheduled seed must actually settle; unsupported cases are not PASS');
