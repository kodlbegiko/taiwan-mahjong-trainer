import test from 'node:test';
import assert from 'node:assert/strict';
import {createSandboxSession,availableTableProfiles} from '../../src/table-ui/session.js';
import {TableView} from '../../src/table-ui/view.js';

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
