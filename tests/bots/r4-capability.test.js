import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,createPlayerView,listLegalActions,applyAction,replayGame,
} from '../../src/rules/index.js';
import {createBot,createBotController} from '../../src/bots/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const bots=[1,2,3].map(seat=>createBot({
  seat,seed:'r4-sticky-unsupported-'+seat,difficulty:'Beginner',
}));

function makeGame(seed) {
  let state=createGame({gameId:'r4-sticky-'+seed,seed,...REF});
  // Real R3 Rules owns the initial flower replacements, never the Bot.
  while(state.round.phase==='replacement'){
    const seat=state.round.currentSeat;
    const action=listLegalActions(state,seat).find(a=>a.kind==='replace_flower');
    assert.ok(action);
    state=applyAction(state,{actorSeat:seat,actionId:action.actionId,
      expectedRevision:action.expectedRevision}).state;
  }
  return state;
}
const capability=()=>{
  const error=new RangeError('Rules policy has no multiple winner settlement');
  error.name='RuleCapabilityError';
  error.code='UNSUPPORTED_RULE_CAPABILITY';
  error.capability='multiple_winners';
  return error;
};

test('R4: Bot unsupported is sticky; duplicate tick and resumed checkpoint never retry or invent settlement',async()=>{
  let state=makeGame('bot-unsupported'),submissions=0;
  // Trusted host can schedule seat 1 with the real Rules view by one discard.
  const discard=listLegalActions(state,state.round.currentSeat).find(a=>a.kind==='discard');
  state=applyAction(state,{actorSeat:discard.actorSeat,
    actionId:discard.actionId,expectedRevision:discard.expectedRevision}).state;
  const before=state.revision, gameId=state.gameId;
  const config={
    bots,humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    getPendingClaimResponders:()=>[1,2,3].filter(
      seat=>listLegalActions(state,seat).some(a=>a.kind==='pass')),
    submitAction:()=>{submissions++;throw capability();},
    yieldControl:async()=>{},
  };
  const ctl=createBotController(config);
  const first=await ctl.tick();
  assert.equal(first.status,'unsupported');
  assert.equal(first.capability,'multiple_winners');
  assert.equal(first.code,'UNSUPPORTED_RULE_CAPABILITY');
  assert.equal(first.reason,'unsupported-rule-capability');
  assert.equal(first.seat,1);
  assert.equal(submissions,1);
  assert.equal(state.revision,before);
  assert.equal(state.gameId,gameId);
  assert.equal(state.round.phase,'claim_window');
  assert.equal((await ctl.tick()).status,'unsupported');
  assert.equal((await ctl.runUntilHuman({maxActions:5})).capability,'multiple_winners');
  assert.equal((await ctl.submitHumanAction({actionId:'invalid',expectedRevision:before})).status,'unsupported');
  assert.equal(submissions,1,'no repeat action on an unsupported revision');
  const checkpoint=ctl.checkpoint();
  assert.equal(checkpoint.blocked.expectedRevision,before);
  assert.deepEqual(checkpoint.blocked,{
    status:'unsupported',reason:'unsupported-rule-capability',
    code:'UNSUPPORTED_RULE_CAPABILITY',capability:'multiple_winners',
    gameId,expectedRevision:before,seat:1,
  });
  const resumed=createBotController({...config,checkpoint});
  resumed.resume();
  assert.deepEqual(await resumed.tick(),checkpoint.blocked);
  assert.equal(submissions,1);
  assert.ok(createPlayerView(state,1).opponents.every(
    o=>!Object.hasOwn(o,'concealed')));
  assert.deepEqual(replayGame(state),state);
  assert.ok(!('state' in checkpoint.blocked));
  assert.ok(!('wall' in checkpoint.blocked));
  assert.ok(!('concealed' in checkpoint.blocked));
});

test('R4: human Rules capability failure is sticky but never counted as a completed round',async()=>{
  let state=makeGame('human-unsupported'),calls=0;
  const ctl=createBotController({
    bots,humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:()=>{calls++;throw capability();},
    yieldControl:async()=>{},
  });
  const action=createPlayerView(state,0).legalActions[0];
  assert.ok(action);
  const fail=await ctl.submitHumanAction({
    actionId:action.actionId,expectedRevision:action.expectedRevision,
  });
  assert.equal(fail.status,'unsupported');
  assert.equal(fail.capability,'multiple_winners');
  assert.equal(fail.code,'UNSUPPORTED_RULE_CAPABILITY');
  assert.equal((await ctl.tick()).status,'unsupported');
  assert.equal(calls,1);
  assert.notEqual(state.round.phase,'settled');
  assert.equal(state.revision,action.expectedRevision);
  assert.equal(ctl.checkpoint().blocked.seat,0);
  assert.throws(()=>createBotController({
    bots,humanSeat:0,getActingSeat:()=>0,
    getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:()=>{},checkpoint:{paused:false,blocked:{
      ...ctl.checkpoint().blocked,wall:['t:0:0'],
    }},
  }),/Invalid controller checkpoint/);
});
