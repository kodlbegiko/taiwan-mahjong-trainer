import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createPlayerView,listLegalActions,applyAction} from '../../src/rules/index.js';
import {createBot,runBotTurn,createBotController} from '../../src/bots/index.js';

const REF={profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'};
const bot=seat=>createBot({seat,difficulty:'Beginner',seed:'host-contract-'+seat});
function ready(seed){
  let state=createGame({gameId:'bot-host-contract',seed,...REF});
  while(state.round.phase==='replacement'){
    const action=listLegalActions(state,state.round.currentSeat)
      .find(a=>a.kind==='replace_flower');
    state=applyAction(state,{actorSeat:action.actorSeat,actionId:action.actionId,
      expectedRevision:action.expectedRevision}).state;
  }
  return state;
}
test('R3 host-provided pending responders schedule only fresh PlayerView LegalActions',async()=>{
  let state=ready('host-pending-adapter');
  const discard=listLegalActions(state,state.round.currentSeat).find(a=>a.kind==='discard');
  state=applyAction(state,{actorSeat:discard.actorSeat,actionId:discard.actionId,
    expectedRevision:discard.expectedRevision}).state;
  const pending=()=>[0,1,2,3].filter(seat=>listLegalActions(state,seat).some(a=>a.kind==='pass'));
  assert.equal(pending().length,3);
  const c=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    getPendingClaimResponders:()=>pending(),
    submitAction:a=>{state=applyAction(state,a).state;},
    yieldControl:async()=>{},
  });
  for(let n=0;n<3;n++){
    const seat=pending()[0];
    const res=seat===0
      ? await c.submitHumanAction((()=>{
        const action=listLegalActions(state,0).find(a=>a.kind==='pass');
        return {actionId:action.actionId,expectedRevision:action.expectedRevision};
      })())
      : await c.tick();
    assert.equal(res.status,'acted',JSON.stringify(res));
  }
  assert.notEqual(state.round.phase,'claim_window');
  assert.equal(pending().length,0);
});
test('R3 capability errors propagate as typed unsupported with no private state',async()=>{
  const state=ready('typed-unsupported-error');
  const b=bot(state.round.currentSeat);
  const view=createPlayerView(state,b.seat);
  const res=await runBotTurn({bot:b,playerView:view,submitAction:()=>{
    const e=new RangeError('Multiple winners unsupported');
    e.code='UNSUPPORTED_RULE_CAPABILITY';e.capability='multiple_winners';throw e;
  }});
  assert.equal(res.status,'unsupported');
  assert.equal(res.reason,'unsupported-rule-capability');
  assert.equal(res.capability,'multiple_winners');
  assert.ok(!('state' in res));
  assert.equal(state.round.phase,'await_discard');
});
