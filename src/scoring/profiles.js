/**
 * Opt-in, platform-comparative Taiwan 16-tile scoring. This does not modify
 * src/rules/scoring.js or tw16-minimal-tai-v1.
 */
export const SCORING_CONTRACT = 'tw16-scoring/1.0.0-experimental';
const GAME_TOWER='https://www.gametower.com.tw/Games/Freeplay/MJ/Star31/Data/i_ingame-count.aspx';
const ORCHID='https://mahjongorchid.com/zh-tw/tai/';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const clone=x=>JSON.parse(JSON.stringify(x));
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
const tai={
  concealed:1,selfDraw:1,concealedSelfDraw:3,
  roundWind:1,seatWind:1,dragon:1,correctFlower:1,flowerSet:2,
  allPongs:4,mixedSuit:4,pureSuit:8,allHonors:8,
  smallDragons:4,bigDragons:8,smallWinds:8,bigWinds:16,
  concealedTriplets:{3:2,4:5,5:8},
  openKong:0,concealedKong:0,noHonorsNoFlowers:0,dealer:1,dealerStreakEach:2,
};
const base={
  contractVersion:SCORING_CONTRACT,
  profileId:'tw16-gametower-comparative',
  version:'1.0.0-experimental',
  status:'experimental',
  claim:'Platform-specific comparative fixture; not a Taiwan-wide rule',
  sourceRefs:[GAME_TOWER,ORCHID],
  ruleRefs:[
    {profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'},
    {profileId:'tw16-single-winner-interception',ruleVersion:'experimental-v1'},
  ],
  points:{base:0,perTai:1,unit:'abstract-points'},
  settlement:{discard:'discarder-only',selfDraw:'all-other-three',liability:'unsupported',
    fee:{mode:'none',points:0}},
  variants:{wind:'round-and-seat',flower:'correct-and-sets',kong:'none',
    flowerSetsReplaceCorrect:true,smallWindRetainsWind:true,allHonorsSuppressAllPongs:true},
  tai,
};
const SEE=clone(base);
SEE.profileId='tw16-gametower-see-flower-wind';
SEE.claim='Gametower 見花見字 optional platform switch, not the standard mode';
SEE.variants={wind:'all',flower:'each',kong:'each',flowerSetsReplaceCorrect:false,
  smallWindRetainsWind:true,allHonorsSuppressAllPongs:true};
SEE.tai.noHonorsNoFlowers=2;
SEE.tai.openKong=1;
SEE.tai.concealedKong=2;
SEE.tai.correctFlower=1;
SEE.tai.roundWind=1;
SEE.tai.seatWind=0;
SEE.tai.flowerSet=2;
const PRESETS=freeze([base,SEE]);
const keys=Object.keys(tai);
const str=x=>typeof x==='string'&&x.length>0;
const nonneg=x=>Number.isSafeInteger(x)&&x>=0;
export function validateScoringProfile(p){
  if(!isObject(p)||p.contractVersion!==SCORING_CONTRACT||
    !str(p.profileId)||!str(p.version)||p.status!=='experimental'||
    !str(p.claim)||!Array.isArray(p.sourceRefs)||!p.sourceRefs.length||
    !p.sourceRefs.every(x=>str(x)&&x.startsWith('https://'))||
    !Array.isArray(p.ruleRefs)||!p.ruleRefs.length||
    !p.ruleRefs.every(x=>isObject(x)&&str(x.profileId)&&str(x.ruleVersion)))
    throw new RangeError('Invalid ScoringProfile identity/provenance');
  if(!isObject(p.points)||!nonneg(p.points.base)||!nonneg(p.points.perTai)||
    p.points.perTai===0||p.points.unit!=='abstract-points')
    throw new RangeError('Invalid ScoringProfile points (abstract only)');
  if(!isObject(p.settlement)||p.settlement.discard!=='discarder-only'||
    p.settlement.selfDraw!=='all-other-three'||p.settlement.liability!=='unsupported'||
    !isObject(p.settlement.fee)||
    !['none','fixed-per-player'].includes(p.settlement.fee.mode)||
    !nonneg(p.settlement.fee.points)||
    (p.settlement.fee.mode==='none'&&p.settlement.fee.points!==0))
    throw new RangeError('Unsupported settlement or liability policy');
  const v=p.variants;
  if(!isObject(v)||!['round-and-seat','all'].includes(v.wind)||
    !['correct-and-sets','each'].includes(v.flower)||
    !['none','each'].includes(v.kong)||
    typeof v.flowerSetsReplaceCorrect!=='boolean'||
    typeof v.smallWindRetainsWind!=='boolean'||
    typeof v.allHonorsSuppressAllPongs!=='boolean')
    throw new RangeError('Unsupported scoring variants');
  if(!isObject(p.tai)||keys.some(k=>!Object.hasOwn(p.tai,k))||
    Object.keys(p.tai).some(k=>!keys.includes(k))||
    keys.some(k=>k!=='concealedTriplets'&&!nonneg(p.tai[k]))||
    !isObject(p.tai.concealedTriplets)||
    [3,4,5].some(k=>!nonneg(p.tai.concealedTriplets[k]))||
    Object.keys(p.tai.concealedTriplets).some(k=>!['3','4','5'].includes(k)))
    throw new RangeError('Invalid tai mapping');
  return true;
}
export function createScoringProfile(definition){
  validateScoringProfile(definition);
  return freeze(clone(definition));
}
export function listScoringProfiles(){return clone(PRESETS);}
export function getScoringProfile(profileId,version='1.0.0-experimental'){
  const found=PRESETS.find(x=>x.profileId===profileId&&x.version===version);
  if(!found)throw new RangeError('Unknown ScoringProfile: '+profileId+'@'+version);
  return createScoringProfile(found);
}
