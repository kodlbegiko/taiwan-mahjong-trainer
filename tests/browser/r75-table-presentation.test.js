import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxSession,availableTableProfiles} from '../../src/table-ui/session.js';
import {TableView,latestPublicDiscard,publicDeclaration,ActionBar,observedOwnDraw,seatWind,normalizeTableTheme,TABLE_THEMES,readTableTheme,writeTableTheme,TABLE_THEME_KEY,normalizeTableCamera,TABLE_CAMERAS} from '../../src/table-ui/view.js';

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

test('R7.5 fresh draw is marked only for a uniquely observed own draw',()=>{
  const tile=id=>({id});
  const prev={gameId:'g',audienceSeat:0,asOfEventSeq:10,self:{seat:0,concealed:[tile('t:0:0')]}};
  const draw={gameId:'g',seq:11,visibility:'public',type:'draw',actorSeat:0,payload:{count:1}};
  const view={...prev,asOfEventSeq:11,round:{currentSeat:0,phase:'await_discard'},
    self:{seat:0,concealed:[tile('t:0:0'),tile('t:4:1')]},publicEvents:[draw]};
  const cue=observedOwnDraw(prev,view);
  assert.deepEqual(cue,{gameId:'g',seat:0,revision:11,seq:11,tileId:'t:4:1'});
  assert.equal(observedOwnDraw(null,view),null);
  assert.equal(observedOwnDraw(view,view),null);
  assert.equal(observedOwnDraw(prev,{...view,gameId:'new'}),null);
  assert.equal(observedOwnDraw(prev,{...view,publicEvents:[{...draw,actorSeat:1}]}),null);
  assert.equal(observedOwnDraw(prev,{...view,publicEvents:[{...draw,visibility:'seat-private'}]}),null);
  assert.equal(observedOwnDraw(prev,{...view,asOfEventSeq:12,publicEvents:[draw,{...draw,seq:12}]}),null);
  assert.equal(observedOwnDraw(prev,{...view,self:{seat:0,concealed:[...view.self.concealed,tile('t:5:0')]}}),null);
  assert.equal(observedOwnDraw(prev,{...view,round:{currentSeat:0,phase:'replacement'}}),null);
  assert.equal(observedOwnDraw(prev,{...view,asOfEventSeq:12,publicEvents:[draw,{...draw,type:'discard',seq:12}]}),null);
});
test('R7.5 draw cue renders one physical tile without changing its legal action',()=>{
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession();
  const snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const v=snap.view,id=v.self.concealed[0].id;
  const a=v.legalActions.find(a=>a.tileIds[0]===id);
  const cue={gameId:v.gameId,seat:v.audienceSeat,revision:v.asOfEventSeq,tileId:id};
  const html=TableView(snap,{drawCue:cue,selection:a.actionId});
  assert.equal((html.match(/table-fresh-draw/g)??[]).length,1);
  assert.ok(html.includes('data-submit-action="'+a.actionId+'"'));
  assert.equal((html.match(/data-pick-action=/g)??[]).length,17);
  assert.ok(!TableView(snap,{drawCue:{...cue,revision:0}}).includes('table-fresh-draw'));
  assert.ok(!TableView(snap,{drawCue:{...cue,seat:1}}).includes('table-fresh-draw'));
});

test('R7.5 wind medallions follow dealer rotation and do not invent a round wind',()=>{
  for(let dealer=0;dealer<4;dealer++){
    assert.deepEqual(Array.from({length:4},(_,i)=>seatWind((dealer+i)%4,dealer)),['東','南','西','北']);
  }
  assert.equal(seatWind(4,0),'');
  assert.equal(seatWind(0,null),'');
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession(),snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const html=TableView(snap);
  assert.equal((html.match(/data-seat-wind=/g)??[]).length,4);
  assert.equal((html.match(/data-dealer-seat="true"/g)??[]).length,1);
  assert.equal((html.match(/data-seat-turn="true"/g)??[]).length,1);
  assert.equal((TableView({...snap,paused:true}).match(/data-seat-turn="true"/g)??[]).length,0);
  assert.equal((html.match(/data-pick-action=/g)??[]).length,17);
});

test('R7.5 themes are allowlisted presentation only and preserve the authoritative action set',()=>{
  assert.deepEqual(Object.keys(TABLE_THEMES),['jade-room','walnut-room','midnight-room']);
  for(const value of [null,undefined,{},'__proto__','constructor','"><script>'])assert.equal(normalizeTableTheme(value),'jade-room');
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession(),snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const before=JSON.stringify(snap);
  const selected=snap.view.legalActions[0].actionId;
  const expected=Array.from(TableView(snap,{selection:selected}).matchAll(/data-pick-action="([^"]+)"/g),m=>m[1]);
  for(const theme of Object.keys(TABLE_THEMES)){
    const html=TableView(snap,{theme,selection:selected});
    assert.ok(html.includes('data-table-theme="'+theme+'"'));
    assert.ok(html.includes('value="'+theme+'" selected'));
    assert.deepEqual(Array.from(html.matchAll(/data-pick-action="([^"]+)"/g),m=>m[1]),expected);
    assert.ok(html.includes('data-submit-action="'+selected+'"'));
  }
  assert.ok(TableView(snap,{theme:'invalid'}).includes('data-table-theme="jade-room"'));
  assert.equal(JSON.stringify(snap),before);
});

test('R7.5 theme preference has its own storage key and fails safely when storage is blocked',()=>{
  const map=new Map([['game','unchanged'],['academy','unchanged'],['replay','unchanged']]);
  const storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
  assert.equal(readTableTheme(storage),'jade-room');
  assert.equal(writeTableTheme(storage,'walnut-room'),true);
  assert.equal(readTableTheme(storage),'walnut-room');
  assert.deepEqual([...map.keys()],['game','academy','replay',TABLE_THEME_KEY]);
  assert.equal(writeTableTheme(storage,'__proto__'),false);
  assert.equal(readTableTheme(storage),'walnut-room');
  assert.equal(map.get('game'),'unchanged');
  map.set(TABLE_THEME_KEY,'invalid');
  assert.equal(readTableTheme(storage),'jade-room');
  assert.equal(map.get(TABLE_THEME_KEY),'invalid');
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};
  assert.equal(readTableTheme(blocked),'jade-room');
  assert.equal(writeTableTheme(blocked,'midnight-room'),false);
  assert.equal(writeTableTheme(null,'midnight-room'),false);
});

test('R7.5 camera is allowlisted and presentation-only',()=>{
  assert.deepEqual(Object.keys(TABLE_CAMERAS),['flat','perspective']);
  for(const bad of [null,undefined,{},'constructor','__proto__','"><script>'])assert.equal(normalizeTableCamera(bad),'flat');
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession(),snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const bytes=JSON.stringify(snap),id=snap.view.legalActions[0].actionId;
  const flat=TableView(snap,{selection:id});
  const perspective=TableView(snap,{selection:id,camera:'perspective'});
  assert.ok(perspective.includes('data-table-camera="perspective"'));
  assert.ok(flat.includes('data-table-camera="flat"'));
  const actions=html=>Array.from(html.matchAll(/data-pick-action="([^"]+)"/g),x=>x[1]);
  assert.deepEqual(actions(flat),actions(perspective));
  assert.ok(perspective.includes('data-submit-action="'+id+'"'));
  assert.equal(JSON.stringify(snap),bytes);
});

test('R7.5 extrusion adds anonymous planes to public tiles only and preserves action IDs',()=>{
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession(),snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const html=TableView(snap,{camera:'perspective'});
  assert.equal((html.match(/class="table-tile-extrusion"/g)??[]).length,48);
  assert.equal((html.match(/class="table-mesh-face table-mesh-/g)??[]).length,48*5);
  assert.equal((html.match(/data-pick-action=/g)??[]).length,17);
  const a=snap.view.legalActions[0];
  const after=s.submit({actionId:a.actionId,actorSeat:a.actorSeat,expectedRevision:a.expectedRevision});
  const next=TableView(after,{camera:'perspective'});
  assert.equal((next.match(/class="table-tile-extrusion"/g)??[]).length,49);
  assert.equal((next.match(/table-last-discard/g)??[]).length,1);
  assert.ok(after.view.opponents.every(p=>!Object.hasOwn(p,'concealed')));
});

test('R7.5 claimed river history is visually distinct from a live physical tile',()=>{
  const p=availableTableProfiles().find(x=>x.profileId==='tw16-four-player-sandbox');
  const s=createSandboxSession(),snap=s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const a=snap.view.legalActions[0];
  const after=s.submit({actionId:a.actionId,actorSeat:a.actorSeat,expectedRevision:a.expectedRevision});
  const fixture=JSON.parse(JSON.stringify(after));
  fixture.view.self.river[0].claimedByEventId='fixture-claimed';
  const bytes=JSON.stringify(fixture);
  const html=TableView(fixture,{camera:'perspective'});
  assert.equal((html.match(/class="table-claimed-discard"/g)??[]).length,1);
  assert.ok(html.includes('data-river-history-count="1" data-river-live-count="0"'));
  assert.equal((html.match(/class="table-tile-extrusion"/g)??[]).length,48);
  assert.equal((html.match(/table-last-discard/g)??[]).length,0);
  assert.equal(JSON.stringify(fixture),bytes);
});
