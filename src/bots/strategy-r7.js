/**
 * R7 Bot-only decision ranking. Callers MUST pass the detached, validated
 * PlayerView from readBotView; this module deliberately imports no Rules
 * internals and cannot inspect private wall/hand/claim data.
 *
 * Danger indicators are ordinal PUBLIC proxies, NOT deal-in probabilities,
 * guaranteed safe tiles, or verified Taiwanese-house-rule assumptions.
 */
export const R7_POLICY_VERSION = 'r7-public-attack-defense/0.1.0';

const metric = (rec, name) => rec.metrics.find(m => m.name === name)?.value ?? null;
const typeOf = id => Number(id.split(':')[1]);

function publicTileExposure(view, type) {
  const ids = new Set();
  for (const player of [view.self, ...view.opponents]) {
    for (const meld of player.melds) for (const id of meld.tileIds) {
      if (typeOf(id) === type) ids.add(id);
    }
    for (const discard of player.river) {
      if (typeOf(discard.tileId) === type) ids.add(discard.tileId);
    }
  }
  return ids.size; // Claimed river tiles and exposed melds have one physical ID.
}

/**
 * Score strictly within an exact shanten tier. A pressure signal may exchange
 * effective draws for qualitative caution, but cannot sacrifice a whole
 * shanten step. Stable canonical rank and actionId break all final ties.
 */
export function rankPublicDiscardCandidates(view, recommendations, difficulty) {
  if (!['Intermediate', 'Advanced'].includes(difficulty))
    throw new RangeError('R7 ranker requires Intermediate or Advanced');
  if (!Array.isArray(recommendations) || !recommendations.length) return [];
  const legal = new Set(view.legalActions.filter(a => a.kind === 'discard').map(a => a.actionId));
  const bestShanten = Math.min(...recommendations.map(r => metric(r, 'postDiscardShanten')));
  const handCounts = new Map();
  for (const t of view.self.concealed) handCounts.set(t.tileType, (handCounts.get(t.tileType) || 0) + 1);
  const maxOpen = Math.max(0, ...view.opponents.map(p => p.melds.filter(m => m.open).length));
  const aggressiveThreats = view.opponents.filter(p => p.melds.filter(m => m.open).length >= 2);
  const pressure = aggressiveThreats.length > 0 && maxOpen >= (difficulty === 'Advanced' ? 2 : 3);
  const all = [];
  for (const rec of recommendations) {
    if (!legal.has(rec.actionId)) continue;
    const action = view.legalActions.find(a => a.actionId === rec.actionId);
    const tile = typeOf(action.tileIds[0]);
    const shanten = metric(rec, 'postDiscardShanten');
    const copies = metric(rec, 'oneTurnEffectiveCopies');
    const kinds = metric(rec, 'oneTurnEffectiveKinds');
    if (![shanten, copies, kinds].every(Number.isFinite)) continue;
    // Public history, not a furiten or guaranteed-safety rule.
    const repeatedByThreat = aggressiveThreats.filter(p =>
      p.river.some(d => typeOf(d.tileId) === tile)).length;
    const exposed = publicTileExposure(view, tile);
    const honorPairCost = tile >= 27 && (handCounts.get(tile) || 0) >= 2 ? 5 : 0;
    const cautious = pressure && shanten >= 1;
    const efficiencyScore = copies * 10 + kinds;
    const publicCautionScore = cautious
      ? repeatedByThreat * (difficulty === 'Advanced' ? 40 : 16)
        + exposed * (difficulty === 'Advanced' ? 2 : 1)
      : 0;
    const handShapeProxy = -honorPairCost; // Unverified tai/fan opportunity proxy.
    const shantenScore = -10000 * (shanten - bestShanten);
    const score = shantenScore + efficiencyScore + publicCautionScore + handShapeProxy;
    all.push({
      actionId: rec.actionId, tile, score,
      components: {shanten, effectiveCopies:copies, effectiveKinds:kinds,
        shantenScore, efficiencyScore, publicCautionScore, handShapeProxy,
        exposedPublicCopies:exposed, repeatDiscardingThreats:repeatedByThreat,
        maxOpponentOpenMelds:maxOpen, pressureActive:cautious},
      reasonCodes: ['EXACT_SHANTEN', 'VISIBLE_UKEIRE',
        cautious ? 'PUBLIC_PRESSURE_CAUTION_PROXY' : 'ATTACK_EFFICIENCY',
        'UNVERIFIED_HAND_VALUE_PROXY', 'UNCALIBRATED_DEAL_IN_RISK'],
      canonicalRank:rec.rank,
    });
  }
  return all.sort((a,b) => b.score-a.score ||
    a.canonicalRank-b.canonicalRank || a.actionId.localeCompare(b.actionId));
}
