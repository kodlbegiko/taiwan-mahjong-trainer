import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEMA_VERSION, CONTRACT_VERSION, parsePhysicalTileId, typeOf,
  makeTileIdentity, validateTileIdentity, createDeck, shuffleDeck,
  getRuleProfile, listRuleProfiles, validateRuleProfile, createRuleProfileRegistry,
  createGame, listLegalActions, applyAction, replayGame,
  validateGameState, createPlayerView,
} from '../../src/rules/index.js';

const REF = { profileId: 'tw16-four-player-sandbox', ruleVersion: 'experimental-move-v1' };
const fresh = (seed = 'golden-seed-001') => createGame({ gameId: 'golden-1', seed, ...REF });
const next = (state, seat, action) => {
  const options = listLegalActions(state, seat);
  const choice = action ? options.find(a => a.kind === action) : options[0];
  assert.ok(choice, 'action must be available to the rightful actor');
  return applyAction(state, { actorSeat: seat, actionId: choice.actionId, expectedRevision: state.revision });
};

test('V1 contract: verified structural profile is not verified four-player gameplay', () => {
  const profiles = listRuleProfiles();
  assert.equal(profiles.length, 2);
  const structural = getRuleProfile('tw16-structural-verified', 'structural-only-v1');
  assert.equal(structural.status, 'verified');
  assert.equal(structural.scope, 'structural-16');
  assert.equal(structural.scoringPolicy.mode, 'undefined');
  assert.equal(getRuleProfile(...Object.values(REF)).status, 'experimental');
  assert.throws(() => createGame({ gameId: 'structural', seed: 'test',
    profileId: structural.profileId, ruleVersion: structural.ruleVersion }), /not supported/);
  assert.throws(() => getRuleProfile('unknown-profile', '1'), /Unknown RuleProfile/);
  assert.throws(() => createGame({ seed: 's', ...REF, ruleVersion: 'typo' }), /Unknown/);
  const forged = structuredClone(structural);
  forged.scope = 'four-player';
  assert.throws(() => validateRuleProfile(forged), /verified scope/);
  assert.throws(() => validateRuleProfile({ ...structural, contractVersion: 'wrong' }), /version/);
  assert.throws(() => validateRuleProfile({ ...structural, handShape: { ...structural.handShape, base: 13 } }), /handShape/);
  const registry = createRuleProfileRegistry();
  assert.throws(() => registry.register(structural), /Duplicate/);
});

test('Golden tile inventory: 136 canonical standard IDs with strict numeric range', () => {
  const profile = getRuleProfile(...Object.values(REF));
  const deck = createDeck(profile);
  assert.equal(deck.length, 136);
  assert.equal(new Set(deck).size, 136);
  for (let i = 0; i < 34; i++) {
    assert.equal(deck.filter(id => typeOf(id) === i).length, 4);
    assert.deepEqual([0, 1, 2, 3].map(n => 't:' + i + ':' + n).filter(id => deck.includes(id)),
      Array.from({ length: 4 }, (_, n) => 't:' + i + ':' + n));
  }
  assert.deepEqual(makeTileIdentity('t:27:3'), {
    schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION,
    id: 't:27:3', kind: 'standard', tileType: 27, copyIndex: 3,
  });
  assert.equal(validateTileIdentity(makeTileIdentity('t:27:3'), profile), true);
  assert.throws(() => validateTileIdentity({ ...makeTileIdentity('t:27:3'), tileType: 28 }, profile));
  for (const bad of [34, -1, 't:34:0', 't:0:4', 't:01:0', 't:0:00', 'x:0:0', 't:0:0:extra']) {
    assert.throws(() => parsePhysicalTileId(bad));
  }
});

test('Flower codes remain independent of 0..33; profile controls count and enabling', () => {
  const profile = getRuleProfile(...Object.values(REF));
  profile.tileSet.flowers = {
    enabled: true,
    codes: [
      { code: 'season-spring', copies: 1 },
      { code: 'season-summer', copies: 1 },
      { code: 'plant-plum', copies: 2 },
    ],
  };
  validateRuleProfile(profile);
  const deck = createDeck(profile);
  assert.equal(deck.length, 140);
  assert.equal(new Set(deck).size, 140);
  assert.deepEqual(parsePhysicalTileId('f:plant-plum:1'), {
    kind: 'flower', flowerCode: 'plant-plum', copyIndex: 1,
  });
  assert.throws(() => typeOf('f:plant-plum:1'), /Flower/);
  assert.deepEqual(makeTileIdentity('f:plant-plum:1', profile), {
    schemaVersion: 1, contractVersion: CONTRACT_VERSION, id: 'f:plant-plum:1',
    kind: 'flower', flowerCode: 'plant-plum', copyIndex: 1,
  });
  assert.throws(() => makeTileIdentity('f:plant-plum:2', profile), /not enabled/);
  assert.throws(() => makeTileIdentity('f:season-spring:0', getRuleProfile(...Object.values(REF))), /not enabled/);
  assert.throws(() => createRuleProfileRegistry([profile]).register(profile), /Duplicate/);
  const malformed = structuredClone(profile);
  malformed.tileSet.flowers.codes[1].code = 'season-spring';
  assert.throws(() => validateRuleProfile(malformed), /flower/);
  assert.equal(getRuleProfile(...Object.values(REF)).tileSet.flowers.enabled, false);
});

test('Pinned Golden Seed: physical wall order and initial dealer count', () => {
  const s = fresh();
  assert.deepEqual(s.players[0].concealed.slice(0, 8),
    ['t:6:2', 't:27:2', 't:31:3', 't:8:3', 't:20:2', 't:14:2', 't:18:3', 't:33:0']);
  assert.equal(s.players[0].concealed.at(-1), 't:11:2');
  assert.equal(s.wall[0], 't:17:1');
  assert.deepEqual(s.players.map(p => p.concealed.length), [17, 16, 16, 16]);
  assert.equal(s.wall.length, 71);
  assert.deepEqual(s, fresh());
  assert.notDeepEqual(s.wall, fresh('different-seed').wall);
  assert.deepEqual(shuffleDeck(createDeck(getRuleProfile(...Object.values(REF))), 'repeat'),
    shuffleDeck(createDeck(getRuleProfile(...Object.values(REF))), 'repeat'));
  assert.equal(s.rng.counter, 135);
  assert.equal(s.round.phase, 'await_discard');
  assert.equal(s.revision, 1);
  assert.equal(s.events[0].visibility, 'system-private');
  assert.equal(validateGameState(s), true);
});

test('Legal moves are executable and revision-protected; phase and actor enforced', () => {
  const s = fresh();
  assert.equal(listLegalActions(s, 0).length, 17);
  assert.deepEqual(listLegalActions(s, 1), []);
  assert.ok(listLegalActions(s, 0).every(a => a.kind === 'discard' && a.ruleRef.profileId === REF.profileId));
  const original = structuredClone(s);
  const { state: s2, event: discard } = next(s, 0, 'discard');
  assert.deepEqual(s, original, 'applyAction must be immutable');
  assert.equal(discard.seq, 2);
  assert.equal(discard.visibility, 'public');
  assert.equal(s2.round.phase, 'await_draw');
  assert.equal(s2.round.currentSeat, 1);
  assert.equal(s2.players[0].river[0].tileId, discard.payload.tileId);
  assert.equal(s2.players[0].concealed.length, 16);
  assert.deepEqual(listLegalActions(s2, 0), []);
  assert.equal(listLegalActions(s2, 1).length, 1);
  const drawAction = listLegalActions(s2, 1)[0];
  assert.equal(drawAction.kind, 'draw');
  assert.deepEqual(drawAction.tileIds, []);
  const { state: s3, event: draw } = next(s2, 1, 'draw');
  assert.equal(draw.visibility, 'seat-private');
  assert.equal(draw.payload.tileId, s2.wall[0]);
  assert.equal(s3.wall.length, s2.wall.length - 1);
  assert.equal(s3.players[1].concealed.length, 17);
  assert.equal(s3.round.phase, 'await_discard');
  assert.equal(s3.round.currentSeat, 1);
  assert.throws(() => applyAction(s2, {
    actorSeat: 1, actionId: drawAction.actionId, expectedRevision: s.revision,
  }), /Stale/);
  assert.throws(() => applyAction(s2, {
    actorSeat: 2, actionId: drawAction.actionId, expectedRevision: s2.revision,
  }), /illegal/);
  assert.throws(() => applyAction(s2, {
    actorSeat: 1, actionId: 'act:forged:chi', expectedRevision: s2.revision,
  }), /illegal/);
  assert.throws(() => applyAction(s2, {
    actorSeat: 1, actionId: drawAction.actionId, expectedRevision: s2.revision,
    tileIds: ['t:0:0'],
  }), /Forged/);
  assert.throws(() => applyAction(s2, {
    actorSeat: 1, actionId: 'act:forged:win', expectedRevision: s2.revision,
  }), /illegal/);
  assert.equal(validateGameState(s3), true);
});

test('Golden event replay: action history recreates identical full state', () => {
  let s = fresh();
  for (let i = 0; i < 17; i++) {
    const seat = s.round.currentSeat;
    s = next(s, seat).state;
  }
  assert.equal(s.revision, 18);
  const replayed = replayGame(s);
  assert.deepEqual(replayed, s);
  assert.equal(validateGameState(replayed), true);
  assert.equal(new Set(s.events.map(e => e.eventId)).size, s.events.length);
  assert.deepEqual(s.events.map(e => e.seq), Array.from({ length: s.events.length }, (_, i) => i + 1));
  const malicious = structuredClone(s);
  malicious.events[3].payload.tileId = 't:0:0';
  assert.throws(() => replayGame(malicious), /Replay event mismatch|illegal|mismatch/);
  const reordered = structuredClone(s);
  [reordered.events[2], reordered.events[3]] = [reordered.events[3], reordered.events[2]];
  assert.throws(() => replayGame(reordered), /Replay event ordering/);
});

test('PlayerView: opponent hidden hand/wall swap is information-equivalent', () => {
  const s = fresh();
  const baseline = createPlayerView(s, 0);
  const counterfactual = structuredClone(s);
  [counterfactual.players[1].concealed[0], counterfactual.wall[0]]
    = [counterfactual.wall[0], counterfactual.players[1].concealed[0]];
  assert.notDeepEqual(counterfactual, s);
  assert.equal(validateGameState(counterfactual, { replay: false }), true);
  assert.deepEqual(createPlayerView(counterfactual, 0), baseline);
  const keys = Object.keys(baseline).sort();
  assert.deepEqual(keys, [
    'asOfEventSeq', 'audienceSeat', 'capabilities', 'contractVersion',
    'gameId', 'knownUnavailableTypes', 'legalActions', 'opponents',
    'publicEvents', 'round', 'ruleRef', 'schemaVersion', 'self', 'viewId',
  ].sort());
  const serialized = JSON.stringify(baseline);
  assert.equal(serialized.includes(s.wall[0]), false, 'future wall tile must not be serialized');
  assert.equal(serialized.includes(s.players[1].concealed[0]), false, 'opponent secret must not be serialized');
  for (const secret of ['wall', 'replacementWall', 'rng', 'futureEvents', 'answerKey']) {
    assert.equal(Object.hasOwn(baseline, secret), false);
  }
  assert.ok(baseline.opponents.every(p => !Object.hasOwn(p, 'concealed')));
  assert.deepEqual(baseline.legalActions, listLegalActions(s, 0));
  assert.equal(baseline.capabilities.roundActions, false);
  assert.equal(baseline.capabilities.settlement, false);
  assert.throws(() => createPlayerView(s, 0, 0), /Invalid asOf/);
  assert.throws(() => createPlayerView(s, 4), /Invalid seat/);
});

test('Private draw is redacted even for opponents; historical view is recreated', () => {
  const s0 = fresh();
  const s1 = next(s0, 0).state;
  const s2 = next(s1, 1).state;
  const current = createPlayerView(s2, 0);
  const draw = current.publicEvents.at(-1);
  assert.equal(draw.type, 'draw');
  assert.deepEqual(draw.payload, { count: 1 });
  assert.equal(JSON.stringify(current).includes(s2.events.at(-1).payload.tileId), false);
  assert.equal(draw.causedByActionId, undefined);
  assert.deepEqual(createPlayerView(s2, 0, 1), createPlayerView(s0, 0));
  assert.deepEqual(createPlayerView(s2, 0, 2), createPlayerView(s1, 0));
  assert.equal(s2.round.lastPublicEventSeq, 2);
});

test('Illegal inventory, tampered state, unsupported melds and phase fail closed', () => {
  const s = fresh();
  let bad = structuredClone(s);
  bad.players[1].concealed[0] = bad.wall[0];
  assert.throws(() => validateGameState(bad, { replay: false }), /Duplicate/);
  bad = structuredClone(s);
  bad.players[0].concealed[0] = 't:34:0';
  assert.throws(() => validateGameState(bad, { replay: false }), /Invalid|unknown/);
  bad = structuredClone(s);
  bad.players[2].melds.push({ kind: 'triplet', tileIds: ['t:0:0', 't:0:1', 't:0:2'], open: true });
  assert.throws(() => validateGameState(bad, { replay: false }), /meld/);
  bad = structuredClone(s);
  bad.round.phase = 'claim_window';
  assert.throws(() => validateGameState(bad, { replay: false }), /RoundState/);
  bad = structuredClone(s);
  bad.round.currentSeat = 3;
  assert.throws(() => validateGameState(bad, { replay: false }), /count|phase/);
  bad = structuredClone(s);
  [bad.players[1].concealed[0], bad.wall[0]] = [bad.wall[0], bad.players[1].concealed[0]];
  assert.throws(() => validateGameState(bad), /replay/);
  bad = structuredClone(s);
  bad.revision += 1;
  assert.throws(() => validateGameState(bad), /shape/);
});

test('Property: 32 seeds, 71 complete draws, conservation after each transition', () => {
  for (let seed = 0; seed < 32; seed++) {
    let s = fresh('property-' + seed);
    const deck = new Set(createDeck(getRuleProfile(...Object.values(REF))));
    for (let i = 0; i < 71; i++) {
      const discard = next(s, s.round.currentSeat, 'discard').state;
      s = next(discard, discard.round.currentSeat, 'draw').state;
      assert.equal(validateGameState(s, { replay: false }), true);
    }
    assert.equal(s.wall.length, 0);
    s = next(s, s.round.currentSeat, 'discard').state;
    assert.equal(s.round.phase, 'await_draw');
    assert.deepEqual(listLegalActions(s, s.round.currentSeat), [], 'no fabricated settlement');
    const all = [
      ...s.wall, ...s.players.flatMap(p => [...p.concealed, ...p.river.map(d => d.tileId)]),
    ];
    assert.equal(all.length, deck.size);
    assert.equal(new Set(all).size, deck.size);
    assert.equal(validateGameState(s, { replay: false }), true);
  }
});
