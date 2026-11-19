import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getRuleProfile, createDeck, listLegalActions,
  createPlayerView, validateGameState, applyAction, replayGame } from '../../src/rules/index.js';
import { readPlayerView } from '../../src/strategy/view.js';
import { createBot, chooseBotAction, validateBotDecision, createBotController } from '../../src/bots/index.js';
import { createReplayService } from '../../src/replay/index.js';
import { availableTableProfiles, TABLE_STORAGE_KEY } from '../../src/table-ui/session.js';

function r3() {
  const profile=getRuleProfile('tw16-configurable-table','experimental-full-v1');
  const tiles=createDeck(profile);
  const fixtureDeck=[...tiles.filter(t=>t.startsWith('t:')),...tiles.filter(t=>t.startsWith('f:'))];
  return createGame({gameId:'phase3-isolated-integration',seed:'phase3-fixed-seed',
    profileId:profile.profileId,ruleVersion:profile.ruleVersion,fixtureDeck,dealerSeat:0});
}
test('Phase 3 RuleProfile never upgrades experimental to verified and conserves full physical inventory',()=>{
  const profile=getRuleProfile('tw16-configurable-table','experimental-full-v1');
  assert.equal(profile.status,'experimental');
  const state=r3();
  assert.equal(validateGameState(state),true);
  assert.equal(state.players.length,4);
  assert.equal(state.players[0].concealed.length,17);
  assert.equal(state.players.slice(1).every(p=>p.concealed.length===16),true);
  assert.equal(state.wall.length+state.players.reduce((n,p)=>n+p.concealed.length+p.flowers.length,0),144);
  assert.deepEqual(replayGame(state),state);
  assert.ok(availableTableProfiles().some(p=>p.profileId===profile.profileId&&p.status==='experimental'));
});
test('R3 PlayerView can feed a real public-only Bot without private wall or illegal LegalAction',()=>{
  const state=r3(),view=createPlayerView(state,0),b=createBot({seat:0,seed:'phase3-bot-seed'});
  const safe=readPlayerView(view);
  assert.equal(safe.view.audienceSeat,0);
  assert.equal(view.opponents.every(x=>!Object.hasOwn(x,'concealed')),true);
  assert.equal(Object.hasOwn(view,'wall'),false);
  assert.equal(Object.hasOwn(view,'rng'),false);
  assert.equal(JSON.stringify(view).includes('fixtureDeck'),false);
  const d=chooseBotAction(b,view);
  assert.equal(d.status,'ready');
  assert.equal(validateBotDecision(b,view,d),true);
  assert.ok(view.legalActions.some(a=>a.actionId===d.actionId));
  const next=applyAction(state,{actorSeat:0,actionId:d.actionId,expectedRevision:d.expectedRevision}).state;
  assert.equal(validateGameState(next),true);
  assert.throws(()=>applyAction(next,{actorSeat:0,actionId:d.actionId,expectedRevision:d.expectedRevision}));
});
test('R3 claim window currently stops automated Bot controller instead of inventing a winner',async()=>{
  const start=r3(),a=listLegalActions(start,0).find(x=>x.kind==='discard');
  assert.ok(a);
  const after=applyAction(start,{actorSeat:0,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
  assert.equal(after.round.phase,'claim_window');
  let submissions=0;
  const bots=[1,2,3].map(seat=>createBot({seat,seed:'phase3-bot'+seat}));
  const controller=createBotController({bots,humanSeat:0,
    getActingSeat:()=>1,getPlayerView:seat=>createPlayerView(after,seat),
    submitAction:()=>{submissions++;}});
  const step=await controller.tick();
  assert.equal(step.status,'claim-adjudication-unavailable');
  assert.equal(submissions,0);
});
test('Replay remains owner-only and deterministic for previously supported sandbox history',()=>{
  let state=createGame({gameId:'phase3-replay-bounded',seed:'phase3-replay-seed',
    profileId:'tw16-four-player-sandbox',ruleVersion:'experimental-move-v1'});
  const action=listLegalActions(state,0)[0];
  state=applyAction(state,{actorSeat:action.actorSeat,actionId:action.actionId,
    expectedRevision:action.expectedRevision}).state;
  const service=createReplayService({storage:new Map()});
  const manifest=service.saveReplay(state,{ownerSeat:0});
  assert.equal(manifest.completionStatus,'incomplete');
  const frame=service.getReplayFrame(manifest.replayId,1,{viewerSeat:0});
  assert.equal(frame.playerView.audienceSeat,0);
  assert.equal(Object.hasOwn(frame.playerView,'wall'),false);
  assert.throws(()=>service.getReplayFrame(manifest.replayId,1,{viewerSeat:1}));
  assert.throws(()=>service.getReplayFrame(manifest.replayId,1,{perspective:'postgame'}));
});
test('Phase 3 table persistence is versioned and disjoint from V1 canonical archives',()=>{
  assert.notEqual(TABLE_STORAGE_KEY,'tw-mahjong-trainer:archive:v3');
  assert.notEqual(TABLE_STORAGE_KEY,'tw-mahjong-master-academy:state:v1');
  assert.ok(TABLE_STORAGE_KEY.endsWith(':v1'));
});
