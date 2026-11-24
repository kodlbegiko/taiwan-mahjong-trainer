/**
 * Versioned, configurable, EXPERIMENTAL Taiwanese 16-tile four-seat engine.
 * Preserves V1 GameState/PlayerView/LegalAction/TurnEvent fields and the original
 * draw/discard sandbox. Explicit table policy is NOT an officially verified rule.
 *
 * A fixed seed is the only random input. This file never inspects UI or Strategy.
 */
import {SCHEMA_VERSION, CONTRACT_VERSION} from './tile-constants.js';
import {createDeck, shuffleDeck, parsePhysicalTileId, makeTileIdentity, typeOf, RNG_ALGORITHM_VERSION} from './tile-identity.js';
import {getRuleProfile} from './profiles.js';
import {calculateShanten} from '../core/efficiency.js';
import {settleWin, scoreWinningHand} from './scoring.js';

export const COMPLETE_ENGINE_VERSION='rules-engine/0.2.0-experimental';
// R7 public projection contract; raw V1 ledger and legacy action IDs stay pinned.
const R7_PUBLIC_EVENT_CONTRACT='tw16-rob-added-kong-public/1.0.0';

/** Explicit failure rather than a guessed fallback for an unsupported house rule. */
export class RuleCapabilityError extends RangeError {
  constructor(capability) {
    super('Unsupported rule capability: '+capability);
    this.name='RuleCapabilityError';
    this.code='UNSUPPORTED_RULE_CAPABILITY';
    this.capability=capability;
  }
}
const V1={schemaVersion:SCHEMA_VERSION,contractVersion:CONTRACT_VERSION};
const clone=x=>JSON.parse(JSON.stringify(x));
const seatOK=s=>Number.isInteger(s)&&s>=0&&s<=3;
const assertSeat=s=>{if(!seatOK(s))throw new RangeError('Invalid seat');};
const isFlower=id=>parsePhysicalTileId(id).kind==='flower';
const same=(a,b)=>{
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a))return a.length===b.length&&a.every((v,i)=>same(v,b[i]));
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));
};
function profileFor(ref){
  const p=getRuleProfile(ref?.profileId,ref?.ruleVersion);
  const interception=p.profileId==='tw16-single-winner-interception';
  const robbery=p.profileId==='tw16-rob-added-kong';
  if(!['tw16-configurable-table','tw16-single-winner-interception','tw16-rob-added-kong'].includes(p.profileId)
    ||p.ruleVersion!==(interception||robbery?'experimental-v1':'experimental-full-v1')
    ||p.status!=='experimental'||p.scope!=='four-player'
    ||p.turnPolicy.claimPriority!=='configured'
    ||p.turnPolicy.replacementDraw!=='configured'
    ||p.winningPolicy.mode!=='configured'||p.scoringPolicy.mode!=='configured'
    ||!p.extensions?.tw16)throw new RangeError('Unsupported experimental complete table profile');
  const c=p.extensions.tw16;
  // Refuse unsupported or contradictory policy variants rather than silently
  // behaving as if they had passed Goldens for another table.
  if(!Array.isArray(c.claimOrder)||c.claimOrder.join(',')!=='win,kong,pong,chi'||
    c.singleWinner!==true||c.chiFromPreviousSeatOnly!==true||
    c.robAddedKong!==robbery||c.passWinLock!=='until-own-discard'||
    c.replacementFromTail!==true||!Number.isInteger(c.reserveTail)||
    c.reserveTail<0||c.reserveTail>32||
    !Array.isArray(c.specialHands)||c.specialHands.length>0||
    c.dealerRetentionOnDraw!==true||
    c.startingPrevailingWind!=='east'||c.windAdvancePolicy!=='explicit'||
    c.multipleDiscardWins!==(interception?'single-winner':'unsupported')||
    (interception&&(c.winPriority!=='nearest-clockwise-from-discarder'||
      c.claimPriority!=='win > open-kong > pong > chi'||
      c.settlementPolicy!=='single-discard-winner'||
      c.scoringPolicy!=='tw16-minimal-tai-v1'||
      c.verificationStatus!=='experimental'))||
    (robbery&&(c.housePolicyVersion!=='tw16-rob-added-kong/1.0.0'||
      c.robAddedKongSettlement!=='existing-minimal-discard-liability'||
      c.robAddedKongPriority!=='win-only-legacy-multiwinner-fail-closed'||
      c.verificationStatus!=='experimental')))
    throw new RangeError('Unsupported or contradictory experimental table policy');
  return p;
}
const policyOf=state=>profileFor(state.ruleRef).extensions.tw16;
const ext=state=>state.extensions.tw16;
const afterSeat=s=>(s+1)%4;

/**
 * R4 capability negotiation is STATIC by RuleProfile, not live claim intents.
 * Safe to pass to a Bot or UI without exposing which seats declared WIN.
 * No new table rule is implicitly enabled by this metadata.
 */
export function completeGetRuleCapabilities(ruleRef) {
  const profile=profileFor(ruleRef);
  const interception=profile.extensions.tw16.multipleDiscardWins==='single-winner';
  return {
    ...V1,ruleRef:{profileId:profile.profileId,ruleVersion:profile.ruleVersion},
    status:'experimental',
    ...(profile.extensions.tw16.robAddedKong?{
      publicEventContractVersion:R7_PUBLIC_EVENT_CONTRACT,
      replacementTailExhaustion:{status:'unsupported',capability:'replacement_tail_exhausted'},
    }:{}),
    claimArbitration:{
      responders:3,
      supportedActions:['pass','chi','pong','kong','win'],
      priority:['win','kong','pong','chi'],
      singleDiscardWin:'experimental-supported',
      multipleDiscardWins:interception
        ?{status:'experimental-supported',mode:'single-winner',
          priority:'nearest-clockwise-from-discarder'}
        :{status:'unsupported',capability:'multiple_winners'},
      singleWinner:interception,
      winPriority:interception?'nearest-clockwise-from-discarder':null,
      settlementPolicy:interception?'single-discard-winner':null,
      multipleWinnerSettlement:{status:'unsupported',capability:'multiple_winner_settlement'},
      robAddedKong:profile.extensions.tw16.robAddedKong
        ?{status:'experimental-supported',mode:'win-only',
          multiWinner:'unsupported',scoring:'existing-minimal-discard-liability'}
        :{status:'unsupported',capability:'rob_added_kong'},
      unsupportedDisposition:'fail-closed-without-settlement',
    },
    scoring:{status:'experimental',policy:'tw16-minimal-tai-v1'},
  };
}

/**
 * Rules-host scheduling API. Never pass GameState or this function to a Bot.
 * Responders are stable clockwise; intents and action identities stay private.
 */
export function completeListPendingClaimResponders(state) {
  profileFor(state?.ruleRef);
  const w=state.round.phase==='claim_window'?ext(state).window:null;
  if(!w)return [];
  return [1,2,3].map(offset=>(w.fromSeat+offset)%4)
    .filter(seat=>!w.decisions.some(d=>d.seat===seat));
}

/** Public summary contains no submitted seat, PASS, tile choice or win intent. */
export function completeGetClaimWindowPublic(state) {
  profileFor(state?.ruleRef);
  if(state.round.phase!=='claim_window')return null;
  const w=ext(state).window;
  if(!w)throw new RangeError('Invalid declaration window');
  return {...V1,discardEventId:w.discardEventId,fromSeat:w.fromSeat,
    ...(w.kind==='rob-added-kong'
      ?{sourceKind:'rob-added-kong',sourceEventId:w.sourceEventId}:{ }),
    responders:[1,2,3].map(offset=>(w.fromSeat+offset)%4),
    pendingCount:completeListPendingClaimResponders(state).length,
    claimPolicyVersion:policyOf(state).housePolicyVersion,
    status:'open',expectedRevision:state.revision};
}
const remove=(arr,id)=>{const i=arr.indexOf(id);if(i<0)throw new RangeError('Not owned PhysicalTileId: '+id);arr.splice(i,1);};
const sortIds=ids=>[...ids].sort((a,b)=>a.localeCompare(b));
function event(state,type,visibility,seat,payload,causedByActionId){
  const seq=state.events.length+1;
  const e={...V1,eventId:'evt:'+state.gameId+':'+seq,gameId:state.gameId,
    seq,ruleRef:clone(state.ruleRef),...(seat===undefined?{}:{actorSeat:seat}),
    type,visibility,payload:clone(payload),
    ...(causedByActionId===undefined?{}:{causedByActionId}),
    ...(seq>1?{previousEventId:state.events.at(-1).eventId}:{})};
  state.events.push(e);state.revision=seq;
  if(visibility==='public')state.round.lastPublicEventSeq=seq;
  return e;
}
function action(state,seat,kind,tileIds=[],reason='TABLE_ACTION',claimEventId){
  const ids=sortIds(tileIds);
  const actionId=['act',state.gameId,state.revision,seat,kind,reason,
    ...(claimEventId?[claimEventId]:[]),...ids].join(':');
  return {...V1,actionId,kind,actorSeat:seat,expectedRevision:state.revision,
    tileIds:ids,...(claimEventId?{claimEventId}:{}),
    ruleRef:clone(state.ruleRef),
    legalityBasis:{engineVersion:COMPLETE_ENGINE_VERSION,reasonCodes:[reason]}};
}
function combos(ids,n){
  if(n===0)return [[]];
  if(ids.length<n)return [];
  if(n===1)return ids.map(v=>[v]);
  return ids.flatMap((v,i)=>combos(ids.slice(i+1),n-1).map(r=>[v,...r]));
}
const byType=(ids,t)=>ids.filter(id=>!isFlower(id)&&typeOf(id)===t);
function standardHand(player){return player.concealed.filter(id=>!isFlower(id)).map(typeOf);}
function winning(player,tileId){
  const hand=standardHand(player);
  if(tileId!==undefined)hand.push(typeOf(tileId));
  return hand.length===17-3*player.melds.length &&
    calculateShanten(hand,{fixedMelds:player.melds.length})===-1;
}
function flowerQueue(state){
  // Explicit fixed seat order for this experimental profile.
  return [0,1,2,3].map(i=>(state.round.dealerSeat+i)%4)
    .find(seat=>state.players[seat].concealed.some(isFlower));
}
function endInitialFlowers(state){
  const pending=flowerQueue(state);
  if(pending!==undefined){state.round.currentSeat=pending;state.round.phase='replacement';return;}
  ext(state).initialFlowers=false;
  state.round.currentSeat=state.round.dealerSeat;state.round.phase='await_discard';
  ext(state).lastDraw={seat:state.round.dealerSeat,
    tileId:state.players[state.round.dealerSeat].concealed.at(-1),source:'deal'};
}
function endSupplement(state,seat,drawnId){
  ext(state).pendingReplacement=false;
  if(isFlower(drawnId)){state.round.phase='replacement';}
  else{state.round.phase='await_discard';ext(state).lastDraw={seat,tileId:drawnId,source:'replacement'};}
}
function exhaustIfNeeded(state,triggerActionId){
  if(state.wall.length>policyOf(state).reserveTail)return false;
  ext(state).window=null;state.round.phase='settled';
  state.round.scores=[0,0,0,0];
  ext(state).result={reason:'exhaustive-draw',winnerSeat:null,delta:[0,0,0,0],tai:0};
  event(state,'settle','public',undefined,
    {reason:'exhaustive-draw',delta:[0,0,0,0]},triggerActionId);
  return true;
}
export function completeCreateGame({
  gameId='game-complete-1',seed,profileId='tw16-configurable-table',
  ruleVersion='experimental-full-v1',dealerSeat=0,fixtureDeck=null,
  handIndex=0,previousRoundRef=null,prevailingWind=null,
}={}){
  if(typeof gameId!=='string'||!/^[A-Za-z0-9_-]+$/.test(gameId))throw new TypeError('Invalid gameId');
  assertSeat(dealerSeat);
  if(!Number.isInteger(handIndex)||handIndex<0)throw new RangeError('Invalid handIndex');
  if(previousRoundRef!==null&&
    (typeof previousRoundRef.gameId!=='string'||!Number.isInteger(previousRoundRef.revision)||
    typeof previousRoundRef.roundId!=='string'))throw new RangeError('Invalid previousRoundRef');
  const profile=profileFor({profileId,ruleVersion});
  const roundWind=prevailingWind??profile.extensions.tw16.startingPrevailingWind;
  if(!['east','south','west','north'].includes(roundWind))
    throw new RangeError('Invalid prevailing wind');
  const shuffled=shuffleDeck(createDeck(profile),seed),rng=shuffled.rng;
  if(fixtureDeck!==null){
    const inventory=new Set(createDeck(profile));
    if(!Array.isArray(fixtureDeck)||fixtureDeck.length!==inventory.size||
      new Set(fixtureDeck).size!==inventory.size||
      fixtureDeck.some(id=>!inventory.has(id)))
      throw new RangeError('Invalid private scripted physical deck fixture');
  }
  const tiles=fixtureDeck===null?shuffled.tiles:[...fixtureDeck];
  const players=Array.from({length:4},(_,seat)=>({
    seat,concealed:[],melds:[],river:[],flowers:[],
  }));
  let index=0;
  for(let seat=0;seat<4;seat++)players[seat].concealed=tiles.slice(index,index+=16);
  players[dealerSeat].concealed.push(tiles[index++]);
  const state={...V1,gameId,ruleRef:{profileId,ruleVersion},
    round:{...V1,roundId:gameId+'-round-'+handIndex,handIndex,dealerSeat,
      currentSeat:dealerSeat,phase:'await_discard',lastPublicEventSeq:0,
      prevailingWind:roundWind},
    players,wall:tiles.slice(index),events:[],rng,revision:0,
    extensions:{tw16:{initialFlowers:true,pendingReplacement:false,
      window:null,afterClaim:null,passLocks:[false,false,false,false],
      lastDraw:null,result:null,previousRoundRef:clone(previousRoundRef)}}},
    counts=players.map(p=>p.concealed.length);
  event(state,'deal','system-private',undefined,{dealerSeat,countsBySeat:counts,
    ...(fixtureDeck===null?{}:{fixtureDeck:clone(tiles)}),
    ...(previousRoundRef===null?{}:{previousRoundRef:clone(previousRoundRef)})});
  endInitialFlowers(state);
  completeValidateGameState(state,{replay:false});
  return state;
}
function claimActions(state,seat){
  const win=ext(state).window;
  if(!win||seat===win.fromSeat||win.decisions.some(d=>d.seat===seat))return [];
  const player=state.players[seat],t=typeOf(win.tileId),ids=byType(player.concealed,t);
  const sourceId=win.sourceEventId??win.discardEventId;
  const actions=[action(state,seat,'pass',[],'CLAIM_WINDOW_PASS',sourceId)];
  if(!ext(state).passLocks[seat]&&winning(player,win.tileId))
    actions.push(action(state,seat,'win',[win.tileId],
      win.kind==='rob-added-kong'?'ROB_ADDED_KONG_WIN':'DISCARD_WIN',sourceId));
  // A proposed added kong is not a discarded tile: no chi/pong/open-kong.
  if(win.kind==='rob-added-kong')return actions;
  for(const pair of combos(ids,2)){
    actions.push(action(state,seat,'pong',[...pair,win.tileId],'OPEN_PONG',win.discardEventId));
  }
  if(state.wall.length>0){
    for(const triple of combos(ids,3))
      actions.push(action(state,seat,'kong',[...triple,win.tileId],'OPEN_KONG',win.discardEventId));
  }
  if(seat===afterSeat(win.fromSeat)&&t<27){
    const suit=Math.floor(t/9)*9;
    for(let first=Math.max(suit,t-2);first<=Math.min(t,suit+6);first++){
      const needed=[first,first+1,first+2].filter(n=>n!==t);
      for(const a of byType(player.concealed,needed[0]))
        for(const b of byType(player.concealed,needed[1]))
          actions.push(action(state,seat,'chi',[a,b,win.tileId],'NEXT_SEAT_CHI',win.discardEventId));
    }
  }
  return actions;
}
export function completeListLegalActions(state,seat){
  assertSeat(seat);
  const p=profileFor(state.ruleRef),phase=state.round.phase;
  if(phase==='settled')return [];
  if(phase==='claim_window')return claimActions(state,seat);
  if(seat!==state.round.currentSeat)return [];
  const player=state.players[seat];
  if(phase==='replacement'){
    // No policy has been certified for a mandatory replacement with no tile.
    // R7 must not advertise an action that cannot complete. Legacy stays pinned.
    if(p.extensions.tw16.robAddedKong&&!state.wall.length)return [];
    const flowers=player.concealed.filter(isFlower);
    if(flowers.length)return flowers.map(id=>
      action(state,seat,'replace_flower',[id],'PUBLIC_FLOWER_REPLACEMENT'));
    if(ext(state).pendingReplacement&&state.wall.length)
      return [action(state,seat,'draw',[],'TAIL_KONG_REPLACEMENT')];
    return [];
  }
  if(phase==='await_draw'){
    return state.wall.length>p.extensions.tw16.reserveTail
      ?[action(state,seat,'draw',[],'LIVE_WALL_DRAW')]:[];
  }
  if(phase!=='await_discard')return [];
  const locked=ext(state).afterClaim;
  const actions=player.concealed.filter(id=>!isFlower(id)&&
    (locked?.seat!==seat||typeOf(id)!==locked.forbiddenDiscardType)).map(id=>
    action(state,seat,'discard',[id],'OWN_DISCARD'));
  if(winning(player)&&!ext(state).passLocks[seat]&&ext(state).lastDraw?.seat===seat){
    actions.push(action(state,seat,'win',[],'SELF_DRAW_WIN'));
  }
  if(state.wall.length&&ext(state).afterClaim?.seat!==seat){
    for(let t=0;t<34;t++){
      for(const handIds of combos(byType(player.concealed,t),4)){
        actions.push(action(state,seat,'kong',handIds,'CONCEALED_KONG'));
      }
    }
    for(const meld of player.melds){
      if(meld.kind!=='triplet'||!meld.open)continue;
      const t=typeOf(meld.tileIds[0]);
      for(const id of byType(player.concealed,t))
        actions.push(action(state,seat,'kong',[id],'ADDED_KONG'));
    }
  }
  return actions;
}
function registerWin(state,winnerSeat,sourceSeat,via,tileId,actionId,claimResolution=null,robAddedKong=null){
  const player=state.players[winnerSeat];
  const scoring=scoreWinningHand(profileFor(state.ruleRef),player,{winnerSeat,sourceSeat,via,
    dealerSeat:state.round.dealerSeat});
  const settlement=settleWin(profileFor(state.ruleRef),scoring,{winnerSeat,sourceSeat,via,
    dealerSeat:state.round.dealerSeat});
  state.round.phase='settled';state.round.currentSeat=winnerSeat;
  state.round.scores=settlement.delta;
  ext(state).window=null;
  ext(state).result={reason:'win',winnerSeat,sourceSeat,via,
    winningTileId:tileId||null,tai:scoring.tai,breakdown:scoring.breakdown,
    delta:settlement.delta,
    ...(claimResolution?{claimResolution:clone(claimResolution)}:{}),
    ...(robAddedKong?{robAddedKong:clone(robAddedKong)}:{})};
  event(state,'win','public',winnerSeat,
    {via,sourceSeat,winnerSeat,
      ...(claimResolution?{claimResolution:clone(claimResolution)}:{}),
      ...(robAddedKong?{robAddedKong:clone(robAddedKong)}:{})},actionId);
  event(state,'settle','public',winnerSeat,
    {reason:'win',winnerSeat,tai:scoring.tai,delta:settlement.delta,
      ...(claimResolution?{claimResolution:clone(claimResolution)}:{}),
      ...(robAddedKong?{robAddedKong:clone(robAddedKong)}:{})},actionId);
}
function resolveClaim(state,triggerActionId){
  const w=ext(state).window;
  if(w.decisions.length!==3)return;
  const priority={...Object.fromEntries(policyOf(state).claimOrder.map((kind,index)=>[kind,index])),pass:9};
  // The legacy profile remains fail-closed. The *new* profile explicitly
  // intercepts multiple legal WIN intents by nearest clockwise claimant.
  const legalWins=w.decisions.filter(d=>d.kind==='win');
  if(legalWins.length>1&&policyOf(state).multipleDiscardWins!=='single-winner')
    throw new RuleCapabilityError('multiple_winners');
  if(w.kind==='rob-added-kong'){
    // Stage the tile with the exposed triplet until all three replies arrive.
    // A win transfers its physical ownership to the visible proposal river;
    // the scorer continues using the existing discard-liability contract.
    const declarer=state.players[w.fromSeat],tileId=w.tileId;
    const meld=declarer.melds.find(m=>m.kind==='triplet'&&m.open&&
      typeOf(m.tileIds[0])===typeOf(tileId));
    if(!meld||!declarer.concealed.includes(tileId))
      throw new RangeError('Added-kong proposal ownership mismatch');
    const clockwise=(a,b)=>((a.seat-w.fromSeat+4)%4)-((b.seat-w.fromSeat+4)%4);
    const winner=legalWins.sort(clockwise)[0];
    ext(state).window=null;
    remove(declarer.concealed,tileId);
    if(winner){
      declarer.river.push({tileId,seq:w.discardSeq});
      registerWin(state,winner.seat,w.fromSeat,'discard',tileId,triggerActionId,
        null,{proposalEventId:w.sourceEventId,fromSeat:w.fromSeat,tileId});
    }else{
      meld.kind='kong';meld.tileIds=sortIds([...meld.tileIds,tileId]);
      state.round.currentSeat=w.fromSeat;state.round.phase='replacement';
      ext(state).pendingReplacement=true;ext(state).lastDraw=null;
      event(state,'kong','public',w.fromSeat,
        {kind:'ADDED_KONG',tileIds:[tileId],proposalEventId:w.sourceEventId},
        triggerActionId);
    }
    return;
  }
  const choices=w.decisions.filter(d=>d.kind!=='pass').sort((a,b)=>
    priority[a.kind]-priority[b.kind]||
    ((a.seat-w.fromSeat+4)%4)-((b.seat-w.fromSeat+4)%4));
  ext(state).window=null;
  if(!choices.length){
    state.round.currentSeat=afterSeat(w.fromSeat);
    if(!exhaustIfNeeded(state,triggerActionId))state.round.phase='await_draw';
    return;
  }
  const winner=choices[0],p=state.players[winner.seat],discarder=state.players[w.fromSeat];
  if(winner.kind==='win'){
    // This disclosure is emitted only after all three private responses.
    // Keep each original private WIN intent immutable; do not rewrite to PASS.
    const claimResolution=policyOf(state).multipleDiscardWins==='single-winner'
      ?{schemaVersion:1,
        policyVersion:policyOf(state).housePolicyVersion,
        winPriority:'nearest-clockwise-from-discarder',
        discardEventId:w.discardEventId,
        fromSeat:w.fromSeat,selectedSeat:winner.seat,
        selectedClaimActionId:winner.actionId,
        declaredWinSeats:legalWins.map(d=>d.seat).sort((a,b)=>
          ((a-w.fromSeat+4)%4)-((b-w.fromSeat+4)%4)),
        interceptedWinSeats:legalWins.filter(d=>d.seat!==winner.seat)
          .map(d=>d.seat).sort((a,b)=>
            ((a-w.fromSeat+4)%4)-((b-w.fromSeat+4)%4))}
      :null;
    registerWin(state,winner.seat,w.fromSeat,'discard',w.tileId,
      triggerActionId,claimResolution);
    return;
  }
  const target=discarder.river.find(d=>d.seq===w.discardSeq&&d.tileId===w.tileId);
  if(!target||target.claimedByEventId)throw new RangeError('Discard not claimable');
  for(const id of winner.tileIds.filter(id=>id!==w.tileId))remove(p.concealed,id);
  const kind=winner.kind==='chi'?'sequence':winner.kind==='pong'?'triplet':'kong';
  const resolved=event(state,kind==='kong'?'kong':'claim','public',winner.seat,
    {kind:winner.kind,sourceSeat:w.fromSeat,claimEventId:w.discardEventId,
      tileIds:sortIds(winner.tileIds)},triggerActionId);
  target.claimedByEventId=resolved.eventId;
  p.melds.push({kind,open:true,tileIds:sortIds(winner.tileIds),
    sourceSeat:w.fromSeat,sourceEventId:w.discardEventId});
  state.round.currentSeat=winner.seat;
  state.round.phase=winner.kind==='kong'?'replacement':'await_discard';
  ext(state).pendingReplacement=winner.kind==='kong';
  ext(state).lastDraw=null;
  ext(state).afterClaim=winner.kind==='kong'?null:{seat:winner.seat,kind:winner.kind,
    forbiddenDiscardType:typeOf(w.tileId)};
}
export function completeApplyAction(state,submission){
  completeValidateGameState(state,{replay:false});
  const {actorSeat,actionId,expectedRevision}=submission||{};
  assertSeat(actorSeat);
  if(!Number.isInteger(expectedRevision)||expectedRevision!==state.revision)
    throw new RangeError('Stale expectedRevision');
  if(typeof actionId!=='string')throw new TypeError('actionId required');
  if(policyOf(state).robAddedKong&&state.round.phase==='replacement'&&
    state.round.currentSeat===actorSeat&&!state.wall.length)
    throw new RuleCapabilityError('replacement_tail_exhausted');
  const valid=completeListLegalActions(state,actorSeat);
  const action=valid.find(a=>a.actionId===actionId);
  if(!action)throw new RangeError('Unavailable or illegal actionId');
  if(submission.tileIds!==undefined&&!same(submission.tileIds,action.tileIds))
    throw new RangeError('Forged tileIds');
  const next=clone(state),p=next.players[actorSeat],e=ext(next),before=next.revision;
  const kind=action.kind,reason=action.legalityBasis.reasonCodes[0];
  if(next.round.phase==='claim_window'){
    const w=e.window;
    if(kind!=='win'&&completeListLegalActions(next,actorSeat).some(a=>a.kind==='win'))
      e.passLocks[actorSeat]=true;
    w.decisions.push({seat:actorSeat,kind,actionId:action.actionId,tileIds:action.tileIds});
    // PASS and claims are equally private until the last responder resolves
    // the window. A public PASS would reveal a participant's hidden intent.
    event(next,kind==='pass'?'pass':'claim',
      'seat-private',actorSeat,
      {kind,claimEventId:w.sourceEventId??w.discardEventId,
        ...(kind==='pass'?{}:{tileIds:action.tileIds})},actionId);
    resolveClaim(next,actionId);
  }else if(kind==='discard'){
    const id=action.tileIds[0];remove(p.concealed,id);
    e.passLocks[actorSeat]=false;e.lastDraw=null;e.afterClaim=null;
    const evt=event(next,'discard','public',actorSeat,{tileId:id},actionId);
    p.river.push({tileId:id,seq:evt.seq});
    e.window={discardEventId:evt.eventId,discardSeq:evt.seq,tileId:id,
      fromSeat:actorSeat,decisions:[]};
    next.round.phase='claim_window';next.round.currentSeat=afterSeat(actorSeat);
  }else if(kind==='draw'){
    if(!next.wall.length)throw new RangeError('Wall exhausted');
    const supplement=next.round.phase==='replacement';
    const id=supplement?next.wall.pop():next.wall.shift();
    p.concealed.push(id);
    event(next,'draw','seat-private',actorSeat,{tileId:id,
      source:supplement?'tail':'live'},actionId);
    if(supplement)endSupplement(next,actorSeat,id);
    else if(isFlower(id)){next.round.phase='replacement';}
    else{next.round.phase='await_discard';e.lastDraw={seat:actorSeat,tileId:id,source:'live'};}
  }else if(kind==='replace_flower'){
    const flowerId=action.tileIds[0];remove(p.concealed,flowerId);p.flowers.push(flowerId);
    if(!next.wall.length)throw new RangeError('No tail replacement available');
    const drawId=next.wall.pop();p.concealed.push(drawId);
    event(next,'flower','seat-private',actorSeat,
      {tileId:flowerId,replacementTileId:drawId},actionId);
    if(e.initialFlowers)endInitialFlowers(next);
    else if(isFlower(drawId))next.round.phase='replacement';
    else{next.round.phase='await_discard';e.lastDraw={seat:actorSeat,tileId:drawId,source:'flower'};}
  }else if(kind==='kong'){
    const ids=action.tileIds;
    if(reason==='CONCEALED_KONG'){
      for(const id of ids)remove(p.concealed,id);
      p.melds.push({kind:'kong',open:false,tileIds:ids});
    }else if(reason==='ADDED_KONG'){
      const id=ids[0],t=typeOf(id);
      const meld=p.melds.find(m=>m.kind==='triplet'&&m.open&&typeOf(m.tileIds[0])===t);
      if(!meld)throw new RangeError('Added kong has no exposed triplet');
      if(policyOf(next).robAddedKong){
        const proposal=event(next,'kong_proposed','public',actorSeat,
          {kind:'ADDED_KONG',tileId:id},actionId);
        e.window={kind:'rob-added-kong',sourceEventId:proposal.eventId,
          discardEventId:null,discardSeq:proposal.seq,tileId:id,
          fromSeat:actorSeat,decisions:[]};
        next.round.phase='claim_window';next.round.currentSeat=afterSeat(actorSeat);
      }else{
        remove(p.concealed,id);meld.kind='kong';meld.tileIds=sortIds([...meld.tileIds,id]);
      }
    }else throw new RangeError('Invalid self kong reason');
    if(!e.window){
      event(next,'kong','public',actorSeat,{kind:reason,tileIds:ids},actionId);
      next.round.phase='replacement';e.pendingReplacement=true;e.lastDraw=null;
    }
  }else if(kind==='win'){
    registerWin(next,actorSeat,actorSeat,'self-draw',e.lastDraw?.tileId,actionId);
  }else throw new RangeError('Unsupported action kind');
  completeValidateGameState(next,{replay:false});
  return {state:next,event:clone(next.events[before]),events:clone(next.events.slice(before))};
}
function publicEvent(evt,privateClaimActionIds=null){
  const hiddenClaim=evt.visibility==='seat-private'&&
    (evt.type==='claim'||evt.type==='pass');
  let payload={};
  if(evt.type==='deal')payload={countsBySeat:clone(evt.payload.countsBySeat)};
  else if(evt.type==='draw')payload={count:1};
  else if(evt.type==='discard')payload={tileId:evt.payload.tileId};
  else if(evt.type==='flower')payload={tileId:evt.payload.tileId};
  else if(evt.type==='claim'&&evt.visibility==='public')payload={
    kind:evt.payload.kind,sourceSeat:evt.payload.sourceSeat,
    claimEventId:evt.payload.claimEventId,tileIds:clone(evt.payload.tileIds)};
  else if(evt.type==='kong_proposed')payload={kind:evt.payload.kind,
    tileId:evt.payload.tileId};
  else if(evt.type==='kong')payload={kind:evt.payload.kind,tileIds:clone(evt.payload.tileIds),
    ...(evt.payload.sourceSeat!==undefined?{sourceSeat:evt.payload.sourceSeat}:{}),
    ...(evt.payload.claimEventId?{claimEventId:evt.payload.claimEventId}:{}),
    ...(evt.payload.proposalEventId?{proposalEventId:evt.payload.proposalEventId}:{})};
  else if(evt.type==='win')payload={seat:evt.payload.winnerSeat,
    sourceSeat:evt.payload.sourceSeat,
    ...(evt.payload.claimResolution
      ?{claimResolution:clone(evt.payload.claimResolution)}:{}),
    ...(evt.payload.robAddedKong
      ?{robAddedKong:clone(evt.payload.robAddedKong)}:{})};
  else if(evt.type==='settle'&&evt.payload.robAddedKong)
    payload={robAddedKong:clone(evt.payload.robAddedKong)};
  return {...V1,eventId:evt.eventId,gameId:evt.gameId,seq:evt.seq,
    ruleRef:clone(evt.ruleRef),type:hiddenClaim?'claim':evt.type,visibility:'public',
    ...(hiddenClaim||evt.actorSeat===undefined?{}:{actorSeat:evt.actorSeat}),
    payload,...(evt.previousEventId?{previousEventId:evt.previousEventId}:{}),
    ...(evt.visibility==='public'&&evt.causedByActionId&&
      !privateClaimActionIds?.has(evt.causedByActionId)
      ?{causedByActionId:evt.causedByActionId}:{})};
}
export function completeCreatePlayerView(state,seat,eventSeq=state.revision){
  assertSeat(seat);
  if(!Number.isInteger(eventSeq)||eventSeq<1||eventSeq>state.revision)
    throw new RangeError('Invalid asOfEventSeq');
  const at=eventSeq===state.revision?state:
    completeReplayGame({...state,events:state.events.slice(0,eventSeq)});
  const profile=profileFor(at.ruleRef),toTile=id=>makeTileIdentity(id,profile);
  const publicParts=p=>({seat:p.seat,melds:clone(p.melds),
    river:clone(p.river),flowers:p.flowers.map(toTile)});
  const self={...publicParts(at.players[seat]),concealed:at.players[seat].concealed.map(toTile)};
  const opponents=at.players.filter(p=>p.seat!==seat)
    .map(p=>({...publicParts(p),concealedCount:p.concealed.length}));
  const seen=new Set(),known=new Uint8Array(34);
  const add=id=>{if(isFlower(id)||seen.has(id))return;seen.add(id);known[typeOf(id)]++;};
  at.players[seat].concealed.forEach(add);
  for(const p of at.players){
    for(const m of p.melds)m.tileIds.forEach(add);
    for(const d of p.river)if(!d.claimedByEventId)add(d.tileId);
  }
  if(ext(at).window?.kind==='rob-added-kong')add(ext(at).window.tileId);
  // A derived public event can be triggered by a private final response.
  // Its raw action ID encodes seat, kind and tile IDs. R7 projections omit
  // that private provenance even after resolution; the raw ledger retains it.
  const privateClaimActionIds=profile.extensions.tw16.robAddedKong
    ?new Set(at.events.filter(e=>e.visibility==='seat-private'&&
      (e.type==='claim'||e.type==='pass')).map(e=>e.causedByActionId))
    :null;
  return {...V1,viewId:'view-'+at.gameId+'-'+eventSeq+'-seat'+seat,
    gameId:at.gameId,ruleRef:clone(at.ruleRef),audienceSeat:seat,
    asOfEventSeq:eventSeq,round:clone(at.round),self,opponents,
    publicEvents:at.events.filter(evt=>evt.seq<=eventSeq).map(evt=>publicEvent(evt,privateClaimActionIds)),
    legalActions:completeListLegalActions(at,seat),
    knownUnavailableTypes:[...known.keys()].filter(t=>known[t]===4),
    capabilities:{structuralScore:true,roundActions:false,settlement:false}};
}
export function completeReplayGame(config){
  if(!config||!Array.isArray(config.events)||!config.events.length)
    throw new TypeError('Replay events required');
  const ref=config.ruleRef||{};
  let state=completeCreateGame({
    gameId:config.gameId,seed:config.seed??config.rng?.seed,
    profileId:ref.profileId,ruleVersion:ref.ruleVersion,
    dealerSeat:config.dealerSeat??config.round?.dealerSeat,
    fixtureDeck:config.events[0]?.payload?.fixtureDeck??null,
    handIndex:config.round?.handIndex??0,
    previousRoundRef:config.events[0]?.payload?.previousRoundRef??null,
    prevailingWind:config.round?.prevailingWind??null,
  });
  if(!same(config.events[0],state.events[0]))
    throw new RangeError('Replay mismatch: deal event');
  let index=1;
  while(index<config.events.length){
    const evt=config.events[index];
    if(!seatOK(evt?.actorSeat)||typeof evt.causedByActionId!=='string')
      throw new RangeError('Replay event actor/action invalid');
    const applied=completeApplyAction(state,{
      actorSeat:evt.actorSeat,actionId:evt.causedByActionId,
      expectedRevision:state.revision,
    });
    const group=applied.state.events.slice(index);
    if(!group.length||index+group.length>config.events.length)
      throw new RangeError('Replay truncated atomic transition');
    for(let j=0;j<group.length;j++){
      if(!same(group[j],config.events[index+j]))
        throw new RangeError('Replay event mismatch at seq '+(index+j+1));
    }
    index+=group.length;state=applied.state;
  }
  return state;
}
/**
 * R7-only structural ledger check, including replay:false at the authoritative
 * applyAction boundary. Full replay still proves action legality and ownership.
 * No new raw fields and no changes to R3/R5 event sequences.
 */
function validateRobberyLedger(state){
  const events=state.events,e=ext(state),linked=new Set();
  const fail=()=>{throw new RangeError('Invalid R7 added-kong proposal ledger');};
  let pending=null;
  for(let i=0;i<events.length;i++){
    const proposal=events[i];
    if(proposal.type!=='kong_proposed')continue;
    const from=proposal.actorSeat,id=proposal.payload?.tileId,ref=proposal.eventId;
    if(!seatOK(from)||proposal.visibility!=='public'||typeof id!=='string'||
      isFlower(id)||!same(proposal.payload,{kind:'ADDED_KONG',tileId:id})||
      proposal.causedByActionId!==action({...state,revision:proposal.seq-1},
        from,'kong',[id],'ADDED_KONG').actionId)fail();
    let j=i+1;
    const decisions=[];
    while(j<events.length&&events[j].visibility==='seat-private'&&
      ['claim','pass'].includes(events[j].type)){
      const reply=events[j],seat=reply.actorSeat,kind=reply.payload?.kind;
      const tileIds=kind==='win'?[id]:[];
      if(decisions.length>=3||!seatOK(seat)||seat===from||
        decisions.some(d=>d.seat===seat)||!['win','pass'].includes(kind)||
        reply.type!==(kind==='win'?'claim':'pass')||
        !same(reply.payload,{kind,claimEventId:ref,...(kind==='win'?{tileIds}:{})})||
        reply.causedByActionId!==action({...state,revision:reply.seq-1},seat,kind,tileIds,
          kind==='win'?'ROB_ADDED_KONG_WIN':'CLAIM_WINDOW_PASS',ref).actionId)fail();
      decisions.push({seat,kind,actionId:reply.causedByActionId,tileIds});
      j++;
    }
    if(decisions.length<3){
      if(j!==events.length||pending||state.round.phase!=='claim_window'||
        e.window?.kind!=='rob-added-kong'||e.window.sourceEventId!==ref||
        e.window.fromSeat!==from||e.window.tileId!==id||
        !same(e.window.decisions,decisions))fail();
      pending=ref;
      continue;
    }
    const wins=decisions.filter(d=>d.kind==='win');
    const trigger=decisions.at(-1).actionId,finish=events[j];
    if(wins.length>1||!finish||finish.visibility!=='public'||
      finish.causedByActionId!==trigger)fail();
    if(!wins.length){
      if(finish.type!=='kong'||finish.actorSeat!==from||
        !same(finish.payload,{kind:'ADDED_KONG',tileIds:[id],proposalEventId:ref}))fail();
      linked.add(finish.eventId);
    }else{
      const winner=wins[0].seat,settle=events[j+1],marker={proposalEventId:ref,fromSeat:from,tileId:id};
      if(finish.type!=='win'||finish.actorSeat!==winner||
        !same(finish.payload,{via:'discard',sourceSeat:from,winnerSeat:winner,robAddedKong:marker})||
        !settle||settle!==events.at(-1)||settle.type!=='settle'||settle.visibility!=='public'||
        settle.actorSeat!==winner||settle.causedByActionId!==trigger||
        settle.payload?.reason!=='win'||settle.payload.winnerSeat!==winner||
        !same(settle.payload.robAddedKong,marker)||
        !same(e.result?.robAddedKong,marker)||e.result.winningTileId!==id||
        e.result.winnerSeat!==winner||e.result.sourceSeat!==from)fail();
      linked.add(finish.eventId);linked.add(settle.eventId);
    }
  }
  if((e.window?.kind==='rob-added-kong'&&!pending)||
    events.some(evt=>(evt.payload?.proposalEventId||evt.payload?.robAddedKong)&&
      !linked.has(evt.eventId)))fail();
}
export function completeValidateGameState(state,{replay=true}={}){
  if(!state||state.schemaVersion!==1||state.contractVersion!==CONTRACT_VERSION||
    !Array.isArray(state.players)||state.players.length!==4||!Array.isArray(state.wall)||
    !Array.isArray(state.events)||!state.events.length||state.revision!==state.events.length||
    !state.round||!state.rng||!state.extensions?.tw16)
    throw new RangeError('Invalid complete GameState schema');
  const profile=profileFor(state.ruleRef),e=ext(state);
  if(!Number.isInteger(state.round.handIndex)||state.round.handIndex<0||
    state.round.roundId!==state.gameId+'-round-'+state.round.handIndex||state.round.schemaVersion!==1||
    state.round.contractVersion!==CONTRACT_VERSION||
    !['east','south','west','north'].includes(state.round.prevailingWind)||
    !['await_draw','await_discard','claim_window','replacement','settled'].includes(state.round.phase))
    throw new RangeError('Invalid complete RoundState');
  assertSeat(state.round.currentSeat);assertSeat(state.round.dealerSeat);
  if(!Array.isArray(e.passLocks)||e.passLocks.length!==4||e.passLocks.some(v=>typeof v!=='boolean'))
    throw new RangeError('Invalid pass locks');
  if(state.rng.algorithmVersion!==RNG_ALGORITHM_VERSION||
    state.rng.counter!==createDeck(profile).length-1||typeof state.rng.seed!=='string')
    throw new RangeError('RNG metadata mismatch');
  const fullDeck=new Set(createDeck(profile)),seen=new Set(),claimed=new Map(),claimedRivers=[];
  const put=id=>{parsePhysicalTileId(id);if(!fullDeck.has(id)||seen.has(id))
    throw new RangeError('Physical tile duplication, unknown id or loss: '+id);seen.add(id);};
  state.wall.forEach(put);
  for(let seat=0;seat<4;seat++){
    const p=state.players[seat];
    if(!p||p.seat!==seat||!Array.isArray(p.concealed)||
      !Array.isArray(p.melds)||!Array.isArray(p.river)||!Array.isArray(p.flowers))
      throw new RangeError('Invalid player state');
    p.concealed.forEach(put);
    p.flowers.forEach(id=>{if(!isFlower(id))throw new RangeError('Nonflower in flower zone');put(id);});
    for(const m of p.melds){
      if(!['sequence','triplet','kong'].includes(m.kind)||
        !Array.isArray(m.tileIds)||m.tileIds.length!==(m.kind==='kong'?4:3)||
        typeof m.open!=='boolean')throw new RangeError('Invalid Meld');
      const kinds=m.tileIds.map(typeOf).sort((a,b)=>a-b);
      if(m.kind==='sequence'){
        if(kinds[0]>=27||Math.floor(kinds[0]/9)!==Math.floor(kinds[2]/9)||
          kinds[1]!==kinds[0]+1||kinds[2]!==kinds[1]+1)
          throw new RangeError('Illegal sequence');
      }else if(!kinds.every(t=>t===kinds[0]))throw new RangeError('Illegal triplet/kong');
      m.tileIds.forEach(put);
      if(m.sourceEventId){
        if(!m.open||!seatOK(m.sourceSeat))throw new RangeError('Invalid claimed meld source');
        const evt=state.events.find(x=>x.eventId===m.sourceEventId);
        if(evt?.type!=='discard'||evt.actorSeat!==m.sourceSeat||
          !m.tileIds.includes(evt.payload.tileId))
          throw new RangeError('Forged claimed meld source');
        claimed.set(evt.payload.tileId,(claimed.get(evt.payload.tileId)||0)+1);
      }
    }
    for(const d of p.river){
      if(!Number.isInteger(d.seq)||d.seq<2||d.seq>state.revision||
        !(['discard'].includes(state.events[d.seq-1]?.type)||
          (state.events[d.seq-1]?.type==='kong_proposed'&&
            e.result?.robAddedKong?.proposalEventId===state.events[d.seq-1].eventId&&
            e.result.robAddedKong.tileId===d.tileId&&
            e.result.robAddedKong.fromSeat===seat))||
        state.events[d.seq-1]?.actorSeat!==seat||
        state.events[d.seq-1]?.payload.tileId!==d.tileId)
        throw new RangeError('Forged river/discard event');
      if(d.claimedByEventId){
        const claimant=state.events.find(x=>x.eventId===d.claimedByEventId);
        if(!claimant||!['claim','kong'].includes(claimant.type)||
          claimant.visibility!=='public'||!claimant.payload.tileIds?.includes(d.tileId))
          throw new RangeError('Forged claimed river link');
        claimedRivers.push(d.tileId);
      }else put(d.tileId);
    }
    const effective=p.concealed.length+3*p.melds.length;
    const phase=state.round.phase;
    let expected=16;
    if(e.initialFlowers&&seat===state.round.dealerSeat)expected=17;
    else if(phase==='await_discard'&&seat===state.round.currentSeat)expected=17;
    else if(phase==='claim_window'&&e.window?.kind==='rob-added-kong'&&
      e.window.fromSeat===seat)expected=17;
    else if(phase==='replacement'&&seat===state.round.currentSeat&&
      !e.pendingReplacement&&!e.initialFlowers)expected=17;
    else if(phase==='settled'&&e.result?.via==='self-draw'&&seat===e.result.winnerSeat)
      expected=17;
    if(effective!==expected)
      throw new RangeError('Invalid player effective tile count for phase: '+seat+' / '+phase);
  }
  for(const id of claimedRivers)if(claimed.get(id)!==1)
    throw new RangeError('Claim has no unique public meld owner');
  if(seen.size!==fullDeck.size)throw new RangeError('Physical tile conservation failed');
  let publicSeq=0;
  for(let i=0;i<state.events.length;i++){
    const evt=state.events[i];
    if(!evt||evt.seq!==i+1||evt.eventId!=='evt:'+state.gameId+':'+(i+1)||
      evt.schemaVersion!==1||evt.contractVersion!==CONTRACT_VERSION||
      evt.gameId!==state.gameId||!same(evt.ruleRef,state.ruleRef)||
      (i===0&&(evt.type!=='deal'||evt.visibility!=='system-private'))||
      (i>0&&evt.previousEventId!==state.events[i-1].eventId))
      throw new RangeError('Invalid complete ledger ordering');
    if(evt.visibility==='public')publicSeq=evt.seq;
  }
  if(publicSeq!==state.round.lastPublicEventSeq)
    throw new RangeError('Invalid public event watermark');
  if(state.round.phase==='settled'){
    const r=e.result;
    if(!r||!['win','exhaustive-draw'].includes(r.reason)||
      !Array.isArray(r.delta)||r.delta.length!==4||
      r.delta.some(n=>typeof n!=='number'||!Number.isFinite(n))||
      r.delta.reduce((sum,n)=>sum+n,0)!==0||
      !same(state.round.scores,r.delta)||
      state.events.at(-1)?.type!=='settle')
      throw new RangeError('Invalid or non-zero-sum settlement');
    if(r.reason==='win'&&(!seatOK(r.winnerSeat)||!seatOK(r.sourceSeat)||
      !['self-draw','discard'].includes(r.via)||
      !state.events.some(x=>x.type==='win')))
      throw new RangeError('Invalid winning settlement');
    if(profile.profileId==='tw16-single-winner-interception' &&
      r.reason==='win'&&r.via==='discard'&&!r.claimResolution)
      throw new RangeError('Missing single-winner claim resolution');
    if(r.claimResolution){
      const cr=r.claimResolution;
      const winEvents=state.events.filter(x=>x.type==='win');
      const settleEvents=state.events.filter(x=>x.type==='settle');
      const source=state.events.find(x=>x.eventId===cr.discardEventId);
      const declared=state.events.filter(x=>
        x.visibility==='seat-private'&&x.type==='claim'&&
        x.payload?.kind==='win'&&x.payload.claimEventId===cr.discardEventId);
      const clockwise=(a,b)=>((a-cr.fromSeat+4)%4)-((b-cr.fromSeat+4)%4);
      const ranked=declared.map(x=>x.actorSeat).sort(clockwise);
      if(profile.profileId!=='tw16-single-winner-interception'||
        r.reason!=='win'||r.via!=='discard'||
        cr.schemaVersion!==1||
        cr.policyVersion!==profile.extensions.tw16.housePolicyVersion||
        cr.winPriority!=='nearest-clockwise-from-discarder'||
        !seatOK(cr.selectedSeat)||cr.selectedSeat!==r.winnerSeat||
        cr.fromSeat!==r.sourceSeat||
        source?.type!=='discard'||source?.actorSeat!==cr.fromSeat||
        !Array.isArray(cr.declaredWinSeats)||!Array.isArray(cr.interceptedWinSeats)||
        ranked.length<1||ranked.length>3||
        new Set(ranked).size!==ranked.length||
        !same(cr.declaredWinSeats,ranked)||
        cr.selectedSeat!==ranked[0]||
        !same(cr.interceptedWinSeats,ranked.slice(1))||
        !declared.some(x=>x.actorSeat===cr.selectedSeat&&
          x.causedByActionId===cr.selectedClaimActionId)||
        winEvents.length!==1||settleEvents.length!==1||
        !same(winEvents[0]?.payload.claimResolution,cr)||
        !same(settleEvents[0]?.payload.claimResolution,cr))
        throw new RangeError('Invalid versioned single-winner settlement');
    }
    if(r.robAddedKong){
      const rob=r.robAddedKong;
      const proposal=state.events.find(x=>x.eventId===rob.proposalEventId);
      const src=state.players[rob.fromSeat];
      if(profile.profileId!=='tw16-rob-added-kong'||
        r.reason!=='win'||r.via!=='discard'||
        !seatOK(rob.fromSeat)||rob.fromSeat!==r.sourceSeat||
        proposal?.type!=='kong_proposed'||proposal?.actorSeat!==rob.fromSeat||
        proposal?.payload.tileId!==rob.tileId||
        !src.river.some(d=>d.tileId===rob.tileId&&d.seq===proposal.seq)||
        !state.events.some(x=>x.type==='win'&&
          same(x.payload.robAddedKong,rob))||
        !same(state.events.at(-1)?.payload.robAddedKong,rob))
        throw new RangeError('Invalid rob-added-kong settlement');
    }
    if(r.reason==='exhaustive-draw'&&(r.winnerSeat!==null||
      r.delta.some(x=>x!==0)))
      throw new RangeError('Invalid exhaustive draw settlement');
  }else if(e.result!==null)throw new RangeError('Settlement before finished hand');
  if(state.round.phase==='claim_window'){
    const w=e.window;
    if(!w||w.decisions.length>2||w.fromSeat===state.round.currentSeat||
      (w.kind==='rob-added-kong'
        ?(profile.profileId!=='tw16-rob-added-kong'||
          state.events[w.discardSeq-1]?.type!=='kong_proposed'||
          w.sourceEventId!==state.events[w.discardSeq-1]?.eventId||
          w.discardEventId!==null||
          !state.players[w.fromSeat].concealed.includes(w.tileId)||
          !state.players[w.fromSeat].melds.some(m=>m.kind==='triplet'&&m.open&&
            typeOf(m.tileIds[0])===typeOf(w.tileId)))
        :state.events[w.discardSeq-1]?.type!=='discard')||
      w.tileId!==state.events[w.discardSeq-1].payload.tileId||
      (w.kind==='rob-added-kong'
        ?w.decisions.some(d=>!['pass','win'].includes(d.kind))
        :w.discardEventId!==state.events[w.discardSeq-1].eventId)||
      w.fromSeat!==state.events[w.discardSeq-1].actorSeat||
      state.round.currentSeat!==afterSeat(w.fromSeat)||
      w.decisions.some(d=>d.seat===w.fromSeat||
        !seatOK(d.seat)||!['pass','win','chi','pong','kong'].includes(d.kind)||
        typeof d.actionId!=='string'||!Array.isArray(d.tileIds))||
      new Set(w.decisions.map(d=>d.seat)).size!==w.decisions.length)
      throw new RangeError('Invalid declaration window');
  }else if(e.window!==null)throw new RangeError('Unexpected declaration window');
  if(profile.extensions.tw16.robAddedKong)validateRobberyLedger(state);
  if(replay&&!same(completeReplayGame(state),state))
    throw new RangeError('Deterministic complete replay mismatch');
  return true;
}


/**
 * Start the NEXT separately replayable hand. This is a round-chain adapter,
 * not an append to the previous hand's immutable TurnEvent ledger.
 * A fresh explicit seed and unique gameId are mandatory.
 */
export function completeStartNextRound(previous,{seed,gameId,prevailingWind}={}){
  completeValidateGameState(previous);
  if(previous.round.phase!=='settled'||!ext(previous).result)
    throw new RangeError('Only a settled hand can advance');
  if(typeof seed!=='string'||!seed||typeof gameId!=='string'||
    !/^[A-Za-z0-9_-]+$/.test(gameId)||gameId===previous.gameId)
    throw new RangeError('Explicit new seed and distinct gameId required');
  const result=ext(previous).result;
  const retain=result.reason==='exhaustive-draw'
    ? policyOf(previous).dealerRetentionOnDraw
    : result.winnerSeat===previous.round.dealerSeat;
  const dealerSeat=retain?previous.round.dealerSeat:afterSeat(previous.round.dealerSeat);
  return completeCreateGame({gameId,seed,profileId:previous.ruleRef.profileId,
    ruleVersion:previous.ruleRef.ruleVersion,dealerSeat,
    prevailingWind:prevailingWind??previous.round.prevailingWind,
    handIndex:previous.round.handIndex+1,
    previousRoundRef:{gameId:previous.gameId,roundId:previous.round.roundId,
      revision:previous.revision}});
}
