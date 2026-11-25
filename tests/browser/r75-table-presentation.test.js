import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxSession,availableTableProfiles} from '../../src/table-ui/session.js';
import {TableView,latestPublicDiscard,publicDeclaration,ActionBar} from '../../src/table-ui/view.js';

test('R7.5 sorted hand keeps exact physical actions, hidden tiles and input bytes',()=>{
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession();
  const snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const copy=JSON.parse(JSON.stringify(snap));
  copy.view.self.concealed.sort((a,b)=>b.tileType-a.tileType);
  const before=JSON.stringify(copy);
  const html=TableView(copy);
  const actions=[...html.matchAll(/data-pick-action="([^"]+)"/g)].map(x=>x[1]);
  const expected=copy.view.legalActions.filter(a=>a.kind==='discard');
  assert.equal(actions.length,17);
  assert.deepEqual([...actions].sort(),expected.map(a=>a.actionId).sort());
  const types=actions.map(id=>{
    const a=expected.find(x=>x.actionId===id);
    return copy.view.self.concealed.find(t=>t.id===a.tileIds[0]).tileType;
  });
  assert.deepEqual(types,[...types].sort((a,b)=>a-b));
  assert.equal((html.match(/class="table-back-tile"/g)??[]).length,48);
  assert.equal((html.match(/class="table-own-river"/g)??[]).length,1);
  assert.equal(JSON.stringify(copy),before);
  assert.ok(copy.view.opponents.every(p=>!Object.hasOwn(p,'concealed')));
  const selected=TableView(copy,{selection:actions[0]});
  assert.equal((selected.match(/aria-pressed="true"/g)??[]).length,1);
  assert.ok(selected.includes('data-submit-action="'+actions[0]+'"'));
});

test('R7.5 latest public discard highlights only one river tile and never a claimed tile',()=>{
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession();
  const start=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  assert.equal(latestPublicDiscard(start.view),null);
  const a=start.view.legalActions[0];
  const after=s.submit({actionId:a.actionId,actorSeat:a.actorSeat,expectedRevision:a.expectedRevision});
  const v=after.view;
  assert.deepEqual(latestPublicDiscard(v),{seat:0,seq:v.asOfEventSeq,tileId:a.tileIds[0]});
  assert.equal((TableView(after).match(/table-last-discard/g)??[]).length,1);
  const copy=JSON.parse(JSON.stringify(after));
  copy.view.self.river[0].claimedByEventId='fixture-claimed';
  assert.equal(latestPublicDiscard(copy.view),null);
  assert.equal((TableView(copy).match(/table-last-discard/g)??[]).length,0);
  copy.view.self.river[0].claimedByEventId=null;
  copy.view.publicEvents.at(-1).visibility='seat-private';
  assert.equal(latestPublicDiscard(copy.view),null);
  assert.equal(latestPublicDiscard({...v,gameId:'different-game'}),null);
});

test('R7.5 declarations use only public resolved events and never private or proposed kong',()=>{
  const base={gameId:'g',asOfEventSeq:8,round:{phase:'await_discard'},publicEvents:[]};
  const event=(type,payload,actorSeat=1)=>({gameId:'g',seq:7,visibility:'public',type,payload,actorSeat});
  const claim=event('claim',{kind:'chi',sourceSeat:0,claimEventId:'d',tileIds:['t:0:0','t:1:0','t:2:0']});
  const view=(events,phase='await_discard')=>({...base,round:{phase},publicEvents:events});
  assert.deepEqual(publicDeclaration(view([claim])),{kind:'chi',label:'吃',seat:1,seq:7});
  assert.equal(publicDeclaration(view([{...claim,visibility:'seat-private'}])),null);
  assert.equal(publicDeclaration(view([{...claim,actorSeat:undefined,payload:{}}])),null);
  assert.equal(publicDeclaration(view([claim,{...event('discard',{tileId:'t:4:0'}),seq:8}])),null);
  assert.equal(publicDeclaration(view([claim,{...event('kong_proposed',{kind:'ADDED_KONG',tileId:'t:4:0'}),seq:8}])),null);
  const kong=event('kong',{kind:'CONCEALED_KONG',tileIds:['t:4:0','t:4:1','t:4:2','t:4:3']});
  assert.equal(publicDeclaration(view([kong])).label,'暗槓');
  const win=event('win',{seat:1,sourceSeat:1});
  assert.equal(publicDeclaration(view([win])),null);
  assert.equal(publicDeclaration(view([win],'settled')).label,'自摸');
  assert.equal(publicDeclaration(view([{...win,payload:{seat:1,sourceSeat:0}}],'settled')).label,'胡牌');
  assert.equal(publicDeclaration(view([{...claim,seq:9}])),null);
  assert.equal(publicDeclaration(view([{...claim,gameId:'other'}])),null);
});
test('R7.5 declaration previews preserve exact issued action IDs and confirmation',()=>{
  const action={kind:'chi',actionId:'issued-a',actorSeat:0,expectedRevision:4,tileIds:['t:0:0','t:1:0','t:2:0']};
  const pass={kind:'pass',actionId:'issued-pass',actorSeat:0,expectedRevision:4,tileIds:[]};
  const html=ActionBar([action,pass],null,false);
  assert.equal((html.match(/data-submit-action=/g)??[]).length,2);
  assert.equal((html.match(/data-action-kind="chi"/g)??[]).length,1);
  assert.equal((html.match(/class="table-declare-face"/g)??[]).length,3);
  assert.ok(html.includes('data-submit-action="issued-a"'));
  assert.ok(!html.includes('data-confirm-action='));
  assert.ok(ActionBar([action,pass],null,false,action).includes('data-confirm-action="issued-a"'));
  assert.ok(!ActionBar([action,pass],null,false,{...action,expectedRevision:5}).includes('data-confirm-action='));
});
