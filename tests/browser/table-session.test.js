import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxSession, TABLE_STORAGE_KEY, availableTableProfiles } from '../../src/table-ui/session.js';
import { TableView, ReplayControls, ActionBar, BotDifficultySelect } from '../../src/table-ui/view.js';
import { createFullRoundSession } from '../../src/table-ui/full-round.js';
import { tileFaceMarkup } from '../../src/tile-visuals.js';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, val) => { values.set(key, String(val)); },
  };
}
function firstProfile() {
  const profile = availableTableProfiles().find(p => p.profileId === 'tw16-four-player-sandbox');
  assert.ok(profile);
  return profile;
}
test('actual Rules sandbox supplies a private 17-tile hand and 3 redacted seats', () => {
  const storage = memoryStorage();
  storage.setItem('tw-mahjong-trainer:archive:v3', 'do-not-modify');
  storage.setItem('tw-mahjong-master-academy:state:v1', 'do-not-modify');
  const session = createSandboxSession({ storage });
  const profile = firstProfile();
  assert.equal(profile.status, 'experimental');
  const s = session.start({ profileId: profile.profileId, ruleVersion: profile.ruleVersion });
  assert.equal(s.view.self.concealed.length, 17);
  assert.deepEqual(s.view.opponents.map(p => p.concealedCount), [16,16,16]);
  assert.ok(s.view.opponents.every(p => !('concealed' in p)));
  assert.equal(s.view.legalActions.length, 17);
  assert.ok(s.view.legalActions.every(a => a.kind === 'discard'));
  assert.equal(s.botConnected, false);
  assert.equal(s.replayConnected, false);
  assert.equal(s.result, null);
  assert.equal(storage.getItem('tw-mahjong-trainer:archive:v3'), 'do-not-modify');
  assert.equal(storage.getItem('tw-mahjong-master-academy:state:v1'), 'do-not-modify');
  assert.ok(storage.getItem(TABLE_STORAGE_KEY));
  const html = TableView(s);
  assert.equal((html.match(/data-pick-action=/g) ?? []).length, 17);
  assert.equal((html.match(/class="table-concealed"/g) ?? []).length, 3);
  assert.ok(!html.includes('data-submit-action='));
  assert.ok(!html.includes('data-action="win"'));
  assert.ok(!html.includes('CoachingFinding') || !html.includes('100/100'));
});
test('fixture-only replacement PlayerView separates 17 physical tiles from zero legal discards', () => {
  // This is a pure UI contract fixture, not a real Rules/Bot completed game.
  const session=createSandboxSession({storage:memoryStorage()});
  const p=firstProfile();
  const snapshot=session.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const copy=JSON.parse(JSON.stringify(snapshot));
  copy.view.self.concealed[0]={
    id:'f:season-spring:0',kind:'flower',flowerCode:'season-spring',
    schemaVersion:1,contractVersion:'master-academy/1.0.0',
    copyIndex:0
  };
  copy.view.round.phase='replacement';
  copy.view.legalActions=[{
    actorSeat:0,kind:'replace_flower',tileIds:['f:season-spring:0'],
    actionId:'fixture-issued-by-rules-only',expectedRevision:copy.view.asOfEventSeq
  }];
  const html=TableView(copy);
  assert.ok(html.includes('data-table-physical-count="17"'));
  assert.ok(html.includes('data-table-discard-count="0"'));
  assert.ok(html.includes('data-table-legal-count="1"'));
  assert.equal((html.match(/data-pick-action=/g)??[]).length,0);
  assert.equal((html.match(/data-submit-action=/g)??[]).length,1);
  assert.ok(html.includes('補花'));
  const pending=TableView(copy,{confirmation:copy.view.legalActions[0]});
  assert.ok(pending.includes('data-action-confirmation'));
  assert.ok(pending.includes('data-confirm-action="fixture-issued-by-rules-only"'));
  assert.ok(pending.includes('data-cancel-action'));
  const forged=TableView(copy,{confirmation:{actionId:'not-a-rules-action'}});
  assert.ok(!forged.includes('data-action-confirmation'));
  assert.ok(!forged.includes('data-confirm-action='));
});
test('restarting a real sandbox round requires an explicit cancellable in-page prompt', () => {
  const session=createSandboxSession({storage:memoryStorage()});
  const p=firstProfile();
  const start=session.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const html=TableView(start,{restartPending:true});
  assert.ok(html.includes('data-restart-confirmation'));
  assert.ok(html.includes('data-confirm-new'));
  assert.ok(html.includes('data-cancel-new'));
  assert.equal(session.snapshot().view.asOfEventSeq,start.view.asOfEventSeq);
});

test('the first discard must be confirmed; stale/repeated/forged actions are rejected', () => {
  const session = createSandboxSession({ storage: memoryStorage() });
  const p = firstProfile();
  const start = session.start({ profileId: p.profileId, ruleVersion: p.ruleVersion });
  const action = start.view.legalActions[0];
  const selected = TableView(start, {selection:action.actionId});
  assert.ok(selected.includes('確認捨牌'));
  assert.ok(selected.includes('data-submit-action='));
  assert.equal(session.snapshot().view.asOfEventSeq, start.view.asOfEventSeq);
  const after = session.submit({ actionId: action.actionId,
    actorSeat: action.actorSeat, expectedRevision: action.expectedRevision });
  assert.equal(after.view.asOfEventSeq, start.view.asOfEventSeq + 1);
  assert.equal(after.view.self.concealed.length, 16);
  assert.equal(after.view.self.river.length, 1);
  assert.equal(after.view.round.currentSeat, 1);
  assert.deepEqual(after.view.legalActions, []);
  assert.throws(() => session.submit({ actionId: action.actionId,
    actorSeat: action.actorSeat, expectedRevision: action.expectedRevision }), /過期|非正式/);
  assert.throws(() => session.submit({ actionId: 'forged', actorSeat: 0,
    expectedRevision: after.view.asOfEventSeq }), /過期|非正式/);
});
test('a valid persisted game resumes, including latest revision, without touching Academy keys', () => {
  const storage = memoryStorage(), p = firstProfile();
  const a = createSandboxSession({ storage });
  const before = a.start({profileId:p.profileId, ruleVersion:p.ruleVersion});
  const action = before.view.legalActions[1];
  a.submit({actionId:action.actionId, actorSeat:0, expectedRevision:action.expectedRevision});
  const b = createSandboxSession({ storage });
  assert.equal(b.restore(), true);
  assert.deepEqual(b.snapshot().view, a.snapshot().view);
  assert.equal(b.snapshot().wallRemaining, a.snapshot().wallRemaining);
});
test('corrupt game data is not silently erased; unsupported full game profile is refused', () => {
  const storage = memoryStorage();
  storage.setItem(TABLE_STORAGE_KEY, '{"version":1,"gameState":{"bogus":true}}');
  const s = createSandboxSession({ storage });
  assert.equal(s.restore(), false);
  const raw = storage.getItem(TABLE_STORAGE_KEY);
  const p = firstProfile();
  assert.throws(() => s.start({ profileId:p.profileId, ruleVersion:p.ruleVersion }), /禁止覆寫|驗證|已停止寫入/);
  assert.equal(storage.getItem(TABLE_STORAGE_KEY), raw);
  const other = createSandboxSession();
  assert.throws(() => other.start({ profileId: 'tw16-structural-verified', ruleVersion:'structural-only-v1' }));
});
test('an injected fixture Bot can only return exact authoritative LegalActions', async () => {
  const storage = memoryStorage(), p = firstProfile();
  let calls = 0;
  const adapter = { async selectAction(view) {
    calls++;
    assert.ok(view.opponents.every(x => !('concealed' in x)));
    // Fixture decision only. This is NOT a formal opponent AI acceptance.
    return view.legalActions[0];
  }};
  const s = createSandboxSession({ storage, botAdapter: adapter });
  const start = s.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  const first = start.view.legalActions[0];
  s.submit({actorSeat:0,actionId:first.actionId,expectedRevision:first.expectedRevision});
  await s.advanceBots();
  assert.equal(s.snapshot().view.round.currentSeat, 0);
  assert.ok(calls >= 6);
  assert.equal(s.snapshot().view.self.concealed.length, 16);
  const invalid = createSandboxSession({botAdapter:{async selectAction(){return {actionId:'invented',actorSeat:1,expectedRevision:2};}}});
  const init = invalid.start({profileId:p.profileId,ruleVersion:p.ruleVersion});
  invalid.submit({actorSeat:0,actionId:init.view.legalActions[0].actionId,
    expectedRevision:init.view.asOfEventSeq});
  await assert.rejects(invalid.advanceBots(), /非合法|過期/);
});
test('Replay controls remain disabled without official verified timeline', () => {
  const html = ReplayControls(null, 0);
  assert.ok(html.includes('尚未開放'));
  assert.ok(!html.includes('data-replay-next'));
  const s = createSandboxSession();
  assert.equal(typeof s.replay, 'function');
});
test('all 34 traditional tile assets remain in the canonical face lookup', () => {
  for (let t = 0; t < 34; t++) {
    assert.ok(tileFaceMarkup(t).includes('/tiles/' + t + '.svg'));
  }
});

test('R7.1 declaration renderer contract: all supported kinds, exact token, busy and ARIA',()=>{
  // Pure public renderer input, NOT real game/Rules/E2E evidence.
  for(const kind of ['replace_flower','pass','chi','pong','kong','win','draw']){
    const a={kind,actionId:'render-contract-'+kind,actorSeat:0,expectedRevision:9,tileIds:[]};
    const html=ActionBar([a],null,false,a);
    assert.ok(html.includes('data-confirm-action="'+a.actionId+'"'));
    assert.ok(html.includes('data-cancel-action'));
    assert.ok(html.includes('aria-live="polite"'));
    for(const wrong of [{...a,expectedRevision:8},{...a,actorSeat:1},{...a,kind:'discard'},{...a,actionId:'stale'}]){
      assert.ok(!ActionBar([a],null,false,wrong).includes('data-confirm-action='));
    }
    const disabled=ActionBar([a],null,true,a);
    assert.ok(disabled.includes('aria-busy="true"'));
    assert.match(disabled,/data-confirm-action="[^"]+" disabled/);
    assert.match(disabled,/data-cancel-action disabled/);
  }
});
test('R7.1 full-round Bot difficulties preserve existing public host and checkpoint contract',async()=>{
  for(const difficulty of ['Beginner','Intermediate','Advanced']){
    const storage=memoryStorage();
    const session=await createFullRoundSession({storage});
    const initial=session.start({difficulty});
    assert.equal(initial.botDifficulty,difficulty);
    assert.match(TableView(initial),new RegExp('data-bot-difficulty="'+difficulty+'"'));
    assert.ok(BotDifficultySelect(difficulty).includes('value="'+difficulty+'" selected'));
    // Opening flowers can belong to another seat. Advance only through the
    // actual host/controller until Rules publishes the first human LegalAction.
    const opening=await session.advanceBots({maxActions:128});
    assert.equal(opening.status,'human-turn','Opening must reach a genuine human turn');
    const ready=session.snapshot();
    const a=ready.view.legalActions.find(x=>x.kind==='discard')??ready.view.legalActions.find(x=>x.kind!=='win');
    assert.ok(a,'Rules must supply a non-terminal human LegalAction');
    const submission={actionId:a.actionId,actorSeat:a.actorSeat,expectedRevision:a.expectedRevision};
    const before=ready.view.asOfEventSeq;
    await assert.rejects(session.submit({...submission,expectedRevision:before+1}),/過期|不合法/);
    assert.equal(session.snapshot().view.asOfEventSeq,before);
    const both=await Promise.allSettled([session.submit(submission),session.submit(submission)]);
    assert.equal(both.filter(x=>x.status==='fulfilled').length,1,'duplicate action committed twice');
    assert.equal(both.filter(x=>x.status==='rejected').length,1);
    assert.ok(session.snapshot().view.asOfEventSeq>before);
    const after=session.snapshot().view.asOfEventSeq;
    await assert.rejects(session.submit(submission),/過期|不合法/);
    assert.equal(session.snapshot().view.asOfEventSeq,after);
    // Use actual Rules legal actions until the host hands off to Bots.
    for(let i=0;i<20;i++){
      const v=session.snapshot().view;
      if(v.round.phase==='settled')break;
      if(!v.legalActions.length||v.round.phase==='claim_window')break;
      const action=v.legalActions.find(x=>x.kind==='discard')??v.legalActions[0];
      await session.submit({actionId:action.actionId,actorSeat:action.actorSeat,expectedRevision:action.expectedRevision});
      if(action.kind==='discard')break;
    }
    const progressed=await session.advanceBots({maxActions:128});
    assert.ok(['human-turn','settled'].includes(progressed.status));
    assert.ok(opening.actions+progressed.actions>0,'difficulty must drive real Bot actions');
    const persisted=session.snapshot();
    const restored=await createFullRoundSession({storage});
    assert.equal(restored.restore(),true);
    assert.deepEqual(restored.snapshot().view,persisted.view);
    assert.equal(restored.snapshot().botDifficulty,difficulty);
    assert.throws(()=>restored.start({difficulty:'invalid'}),/難度/);
    assert.equal(restored.snapshot().view.asOfEventSeq,persisted.view.asOfEventSeq);
  }
});
test('R7.1 legacy full-round checkpoint with no difficulty restores Beginner, without altering GameState',async()=>{
  const storage=memoryStorage();
  const session=await createFullRoundSession({storage});
  const initial=session.start();
  assert.equal(initial.botDifficulty,'Beginner');
  const key='tw-mahjong-master-academy:full-table:r3:v1';
  const legacy=JSON.parse(storage.getItem(key));
  delete legacy.botDifficulty; // metadata migration only; retain actual Rules state untouched
  storage.setItem(key,JSON.stringify(legacy));
  const restored=await createFullRoundSession({storage});
  assert.equal(restored.restore(),true);
  assert.equal(restored.snapshot().botDifficulty,'Beginner');
  assert.deepEqual(restored.snapshot().view,initial.view);
});
