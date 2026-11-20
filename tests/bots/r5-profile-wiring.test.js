import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,createPlayerView,listLegalActions,applyAction,
} from '../../src/rules/index.js';
import {
  createBot,chooseBotAction,validateBotDecision,createBotController,
} from '../../src/bots/index.js';
import {
  isSupportedBotTableProfile,readBotView,readSettledBotView,
} from '../../src/bots/view.js';

const OLD={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const NEW={profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const clone=x=>JSON.parse(JSON.stringify(x));
function game(){
  let state=createGame({gameId:'r5-bot-schema-only',seed:'r5-bot-schema-only',...OLD});
  while(state.round.phase==='replacement'){
    const a=listLegalActions(state,state.round.currentSeat)
      .find(a=>a.kind==='replace_flower');
    assert.ok(a);
    state=applyAction(state,{
      actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision,
    }).state;
  }
  return state;
}
/**
 * Adapter-only test fixture: re-tags an actual old-profile Rules PlayerView to
 * check the new Bot contract before R5 Rules #43 joins this branch. It is NOT
 * an R5 authoritative legal action or a claim/settlement acceptance test.
 */
function schemaFixture(view){
  const v=clone(view);
  v.ruleRef=clone(NEW);
  for(const a of v.legalActions)a.ruleRef=clone(NEW);
  for(const e of v.publicEvents)e.ruleRef=clone(NEW);
  return v;
}
test('R5 Bot adapter only permits the two exact reviewed profile versions',()=>{
  assert.equal(isSupportedBotTableProfile(OLD),true);
  assert.equal(isSupportedBotTableProfile(NEW),true);
  assert.equal(isSupportedBotTableProfile({...NEW,ruleVersion:'experimental-v2'}),false);
  assert.equal(isSupportedBotTableProfile({profileId:'arbitrary',ruleVersion:'experimental-v1'}),false);
});
test('R5 Bot decision wiring consumes only a redacted tagged PlayerView and issued IDs',()=>{
  const state=game(),source=createPlayerView(state,state.round.currentSeat);
  const fixture=schemaFixture(source),bot=createBot({
    seat:source.audienceSeat,seed:'r5-schema-only',difficulty:'Beginner',
  });
  const read=readBotView(fixture);
  assert.equal(read.view.ruleRef.profileId,NEW.profileId);
  assert.equal(Object.hasOwn(read.view,'wall'),false);
  assert.ok(read.view.opponents.every(o=>!Object.hasOwn(o,'concealed')));
  const choice=chooseBotAction(bot,fixture);
  assert.equal(choice.status,'ready');
  assert.equal(validateBotDecision(bot,fixture,choice),true);
  assert.ok(fixture.legalActions.some(a=>a.actionId===choice.actionId &&
    a.expectedRevision===choice.expectedRevision));
  const withWall=clone(fixture);withWall.wall=['t:0:0'];
  assert.throws(()=>chooseBotAction(bot,withWall),/非公開|Nonpublic|含非公開欄位/);
  const hidden=clone(fixture);hidden.opponents[0].concealed=['t:0:0'];
  assert.throws(()=>chooseBotAction(bot,hidden),/非公開|Nonpublic|含非公開欄位/);
});
test('R5 Controller wiring accepts three responder PlayerViews without selecting a winner',async()=>{
  let state=game();
  const discard=listLegalActions(state,state.round.currentSeat)
    .find(a=>a.kind==='discard');
  state=applyAction(state,{
    actorSeat:discard.actorSeat,actionId:discard.actionId,
    expectedRevision:discard.expectedRevision,
  }).state;
  assert.equal(state.round.phase,'claim_window');
  const pending=[0,1,2,3].filter(seat=>
    listLegalActions(state,seat).some(a=>a.kind==='pass'));
  assert.equal(pending.length,3);
  const submits=[];
  const controller=createBotController({
    bots:[1,2,3].map(seat=>createBot({seat,seed:'r5-schema-'+seat})),
    humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>schemaFixture(createPlayerView(state,seat)),
    getPendingClaimResponders:()=>pending,
    submitAction:submission=>{
      const original=listLegalActions(state,submission.actorSeat);
      assert.ok(original.some(a=>a.actionId===submission.actionId &&
        a.expectedRevision===submission.expectedRevision));
      submits.push(submission);
      // This is a contract-only callback, not a fake Rules settlement.
    },
    yieldControl:async()=>{},
  });
  const step=await controller.tick();
  assert.equal(step.status,pending[0]===0?'human-turn':'acted');
  if(step.status==='acted'){
    assert.equal(submits.length,1);
    assert.equal(step.decision.actorSeat,pending[0]);
    assert.ok(submits[0].actionId);
    assert.equal(submits[0].expectedRevision,state.revision);
    assert.notEqual(state.round.phase,'settled');
    assert.equal((await controller.tick()).status,'duplicate-revision-blocked');
  }
});
test('R5 Controller terminal check accepts only public claimResolution, not private intent',async()=>{
  const state=game(),seat=state.round.currentSeat;
  const fixture=schemaFixture(createPlayerView(state,seat));
  fixture.round.phase='settled';fixture.legalActions=[];
  const existing=fixture.publicEvents.at(-1);
  fixture.publicEvents.push({...clone(existing),eventId:'unit-r5-final-win',
    type:'win',visibility:'public',seq:fixture.asOfEventSeq,
    payload:{seat:1,sourceSeat:0,claimResolution:{
      schemaVersion:1,policyVersion:'tw16-single-winner-interception/1.0.0',
      winPriority:'nearest-clockwise-from-discarder',
      discardEventId:'unit-r5-discard',fromSeat:0,selectedSeat:1,
      selectedClaimActionId:'unit-r5-legal-id',
      declaredWinSeats:[1,2],interceptedWinSeats:[2],
    }}});
  const bots=[1,2,3].map(seat=>createBot({seat,seed:'terminal-'+seat}));
  const adapter=view=>createBotController({
    bots,humanSeat:0,getActingSeat:()=>seat,
    getPlayerView:()=>view,submitAction:()=>{throw Error('No terminal submission');},
    yieldControl:async()=>{},
  });
  assert.equal(readSettledBotView(fixture).view.round.phase,'settled');
  assert.equal((await adapter(fixture).tick()).status,'settled');
  const leaked=clone(fixture);leaked.publicEvents.at(-1).payload.privateClaimIntents=['win'];
  await assert.rejects(()=>adapter(leaked).tick(),/Nonpublic/);
  const badOpp=clone(fixture);badOpp.opponents[0].concealed=['t:0:0'];
  await assert.rejects(()=>adapter(badOpp).tick(),/Nonpublic/);
  const secret=clone(fixture);secret.wall=['t:0:0'];
  await assert.rejects(()=>adapter(secret).tick(),/Nonpublic/);
});
