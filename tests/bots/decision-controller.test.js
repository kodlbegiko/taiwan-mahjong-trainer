import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createPlayerView, applyAction, listLegalActions,
  replayGame, validateGameState,
} from '../../src/rules/index.js';
import {
  createBot, chooseBotAction, validateBotDecision, runBotTurn, createBotController,
  BOT_ENGINE_VERSION,
} from '../../src/bots/index.js';

const makeGame = (seed = 'bots-fixture-v1', dealerSeat = 0) =>
  createGame({ gameId: 'bots-test', seed, dealerSeat,
    profileId: 'tw16-four-player-sandbox', ruleVersion: 'experimental-move-v1' });
const bot = (seat, difficulty = 'Beginner', seed = 'independent-seed') =>
  createBot({ seat, difficulty, seed });
const clone = x => JSON.parse(JSON.stringify(x));
const first = (state, seat) => {
  const action = listLegalActions(state, seat)[0];
  assert.ok(action, 'expected at least one legal action');
  return applyAction(state, { actorSeat: seat, actionId: action.actionId, expectedRevision: action.expectedRevision }).state;
};

test('public bot API returns only a current, Engine-issued LegalAction for all levels', () => {
  const state = makeGame(), view = createPlayerView(state, 0);
  for (const difficulty of ['Beginner','Intermediate','Advanced']) {
    const b = bot(0, difficulty);
    const d = chooseBotAction(b, view);
    assert.equal(d.status, 'ready');
    assert.equal(d.botVersion, BOT_ENGINE_VERSION);
    assert.equal(d.actorSeat, 0);
    assert.equal(d.expectedRevision, state.revision);
    assert.ok(view.legalActions.some(a => a.actionId === d.actionId));
    assert.equal(validateBotDecision(b, view, d), true);
    assert.equal(typeof d.rngSeed, 'string');
    assert.equal(Object.hasOwn(d, 'wall'), false);
    assert.equal(Object.hasOwn(d, 'state'), false);
    assert.equal(Object.hasOwn(d, 'rng'), false);
  }
});

test('fixed independent bot seed / identical public view gives identical Beginner, Intermediate and Advanced decisions', () => {
  const view = createPlayerView(makeGame('fixed-public-seed'), 0);
  for (const level of ['Beginner','Intermediate','Advanced']) {
    const b = bot(0, level, 'bot-only-seed');
    assert.deepEqual(chooseBotAction(b, view), chooseBotAction(b, clone(view)));
  }
  const versions = ['Beginner','Intermediate','Advanced'].map(d =>
    chooseBotAction(bot(0,d),view).strategyVersion);
  assert.equal(new Set(versions).size, 3, 'levels use distinct, declared policies');
});

test('strict PlayerView boundary rejects full state, hidden fields, opponent hands and stale or illegal bot output', () => {
  const state = makeGame('hide-data'), view = createPlayerView(state,0), b=bot(0);
  assert.throws(() => chooseBotAction(b, state));
  assert.throws(() => chooseBotAction(b, { ...view, wall: state.wall }));
  assert.throws(() => chooseBotAction(b, { ...view, rng: state.rng }));
  assert.throws(() => chooseBotAction(b, {
    ...view, opponents: view.opponents.map((p,i) => i === 0 ? {...p, concealed: state.players[p.seat].concealed} : p),
  }));
  assert.throws(() => chooseBotAction(bot(1), view), /seat/);
  const d=chooseBotAction(b,view);
  assert.throws(() => validateBotDecision(b,view,{...d, actionId:'fabricated'}), /LegalAction/);
  assert.throws(() => validateBotDecision(b,view,{...d, expectedRevision:d.expectedRevision+1}), /context/);
  assert.throws(() => applyAction(state, {actorSeat:0,actionId:'fabricated',expectedRevision:state.revision}));
});

test('opponent concealed and future-wall physical swap cannot affect the PlayerView-only decision', () => {
  const state = makeGame('counterfactual-wall'), altered=clone(state);
  const other=1, unknown=altered.players[other].concealed[0];
  altered.players[other].concealed[0]=altered.wall[0];
  altered.wall[0]=unknown;
  assert.equal(validateGameState(altered,{replay:false}),true);
  const originalView=createPlayerView(state,0), swappedView=createPlayerView(altered,0);
  assert.deepEqual(originalView,swappedView);
  for(const level of ['Beginner','Intermediate','Advanced']) {
    assert.deepEqual(chooseBotAction(bot(0,level),originalView),chooseBotAction(bot(0,level),swappedView));
  }
});

test('draw selection never predicts the wall; stale action rejected by the real authority', async () => {
  let state = makeGame('draw-only');
  state = first(state, 0); // public discard, actor=1 now needs a private draw
  const view=createPlayerView(state,1), b=bot(1,'Advanced');
  const d=chooseBotAction(b,view);
  assert.equal(view.round.phase,'await_draw');
  assert.equal(d.actionId,view.legalActions[0].actionId);
  assert.equal(view.legalActions[0].tileIds.length,0);
  const submitted = await runBotTurn({bot:b,playerView:view,
    submitAction: a => { state=applyAction(state,a).state; }});
  assert.equal(submitted.status,'acted');
  assert.equal(state.round.phase,'await_discard');
  assert.throws(() => applyAction(state,{
    actorSeat:1, actionId:d.actionId, expectedRevision:d.expectedRevision,
  }),/Stale/);
  assert.equal(validateGameState(state),true);
});

test('three-bot controller stops at human, yields in bounded chunks, pauses and resumes with a checkpoint', async () => {
  let state=makeGame('controller-seed'), yieldCount=0;
  const cfg={
    bots:[bot(1),bot(2,'Intermediate'),bot(3,'Advanced')],
    humanSeat:0,
    getActingSeat:()=>state.round.currentSeat,
    getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:async a=>{state=applyAction(state,a).state;},
    yieldControl:async()=>{yieldCount++;},
  };
  const c=createBotController(cfg);
  assert.equal((await c.tick()).status,'human-turn');
  const humanAction=listLegalActions(state,0)[0];
  assert.equal((await c.submitHumanAction({
    actionId:humanAction.actionId,expectedRevision:humanAction.expectedRevision,
  })).status,'acted');
  c.pause();
  assert.deepEqual(c.checkpoint(),{paused:true});
  assert.equal((await c.runUntilHuman()).status,'paused');
  const resumed=createBotController({...cfg,checkpoint:c.checkpoint()});
  assert.equal((await resumed.tick()).status,'paused');
  resumed.resume();
  const r=await resumed.runUntilHuman({maxActions:8});
  assert.equal(r.status,'human-turn');
  assert.equal(r.actions,6); // three opponents: draw + discard each
  assert.ok(yieldCount>=5);
  assert.equal(resumed.history().length,6);
  assert.ok((await resumed.publicEvents()).every(e => e.visibility==='public'));
  assert.equal(validateGameState(state),true);
  assert.deepEqual(replayGame(state),state);
});

test('no repeated invalid submit: failed authority callback and unchanged revision are bounded', async () => {
  const state=makeGame('reject-seed',1);
  const c=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>1,getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:()=>{throw new Error('Rejected by Rules');},
  });
  assert.equal((await c.tick()).status,'submission-rejected');
  assert.equal((await c.tick()).status,'duplicate-revision-blocked');
  const c2=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>1,getPlayerView:seat=>createPlayerView(state,seat),
    submitAction:()=>{}, // intentionally broken authority mock that never advances
  });
  assert.equal((await c2.tick()).status,'acted');
  assert.equal((await c2.tick()).status,'duplicate-revision-blocked');
});

test('claim-window collision fails closed until Rules supplies an adjudication API', async () => {
  const state=makeGame('claim-stub',1);
  const v=createPlayerView(state,1);
  v.round.phase='claim_window';
  let submissions=0;
  const c=createBotController({
    bots:[bot(1),bot(2),bot(3)],humanSeat:0,
    getActingSeat:()=>1, getPlayerView:()=>v,
    submitAction:()=>{submissions++;},
  });
  assert.equal((await c.tick()).status,'claim-adjudication-unavailable');
  assert.equal(submissions,0);
});

test('bounded entire experimental wall exhaustion: no infinite loop, no false settled/win status', () => {
  let state=makeGame('full-wall-stress'), applied=0, draws=0;
  const actors=[bot(0),bot(1),bot(2),bot(3)];
  while (applied < 150) {
    const seat=state.round.currentSeat;
    const view=createPlayerView(state,seat);
    const d=chooseBotAction(actors[seat],view);
    assert.equal(validateBotDecision(actors[seat],view,d),true);
    if (d.status==='no-legal-action') break;
    assert.equal(d.status,'ready');
    const selected=view.legalActions.find(a=>a.actionId===d.actionId);
    if (selected.kind==='draw') draws++;
    state=applyAction(state,{actorSeat:seat,actionId:d.actionId,expectedRevision:d.expectedRevision}).state;
    applied++;
  }
  assert.equal(draws,71);
  assert.equal(applied,143); // dealer discard + 71 draws + 71 discards
  assert.equal(state.wall.length,0);
  assert.equal(state.round.phase,'await_draw');
  assert.deepEqual(listLegalActions(state,state.round.currentSeat),[]);
  assert.equal(validateGameState(state),true);
  assert.deepEqual(replayGame(state),state);
  // No Rules "settled" phase: this is an incomplete experimental simulation, not a completed round.
  assert.notEqual(state.round.phase,'settled');
});
