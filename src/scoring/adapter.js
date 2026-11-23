import {scoreWinningHand} from './evaluate.js';
import {settleWinningHand} from './settlement.js';

/**
 * Rules-host-only, read-only adapter. The input is an authoritative private
 * Rules snapshot, never a Bot's view or an unverifiable user-side DTO.
 */
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
  a.length===b.length&&[...a].sort().every((id,i)=>id===[...b].sort()[i]);
const WIND_TYPES={east:27,south:28,west:29,north:30};
export function evidenceFromSettledRulesState(state,{seatWindType,prevailingWindType,
  dealerStreak,streakEvidence}={}){
  if(!state||state.round?.phase!=='settled'||state.extensions?.tw16?.result?.reason!=='win')
    throw new RangeError('Requires an authoritative settled Rules snapshot');
  const r=state.extensions.tw16.result,events=state.events;
  const win=events?.filter(x=>x.type==='win'&&x.visibility==='public');
  const settle=events?.filter(x=>x.type==='settle'&&x.visibility==='public');
  if(win?.length!==1||settle?.length!==1||
    win[0]?.payload?.winnerSeat!==r.winnerSeat||
    win[0]?.payload?.sourceSeat!==r.sourceSeat||
    win[0]?.payload?.via!==r.via||
    settle[0]?.payload?.winnerSeat!==r.winnerSeat||
    settle[0]?.payload?.reason!=='win'||settle[0].seq!==win[0].seq+1||
    !Array.isArray(settle[0].payload.delta)||
    !Array.isArray(state.round.scores)||
    settle[0]!==events.at(-1)||
    !settle[0].payload.delta.every((n,i)=>n===state.round.scores[i]))
    throw new RangeError('Missing canonical public win/settle event linkage');
  const player=state.players?.[r.winnerSeat];
  if(!player||!Array.isArray(player.concealed)||!Array.isArray(player.melds)||
    !Array.isArray(player.flowers))throw new RangeError('Invalid winner snapshot');
  for(const id of player.flowers)
    if(!events.some(e=>e.type==='flower'&&e.actorSeat===r.winnerSeat&&
      e.payload?.tileId===id))
      throw new RangeError('Flower lacks event provenance');
  for(const m of player.melds){
    if(m.kind!=='kong')continue;
    const matches=events.some(e=>{
      if(e.type!=='kong'||e.visibility!=='public'||e.actorSeat!==r.winnerSeat||
        !Array.isArray(e.payload?.tileIds))return false;
      if(e.payload.kind==='ADDED_KONG'){
        if(e.payload.tileIds.length!==1||!m.tileIds.includes(e.payload.tileIds[0]))return false;
        return events.some(prior=>prior.seq<e.seq&&prior.type==='claim'&&
          prior.visibility==='public'&&prior.actorSeat===r.winnerSeat&&
          prior.payload?.kind==='pong'&&
          sameIds([...prior.payload.tileIds,...e.payload.tileIds],m.tileIds));
      }
      return (e.payload.kind==='CONCEALED_KONG'||e.payload.kind==='kong')&&
        sameIds(e.payload.tileIds,m.tileIds);
    });
    if(!matches)throw new RangeError('Kong lacks complete public event provenance');
  }
  if(r.via==='discard'&&!events.some(e=>e.type==='discard'&&
      e.visibility==='public'&&e.actorSeat===r.sourceSeat&&
      e.payload?.tileId===r.winningTileId&&e.seq<win[0].seq))
    throw new RangeError('Discard-win lacks source event provenance');
  const actualPrevailing=WIND_TYPES[state.round.prevailingWind];
  if(actualPrevailing===undefined||
    (prevailingWindType!==undefined&&prevailingWindType!==actualPrevailing))
    throw new RangeError('Public prevailing wind mismatch');
  prevailingWindType=actualPrevailing;
  if(dealerStreak===undefined){
    if(state.round.handIndex!==0)throw new RangeError('Dealer streak requires verified round-chain evidence');
    dealerStreak=0;
  }
  if(dealerStreak>0&&
    (state.round.handIndex<dealerStreak||
      streakEvidence?.roundRefs?.at(-1)!==state.extensions.tw16.previousRoundRef?.roundId))
    throw new RangeError('Dealer streak lacks immediate previous settled round linkage');
  return {ruleRef:{...state.ruleRef},winnerSeat:r.winnerSeat,
    sourceSeat:r.sourceSeat,via:r.via,dealerSeat:state.round.dealerSeat,
    concealed:[...player.concealed],melds:player.melds.map(m=>({
      kind:m.kind,open:m.open,tileIds:[...m.tileIds]})),
    flowers:[...player.flowers],
    ...(r.via==='discard'?{winningTile:r.winningTileId}:{}),
    ...(seatWindType===undefined?{}:{seatWindType}),
    prevailingWindType,dealerStreak,streakEvidence};
}
export function scoreRulesState(profile,state,context){
  return scoreWinningHand(profile,evidenceFromSettledRulesState(state,context));
}
export function settleRulesState(profile,state,context){
  return settleWinningHand(profile,evidenceFromSettledRulesState(state,context));
}
