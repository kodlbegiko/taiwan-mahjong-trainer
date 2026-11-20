import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createGame, createPlayerView } from '../../src/rules/index.js';
import { createBot, chooseBotAction, validateBotDecision } from '../../src/bots/index.js';

/**
 * Reproducible fixture set; latency figures are machine/CI specific, never a
 * universal iPhone promise. Print observed metrics, not fabricated constants.
 */
test('fixed fixture set: legal-decision rate, invalid rate, latency and repeatability', () => {
  const samples=[], choices=[], levels=['Beginner','Intermediate','Advanced'];
  let valid=0, invalid=0, repeated=0;
  for(let i=0;i<8;i++) {
    const state=createGame({gameId:'benchmark-'+i,seed:'bots-bench-'+i,
      profileId:'tw16-four-player-sandbox',ruleVersion:'experimental-move-v1'});
    const view=createPlayerView(state,0);
    for(const level of levels) {
      const bot=createBot({seat:0,difficulty:level,seed:'bench-independent-seed-v1'});
      const start=performance.now();
      const choice=chooseBotAction(bot,view);
      samples.push(performance.now()-start);
      try { validateBotDecision(bot,view,choice); valid++; } catch { invalid++; }
      const stable=chooseBotAction(bot,structuredClone(view));
      if (JSON.stringify(stable)===JSON.stringify(choice)) repeated++;
      choices.push({fixture:i,level,actionId:choice.actionId,status:choice.status});
    }
  }
  const sorted=[...samples].sort((a,b)=>a-b);
  const sum=samples.reduce((x,y)=>x+y,0);
  const report={
    benchmarkVersion:'bot-bench/0.1.0',fixtureSeeds:'bots-bench-0..7',
    botSeed:'bench-independent-seed-v1',profile:'tw16-four-player-sandbox@experimental-move-v1',
    decisions:samples.length,valid,invalid,repeated,legalDecisionRate:valid/samples.length,
    averageDecisionMs:Number((sum/samples.length).toFixed(3)),
    p95DecisionMs:Number(sorted[Math.ceil(sorted.length*0.95)-1].toFixed(3)),
    maxDecisionMs:Number(sorted.at(-1).toFixed(3)),
    fullRoundCompletionRate:null,
    completeRules:false,
    strategyConsistencyFixture:choices,
    limits:'8 fixed starting states, no adversarial hardware or iPhone timing guarantee',
  };
  console.log('BOT_BENCHMARK '+JSON.stringify(report));
  assert.equal(valid,samples.length);
  assert.equal(invalid,0);
  assert.equal(repeated,samples.length);
  assert.ok(sorted.every(ms => Number.isFinite(ms) && ms>=0));
  // Never claim a settlement or win from the experimental draw/discard Rules subset.
  assert.equal(report.fullRoundCompletionRate,null);
});
