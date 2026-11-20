import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, listLegalActions, applyAction, replayGame, validateGameState,
  createPlayerView, listPendingClaimResponders, getClaimWindowPublic,
  getRuleCapabilities, RuleCapabilityError,
} from '../../src/rules/index.js';
import { SEED_87_R4 as GOLDEN } from './fixtures/seed-87-r4-trace.js';

const clone=x=>JSON.parse(JSON.stringify(x));
const legal=(state,seat,kind)=>listLegalActions(state,seat).filter(a=>!kind||a.kind===kind);
function start(){
  return createGame({gameId:GOLDEN.gameId,seed:GOLDEN.seed,...GOLDEN.ruleRef});
}
function replaySubmittedActions(stopRevision=GOLDEN.expected.revision){
  let state=start(),performed=0;
  assert.equal(state.revision,1);
  for(const [revision,seat,actionId,afterRevision] of GOLDEN.successfulActions){
    if(revision>=stopRevision)break;
    assert.equal(state.revision,revision,'actual revision before submission');
    const choices=legal(state,seat);
    const selected=choices.find(a=>a.actionId===actionId);
    assert.ok(selected,'Rules must issue the original legal action at '+revision);
    assert.equal(selected.expectedRevision,revision);
    assert.equal(selected.actorSeat,seat);
    state=applyAction(state,{actorSeat:seat,actionId,expectedRevision:revision}).state;
    assert.equal(state.revision,afterRevision);
    assert.equal(state.revision,state.events.length);
    performed++;
  }
  assert.equal(state.revision,stopRevision);
  return {state,performed};
}
const submit=(s,a)=>applyAction(s,{
  actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision,
}).state;

test('R4 Seed 87 exact 157-action trace ends at two private legal WINs, revision 162',()=>{
  const {state:s,performed}=replaySubmittedActions();
  assert.equal(performed,157);
  assert.equal(s.gameId,'bot-r3-87');
  assert.equal(s.round.phase,GOLDEN.expected.phase);
  assert.equal(s.events.length,162);
  assert.equal(s.round.scores,undefined,'no fabricated settlement');
  assert.equal(s.extensions.tw16.result,null);
  const w=s.extensions.tw16.window;
  assert.equal(w.fromSeat,GOLDEN.expected.fromSeat);
  assert.equal(w.discardEventId,GOLDEN.expected.discardEventId);
  assert.equal(w.tileId,GOLDEN.expected.tileId);
  assert.deepEqual(w.decisions.map(d=>[d.seat,d.kind]),[[3,'win'],[0,'win']]);
  assert.deepEqual(listPendingClaimResponders(s),[1]);
  assert.deepEqual(legal(s,1).map(a=>a.kind),['pass']);
  for(const seat of [0,2,3])assert.deepEqual(legal(s,seat),[]);
  assert.equal(validateGameState(s),true,'all 144 physical tile IDs conserved');
  assert.deepEqual(replayGame(s),s,'complete private event replay must match');
});

test('R4 Seed 87 final Rules-issued PASS is valid, but settlement is explicitly unsupported and atomic',()=>{
  const {state:s}=replaySubmittedActions();
  const capability=getRuleCapabilities(GOLDEN.ruleRef);
  assert.equal(capability.status,'experimental');
  assert.deepEqual(capability.claimArbitration.multipleDiscardWins,
    {status:'unsupported',capability:'multiple_winners'});
  assert.equal(capability.scoring.policy,'tw16-minimal-tai-v1');
  const view=createPlayerView(s,1),pass=view.legalActions[0];
  assert.equal(pass.kind,'pass');
  assert.equal(pass.actorSeat,1);
  assert.equal(pass.expectedRevision,162);
  assert.equal(pass.actionId,GOLDEN.rejectedSubmission.actionId);
  const before=clone(s);
  assert.throws(()=>submit(s,pass),error=>
    error instanceof RuleCapabilityError &&
    error.name==='RuleCapabilityError' &&
    error.code===GOLDEN.expected.errorCode &&
    error.capability===GOLDEN.expected.capability &&
    /multiple_winners/.test(error.message));
  assert.deepEqual(s,before,'a failed capability gate must never mutate its input');
  assert.equal(s.round.phase,'claim_window');
  assert.equal(s.events.length,162);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
});

test('R4 Seed 87 illegal, stale and duplicate claims fail before adjudication',()=>{
  const {state:s}=replaySubmittedActions();
  const pass=legal(s,1,'pass')[0];
  assert.throws(()=>applyAction(s,{actorSeat:1,actionId:pass.actionId,
    expectedRevision:161}),/Stale/);
  assert.throws(()=>applyAction(s,{actorSeat:2,actionId:pass.actionId,
    expectedRevision:162}),/illegal/);
  assert.throws(()=>applyAction(s,{actorSeat:0,actionId:'forged:win',
    expectedRevision:162}),/illegal/);
  assert.throws(()=>applyAction(s,{actorSeat:3,actionId:
    s.extensions.tw16.window.decisions[0].actionId,
    expectedRevision:162}),/illegal/);
  assert.equal(s.revision,162);
  assert.equal(validateGameState(s),true);
});

test('R4 Seed 87 PlayerView remains noninterfering across two concealed WIN versus PASS intents',()=>{
  const {state:before}=replaySubmittedActions(160);
  const [seat3win]=legal(before,3,'win');
  assert.ok(seat3win);
  const winningA=submit(before,seat3win);
  const [seat0win]=legal(winningA,0,'win');
  assert.ok(seat0win);
  const winningB=submit(winningA,seat0win);
  const passingA=submit(before,legal(before,3,'pass')[0]);
  const passingB=submit(passingA,legal(passingA,0,'pass')[0]);
  assert.equal(winningB.revision,162);
  assert.equal(passingB.revision,162);
  const winningView=createPlayerView(winningB,1);
  const passView=createPlayerView(passingB,1);
  assert.deepEqual(winningView,passView,
    'third-party PlayerView cannot distinguish private WIN and PASS');
  assert.deepEqual(getClaimWindowPublic(winningB),
    getClaimWindowPublic(passingB));
  assert.equal(getClaimWindowPublic(winningB).pendingCount,1);
  for(const event of winningView.publicEvents.slice(-2)){
    assert.equal(event.type,'claim');
    assert.deepEqual(event.payload,{});
    assert.equal(Object.hasOwn(event,'actorSeat'),false);
    assert.equal(Object.hasOwn(event,'causedByActionId'),false);
  }
  assert.ok(winningView.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  assert.equal(Object.hasOwn(winningView,'wall'),false);
  assert.equal(Object.hasOwn(winningView,'rng'),false);
});

test('R4 Seed 87 positive independent single-WIN counterfactual settles zero-sum, without rewriting actual trace',()=>{
  // This is a distinct legal hypothetical branch, NOT a replacement for the
  // actual Seed 87 two-WIN result. It tests that the existing single-win path
  // has not been regressed by R4 capability negotiation.
  let {state:s}=replaySubmittedActions(160);
  s=submit(s,legal(s,3,'win')[0]);
  s=submit(s,legal(s,0,'pass')[0]);
  assert.equal(s.round.phase,'claim_window');
  assert.deepEqual(listPendingClaimResponders(s),[1]);
  s=submit(s,legal(s,1,'pass')[0]);
  assert.equal(s.round.phase,'settled');
  const settlement=s.extensions.tw16.result;
  assert.equal(settlement.reason,'win');
  assert.equal(settlement.winnerSeat,3);
  assert.equal(settlement.sourceSeat,2);
  assert.equal(settlement.via,'discard');
  assert.equal(settlement.delta.reduce((x,y)=>x+y,0),0);
  assert.deepEqual(s.round.scores,settlement.delta);
  assert.deepEqual(listPendingClaimResponders(s),[]);
  assert.equal(getClaimWindowPublic(s),null);
  for(let seat=0;seat<4;seat++)assert.deepEqual(legal(s,seat),[]);
  assert.equal(validateGameState(s),true);
  assert.deepEqual(replayGame(s),s);
  assert.throws(()=>applyAction(s,{actorSeat:1,
    actionId:'fake-settle',expectedRevision:s.revision}),/illegal/);
});

test('R4 profile capability contract is static, version-scoped and hides all claimant identities',()=>{
  const once=getRuleCapabilities(GOLDEN.ruleRef);
  const another=getRuleCapabilities(GOLDEN.ruleRef);
  assert.deepEqual(once,another);
  assert.equal(once.claimArbitration.responders,3);
  assert.deepEqual(once.claimArbitration.priority,['win','kong','pong','chi']);
  assert.equal(once.claimArbitration.robAddedKong.status,'unsupported');
  assert.equal(once.claimArbitration.unsupportedDisposition,'fail-closed-without-settlement');
  const encoded=JSON.stringify(once);
  for(const field of ['GameState','decisions','intent','tileIds','winningSeats','wall','actorSeat'])
    assert.ok(!encoded.includes(field));
  const sandbox=getRuleCapabilities({profileId:'tw16-four-player-sandbox',
    ruleVersion:'experimental-move-v1'});
  assert.deepEqual(sandbox.claimArbitration.supportedActions,[]);
  assert.equal(sandbox.claimArbitration.singleDiscardWin,'unsupported');
  assert.throws(()=>getRuleCapabilities({
    profileId:GOLDEN.ruleRef.profileId,ruleVersion:'unreviewed-rule-version'
  }),/Unknown RuleProfile/);
});
