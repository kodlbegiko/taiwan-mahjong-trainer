import {scoreWinningHand,ScoringCapabilityError} from './evaluate.js';
import {settleWinningHand} from './settlement.js';

/**
 * Rules-host-only, read-only adapter. The input is an authoritative private
 * Rules snapshot, never a Bot's view or an unverifiable user-side DTO.
 */
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&
  a.length===b.length&&[...a].sort().every((id,i)=>id===[...b].sort()[i]);
const WIND_TYPES={east:27,south:28,west:29,north:30};
export function evidenceFromSettledRulesState(state,{seatWindType,prevailingWindType,
  dealerStreak,streakEvidence,publicEventContractVersion}={}){
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
  // R7 Rules Agent opt-in: the proposal is NOT a discard event.
  // Only the Rules-owned public proposal + private winning declaration +
  // matching terminal win/settle markers authorize one robber, one payer.
  let robAddedKong;
  if(r.robAddedKong!==undefined){
    if(publicEventContractVersion!=='tw16-rob-added-kong-public/1.0.0')
      throw new ScoringCapabilityError('unnegotiated-r7-public-event-contract');
    const marker=r.robAddedKong;
    const equalMarker=x=>x&&typeof x==='object'&&
      Object.keys(x).length===3&&
      x.proposalEventId===marker.proposalEventId&&
      x.fromSeat===marker.fromSeat&&x.tileId===marker.tileId;
    const proposal=events.find(e=>e.eventId===marker.proposalEventId);
    const sourcePlayer=state.players?.[r.sourceSeat];
    const replies=events.filter(e=>
      ['claim','pass'].includes(e.type)&&
      e.payload?.claimEventId===marker.proposalEventId);
    const claimed=replies.filter(e=>e.type==='claim'&&e.payload?.kind==='win');
    const validReplies=replies.length===3&&
      new Set(replies.map(e=>e.actorSeat)).size===3&&
      replies.every(e=>e.visibility==='seat-private'&&
        Number.isInteger(e.actorSeat)&&e.actorSeat>=0&&e.actorSeat<4&&
        e.actorSeat!==r.sourceSeat&&e.seq>proposal?.seq&&e.seq<win[0].seq&&
        (e.type==='claim'
          ? e.payload.kind==='win'&&Array.isArray(e.payload.tileIds)&&
            e.payload.tileIds.length===1&&e.payload.tileIds[0]===marker.tileId
          : e.payload.kind==='pass'&&e.payload.tileIds===undefined));
    const type=id=>/^t:(0|[1-9]|[12][0-9]|3[0-3]):[0-3]$/.exec(id)?.[1];
    if(state.ruleRef?.profileId!=='tw16-rob-added-kong'||
      state.ruleRef?.ruleVersion!=='experimental-v1'||
      r.via!=='discard'||r.winnerSeat===r.sourceSeat||
      !Number.isInteger(r.sourceSeat)||r.sourceSeat<0||r.sourceSeat>3||
      typeof marker?.proposalEventId!=='string'||!marker.proposalEventId||
      !equalMarker(win[0].payload.robAddedKong)||
      !equalMarker(settle[0].payload.robAddedKong)||
      marker.fromSeat!==r.sourceSeat||
      !type(marker.tileId)||marker.tileId!==r.winningTileId||
      proposal?.type!=='kong_proposed'||proposal.visibility!=='public'||
      proposal.actorSeat!==r.sourceSeat||
      proposal.payload?.kind!=='ADDED_KONG'||
      proposal.payload?.tileId!==marker.tileId||
      proposal.seq>=win[0].seq||
      !validReplies||claimed.length!==1||claimed[0].actorSeat!==r.winnerSeat||
      claimed[0].seq<=proposal.seq||claimed[0].seq>=win[0].seq||
      !sourcePlayer?.melds?.some(m=>m.kind==='triplet'&&m.open&&
        type(m.tileIds?.[0])===type(marker.tileId))||
      !sourcePlayer.river?.some(d=>d.tileId===marker.tileId&&
        d.seq===proposal.seq&&!d.claimedByEventId)||
      sourcePlayer.concealed?.includes(marker.tileId)||
      events.some(e=>e.type==='kong'&&e.payload?.proposalEventId===marker.proposalEventId))
      throw new RangeError('Invalid rob-added-kong event provenance or payer');
    robAddedKong={proposalEventId:marker.proposalEventId,
      fromSeat:marker.fromSeat,tileId:marker.tileId};
  }else if(win[0].payload.robAddedKong!==undefined||
    settle[0].payload.robAddedKong!==undefined)
    throw new RangeError('Unpaired rob-added-kong terminal event markers');
  if(r.via==='discard'&&!robAddedKong&&!events.some(e=>e.type==='discard'&&
      e.visibility==='public'&&e.actorSeat===r.sourceSeat&&
      e.payload?.tileId===r.winningTileId&&e.seq<win[0].seq))
    throw new RangeError('Discard-win lacks source event provenance');
  // Supplemental win tai require a private Rules ledger and the exact winning
  // draw event; public PlayerView never exposes replacement tile identities.
  let specialDraw;
  if(r.via==='self-draw'&&typeof r.winningTileId==='string'){
    const last=events.filter(e=>e.seq<win[0].seq&&e.actorSeat===r.winnerSeat&&
      ((e.type==='draw'&&e.visibility==='seat-private'&&
        e.payload?.tileId===r.winningTileId)||
       (e.type==='flower'&&e.visibility==='seat-private'&&
        e.payload?.replacementTileId===r.winningTileId))).at(-1);
    if(last){
      if(events.some(e=>e.seq>last.seq&&e.seq<win[0].seq&&
        e.actorSeat===r.winnerSeat&&
        ['discard','draw','flower','kong'].includes(e.type)))
        throw new RangeError('Winning draw is not the most recent owned tile event');
      if(last.type==='draw'&&last.payload.source==='tail'){
        const lastKong=events.filter(e=>e.type==='kong'&&e.visibility==='public'&&
          e.actorSeat===r.winnerSeat&&e.seq<last.seq).at(-1);
        if(!lastKong)throw new ScoringCapabilityError('unproven-kong-supplement');
        if(!['CONCEALED_KONG','ADDED_KONG'].includes(lastKong.payload?.kind))
          throw new ScoringCapabilityError('open-kong-supplement-win-variant');
        if(events.some(e=>e.seq>lastKong.seq&&e.seq<last.seq&&
          ['draw','discard','flower','kong'].includes(e.type)))
          throw new RangeError('Broken kong replacement event adjacency');
        specialDraw={kind:'kong-bloom',sourceEventId:lastKong.eventId,
          drawEventId:last.eventId};
      }else if(last.type==='flower'){
        if(!events.some(e=>e.type==='discard'&&e.seq<last.seq))
          throw new ScoringCapabilityError('initial-flower-replacement-variant');
        specialDraw={kind:'kong-bloom',sourceEventId:last.eventId,
          drawEventId:last.eventId};
      }else if(last.type==='draw'&&last.payload.source==='live'&&
        Array.isArray(state.wall)&&state.wall.length===16&&
        state.extensions?.tw16?.lastDraw?.source==='live')
        specialDraw={kind:'sea-bottom',sourceEventId:last.eventId,
          drawEventId:last.eventId};
      else if(last.type==='draw'&&!['live','tail'].includes(last.payload.source))
        throw new ScoringCapabilityError('unsupported-winning-draw-source');
    }else if(state.extensions?.tw16?.lastDraw?.seat===r.winnerSeat&&
      state.extensions.tw16.lastDraw.tileId===r.winningTileId&&
      ['replacement','flower','live'].includes(state.extensions.tw16.lastDraw.source))
      throw new RangeError('Winning draw lacks matching private Rules event');
  }
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
    ...(robAddedKong?{robAddedKong}:{}),
    ...(specialDraw?{specialDraw}:{}),
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
