/**
 * Real Rules+Strategy cross-module contract gate.
 *
 * This file intentionally imports the Rules Engine public API ONLY when the
 * source is present in the checked-out tree. PR #36 alone has no src/rules;
 * a combined checkout MUST run with STRATEGY_REQUIRE_RULES_INTEGRATION=1 so
 * absence cannot silently become a green integration check.
 *
 * No Rules source files are copied into the Strategy PR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePlayerView, analyzeEfficiencyRoutes, analyzeAttackDefense,
  inspectClaimOptions, explainStrategy, STRATEGY_ENGINE_VERSION,
} from '../../src/strategy/index.js';
import { validatePlayerView } from '../../src/strategy/view.js';
import { CONTRACT_VERSION } from '../../src/strategy/view.js';

const REQUIRE = process.env.STRATEGY_REQUIRE_RULES_INTEGRATION === '1';
let rules;
try {
  rules = await import('../../src/rules/index.js');
} catch (error) {
  const absent = error?.code === 'ERR_MODULE_NOT_FOUND' &&
    String(error.message).includes('/src/rules/index.js');
  if (!absent || REQUIRE) throw error;
}

const profileRef = Object.freeze({
  profileId: 'tw16-four-player-sandbox',
  ruleVersion: 'experimental-move-v1',
});
const opts = Object.freeze({ seed: 'real-rules-strategy-combined-v1', samples: 5, maxSimulatedRoutes: 2 });
const json = value => JSON.parse(JSON.stringify(value));
const get = (recommendation, name) => recommendation.metrics.find(metric => metric.name === name);

function expectAnalysis(view, result) {
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.contractVersion, CONTRACT_VERSION);
  assert.equal(result.engineVersion, STRATEGY_ENGINE_VERSION);
  assert.match(result.analysisId, /^strategy:/);
  assert.deepEqual(result.viewRef, {
    gameId: view.gameId, viewId: view.viewId,
    asOfEventSeq: view.asOfEventSeq, audienceSeat: view.audienceSeat,
  });
  assert.deepEqual(result.ruleRef, view.ruleRef);
  assert.deepEqual(result.legalActionIds, view.legalActions.map(action => action.actionId));
  assert.ok(['exact-structural','heuristic','model-estimate','unavailable'].includes(result.status));
  assert.ok(Array.isArray(result.assumptions) && result.assumptions.length);
  assert.ok(Array.isArray(result.limitations) && result.limitations.length);
  const legal = new Map(view.legalActions.map(a => [a.actionId,a]));
  for (const recommendation of result.recommendations) {
    const action = legal.get(recommendation.actionId);
    assert.ok(action, 'strategy recommendation must have real Rules Engine LegalAction');
    assert.equal(action.actorSeat, view.audienceSeat);
    assert.equal(action.expectedRevision, view.asOfEventSeq);
    assert.equal(action.kind,'discard','experimental RuleProfile cannot recommend claim/win');
    assert.ok(Number.isSafeInteger(recommendation.rank) && recommendation.rank >= 0);
    assert.ok(Array.isArray(recommendation.reasonCodes));
    assert.ok(Array.isArray(recommendation.metrics) && recommendation.metrics.length);
    for (const m of recommendation.metrics) {
      assert.ok(['exact','heuristic','estimated','unknown'].includes(m.epistemic));
      assert.ok(typeof m.method === 'string' && m.method.length);
      assert.deepEqual(m.ruleRef, view.ruleRef);
      if (m.epistemic === 'unknown') assert.equal(m.value,null);
      else assert.ok(typeof m.value==='number' && Number.isFinite(m.value));
      if (m.epistemic === 'estimated') {
        assert.ok(Number.isInteger(m.sampleSize) && m.sampleSize > 0);
        assert.equal(m.calibrated,false);
        assert.ok(m.interval && m.interval.low<=m.value && m.value<=m.interval.high);
      }
    }
    for (const riskName of ['dealInRisk','expectedFans']) {
      assert.equal(get(recommendation,riskName).value,null);
      assert.equal(get(recommendation,riskName).epistemic,'unknown');
    }
  }
}

function step(state, actorSeat, action) {
  assert.ok(state && action);
  assert.equal(action.actorSeat, actorSeat);
  assert.equal(action.expectedRevision, state.revision);
  return rules.applyAction(state,{
    actorSeat, actionId:action.actionId, expectedRevision:action.expectedRevision,
  }).state;
}

if (!rules) {
  test('Rules+Strategy public API integration (requires combined checkout)', {
    skip:'Rules Engine PR #34 is absent from standalone Strategy PR #36; run combined SHA with STRATEGY_REQUIRE_RULES_INTEGRATION=1',
  },()=>{});
} else {
  test('REAL Rules→Strategy→applyAction→replay→PlayerView lifecycle, same checkout',()=>{
    const rule=rules.getRuleProfile(profileRef.profileId,profileRef.ruleVersion);
    assert.equal(rule.contractVersion,CONTRACT_VERSION);
    assert.equal(rule.status,'experimental');
    assert.equal(rule.scope,'four-player');
    assert.equal(rule.scoringPolicy.mode,'undefined');
    assert.equal(rule.turnPolicy.claimPriority,'unverified');
    assert.equal(rule.turnPolicy.replacementDraw,'unverified');

    const game=rules.createGame({
      gameId:'strategy-live-001',seed:'rules-strategy-lifecycle-001',
      ...profileRef,dealerSeat:0,
    });
    assert.equal(rules.validateGameState(game),true);
    const view=rules.createPlayerView(game,game.round.currentSeat);
    assert.equal(validatePlayerView(view),true);
    assert.equal(view.asOfEventSeq,game.revision);
    assert.equal(view.capabilities.roundActions,false);
    assert.deepEqual(new Set(view.legalActions.map(a=>a.kind)),new Set(['discard']));
    const analysis=analyzePlayerView(view,opts);
    expectAnalysis(view,analysis);
    assert.equal(analysis.status,'model-estimate');
    assert.equal(analysis.modelVersion,'public-unknown-draws/1.0.0');
    assert.equal(analysis.recommendations.length,view.legalActions.length);
    assert.equal(inspectClaimOptions(view).length,0);

    const routes=analyzeEfficiencyRoutes(view,{samples:0});
    assert.equal(routes.routes.length,analysis.recommendations.length);
    assert.equal(explainStrategy(analysis,view).length,analysis.recommendations.length);
    assert.equal(analyzeAttackDefense(view).dealInRisk.value,null);
    const chosen=view.legalActions.find(a=>a.actionId===analysis.recommendations[0].actionId);
    assert.ok(chosen);
    const updated=step(game,game.round.currentSeat,chosen);
    assert.equal(rules.validateGameState(updated),true);
    assert.deepEqual(rules.replayGame(updated),updated);
    const nextSeat=updated.round.currentSeat;
    const waiting=rules.createPlayerView(updated,nextSeat);
    assert.equal(validatePlayerView(waiting),true);
    assert.deepEqual(waiting.legalActions.map(a=>a.kind),['draw']);
    const unavailable=analyzePlayerView(waiting,opts);
    expectAnalysis(waiting,unavailable);
    assert.equal(unavailable.status,'unavailable');
    assert.deepEqual(unavailable.recommendations,[]);

    const drawn=step(updated,nextSeat,waiting.legalActions[0]);
    assert.equal(rules.validateGameState(drawn),true);
    assert.deepEqual(rules.replayGame(drawn),drawn);
    const resumed=rules.createPlayerView(drawn,nextSeat);
    assert.equal(validatePlayerView(resumed),true);
    assert.ok(resumed.legalActions.length>=1);
    assert.ok(resumed.legalActions.every(a=>a.kind==='discard'));
    const postAnalysis=analyzePlayerView(resumed,opts);
    expectAnalysis(resumed,postAnalysis);
    assert.equal(postAnalysis.status,'model-estimate');
    assert.notEqual(postAnalysis.viewRef.viewId,analysis.viewRef.viewId);
    assert.notEqual(postAnalysis.analysisId,analysis.analysisId);
    assert.deepEqual(postAnalysis,analyzePlayerView(json(resumed),opts));
  });

  test('REAL Rules PlayerView projection hides opponent private hands and unrevealed wall',()=>{
    const original=rules.createGame({gameId:'strategy-secrets-001',seed:'secrets-seed-001',...profileRef});
    assert.equal(rules.validateGameState(original),true);
    const changed=json(original);
    const opponentSeat=(original.round.currentSeat+1)%4;
    const oldOpponentTile=changed.players[opponentSeat].concealed[0];
    const oldWallTile=changed.wall[0];
    assert.notEqual(oldOpponentTile,oldWallTile);
    changed.players[opponentSeat].concealed[0]=oldWallTile;
    changed.wall[0]=oldOpponentTile;
    // Counterfactual valid physical inventory; cannot be replayed from the same original seed,
    // and must NOT be used as a real game state for authoritative action execution.
    assert.equal(rules.validateGameState(changed,{replay:false}),true);
    const currentSeat=original.round.currentSeat;
    const originalView=rules.createPlayerView(original,currentSeat);
    const changedView=rules.createPlayerView(changed,currentSeat);
    assert.deepEqual(originalView,changedView);
    for(const view of [originalView,changedView]){
      assert.equal(validatePlayerView(view),true);
      assert.equal(Object.hasOwn(view,'wall'),false);
      assert.equal(Object.hasOwn(view,'rng'),false);
      assert.ok(view.opponents.every(p=>!Object.hasOwn(p,'concealed')));
      assert.ok(view.publicEvents.every(e=>e.visibility==='public' && !Object.hasOwn(e.payload,'tileId')));
    }
    const resultA=analyzePlayerView(originalView,opts);
    const resultB=analyzePlayerView(changedView,opts);
    assert.deepEqual(resultA,resultB,'hidden opponent/wall swaps must not change strategy');
    assert.deepEqual(resultA,analyzePlayerView(originalView,opts),'fixed seed must reproduce identical sample');
    assert.throws(()=>analyzePlayerView(changed,opts),/非公開欄位/);
    assert.throws(()=>analyzePlayerView({...originalView,answerKey:{secret:'wrong'}},opts),/非公開欄位/);
    assert.throws(()=>analyzePlayerView({...originalView,wall:original.wall},opts),/非公開欄位/);
  });

  test('REAL Rules LegalAction actor/revision tampering fails closed and no unsupported claims exist',()=>{
    const game=rules.createGame({gameId:'strategy-legal-001',seed:'legal-seed-001',...profileRef});
    const view=rules.createPlayerView(game,game.round.currentSeat);
    const stale=json(view);
    stale.legalActions[0].expectedRevision-=1;
    assert.throws(()=>analyzePlayerView(stale,{samples:0}),/expectedRevision/);
    const foreign=json(view);
    foreign.legalActions[0].actorSeat=(view.audienceSeat+1)%4;
    assert.throws(()=>analyzePlayerView(foreign,{samples:0}),/actor\/action/);
    const injected=json(view);
    injected.legalActions.push({...json(view.legalActions[0]),actionId:'forged:claim',
      kind:'pong',tileIds:[]});
    // LegalAction shape alone cannot attest an engine-signed decision; callers must use
    // the Rules-created projection, not injected data. No claim becomes a recommendation.
    const injectionResult=analyzePlayerView(injected,{samples:0});
    assert.ok(injectionResult.recommendations.every(r=>r.actionId!=='forged:claim'));
    assert.ok(view.legalActions.every(a=>['draw','discard'].includes(a.kind)));
    const first=view.legalActions[0];
    assert.throws(()=>rules.applyAction(game,{
      actorSeat:view.audienceSeat,actionId:first.actionId,expectedRevision:first.expectedRevision-1,
    }),/Stale/);
    assert.throws(()=>rules.applyAction(game,{
      actorSeat:view.audienceSeat,actionId:'forged:claim',expectedRevision:game.revision,
    }),/illegal/);
  });
}
