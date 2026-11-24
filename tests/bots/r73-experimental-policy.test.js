import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,createPlayerView,listLegalActions,applyAction} from '../../src/rules/index.js';
import {createBot,chooseBotAction,chooseExperimentalAdvancedAction,validateBotDecision} from '../../src/bots/decision.js';
import {rankPublicDiscardCandidates,publicAttackContext,experimentalClaimAllowed,R73_VARIANTS} from '../../src/bots/strategy-r7.js';
const rec=(id,rank,s,c,k)=>({actionId:id,rank,metrics:[
 {name:'postDiscardShanten',value:s},{name:'oneTurnEffectiveCopies',value:c},{name:'oneTurnEffectiveKinds',value:k}]});
function fixture(n){
 const empty={melds:[],river:[]};
 const open=Array.from({length:3},(_,i)=>({kind:'sequence',open:true,tileIds:[`t:${9+i*3}:0`,`t:${10+i*3}:0`,`t:${11+i*3}:0`]}));
 return {self:{...empty,concealed:[{tileType:0},{tileType:1}]},
  opponents:[{melds:open,river:[{tileId:'t:1:2'}]},empty,empty],
  publicEvents:Array.from({length:n},()=>({type:'discard'})),
  legalActions:[{kind:'discard',actionId:'a',tileIds:['t:0:0']},{kind:'discard',actionId:'b',tileIds:['t:1:0']}]};
}
test('R7.3 dynamic candidate preserves attack budget, shanten, public-only clock',()=>{
 const r=[rec('a',0,2,8,3),rec('b',1,2,5,2)];
 const early=fixture(8),late=fixture(56);
 assert.equal(publicAttackContext(early).stage,'early');assert.equal(publicAttackContext(late).stage,'late');
 assert.equal(rankPublicDiscardCandidates(early,r,'Advanced')[0].actionId,'b');
 assert.equal(rankPublicDiscardCandidates(early,r,'Advanced','discard-only')[0].actionId,'a');
 assert.equal(rankPublicDiscardCandidates(late,r,'Advanced','combined')[0].actionId,'a');
 const close=[r[0],rec('b',1,2,7,3)];
 assert.equal(rankPublicDiscardCandidates(late,close,'Advanced','combined')[0].actionId,'b');
 assert.equal(rankPublicDiscardCandidates(late,[r[0],rec('b',1,3,8,3)],'Advanced','combined')[0].actionId,'a');
});
test('R7.3 claim ablation restores one-shanten gains; zero-gain opening has explicit cost gate',()=>{
 const c={gain:1,beforeCopies:5,afterCopies:2,baseline:1,kind:'pong',
   context:{closed:true,stage:'late',maxOpen:4}};
 assert.equal(experimentalClaimAllowed(c),true);
 assert.equal(experimentalClaimAllowed({...c,gain:0,afterCopies:20}),false);
 assert.equal(experimentalClaimAllowed({...c,gain:0,afterCopies:9,context:{closed:false,stage:'middle',maxOpen:1}}),true);
 assert.equal(experimentalClaimAllowed({...c,gain:0,afterCopies:9,kind:'kong',context:{closed:false,stage:'middle',maxOpen:1}}),false);
});
test('R7.3 experimental policy stays opt-in; actual Rules actions deterministic and private input rejected',()=>{
 let s=createGame({gameId:'r73-gate',seed:'r73-gate',dealerSeat:0,profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'});
 while(s.round.phase==='replacement'){
   const a=listLegalActions(s,s.round.currentSeat).find(x=>x.kind==='replace_flower');
   assert.ok(a);s=applyAction(s,{actorSeat:a.actorSeat,actionId:a.actionId,expectedRevision:a.expectedRevision}).state;
 }
 const v=createPlayerView(s,0),b=createBot({seat:0,difficulty:'Advanced',seed:'r73'});
 const old=chooseBotAction(b,v);
 for(const variant of R73_VARIANTS){
   const d=chooseExperimentalAdvancedAction(b,v,variant);
   assert.deepEqual(d,chooseExperimentalAdvancedAction(b,JSON.parse(JSON.stringify(v)),variant));
   assert.equal(validateBotDecision(b,v,d),true);
   assert.throws(()=>chooseExperimentalAdvancedAction(b,{...v,wall:s.wall},variant));
 }
 assert.deepEqual(chooseBotAction(b,v),old);
 assert.throws(()=>chooseExperimentalAdvancedAction(createBot({seat:0,difficulty:'Beginner'}),v,'combined'));
});
