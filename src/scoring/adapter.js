import {scoreWinningHand} from './evaluate.js';
import {settleWinningHand} from './settlement.js';

/**
 * Trusted Rules-host boundary ONLY. Never hand GameState to a Bot or UI.
 * R5 game state is read-only and its authoritative R5 settlement is unchanged.
 */
export function evidenceFromSettledRulesState(state,{seatWindType,prevailingWindType,
  dealerStreak,streakEvidence}={}){
  if(!state||state.round?.phase!=='settled'||state.extensions?.tw16?.result?.reason!=='win')
    throw new RangeError('Requires an authoritative settled Rules snapshot');
  const r=state.extensions.tw16.result;
  const win=state.events?.filter(x=>x.type==='win'&&x.visibility==='public');
  const settle=state.events?.filter(x=>x.type==='settle'&&x.visibility==='public');
  if(win?.length!==1||settle?.length!==1||win[0].payload.winnerSeat!==r.winnerSeat||
    win[0].payload.sourceSeat!==r.sourceSeat||
    settle[0].payload.winnerSeat!==r.winnerSeat||
    settle[0].payload.reason!=='win')
    throw new RangeError('Missing canonical public win/settle event linkage');
  const player=state.players?.[r.winnerSeat];
  if(!player||!Array.isArray(player.concealed)||!Array.isArray(player.melds)||
    !Array.isArray(player.flowers))throw new RangeError('Invalid winner snapshot');
  // Audit public history for each claimed or revealed flower and kong.
  for(const id of player.flowers)
    if(!state.events.some(e=>e.type==='flower'&&e.actorSeat===r.winnerSeat&&
      e.payload?.tileId===id))
      throw new RangeError('Flower lacks event provenance');
  for(const m of player.melds)
    if(m.kind==='kong'&&!state.events.some(e=>e.type==='kong'&&
      e.visibility==='public'&&e.actorSeat===r.winnerSeat&&
      Array.isArray(e.payload?.tileIds)&&m.tileIds.some(id=>e.payload.tileIds.includes(id))))
      throw new RangeError('Kong lacks public event provenance');
  if(r.via==='discard'){
    const lastDiscard=state.events.find(e=>e.type==='discard'&&
      e.actorSeat===r.sourceSeat&&e.payload.tileId===r.winningTileId);
    if(!lastDiscard)throw new RangeError('Discard-win lacks source event provenance');
  }
  if(prevailingWindType===undefined){
    const lookup={east:27,south:28,west:29,north:30};
    prevailingWindType=lookup[state.round.prevailingWind];
  }
  if(dealerStreak===undefined){
    if(state.round.handIndex!==0)throw new RangeError('Dealer streak requires verified round-chain evidence');
    dealerStreak=0;
  }
  return {ruleRef:{...state.ruleRef},winnerSeat:r.winnerSeat,
    sourceSeat:r.sourceSeat,via:r.via,dealerSeat:state.round.dealerSeat,
    concealed:[...player.concealed],melds:player.melds.map(m=>({
      kind:m.kind,open:m.open,tileIds:[...m.tileIds]})),
    flowers:[...player.flowers],
    ...(r.via==='discard'?{winningTile:r.winningTileId}:{}),
    ...(seatWindType===undefined?{}:{seatWindType}),
    ...(prevailingWindType===undefined?{}:{prevailingWindType}),
    dealerStreak,streakEvidence};
}
export function scoreRulesState(profile,state,context){
  return scoreWinningHand(profile,evidenceFromSettledRulesState(state,context));
}
export function settleRulesState(profile,state,context){
  return settleWinningHand(profile,evidenceFromSettledRulesState(state,context));
}
