/**
 * Rules-authoritative bot orchestration. The adapter holds GameState privately.
 * Bots receive only PlayerView, and submission returns are intentionally ignored.
 */
import { readBotView } from './view.js';
import { chooseBotAction, validateBotDecision } from './decision.js';

const copy = value => JSON.parse(JSON.stringify(value));
const assertSeat = s => { if (!Number.isInteger(s) || s < 0 || s > 3) throw new RangeError('Seat must be 0..3'); };

/**
 * submitAction({actorSeat,actionId,expectedRevision}) MUST delegate to Rules.
 * Any GameState returned by the callback is discarded, not exposed to the bot.
 */
export async function runBotTurn({ bot, playerView, submitAction }) {
  if (typeof submitAction !== 'function') throw new TypeError('submitAction callback required');
  const { view } = readBotView(playerView);
  const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const decision = chooseBotAction(bot, view);
  const decisionMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs;
  validateBotDecision(bot, view, decision);
  if (decision.status !== 'ready') return { status: decision.status, decision, decisionMs };
  try {
    await submitAction({
      actorSeat: decision.actorSeat,
      actionId: decision.actionId,
      expectedRevision: decision.expectedRevision,
    });
    return { status: 'acted', decision, decisionMs };
  } catch (error) {
    // A new R3 capability is explicitly unsupported (e.g. simultaneous
    // multiwinner). Never misreport it as a terminal hand or silently PASS.
    if (error?.code === 'UNSUPPORTED_RULE_CAPABILITY' &&
        typeof error.capability === 'string')
      return {status:'unsupported',reason:'unsupported-rule-capability',
        capability:error.capability,decision,decisionMs};
    // Fail closed; no fallback, no retry using the same revision.
    return { status: 'submission-rejected', decision, decisionMs };
  }
}

/**
 * getActingSeat is an authoritative Rules scheduling callback. In particular
 * this module never determines claim priority or the next draw/discard actor.
 * getPlayerView(seat) MUST be the Rules Engine's public projection.
 */
export function createBotController({
  bots, humanSeat = 0, getActingSeat, getPlayerView, submitAction,
  getPendingClaimResponders = null,
  checkpoint = null, maxRevision = 2048,
  yieldControl = () => new Promise(resolve => setTimeout(resolve, 0)),
} = {}) {
  assertSeat(humanSeat);
  if (!Number.isInteger(maxRevision) || maxRevision < 1 || maxRevision > 100000)
    throw new RangeError('maxRevision must be 1..100000');
  if (!Array.isArray(bots) || bots.length !== 3 ||
      bots.some(bot => !bot || bot.seat === humanSeat ||
        !Number.isInteger(bot.seat) || bot.seat < 0 || bot.seat > 3) ||
      new Set(bots.map(bot => bot.seat)).size !== 3) {
    throw new TypeError('Exactly three distinct non-human bots required');
  }
  if ([getActingSeat,getPlayerView,submitAction,yieldControl].some(x => typeof x !== 'function') ||
      (getPendingClaimResponders!==null && typeof getPendingClaimResponders!=='function'))
    throw new TypeError('Authoritative adapter and yieldControl callbacks required');
  if (checkpoint !== null && (!checkpoint || Object.keys(checkpoint).some(k => k !== 'paused') ||
      typeof checkpoint.paused !== 'boolean')) throw new TypeError('Invalid controller checkpoint');

  const bySeat = new Map(bots.map(bot => [bot.seat,bot]));
  let paused = checkpoint?.paused ?? false, busy = false, lastAttempt = null;
  const decisions = [];
  async function readSeat(seat) {
    const { view } = readBotView(await getPlayerView(seat));
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

  /**
   * R3 publishes outstanding responders as separate seat-specific LegalActions.
   * Search PlayerViews, never GameState.extensions.tw16.window.decisions.
   * Ordered inspection is only scheduling; Rules adjudicates all priorities.
   */
  async function selectActor() {
    const preferred = await getActingSeat();
    if (preferred === null || preferred === undefined)
      return {status:'no-scheduled-actor'};
    assertSeat(preferred);
    const initial = await readSeat(preferred);
    if (initial.round.phase === 'settled') return {status:'settled'};
    if (initial.asOfEventSeq > maxRevision)
      return {status:'unsupported',reason:'max-event-budget-exceeded'};
    if (initial.round.phase !== 'claim_window') {
      if (!initial.legalActions.length)
        return {status:'unsupported',reason:'no-Rules-LegalAction-for-phase',
          phase:initial.round.phase};
      return {seat:preferred,view:initial};
    }
    if (initial.ruleRef.profileId !== 'tw16-configurable-table' ||
        initial.ruleRef.ruleVersion !== 'experimental-full-v1')
      return {status:'claim-adjudication-unavailable'};
    // When available, the trusted Rules host may offer the newer R3
    // listPendingClaimResponders(state) result as an ordered seat list.
    // Otherwise scan only the four per-seat public PlayerViews (older R3).
    const pending = getPendingClaimResponders===null ?
      Array.from({length:4},(_,i)=>(preferred+i)%4) :
      await getPendingClaimResponders();
    if (!Array.isArray(pending) || pending.length>3 && getPendingClaimResponders!==null ||
        pending.some(s=>!Number.isInteger(s)||s<0||s>3) ||
        new Set(pending).size!==pending.length)
      return {status:'unsupported',reason:'invalid-Rules-claim-responder-list'};
    for (const seat of pending) {
      const v = seat===preferred ? initial : await readSeat(seat);
      if (v.gameId !== initial.gameId ||
          v.asOfEventSeq !== initial.asOfEventSeq ||
          v.round.phase !== 'claim_window' ||
          v.ruleRef.profileId !== initial.ruleRef.profileId ||
          v.ruleRef.ruleVersion !== initial.ruleRef.ruleVersion)
        return {status:'unsupported',reason:'inconsistent-Rules-revision-in-claim-window'};
      if (v.legalActions.length) {
        if (!v.legalActions.some(a=>a.kind==='pass'))
          return {status:'unsupported',reason:'claim-response-without-pass'};
        return {seat,view:v};
      }
      if (getPendingClaimResponders!==null)
        return {status:'unsupported',reason:'Rules-reported-responder-without-LegalActions'};
    }
    return {status:'unsupported',reason:'claim-window-deadlock-no-responders'};
  }

  async function tick() {
    if (busy) return {status:'busy'};
    if (paused) return {status:'paused'};
    busy = true;
    try {
      const scheduled = await selectActor();
      if (scheduled.status) return scheduled;
      const {seat,view} = scheduled;
      if (seat === humanSeat) return {status:'human-turn',seat};
      if (lastAttempt && lastAttempt.seat===seat &&
          lastAttempt.gameId===view.gameId &&
          lastAttempt.revision===view.asOfEventSeq)
        return {status:'duplicate-revision-blocked',seat};
      lastAttempt={seat,revision:view.asOfEventSeq,gameId:view.gameId};
      const result=await runBotTurn({
        bot:bySeat.get(seat),playerView:view,submitAction,
      });
      record(result.decision);
      return {status:result.status,seat,decision:result.decision,
        decisionMs:result.decisionMs,
        ...(result.reason?{reason:result.reason}:{}),
        ...(result.capability?{capability:result.capability}:{})};
    } finally {
      busy=false;
    }
  }
  async function runUntilHuman({ maxActions = 32 } = {}) {
    if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 128)
      throw new RangeError('maxActions must be 1..128');
    let actions = 0;
    for (; actions < maxActions;) {
      if (paused) return { status: 'paused', actions };
      const result = await tick();
      if (result.status !== 'acted') return { ...result, actions };
      actions++;
      if (actions < maxActions) await yieldControl(); // macrotask yielding for PWA responsiveness
    }
    return { status: 'action-budget-reached', actions };
  }
  async function submitHumanAction({actionId,expectedRevision}) {
    if (paused || busy) return {status:paused?'paused':'busy'};
    // In R3 claim windows, any pending responder may submit in any order.
    // In normal phases, only Rules.currentSeat is the authorized actor.
    const preferred=await getActingSeat();
    if (preferred===null || preferred===undefined) return {status:'no-scheduled-actor'};
    assertSeat(preferred);
    const primary=await readSeat(preferred);
    if (primary.round.phase==='settled') return {status:'settled'};
    if (primary.asOfEventSeq>maxRevision)
      return {status:'unsupported',reason:'max-event-budget-exceeded'};
    const isClaim=primary.round.phase==='claim_window' &&
      primary.ruleRef.profileId==='tw16-configurable-table' &&
      primary.ruleRef.ruleVersion==='experimental-full-v1';
    if (primary.round.phase==='claim_window' && !isClaim)
      return {status:'claim-adjudication-unavailable'};
    if (!isClaim && preferred!==humanSeat) return {status:'not-human-turn'};
    const view=preferred===humanSeat?primary:await readSeat(humanSeat);
    if (view.gameId!==primary.gameId || view.asOfEventSeq!==primary.asOfEventSeq ||
        view.round.phase!==primary.round.phase)
      return {status:'unsupported',reason:'inconsistent-human-revision'};
    const found=view.legalActions.find(a=>a.actionId===actionId &&
      a.expectedRevision===expectedRevision && a.actorSeat===humanSeat);
    if (!found) return {status:'illegal-or-stale-action'};
    try {
      await submitAction({actorSeat:humanSeat,actionId,expectedRevision});
      return {status:'acted'};
    } catch (error) {
      if (error?.code==='UNSUPPORTED_RULE_CAPABILITY' &&
          typeof error.capability==='string')
        return {status:'unsupported',reason:'unsupported-rule-capability',
          capability:error.capability};
      return {status:'submission-rejected'};
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
