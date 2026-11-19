import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandboxSession, TABLE_STORAGE_KEY, availableTableProfiles } from '../../src/table-ui/session.js';
import { TableView, ReplayControls } from '../../src/table-ui/view.js';
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
  assert.throws(() => s.start({ profileId:p.profileId, ruleVersion:p.ruleVersion }), /禁止覆寫|驗證/);
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
