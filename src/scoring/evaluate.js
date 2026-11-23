import {validateScoringProfile,SCORING_CONTRACT} from './profiles.js';

export class ScoringCapabilityError extends RangeError{
  constructor(capability){super('Unsupported scoring capability: '+capability);
    this.name='ScoringCapabilityError';this.code='UNSUPPORTED_SCORING_CAPABILITY';this.capability=capability;}
}
const assert=(ok,message)=>{if(!ok)throw new RangeError('Invalid scoring evidence: '+message);};
const seat=x=>Number.isInteger(x)&&x>=0&&x<4;
const winds=[27,28,29,30];
const flowerNames=['season-spring','season-summer','season-autumn','season-winter',
  'plant-plum','plant-orchid','plant-bamboo','plant-chrysanthemum'];
const typeOf=x=>{
  if(Number.isInteger(x)&&x>=0&&x<34)return x;
  const m=typeof x==='string'&&/^t:(0|[1-9]|[12][0-9]|3[0-3]):[0-3]$/.exec(x);
  assert(Boolean(m),'standard physical tile/type');return Number(m[1]);
};
const flowerOf=x=>{
  const m=typeof x==='string'&&/^f:([a-z]+(?:-[a-z]+)*):0$/.exec(x);
  assert(Boolean(m)&&flowerNames.includes(m[1]),'unique flower physical ID');
  return m[1];
};
const combinations=(hand,meldCount)=>{
  const counts=Array(34).fill(0);hand.forEach(t=>counts[t]++);
  const answers=[];
  function pick(groups,left,pair){
    if(!left){if(counts.every(x=>x===0))answers.push({groups:groups.map(g=>({...g})),pair});return;}
    const t=counts.findIndex(n=>n>0);
    if(t===-1)return;
    if(counts[t]>=3){counts[t]-=3;pick([...groups,{kind:'triplet',type:t}],left-1,pair);counts[t]+=3;}
    if(t<27&&t%9<=6&&counts[t+1]&&counts[t+2]){
      counts[t]--;counts[t+1]--;counts[t+2]--;
      pick([...groups,{kind:'sequence',type:t}],left-1,pair);
      counts[t]++;counts[t+1]++;counts[t+2]++;
    }
  }
  for(let t=0;t<34;t++){
    if(counts[t]<2)continue;
    counts[t]-=2;pick([],meldCount,t);counts[t]+=2;
  }
  return answers;
};
const name={
  concealed:'門清',selfDraw:'自摸',concealedSelfDraw:'門清自摸',roundWind:'圈風',seatWind:'門風',
  dragon:'三元牌',correctFlower:'正花',flowerSet:'花槓',allPongs:'碰碰胡',
  mixedSuit:'混一色',pureSuit:'清一色',allHonors:'字一色',
  smallDragons:'小三元',bigDragons:'大三元',smallWinds:'小四喜',bigWinds:'大四喜',
  concealedTriplets:'暗刻',openKong:'明槓',concealedKong:'暗槓',
};
function validateEvidence(p,e){
  validateScoringProfile(p);
  assert(e&&typeof e==='object'&&!Array.isArray(e),'object');
  assert(e.ruleRef&&p.ruleRefs.some(r=>r.profileId===e.ruleRef.profileId&&
    r.ruleVersion===e.ruleRef.ruleVersion),'compatible RuleProfile pin');
  assert(seat(e.winnerSeat)&&seat(e.sourceSeat)&&seat(e.dealerSeat),'seat');
  assert(['self-draw','discard'].includes(e.via),'win mode');
  assert(e.via==='self-draw'?e.winnerSeat===e.sourceSeat:e.winnerSeat!==e.sourceSeat,'win source');
  if(e.specialWin!==undefined&&e.specialWin!=='ordinary')
    throw new ScoringCapabilityError(e.specialWin);
  if(e.liability!==undefined&&e.liability!==null)
    throw new ScoringCapabilityError('bao-pai-or-special-liability');
  assert(Number.isInteger(e.dealerStreak)&&e.dealerStreak>=0&&e.dealerStreak<=100,
    'explicit dealerStreak count (never inferred from handIndex)');
  if(e.dealerStreak>0)
    assert(e.streakEvidence&&Array.isArray(e.streakEvidence.roundRefs)&&
      e.streakEvidence.roundRefs.length>=e.dealerStreak&&
      e.streakEvidence.roundRefs.every(x=>typeof x==='string'&&x.length>0),
      'auditable prior-round dealer streak references');
  assert(Array.isArray(e.concealed)&&Array.isArray(e.melds)&&e.melds.length<=5,'hand inventory');
  assert(Array.isArray(e.flowers)&&e.flowers.length<=8,'flower inventory');
  const concealed=e.concealed.map(typeOf),melds=e.melds.map(m=>{
    assert(m&&['sequence','triplet','kong'].includes(m.kind)&&typeof m.open==='boolean'&&
      Array.isArray(m.tileIds)&&m.tileIds.length===(m.kind==='kong'?4:3),'meld');
    const tiles=m.tileIds.map(typeOf).sort((a,b)=>a-b);
    if(m.kind==='sequence')assert(tiles[0]<27&&tiles[0]%9<=6&&tiles[1]===tiles[0]+1&&
      tiles[2]===tiles[0]+2,'sequence');
    else assert(tiles.every(t=>t===tiles[0]),'triplet/kong');
    return {kind:m.kind,open:m.open,type:tiles[0],types:tiles};
  });
  const seenPhysical=[...e.concealed,...e.melds.flatMap(m=>m.tileIds)].filter(x=>typeof x==='string');
  assert(new Set(seenPhysical).size===seenPhysical.length,'duplicate physical tile');
  const f=e.flowers.map(flowerOf);
  assert(new Set(f).size===f.length,'duplicate flower');
  const need=17-3*melds.length;
  assert(concealed.length===(e.via==='discard'?need-1:need),'concealed count (16+claimed win or 17)');
  if(e.via==='discard')assert(e.winningTile!==undefined,'claimed winning tile');
  const winningTile=e.via==='discard'?typeOf(e.winningTile):null;
  const whole=[...concealed,...melds.flatMap(m=>m.types),...(winningTile===null?[]:[winningTile])];
  const counts=Array(34).fill(0);whole.forEach(t=>counts[t]++);
  assert(counts.every(c=>c<=4),'more than four standard copies');
  if(typeof e.winningTile==='string'&&seenPhysical.includes(e.winningTile))
    assert(false,'winning tile previously owned');
  if(melds.some(m=>m.type>=27)&&p.variants.wind==='round-and-seat'){
    assert(winds.includes(e.prevailingWindType)&&winds.includes(e.seatWindType),'round/seat wind proofs');
  }
  if(f.length&&p.variants.flower==='correct-and-sets')
    assert(winds.includes(e.seatWindType),'seat wind proof for correct flowers');
  return {concealed,melds,flowers:f,winningTile,whole};
}
export function scoreWinningHand(profile,evidence){
  const {concealed,melds,flowers,winningTile,whole}=validateEvidence(profile,evidence);
  const rules=profile.tai,ver=profile.profileId+'@'+profile.version;
  const source=profile.sourceRefs[0];
  const add=(items,code,key,detail,tai=rules[key])=>{
    if(tai>0)items.push({code,name:name[key]||key,tai,
      evidence:detail,ruleVersion:ver,source,scope:'hand'});
  };
  const allConcealed=melds.every(m=>!m.open);
  const finalConcealed=evidence.via==='self-draw';
  const exposed=!allConcealed;
  const decompositions=combinations([...concealed,...(winningTile===null?[]:[winningTile])],5-melds.length);
  assert(decompositions.length>0,'not canonical five melds and one pair');
  let best=null;
  for(const dec of decompositions){
    const all=[...melds,...dec.groups.map(g=>({...g,open:false}))];
    const roles=evidence.via==='discard'
      ?[...(dec.pair===winningTile?['pair']:[]),
        ...dec.groups.filter(g=>g.type===winningTile||
          (g.kind==='sequence'&&winningTile>=g.type&&winningTile<=g.type+2))
          .map(g=>g.kind==='triplet'?'ron-triplet':'sequence')]
      :['self-draw'];
    assert(roles.length>0,'winning tile has no legal decomposition role');
    for(const role of roles){
      const items=[];
      if(allConcealed&&finalConcealed)add(items,'concealed-self-draw','concealedSelfDraw','no open meld and self-drawn');
      else{
        if(allConcealed)add(items,'concealed','concealed','no open meld');
        if(finalConcealed)add(items,'self-draw','selfDraw','self-draw winning tile');
      }
      const types=[...whole];
      const suits=new Set(types.filter(t=>t<27).map(t=>Math.floor(t/9)));
      const honors=types.some(t=>t>=27);
      if(suits.size===0)add(items,'all-honors','allHonors','all 17 effective tiles honor types');
      else if(suits.size===1){
        if(honors)add(items,'mixed-suit','mixedSuit','one suited family plus honors');
        else add(items,'pure-suit','pureSuit','one suited family without honors');
      }
      if(all.every(g=>g.kind!=='sequence'))
        add(items,'all-pongs','allPongs','five triplets/kongs and one pair');
      const tripletTypes=all.filter(g=>g.kind!=='sequence').map(g=>g.type);
      const dragonCount=tripletTypes.filter(t=>t>=31).length;
      const windCount=tripletTypes.filter(t=>t>=27&&t<=30).length;
      if(dragonCount===3)add(items,'big-dragons','bigDragons','three dragon triplets/kongs');
      else if(dragonCount===2&&dec.pair>=31)add(items,'small-dragons','smallDragons','two dragon triplets and dragon pair');
      else for(const t of tripletTypes.filter(t=>t>=31))
        add(items,'dragon:'+t,'dragon','dragon type '+t);
      if(windCount===4)add(items,'big-winds','bigWinds','four wind triplets/kongs');
      else{
        if(windCount===3&&dec.pair>=27&&dec.pair<=30)
          add(items,'small-winds','smallWinds','three wind triplets and wind pair');
        if(!(windCount===3&&dec.pair>=27&&dec.pair<=30&&!profile.variants.smallWindRetainsWind)){
          for(const t of tripletTypes.filter(t=>t>=27&&t<=30)){
            if(profile.variants.wind==='all')add(items,'wind:'+t,'roundWind','wind triplet type '+t,1);
            else{
              if(t===evidence.prevailingWindType)add(items,'round-wind:'+t,'roundWind','prevailing wind '+t);
              if(t===evidence.seatWindType)add(items,'seat-wind:'+t,'seatWind','seat wind '+t);
            }
          }
        }
      }
      let hiddenPongs=melds.filter(m=>!m.open&&m.kind!=='sequence').length+
        dec.groups.filter(g=>g.kind==='triplet').length;
      if(role==='ron-triplet')hiddenPongs--;
      if(hiddenPongs>=3)add(items,'concealed-triplets:'+hiddenPongs,'concealedTriplets',
        'concealed triplets/kongs '+hiddenPongs,rules.concealedTriplets[hiddenPongs]);
      for(const [i,m] of melds.entries()){
        if(m.kind!=='kong'||profile.variants.kong!=='each')continue;
        add(items,'kong:'+i,m.open?'openKong':'concealedKong','meld index '+i+
          (m.open?' declared open':' declared concealed'));
      }
      if(profile.variants.flower==='each'){
        for(const f of flowers)add(items,'flower:'+f,'correctFlower','flower '+f);
      }else{
        const idx=evidence.seatWindType-27;
        const sets=[flowerNames.slice(0,4),flowerNames.slice(4,8)];
        for(const [s,group] of sets.entries()){
          if(group.every(f=>flowers.includes(f)))
            add(items,'flower-set:'+s,'flowerSet','complete four-flower set '+s);
          if(!group.every(f=>flowers.includes(f))||!profile.variants.flowerSetsReplaceCorrect){
            for(const f of [group[idx]].filter(f=>flowers.includes(f)))
              add(items,'correct-flower:'+f,'correctFlower','seat-matched flower '+f);
          }
        }
      }
      // Flat-hand, wait-shape, special wins and first-turn wins cannot be deduced
      // from the winning decomposition. They are not implicitly awarded.
      const tai=items.reduce((sum,x)=>sum+x.tai,0);
      assert(Number.isSafeInteger(tai),'safe total');
      const fingerprint=items.map(x=>x.code).sort().join(',');
      if(!best||tai>best.tai||(tai===best.tai&&fingerprint<best.fingerprint))
        best={tai,breakdown:items,fingerprint,decomposition:{pair:dec.pair,
          melds:all.map(g=>({kind:g.kind,type:g.type,open:g.open})),
          ronRole:role}};
    }
  }
  return {contractVersion:SCORING_CONTRACT,scoringVersion:ver,
    status:'experimental-not-rule-certified',tai:best.tai,breakdown:best.breakdown,
    decomposition:best.decomposition,via:evidence.via,
    winnerSeat:evidence.winnerSeat,sourceSeat:evidence.sourceSeat,
    ruleRef:{...evidence.ruleRef},excludedCapabilities:[
      'special-wins','wait-shape','flat-hand','rob-kong','bao-pai','multi-winner',
      'declared-ready','heaven-earth-wins'],
    sourceRefs:[...profile.sourceRefs]};
}
