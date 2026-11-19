/**
 * Bot decision boundary. Only a strict, detached PlayerView is accepted.
 * Rules Engine owns legality, phase changes, wall, scoring and adjudication.
 */
import { readPlayerView } from '../strategy/view.js';
import { analyzePlayerView } from '../strategy/index.js';
import { analyzeDiscards } from '../core/efficiency.js';

export const BOT_ENGINE_VERSION = 'tw16-bots/0.1.0';
const LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);
const ACTION_KINDS = new Set(['draw','discard','chi','pong','kong','win','pass','replace_flower']);

function hash(input) {
  let n = 2166136261;
  for (const char of input) { n ^= char.charCodeAt(0); n = Math.imul(n, 16777619); }
  return n >>> 0;
}
function roll(seed) {
  let s = hash(seed) || 0x9e3779b9;
  s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
  return (s >>> 0) / 4294967296;
}
function assertBot(bot) {
  if (!bot || !Number.isInteger(bot.seat) || bot.seat < 0 || bot.seat > 3 ||
      !LEVELS.has(bot.difficulty) || typeof bot.seed !== 'string' ||
      bot.seed.length < 1 || bot.seed.length > 128 || bot.version !== BOT_ENGINE_VERSION ||
      Object.keys(bot).some(k => !['seat','difficulty','seed','version'].includes(k))) {
    throw new TypeError('Invalid Bot config');
  }
}
export function createBot({ seat, difficulty = 'Beginner', seed = 'independent-bot-v1' } = {}) {
  const bot = { seat, difficulty, seed, version: BOT_ENGINE_VERSION };
  assertBot(bot);
  return Object.freeze(bot);
}
function decision(bot, view, seed, action, status, reasonCodes, strategyVersion) {
  return Object.freeze({
    actionId: action?.actionId ?? null,
    expectedRevision: view.asOfEventSeq,
    actorSeat: bot.seat,
    gameId: view.gameId,
    status, reasonCodes: [...reasonCodes],
    strategyVersion, botVersion: BOT_ENGINE_VERSION,
    rngSeed: seed, // Independent bot tie-break seed, NEVER the Rules Engine seed.
  });
}
function metric(rec, key) { return rec.metrics.find(m => m.name === key)?.value ?? null; }

/**
 * Deterministic decision on PUBLIC information. No GameState parameter, no wall,
 * no opponent concealed and no future RNG. Never constructs a LegalAction.
 * Beginner: bounded shanten/ukeire; Intermediate: canonical public efficiency;
 * Advanced: same canonical order with at most 2 x 4 hypothetical two-draw
 * samples as an explicitly uncalibrated tie-break.
 */
export function chooseBotAction(bot, playerView) {
  assertBot(bot);
  const { view, hand, visible, fixedMelds } = readPlayerView(playerView);
  if (view.audienceSeat !== bot.seat) throw new RangeError('Bot seat / PlayerView mismatch');
  const seed = [bot.seed, view.gameId, view.asOfEventSeq, bot.seat, bot.difficulty].join('|');
  const legal = view.legalActions;
  if (legal.some(a => !ACTION_KINDS.has(a.kind))) throw new RangeError('Unknown legal action kind');
  const make = (a, status, reasons, version = 'rules-only') =>
    decision(bot, view, seed, a, status, reasons, version);

  if (!legal.length) return make(null, 'no-legal-action', ['RULES_NO_ACTION']);
  const win = legal.find(a => a.kind === 'win');
  if (win) return make(win, 'ready', ['ENGINE_LEGAL_WIN']);
  const draw = legal.find(a => a.kind === 'draw');
  if (draw) return make(draw, 'ready', ['ENGINE_LEGAL_DRAW']);
  const discards = legal.filter(a => a.kind === 'discard');

  if (discards.length) {
    if (!view.capabilities.structuralScore)
      return make(null, 'unsupported-analysis', ['STRUCTURAL_SCORE_UNAVAILABLE']);
    if (bot.difficulty === 'Beginner') {
      const ranked = analyzeDiscards(hand, { visible, fixedMelds });
      if (!ranked.length) return make(null, 'unsupported-analysis', ['NO_STRUCTURAL_RANK']);
      const best = ranked[0].shanten;
      // Deliberately weak but still considers exact shanten and basic ukeire.
      const options = ranked.filter(r => r.shanten === best).slice(0, 3);
      const selectedType = options[Math.floor(roll(seed) * options.length)].tile;
      const selected = discards.filter(a => Number(a.tileIds[0].split(':')[1]) === selectedType)
        .sort((a,b) => a.actionId.localeCompare(b.actionId))[0];
      if (!selected) return make(null, 'unsupported-analysis', ['DISCARD_NOT_IN_LEGAL_SET']);
      return make(selected, 'ready', ['BASIC_SHANTEN','BASIC_UKEIRE','SEEDED_TOP_THREE'], 'canonical-efficiency/basic');
    }

    const advanced = bot.difficulty === 'Advanced';
    const analysis = analyzePlayerView(view, {
      seed, samples: advanced ? 4 : 0, maxSimulatedRoutes: advanced ? 2 : 0,
    });
    const recommendations = analysis.recommendations;
    if (!recommendations.length)
      return make(null, 'unsupported-analysis', ['STRATEGY_UNAVAILABLE'], analysis.engineVersion);
    let chosen = recommendations[0];
    if (advanced && recommendations.length > 1) {
      const first = recommendations[0], second = recommendations[1];
      const s0 = metric(first, 'postDiscardShanten'), s1 = metric(second, 'postDiscardShanten');
      const u0 = metric(first, 'oneTurnEffectiveCopies'), u1 = metric(second, 'oneTurnEffectiveCopies');
      const p0 = metric(first, 'twoTurnImprovementFrequency'), p1 = metric(second, 'twoTurnImprovementFrequency');
      // A bounded, deliberately conservative two-draw tie-break; NOT real win odds.
      if (s0 === s1 && u0 !== null && u1 !== null && u0 - u1 <= 1 &&
          p0 !== null && p1 !== null && p1 > p0) chosen = second;
    }
    const action = discards.find(a => a.actionId === chosen.actionId);
    if (!action) return make(null, 'unsupported-analysis', ['RECOMMENDATION_NOT_LEGAL'], analysis.engineVersion);
    return make(action, 'ready',
      advanced ? ['CANONICAL_EFFICIENCY','VISIBLE_COPIES','BOUNDED_HYPOTHETICAL_TWO_DRAW','NO_CALIBRATED_RISK']
               : ['CANONICAL_EFFICIENCY','VISIBLE_COPIES','PUBLIC_INFORMATION_ONLY'],
      analysis.engineVersion + (advanced ? '+bounded-two-draw-v1' : '+baseline-v1'));
  }

  // Without a verified post-claim projection, do not invent chi/pong/kong value.
  const pass = legal.find(a => a.kind === 'pass');
  if (pass) return make(pass, 'ready', ['ENGINE_LEGAL_PASS','CLAIM_EVALUATION_UNVERIFIED']);
  const replace = legal.find(a => a.kind === 'replace_flower');
  if (replace) return make(replace, 'ready', ['ENGINE_LEGAL_REPLACE_FLOWER']);
  const claim = legal.find(a => ['chi','pong','kong'].includes(a.kind));
  if (claim) return make(claim, 'ready', ['ENGINE_LEGAL_CLAIM','CLAIM_VALUE_UNVERIFIED']);
  return make(null, 'unsupported-action-set', ['NO_SUPPORTED_POLICY']);
}

/** Compare against a fresh Rules-projected legal set, never a bot-generated action. */
export function validateBotDecision(bot, playerView, proposed) {
  assertBot(bot);
  const { view } = readPlayerView(playerView);
  if (bot.seat !== view.audienceSeat || !proposed ||
      proposed.botVersion !== BOT_ENGINE_VERSION ||
      proposed.actorSeat !== bot.seat || proposed.gameId !== view.gameId ||
      proposed.expectedRevision !== view.asOfEventSeq ||
      typeof proposed.rngSeed !== 'string' || !Array.isArray(proposed.reasonCodes)) {
    throw new RangeError('Invalid Bot decision context');
  }
  if (proposed.actionId === null) {
    if (proposed.status === 'ready') throw new RangeError('Ready decision lacks action');
    return true; // Explicit failure/no-action; controller must not submit.
  }
  if (proposed.status !== 'ready') throw new RangeError('Cannot submit non-ready decision');
  if (typeof proposed.actionId !== 'string' ||
      !view.legalActions.some(a => a.actionId === proposed.actionId &&
        a.expectedRevision === proposed.expectedRevision && a.actorSeat === bot.seat)) {
    throw new RangeError('Bot decision is not a current LegalAction');
  }
  return true;
}
