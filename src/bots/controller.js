/**
 * Rules-authoritative bot orchestration. The adapter holds GameState privately.
 * Bots receive only PlayerView, and submission returns are intentionally ignored.
 */
import { readPlayerView } from '../strategy/view.js';
import { chooseBotAction, validateBotDecision } from './decision.js';

const copy = value => JSON.parse(JSON.stringify(value));
const assertSeat = s => { if (!Number.isInteger(s) || s < 0 || s > 3) throw new RangeError('Seat must be 0..3'); };

/**
 * submitAction({actorSeat,actionId,expectedRevision}) MUST delegate to Rules.
 * Any GameState returned by the callback is discarded, not exposed to the bot.
 */
export async function runBotTurn({ bot, playerView, submitAction }) {
  if (typeof submitAction !== 'function') throw new TypeError('submitAction callback required');
  const { view } = readPlayerView(playerView);
  const decision = chooseBotAction(bot, view);
  validateBotDecision(bot, view, decision);
  if (decision.status !== 'ready') return { status: decision.status, decision };
  try {
    await submitAction({
      actorSeat: decision.actorSeat,
      actionId: decision.actionId,
      expectedRevision: decision.expectedRevision,
    });
    return { status: 'acted', decision };
  } catch {
    // Fail closed; no fallback, no retry using the same revision.
    return { status: 'submission-rejected', decision };
  }
}

/**
 * getActingSeat is an authoritative Rules scheduling callback. In particular
 * this module never determines claim priority or the next draw/discard actor.
 * getPlayerView(seat) MUST be the Rules Engine's public projection.
 */
export function createBotController({
  bots, humanSeat = 0, getActingSeat, getPlayerView, submitAction,
  checkpoint = null,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
} = {}) {
  assertSeat(humanSeat);
  if (!Array.isArray(bots) || bots.length !== 3 ||
      bots.some(bot => !bot || bot.seat === humanSeat ||
        !Number.isInteger(bot.seat) || bot.seat < 0 || bot.seat > 3) ||
      new Set(bots.map(bot => bot.seat)).size !== 3) {
    throw new TypeError('Exactly three distinct non-human bots required');
  }
  if ([getActingSeat,getPlayerView,submitAction,yieldControl].some(x => typeof x !== 'function'))
    throw new TypeError('Authoritative adapter and yieldControl callbacks required');
  if (checkpoint !== null && (!checkpoint || Object.keys(checkpoint).some(k => k !== 'paused') ||
      typeof checkpoint.paused !== 'boolean')) throw new TypeError('Invalid controller checkpoint');

  const bySeat = new Map(bots.map(bot => [bot.seat,bot]));
  let paused = checkpoint?.paused ?? false, busy = false, lastAttempt = null;
  const decisions = [];
  async function readSeat(seat) {
    const { view } = readPlayerView(await getPlayerView(seat));
    if (view.audienceSeat !== seat) throw new RangeError('Authoritative view seat mismatch');
    return view;
  }
  function record(decision) {
    // Never record GameState, private TurnEvents, an opponent hand, or the wall.
    decisions.push(copy({
      gameId: decision.gameId, actorSeat: decision.actorSeat,
      expectedRevision: decision.expectedRevision, actionId: decision.actionId,
      status: decision.status, reasonCodes: decision.reasonCodes,
      strategyVersion: decision.strategyVersion, botVersion: decision.botVersion,
      rngSeed: decision.rngSeed,
    }));
    if (decisions.length > 512) decisions.shift();
  }

  async function tick() {
    if (busy) return { status: 'busy' };
    if (paused) return { status: 'paused' };
    busy = true;
    try {
      const seat = await getActingSeat();
      if (seat === null || seat === undefined) return { status: 'no-scheduled-actor' };
      assertSeat(seat);
      if (seat === humanSeat) return { status: 'human-turn', seat };
      const view = await readSeat(seat);
      // Pending claim collisions require a dedicated Rules arbitration API.
      if (view.round.phase === 'claim_window') return { status: 'claim-adjudication-unavailable' };
      if (lastAttempt && lastAttempt.seat === seat &&
          lastAttempt.gameId === view.gameId && lastAttempt.revision === view.asOfEventSeq)
        return { status: 'duplicate-revision-blocked', seat };
      lastAttempt = { seat, revision: view.asOfEventSeq, gameId: view.gameId };
      const result = await runBotTurn({ bot: bySeat.get(seat), playerView: view, submitAction });
      record(result.decision);
      return { status: result.status, seat, decision: result.decision };
    } finally {
      busy = false;
    }
  }
  async function runUntilHuman({ maxActions = 32 } = {}) {
    if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 128)
      throw new RangeError('maxActions must be 1..128');
    let actions = 0;
    for (; actions < maxActions;) {
      if (paused) return { status: 'paused', actions };
      const result = await tick();
      if (result.status !== 'acted') return { status: result.status, actions };
      actions++;
      if (actions < maxActions) await yieldControl(); // macrotask yielding for PWA responsiveness
    }
    return { status: 'action-budget-reached', actions };
  }
  async function submitHumanAction({ actionId, expectedRevision }) {
    if (paused || busy) return { status: paused ? 'paused' : 'busy' };
    const seat = await getActingSeat();
    if (seat !== humanSeat) return { status: 'not-human-turn' };
    const view = await readSeat(humanSeat);
    if (view.round.phase === 'claim_window') return { status: 'claim-adjudication-unavailable' };
    const found = view.legalActions.find(a => a.actionId === actionId &&
      a.expectedRevision === expectedRevision && a.actorSeat === humanSeat);
    if (!found) return { status: 'illegal-or-stale-action' };
    try {
      await submitAction({ actorSeat: humanSeat, actionId, expectedRevision });
      return { status: 'acted' };
    } catch {
      return { status: 'submission-rejected' };
    }
  }
  return Object.freeze({
    tick, runUntilHuman, submitHumanAction,
    pause() { paused = true; },
    resume() { paused = false; },
    isPaused() { return paused; },
    checkpoint() { return { paused }; }, // GameState persistence is owned by the Rules host.
    history() { return copy(decisions); },
    async publicEvents(seat = humanSeat) { assertSeat(seat); return copy((await readSeat(seat)).publicEvents); },
  });
}
