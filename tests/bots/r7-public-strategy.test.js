import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, createPlayerView, listLegalActions, applyAction,
} from '../../src/rules/index.js';
import {
  createBot, chooseBotAction, validateBotDecision, inspectBotDiscardScores,
} from '../../src/bots/index.js';
import {rankPublicDiscardCandidates, R7_POLICY_VERSION} from '../../src/bots/strategy-r7.js';

const clone = x => JSON.parse(JSON.stringify(x));
const ref = {profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'};
const metrics = (s,c,k) => [
  {name:'postDiscardShanten',value:s},
  {name:'oneTurnEffectiveCopies',value:c},
  {name:'oneTurnEffectiveKinds',value:k},
];
const rec = (id,rank,s,c,k) => ({actionId:id,rank,metrics:metrics(s,c,k)});
function pressureFixture(){
  const empty = {melds:[],river:[]};
  const open = n => Array.from({length:n},(_,i)=>({kind:'sequence',open:true,
    tileIds:[`t:${9+i*3}:0`,`t:${10+i*3}:0`,`t:${11+i*3}:0`]}));
  return {
    self:{...empty,concealed:[{tileType:0},{tileType:1}]},
    opponents:[
      {melds:open(3),river:[{tileId:'t:1:2'}]},
      {...empty},{...empty},
    ],
    legalActions:[
      {kind:'discard',actionId:'a',tileIds:['t:0:0']},
      {kind:'discard',actionId:'b',tileIds:['t:1:0']},
    ],
  };
}

test('R7 scores are inspectable: advanced pressure differs, exact shanten remains a hard guard',()=>{
  const view=pressureFixture();
  const candidates=[rec('a',0,2,8,3),rec('b',1,2,5,2)];
  const standard=rankPublicDiscardCandidates(view,candidates,'Intermediate');
  const advanced=rankPublicDiscardCandidates(view,candidates,'Advanced');
  assert.equal(standard[0].actionId,'a');
  assert.equal(advanced[0].actionId,'b');
  assert.equal(advanced[0].components.pressureActive,true);
  assert.equal(advanced[0].components.repeatDiscardingThreats,1);
  assert.equal(advanced[0].components.exposedPublicCopies,1);
  assert.equal(advanced[0].components.shanten,2);
  assert.equal(advanced[0].score,
    Object.entries(advanced[0].components)
      .filter(([k])=>['shantenScore','efficiencyScore','publicCautionScore','handShapeProxy'].includes(k))
      .reduce((sum,[,v])=>sum+v,0));
  const worse=rankPublicDiscardCandidates(view,[candidates[0],rec('b',1,3,5,2)],'Advanced');
  assert.equal(worse[0].actionId,'a','no one-shanten sacrifice for an uncalibrated safety proxy');
  const noPressure=clone(view);
  noPressure.opponents[0].melds=[];
  assert.equal(rankPublicDiscardCandidates(noPressure,candidates,'Advanced')[0].actionId,'a');
});

test('R7 strict boundary prevents hidden-wall or opponent-concealed information reaching policy',()=>{
  for(const i of [0,1,2]){
    const state=createGame({gameId:'r7-private-'+i,seed:'r7-private-'+i,
      profileId:'tw16-four-player-sandbox',ruleVersion:'experimental-move-v1',
      dealerSeat:i});
    const view=createPlayerView(state,i);
    for(const difficulty of ['Intermediate','Advanced']){
      const bot=createBot({seat:i,difficulty,seed:'independent-r7-bot'});
      assert.deepEqual(chooseBotAction(bot,view),chooseBotAction(bot,clone(view)));
      const scores=inspectBotDiscardScores(bot,view);
      assert.ok(scores.length > 0);
      assert.ok(scores.every(s=>view.legalActions.some(a=>a.actionId===s.actionId)));
      assert.ok(scores.every(s=>Number.isFinite(s.score) && s.components.effectiveCopies>=0));
      assert.equal(validateBotDecision(bot,view,chooseBotAction(bot,view)),true);
      assert.throws(()=>inspectBotDiscardScores(bot,{...view,wall:state.wall}),/非公開|Nonpublic/);
      assert.throws(()=>chooseBotAction(bot,{...view,opponents:view.opponents.map((p,j)=>
        j===0?{...p,concealed:state.players[p.seat].concealed}:p)}),/非公開|Nonpublic/);
      const poisoned=clone(view);
      Object.defineProperty(poisoned,'privateClaimIntents',{value:[1],enumerable:true});
      assert.throws(()=>chooseBotAction(bot,poisoned),/非公開|Nonpublic/);
    }
  }
});

test('R7 produces deterministic, Rules-issued actions across seats; Beginner policy remains separate',()=>{
  let observed=0;
  for(let seed=0;seed<4;seed++){
    for(let seat=0;seat<4;seat++){
      let state=createGame({gameId:`r7-seat-${seed}-${seat}`,
        seed:`r7-seat-${seed}`,dealerSeat:seat,...ref});
      while(state.round.phase==='replacement'){
        const a=listLegalActions(state,state.round.currentSeat)
          .find(a=>a.kind==='replace_flower');
        assert.ok(a);
        state=applyAction(state,{actorSeat:a.actorSeat,
          actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
      }
      const view=createPlayerView(state,seat);
      for(const difficulty of ['Beginner','Intermediate','Advanced']){
        const bot=createBot({seat,difficulty,seed:'r7-test-independent'});
        const d=chooseBotAction(bot,view);
        const d2=chooseBotAction(bot,clone(view));
        assert.deepEqual(d,d2);
        assert.equal(d.status,'ready');
        assert.equal(validateBotDecision(bot,view,d),true);
        assert.ok(view.legalActions.some(a=>a.actionId===d.actionId));
        if(difficulty==='Beginner')
          assert.match(d.strategyVersion,/canonical-efficiency\/basic/);
        else {
          assert.ok(d.strategyVersion.startsWith(R7_POLICY_VERSION));
          assert.ok(d.reasonCodes.includes('UNCALIBRATED_DEAL_IN_RISK'));
          const scores=inspectBotDiscardScores(bot,view);
          assert.equal(scores[0].actionId,d.actionId);
        }
        observed++;
      }
    }
  }
  assert.equal(observed,48);
});
