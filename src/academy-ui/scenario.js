import { tileFaceMarkup, tileAccessibleName } from '../tile-visuals.js';

/** Accept ONLY an already projected PlayerView. No access to GameState or wall. */
export function projectScenarioForUI(view) {
  if (!view || view.schemaVersion !== 1 || view.contractVersion !== 'master-academy/1.0.0'
      || !view.self || !Array.isArray(view.self.concealed)
      || !Array.isArray(view.opponents) || view.opponents.length !== 3
      || view.opponents.some(p=>Object.hasOwn(p,'concealed') || !Number.isInteger(p.concealedCount))
      || !Array.isArray(view.legalActions)) throw new TypeError('無效或可能洩漏暗牌的 PlayerView');
  const safeTile = tile => {
    if (!tile || tile.kind !== 'standard' || !Number.isInteger(tile.tileType) || tile.tileType < 0 || tile.tileType > 33)
      return null; // flowers require separate artwork, never index 34–41.
    return tile.tileType;
  };
  const tileTypes = view.self.concealed.map(safeTile).filter(x=>x!==null);
  const seatPublic = [view.self, ...view.opponents].map(p=>({
    seat:p.seat, concealedCount:p.seat===view.audienceSeat ? tileTypes.length : p.concealedCount,
    river:(p.river || []).map(d=>d.tileType ?? (typeof d.tileId==='string' ? Number(d.tileId.split(':')[1]) : null)).filter(n=>Number.isInteger(n)&&n>=0&&n<34),
    meldCount:(p.melds || []).length, flowerCount:(p.flowers || []).length,
  }));
  return Object.freeze({
    fixtureOnly:view.fixtureOnly === true, hand:tileTypes, seats:seatPublic,
    roundLabel:typeof view.round?.phase === 'string' ? view.round.phase : '未知',
    turn: Number.isInteger(view.asOfEventSeq) ? view.asOfEventSeq : null,
    // Even a fixture must not be presented as scoreable.
    legalActions:view.fixtureOnly || view.capabilities?.roundActions !== true ? [] :
      view.legalActions.filter(a=>typeof a.actionId==='string' && typeof a.kind==='string'
        && Number.isInteger(a.expectedRevision)).map(a=>({actionId:a.actionId,kind:a.kind})),
    canScore:false,
  });
}
export function renderTileStrip(tiles) {
  return tiles.map((type,i)=>'<span class="academy-mini-tile tile" role="img" aria-label="第 '
    +(i+1)+' 張：'+tileAccessibleName(type)+'">'+tileFaceMarkup(type)+'</span>').join('');
}
