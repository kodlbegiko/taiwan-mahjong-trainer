/**
 * Bot decision boundary. Only a strict, detached PlayerView is accepted.
 * Rules Engine owns legality, phase changes, wall, scoring and adjudication.
 */
import { readBotView, isSupportedBotTableProfile } from './view.js';
import { analyzePlayerView } from '../strategy/index.js';
import { analyzeDiscards, analyzeDraws } from '../core/efficiency.js';
import { rankPublicDiscardCandidates, R7_POLICY_VERSION } from './strategy-r7.js';

export const BOT_ENGINE_VERSION = 'tw16-bots/0.2.0-r3-experimental';
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

/**
 * Deterministic decision on PUBLIC information. No GameState parameter, no wall,
 * no opponent concealed and no future RNG. Never constructs a LegalAction.
 * Beginner: bounded shanten/ukeire; Intermediate: canonical public efficiency;
 * Advanced: same canonical order with at most 2 x 4 hypothetical two-draw
 * samples as an explicitly uncalibrated tie-break.
 */
export function chooseBotAction(bot, playerView) {
  assertBot(bot);
  const { view, hand, visible, fixedMelds } = readBotView(playerView);
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
  // R3 initial flowers require a real tail-replacement action before any
  // structural analysis. The narrow redacted-view adapter handles this phase.
  const replace = legal.find(a => a.kind === 'replace_flower');
  if (replace) return make(replace, 'ready', ['ENGINE_LEGAL_REPLACE_FLOWER']);
  const ownKongs = legal.filter(a => a.kind === 'kong' &&
    ['CONCEALED_KONG','ADDED_KONG'].includes(a.legalityBasis.reasonCodes[0]));
  const discards = legal.filter(a => a.kind === 'discard');
  // Preserve the pre-R7 Beginner trajectory, including R5 Seed 87.
  // Do not gamble on an unverified kong tai value at higher difficulties.
  if (ownKongs.length && (bot.difficulty === 'Beginner'
    ? roll(seed+'|self-kong') < 0.4 : discards.length === 0))
    return make(ownKongs[0], 'ready', ['ENGINE_LEGAL_SELF_KONG','UNCALIBRATED_KONG_VALUE']);

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

    const analysis = analyzePlayerView(view, {
      seed, samples: 0, maxSimulatedRoutes: 0,
    });
    if (!analysis.recommendations.length)
      return make(null, 'unsupported-analysis', ['STRATEGY_UNAVAILABLE'], analysis.engineVersion);
    const ranked = rankPublicDiscardCandidates(view, analysis.recommendations, bot.difficulty);
    if (!ranked.length)
      return make(null, 'unsupported-analysis', ['R7_NO_PUBLIC_RANK'], R7_POLICY_VERSION);
    const chosen = ranked[0];
    const action = discards.find(a => a.actionId === chosen.actionId);
    if (!action) return make(null, 'unsupported-analysis', ['RECOMMENDATION_NOT_LEGAL'], R7_POLICY_VERSION);
    return make(action, 'ready', chosen.reasonCodes, R7_POLICY_VERSION+'/'+bot.difficulty);

  }

  // A claim is actionable only when the R3 authority offers it; estimate
  // structural shanten *after* a legal meld without simulating a private wall.
  // This is a bounded heuristic, NOT post-claim Rule authorization or odds.
  const pass = legal.find(a => a.kind === 'pass');
  const claims = legal.filter(a => ['chi','pong','kong'].includes(a.kind));
  if (pass && claims.length && isSupportedBotTableProfile(view.ruleRef) &&
      view.round.phase === 'claim_window' && view.capabilities.structuralScore) {
    const owned = new Set(view.self.concealed.map(t => t.id));
    const baseline = analyzeDraws(hand, {visible,fixedMelds}).shanten;
    const candidates = [];
    for (const a of claims) {
      const used = a.tileIds.filter(id => owned.has(id));
      if (used.length !== (a.kind === 'kong' ? 3 : 2)) continue;
      const handAfter = [...hand];
      for (const id of used) {
        const tile = Number(id.split(':')[1]), pos = handAfter.indexOf(tile);
        if (pos < 0) throw new RangeError('Claim does not match public own hand');
        handAfter.splice(pos,1);
      }
      const nextFixed = fixedMelds+1;
      if (nextFixed > 5) continue;
      const projected = a.kind === 'kong'
        ? analyzeDraws(handAfter,{visible,fixedMelds:nextFixed}).shanten
        : Math.min(...analyzeDiscards(handAfter,{visible,fixedMelds:nextFixed})
          .map(rank => rank.shanten));
      if (!Number.isFinite(projected)) continue;
      candidates.push({a, benefit:baseline-projected});
    }
    candidates.sort((a,b)=>b.benefit-a.benefit ||
      a.a.actionId.localeCompare(b.a.actionId));
    const best=candidates[0];
    // A claim consuming concealed pairs carries unverified closed-hand and
    // replacement-draw costs. A zero-shanten-gain claim is not forced.
    const closed = view.self.melds.every(m => !m.open);
    const pressure = view.opponents.some(p => p.melds.filter(m => m.open).length >= 3);
    const threshold = bot.difficulty === 'Beginner' ? 1 :
      bot.difficulty === 'Advanced' && ((closed && baseline <= 1) || pressure) ? 2 : 1;
    if (best && best.benefit>=threshold &&
        (bot.difficulty!=='Beginner' || roll(seed+'|open-claim')<0.45))
      return make(best.a,'ready',['RULES_LEGAL_CLAIM','PUBLIC_POST_MELD_SHANTEN_HEURISTIC',
        'UNCALIBRATED_CLAIM_VALUE'],
        bot.difficulty === 'Beginner' ? 'canonical-efficiency/claim-heuristic' : R7_POLICY_VERSION+'/claim');
  }
  if (pass) return make(pass, 'ready', ['ENGINE_LEGAL_PASS','CLAIM_VALUE_UNVERIFIED']);
  const claim = claims[0];
  if (claim) return make(claim, 'ready', ['ENGINE_LEGAL_CLAIM','NO_PASS_OFFERED']);
  return make(null, 'unsupported-action-set', ['NO_SUPPORTED_POLICY']);
}

/** Compare against a fresh Rules-projected legal set, never a bot-generated action. */
export function validateBotDecision(bot, playerView, proposed) {
  assertBot(bot);
  const { view } = readBotView(playerView);
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

/**
 * Auditable, public-only candidate scores. Empty for Beginner (its seeded
 * three-way policy is intentionally retained as an R5 replay baseline).
 * Each score is a policy heuristic; none is a calibrated deal-in probability.
 */
export function inspectBotDiscardScores(bot, playerView) {
  assertBot(bot);
  const {view} = readBotView(playerView);
  if (view.audienceSeat !== bot.seat) throw new RangeError('Bot seat / PlayerView mismatch');
  if (bot.difficulty === 'Beginner' ||
      !view.capabilities.structuralScore ||
      !view.legalActions.some(a => a.kind === 'discard')) return [];
  const analysis = analyzePlayerView(view, {samples:0,maxSimulatedRoutes:0});
  return rankPublicDiscardCandidates(view,analysis.recommendations,bot.difficulty);
}
