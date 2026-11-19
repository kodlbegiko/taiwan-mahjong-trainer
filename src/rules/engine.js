/**
 * V1 deterministic four-seat draw/discard sandbox. This is NOT a verified
 * Taiwan four-player ruleset: claiming, flower replacement, winning and
 * settlement are deliberately unavailable until rules/fixtures are reviewed.
 */
import { SCHEMA_VERSION, CONTRACT_VERSION, ENGINE_VERSION } from './tile-constants.js';
import { createDeck, shuffleDeck, parsePhysicalTileId, makeTileIdentity, typeOf, RNG_ALGORITHM_VERSION } from './tile-identity.js';
import { getRuleProfile } from './profiles.js';
import {
  completeCreateGame, completeListLegalActions, completeApplyAction,
  completeReplayGame, completeValidateGameState, completeCreatePlayerView,
} from './complete-engine.js';
const isCompleteRef=ref=>ref?.profileId==='tw16-configurable-table';


const V1 = { schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION };
const clone = x => JSON.parse(JSON.stringify(x));

/**
 * Strict structural equality for JSON DTOs. Property insertion order is
 * irrelevant; object key sets, primitive types/values and array order are not.
 * Keeping this browser-compatible avoids a Node-only assert dependency.
 */
function sameJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((value, index) => sameJson(value, b[index]));
  }
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
}

const seatOK = s => Number.isInteger(s) && s >= 0 && s < 4;
function assertSeat(seat) { if (!seatOK(seat)) throw new RangeError('Invalid seat (expected 0..3)'); }
function assertRoundProfile(profile) {
  if (profile.scope !== 'four-player' || profile.status === 'verified'
      || profile.tileSet.flowers.enabled || profile.turnPolicy.claimPriority !== 'unverified'
      || profile.turnPolicy.replacementDraw !== 'unverified'
      || profile.winningPolicy.mode !== 'structural-only' || profile.scoringPolicy.mode !== 'undefined') {
    throw new RangeError('Profile is not supported by the experimental draw/discard sandbox');
  }
}
function profileFor(state) {
  const ref = state?.ruleRef;
  const profile = getRuleProfile(ref?.profileId, ref?.ruleVersion);
  assertRoundProfile(profile);
  return profile;
}
function identityString(id) { parsePhysicalTileId(id); return id; }
function eventFor(state, type, visibility, actorSeat, payload, causedByActionId) {
  const seq = state.events.length + 1;
  return {
    ...V1, eventId: 'evt:' + state.gameId + ':' + seq, gameId: state.gameId,
    seq, ruleRef: clone(state.ruleRef),
    ...(actorSeat === undefined ? {} : { actorSeat }),
    type, visibility, payload: clone(payload),
    ...(causedByActionId === undefined ? {} : { causedByActionId }),
    ...(seq > 1 ? { previousEventId: state.events.at(-1).eventId } : {}),
  };
}
function appendEvent(state, event) {
  state.events.push(event);
  state.revision = event.seq;
  if (event.visibility === 'public') state.round.lastPublicEventSeq = event.seq;
}
function actionFor(state, seat, kind, tileIds = []) {
  return {
    ...V1,
    actionId: ['act', state.gameId, state.revision, seat, kind, ...tileIds].join(':'),
    kind, actorSeat: seat, expectedRevision: state.revision, tileIds: [...tileIds],
    ruleRef: clone(state.ruleRef),
    legalityBasis: { engineVersion: ENGINE_VERSION,
      reasonCodes: [kind === 'draw' ? 'SANDBOX_AWAIT_DRAW' : 'SANDBOX_OWNED_DISCARD'] },
  };
}

/** This function is deterministic; it never calls Math.random or Date.now. */
export function createGame({
  gameId = 'game-1', seed, profileId = 'tw16-four-player-sandbox',
  ruleVersion = 'experimental-move-v1', dealerSeat = 0, fixtureDeck = null,
} = {}) {
  if(isCompleteRef({profileId})) return completeCreateGame({gameId,seed,profileId,ruleVersion,dealerSeat,fixtureDeck});
  if (typeof gameId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(gameId)) throw new TypeError('Invalid gameId');
  assertSeat(dealerSeat);
  const profile = getRuleProfile(profileId, ruleVersion);
  assertRoundProfile(profile);
  const { tiles, rng } = shuffleDeck(createDeck(profile), seed);
  const players = Array.from({ length: 4 }, (_, seat) => ({
    seat, concealed: [], melds: [], river: [], flowers: [],
  }));
  // The sequential dealing order is an explicitly experimental fixture, not
  // an assertion about conventional Taiwanese wall/break/flower procedures.
  let offset = 0;
  for (let seat = 0; seat < 4; seat++) {
    players[seat].concealed = tiles.slice(offset, offset + profile.handShape.base);
    offset += profile.handShape.base;
  }
  players[dealerSeat].concealed.push(tiles[offset++]);
  const state = {
    ...V1, gameId,
    ruleRef: { profileId: profile.profileId, ruleVersion: profile.ruleVersion },
    round: {
      ...V1, roundId: gameId + '-round-0', handIndex: 0,
      dealerSeat, currentSeat: dealerSeat, phase: 'await_discard',
      lastPublicEventSeq: 0,
    },
    players, wall: tiles.slice(offset), events: [], rng, revision: 0,
  };
  appendEvent(state, eventFor(state, 'deal', 'system-private', undefined,
    { dealerSeat, countsBySeat: players.map(p => p.concealed.length) }));
  validateGameState(state, { replay: false });
  return state;
}

/**
 * Lists only executable bounded-subset moves. No chi/pong/kong/win/pass/
 * replace_flower candidates are ever emitted.
 */
export function listLegalActions(state, seat) {
  if(isCompleteRef(state?.ruleRef))return completeListLegalActions(state,seat);
  assertSeat(seat);
  profileFor(state);
  if (state.round.currentSeat !== seat) return [];
  if (state.round.phase === 'await_discard') {
    return state.players[seat].concealed.map(id =>
      actionFor(state, seat, 'discard', [id]));
  }
  if (state.round.phase === 'await_draw' && state.wall.length > 0) {
    return [actionFor(state, seat, 'draw')];
  }
  return [];
}

export function applyAction(state, submission) {
  if(isCompleteRef(state?.ruleRef))return completeApplyAction(state,submission);
  validateGameState(state, { replay: false });
  if (!submission || typeof submission !== 'object') throw new TypeError('Action submission required');
  const { actorSeat, actionId, expectedRevision } = submission;
  assertSeat(actorSeat);
  if (!Number.isInteger(expectedRevision) || expectedRevision !== state.revision) {
    throw new RangeError('Stale or invalid expectedRevision');
  }
  if (typeof actionId !== 'string') throw new TypeError('actionId is required');
  const action = listLegalActions(state, actorSeat).find(a => a.actionId === actionId);
  if (!action) throw new RangeError('Unavailable or illegal actionId');
  if (submission.tileIds !== undefined && !sameJson(submission.tileIds, action.tileIds)) {
    throw new RangeError('Forged tileIds');
  }
  const next = clone(state);
  const player = next.players[actorSeat];
  let event;
  if (action.kind === 'discard') {
    const tileId = action.tileIds[0];
    const index = player.concealed.indexOf(tileId);
    if (index < 0) throw new Error('Tile not owned by actor');
    player.concealed.splice(index, 1);
    event = eventFor(next, 'discard', 'public', actorSeat, { tileId }, action.actionId);
    player.river.push({ tileId, seq: event.seq });
    next.round.currentSeat = (actorSeat + 1) % 4;
    next.round.phase = 'await_draw';
  } else if (action.kind === 'draw') {
    if (!next.wall.length) throw new RangeError('Wall exhausted; no draw/settlement supported');
    const tileId = next.wall.shift();
    player.concealed.push(tileId);
    event = eventFor(next, 'draw', 'seat-private', actorSeat, { tileId }, action.actionId);
    next.round.phase = 'await_discard';
  } else {
    throw new RangeError('Unimplemented house rule action');
  }
  appendEvent(next, event);
  validateGameState(next, { replay: false });
  return { state: next, event: clone(event) };
}

/** Public/private event DTOs are built from scratch, never by deleting keys. */
function publicEvent(event) {
  const payload = event.type === 'discard'
    ? { tileId: event.payload.tileId }
    : event.type === 'deal'
      ? { countsBySeat: [...event.payload.countsBySeat] }
      : event.type === 'draw' ? { count: 1 } : {};
  return {
    ...V1, eventId: event.eventId, gameId: event.gameId, seq: event.seq,
    ruleRef: clone(event.ruleRef), type: event.type, visibility: 'public',
    ...(event.actorSeat === undefined ? {} : { actorSeat: event.actorSeat }),
    payload,
    ...(event.previousEventId ? { previousEventId: event.previousEventId } : {}),
    ...(event.type === 'discard' ? { causedByActionId: event.causedByActionId } : {}),
  };
}

export function createPlayerView(state, seat, eventSeq = state.revision) {
  if(isCompleteRef(state?.ruleRef))return completeCreatePlayerView(state,seat,eventSeq);
  assertSeat(seat);
  if (!Number.isInteger(eventSeq) || eventSeq < 1 || eventSeq > state.revision) {
    throw new RangeError('Invalid asOfEventSeq');
  }
  // A past view is reconstructed, never formed by mixing historical events
  // with present-day own cards/public discards.
  const at = eventSeq === state.revision ? state
    : replayGame({ ...state, events: state.events.slice(0, eventSeq) });
  const profile = profileFor(at);
  const toTile = id => makeTileIdentity(id, profile);
  const publicParts = p => ({
    seat: p.seat, melds: clone(p.melds), river: clone(p.river),
    flowers: p.flowers.map(toTile),
  });
  const self = {
    ...publicParts(at.players[seat]),
    concealed: at.players[seat].concealed.map(toTile),
  };
  const opponents = at.players.filter(p => p.seat !== seat)
    .map(p => ({ ...publicParts(p), concealedCount: p.concealed.length }));
  const known = new Uint8Array(34);
  const add = id => { const t = typeOf(id); if (++known[t] > 4) throw new Error('Public tile count exceeds 4'); };
  for (const id of at.players[seat].concealed) add(id);
  for (const p of at.players) {
    for (const d of p.river) add(d.tileId);
    for (const meld of p.melds) for (const id of meld.tileIds) add(id);
  }
  return {
    ...V1,
    viewId: 'view-' + at.gameId + '-' + eventSeq + '-seat' + seat,
    gameId: at.gameId, ruleRef: clone(at.ruleRef),
    audienceSeat: seat, asOfEventSeq: eventSeq,
    round: clone(at.round), self, opponents,
    publicEvents: at.events.filter(e => e.seq <= eventSeq).map(publicEvent),
    legalActions: listLegalActions(at, seat),
    knownUnavailableTypes: [...known.keys()].filter(t => known[t] === 4),
    capabilities: { structuralScore: true, roundActions: false, settlement: false },
  };
}
export const projectPlayerView = createPlayerView;

/**
 * Replay cross-checks every event including hidden draw payload and action ID.
 * Events are never applied as trusted state mutations.
 */
export function replayGame(config) {
  if(isCompleteRef(config?.ruleRef))return completeReplayGame(config);
  if (!config || !Array.isArray(config.events)) throw new TypeError('Replay events required');
  const seed = config.seed ?? config.rng?.seed;
  const ruleRef = config.ruleRef ?? {};
  let state = createGame({
    gameId: config.gameId, seed, profileId: ruleRef.profileId,
    ruleVersion: ruleRef.ruleVersion, dealerSeat: config.dealerSeat ?? config.round?.dealerSeat,
  });
  if (!config.events.length) throw new RangeError('Missing deal event');
  if (!sameJson(config.events[0], state.events[0])) {
    throw new RangeError('Replay mismatch: deal event');
  }
  for (const recorded of config.events.slice(1)) {
    if (!recorded || recorded.seq !== state.revision + 1 || !seatOK(recorded.actorSeat)
        || typeof recorded.causedByActionId !== 'string') {
      throw new RangeError('Replay event ordering/actor/action invalid');
    }
    const applied = applyAction(state, {
      actorSeat: recorded.actorSeat,
      actionId: recorded.causedByActionId, expectedRevision: state.revision,
    });
    if (!sameJson(applied.event, recorded)) {
      throw new RangeError('Replay event mismatch at seq ' + recorded.seq);
    }
    state = applied.state;
  }
  return state;
}

/** Strict inventory, phase, causality, seat-count and optional replay checks. */
export function validateGameState(state, { replay = true } = {}) {
  if(isCompleteRef(state?.ruleRef))return completeValidateGameState(state,{replay});
  if (!state || state.schemaVersion !== 1 || state.contractVersion !== CONTRACT_VERSION
      || !Array.isArray(state.players) || state.players.length !== 4
      || !Array.isArray(state.wall) || !Array.isArray(state.events)
      || !Number.isInteger(state.revision) || state.revision !== state.events.length
      || state.revision < 1 || !state.round || !state.rng) {
    throw new RangeError('Invalid GameState shape/version');
  }
  const profile = profileFor(state);
  assertSeat(state.round.currentSeat);
  assertSeat(state.round.dealerSeat);
  if (state.round.schemaVersion !== 1 || state.round.contractVersion !== CONTRACT_VERSION
      || !['await_draw', 'await_discard'].includes(state.round.phase)
      || state.round.handIndex !== 0 || state.round.roundId !== state.gameId + '-round-0'
      || !Number.isInteger(state.round.lastPublicEventSeq)) throw new RangeError('Invalid RoundState');
  if (state.rng.seed === undefined || state.rng.algorithmVersion !== RNG_ALGORITHM_VERSION
      || state.rng.counter !== createDeck(profile).length - 1) throw new RangeError('RNG metadata mismatch');
  const deck = new Set(createDeck(profile)), seen = new Set();
  function put(id) {
    identityString(id);
    if (!deck.has(id) || seen.has(id)) throw new RangeError('Duplicate, unknown or excess physical tile: ' + id);
    seen.add(id);
  }
  for (const id of state.wall) put(id);
  for (let seat = 0; seat < 4; seat++) {
    const p = state.players[seat];
    if (!p || p.seat !== seat || !Array.isArray(p.concealed) || !Array.isArray(p.melds)
        || !Array.isArray(p.river) || !Array.isArray(p.flowers)
        || p.melds.length || p.flowers.length) throw new RangeError('Illegal player/meld/flower state');
    const desired = 16 + (state.round.phase === 'await_discard' && state.round.currentSeat === seat ? 1 : 0);
    if (p.concealed.length !== desired) throw new RangeError('Illegal concealed tile count for phase');
    for (const id of p.concealed) put(id);
    for (const d of p.river) {
      if (!d || !Number.isInteger(d.seq) || d.seq <= 1 || d.seq > state.revision
          || d.claimedByEventId !== undefined) throw new RangeError('Invalid discard or unsupported claim');
      put(d.tileId);
      const corresponding = state.events[d.seq - 1];
      if (corresponding?.type !== 'discard' || corresponding.actorSeat !== seat
          || corresponding.payload?.tileId !== d.tileId) throw new RangeError('River/event discrepancy');
    }
  }
  if (seen.size !== deck.size) throw new RangeError('Physical tile conservation failed');
  const last = state.events.at(-1);
  let lastPublicEventSeq = 0;
  for (let i = 0; i < state.events.length; i++) {
    const e = state.events[i];
    if (!e || e.schemaVersion !== 1 || e.contractVersion !== CONTRACT_VERSION
        || e.seq !== i + 1 || e.eventId !== 'evt:' + state.gameId + ':' + (i + 1)
        || e.gameId !== state.gameId || !sameJson(e.ruleRef, state.ruleRef)
        || (i > 0 && e.previousEventId !== state.events[i - 1].eventId)
        || (i === 0 && (e.type !== 'deal' || e.visibility !== 'system-private'))
        || (i > 0 && !['discard', 'draw'].includes(e.type))) {
      throw new RangeError('Illegal event sequence');
    }
    if (e.type === 'discard') {
      if (e.visibility !== 'public') throw new RangeError('Discard must be public');
      lastPublicEventSeq = e.seq;
    } else if (e.type === 'draw' && e.visibility !== 'seat-private') {
      throw new RangeError('Draw must be private');
    }
  }
  if (state.round.lastPublicEventSeq !== lastPublicEventSeq
      || state.round.phase !== (last.type === 'discard' ? 'await_draw' : 'await_discard')
      || state.round.currentSeat !== (
        last.type === 'deal' ? state.round.dealerSeat
          : last.type === 'discard' ? (last.actorSeat + 1) % 4 : last.actorSeat
      )) throw new RangeError('Invalid phase/seat/public sequence');
  if (replay && !sameJson(replayGame(state), state)) {
    throw new RangeError('State does not match deterministic replay');
  }
  return true;
}
