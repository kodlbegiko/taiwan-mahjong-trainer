import {AUTHORITATIVE_RULE_REF,AUTHORITATIVE_SCORING_VERSION,PRE_SETTLEMENT_CONTRACT} from './scoring.js';
import { SCHEMA_VERSION, CONTRACT_VERSION } from './tile-constants.js';

const BASE_TILE_SET = {
  standardTypes: 34, copiesPerType: 4,
  flowers: { enabled: false, codes: [] },
};
const BASE_HAND_SHAPE = { base: 16, drawn: 17, winningMelds: 5, eyes: 1 };

const PRESETS = [
  {
    schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION,
    profileId: 'tw16-structural-verified', ruleVersion: 'structural-only-v1',
    status: 'verified', scope: 'structural-16',
    sourceRefs: ['docs/API_CONTRACT.md#G', 'tests/golden-regression-gates.test.js'],
    tileSet: BASE_TILE_SET, handShape: BASE_HAND_SHAPE,
    turnPolicy: { claimPriority: 'unverified', replacementDraw: 'unverified' },
    winningPolicy: { mode: 'structural-only' },
    scoringPolicy: { mode: 'undefined' },
  },
  {
    schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION,
    profileId: 'tw16-four-player-sandbox', ruleVersion: 'experimental-move-v1',
    status: 'experimental', scope: 'four-player',
    sourceRefs: ['docs/rules/ENGINE_LIMITATIONS.md'],
    tileSet: BASE_TILE_SET, handShape: BASE_HAND_SHAPE,
    turnPolicy: { claimPriority: 'unverified', replacementDraw: 'unverified' },
    winningPolicy: { mode: 'structural-only' },
    scoringPolicy: { mode: 'undefined' },
  },
  {
    schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION,
    profileId: 'tw16-configurable-table', ruleVersion: 'experimental-full-v1',
    status: 'experimental', scope: 'four-player',
    sourceRefs: [
      'https://cml88.com/賽事規則/',
      'https://www.gogogame.com.tw/htm/rule_3000.html',
      'docs/rules/TW16_TABLE_POLICY.md',
    ],
    tileSet: {
      standardTypes: 34, copiesPerType: 4,
      flowers: { enabled: true, codes: [
        {code:'season-spring',copies:1},{code:'season-summer',copies:1},
        {code:'season-autumn',copies:1},{code:'season-winter',copies:1},
        {code:'plant-plum',copies:1},{code:'plant-orchid',copies:1},
        {code:'plant-bamboo',copies:1},{code:'plant-chrysanthemum',copies:1},
      ] },
    },
    handShape: BASE_HAND_SHAPE,
    turnPolicy: { claimPriority: 'configured', replacementDraw: 'configured' },
    winningPolicy: { mode: 'configured', configRef: 'tw16-win-five-melds-v1' },
    scoringPolicy: { mode: 'configured', configRef: 'tw16-minimal-tai-v1' },
    extensions: { tw16: {
      housePolicyVersion: 'tw16-table-experimental/1.0.0',
      startingPrevailingWind: 'east', windAdvancePolicy: 'explicit',
      claimOrder: ['win','kong','pong','chi'], singleWinner: true,
      multipleDiscardWins: 'unsupported',
      chiFromPreviousSeatOnly: true,
      passWinLock: 'until-own-discard',
      reserveTail: 16,
      replacementFromTail: true,
      robAddedKong: false,
      specialHands: [],
      scoring: {basePoints:100,pointsPerTai:20,
        concealedTai:1,selfDrawTai:1,concealedSelfDrawBonusTai:1,
        dealerInteractionTai:1},
      dealerRetentionOnDraw: true,
    } },
  },
];

/**
 * Additive experimental house rule. The original configurable-table profile
 * retains fail-closed multiple-WIN behavior and is not reinterpreted.
 */
const interceptionProfile = JSON.parse(JSON.stringify(PRESETS[2]));
interceptionProfile.profileId = 'tw16-single-winner-interception';
interceptionProfile.ruleVersion = 'experimental-v1';
interceptionProfile.sourceRefs = ['docs/rules/CLAIM_ARBITRATION_API.md#r5-single-winner-interception'];
Object.assign(interceptionProfile.extensions.tw16, {
  housePolicyVersion: 'tw16-single-winner-interception/1.0.0',
  multipleDiscardWins: 'single-winner',
  winPriority: 'nearest-clockwise-from-discarder',
  claimPriority: 'win > open-kong > pong > chi',
  settlementPolicy: 'single-discard-winner',
  scoringPolicy: 'tw16-minimal-tai-v1',
  verificationStatus: 'experimental',
});
PRESETS.push(interceptionProfile);

/**
 * R7 opt-in experiment. Existing R3/R5 policy IDs and behavior remain pinned.
 * Added-kong robbery uses the existing minimal discard-liability scorer; bonus
 * tai and multiple robber settlement are deliberately not represented.
 */
const robberyProfile = JSON.parse(JSON.stringify(PRESETS[2]));
robberyProfile.profileId = 'tw16-rob-added-kong';
robberyProfile.ruleVersion = 'experimental-v1';
robberyProfile.sourceRefs = ['docs/rules/R7_RULE_COVERAGE_MATRIX.md'];
Object.assign(robberyProfile.extensions.tw16, {
  housePolicyVersion: 'tw16-rob-added-kong/1.0.0',
  robAddedKong: true,
  robAddedKongSettlement: 'existing-minimal-discard-liability',
  robAddedKongPriority: 'win-only-legacy-multiwinner-fail-closed',
  verificationStatus: 'experimental',
});
PRESETS.push(robberyProfile);
const authoritativeProfile=JSON.parse(JSON.stringify(robberyProfile));
Object.assign(authoritativeProfile,AUTHORITATIVE_RULE_REF,{
  sourceRefs:['docs/rules/R73_SETTLEMENT_CONTRACT.md'],
  scoringPolicy:{mode:'configured',configRef:AUTHORITATIVE_SCORING_VERSION},
});
Object.assign(authoritativeProfile.extensions.tw16,{
  housePolicyVersion:'tw16-authoritative-scoring/1.0.0',
  robAddedKongSettlement:'authoritative-single-declarer',
  settlementEvidenceContractVersion:PRE_SETTLEMENT_CONTRACT,
  scoringPolicy:AUTHORITATIVE_SCORING_VERSION,
});
PRESETS.push(authoritativeProfile);

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function fail(message) { throw new RangeError('Invalid RuleProfile: ' + message); }
function string(x) { return typeof x === 'string' && x.length > 0; }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function immutable(x) { if (isObj(x) || Array.isArray(x)) { for (const v of Object.values(x)) immutable(v); Object.freeze(x); } return x; }

export function validateRuleProfile(p) {
  if (!isObj(p) || p.schemaVersion !== SCHEMA_VERSION || p.contractVersion !== CONTRACT_VERSION) fail('version');
  if (!string(p.profileId) || !string(p.ruleVersion)) fail('identity');
  if (!['verified', 'experimental', 'incomplete'].includes(p.status)) fail('status');
  if (!['structural-16', 'four-player'].includes(p.scope)) fail('scope');
  if (!Array.isArray(p.sourceRefs) || !p.sourceRefs.every(string)) fail('sourceRefs');
  if (!isObj(p.tileSet) || p.tileSet.standardTypes !== 34 || p.tileSet.copiesPerType !== 4) fail('tileSet');
  const f = p.tileSet.flowers;
  if (!isObj(f) || typeof f.enabled !== 'boolean' || !Array.isArray(f.codes)) fail('flowers');
  if (!f.enabled && f.codes.length) fail('disabled flower codes');
  const codes = new Set();
  for (const item of f.codes) {
    if (!isObj(item) || typeof item.code !== 'string'
        || item.code === 'undefined'
        || !/^[a-z]+(?:-[a-z]+)*$/.test(item.code)
        || !Number.isInteger(item.copies) || item.copies < 1 || item.copies > 4
        || codes.has(item.code)) fail('flower code/copies');
    codes.add(item.code);
  }
  const h = p.handShape;
  if (!isObj(h) || h.base !== 16 || h.drawn !== 17 || h.winningMelds !== 5 || h.eyes !== 1) fail('handShape');
  if (!isObj(p.turnPolicy)
      || !['configured','unverified'].includes(p.turnPolicy.claimPriority)
      || !['configured','unverified'].includes(p.turnPolicy.replacementDraw)) fail('turnPolicy');
  if (!isObj(p.winningPolicy)
      || !['structural-only','configured'].includes(p.winningPolicy.mode)
      || (p.winningPolicy.mode === 'configured' && !string(p.winningPolicy.configRef))) fail('winningPolicy');
  if (!isObj(p.scoringPolicy)
      || !['undefined','configured'].includes(p.scoringPolicy.mode)
      || (p.scoringPolicy.mode === 'configured' && !string(p.scoringPolicy.configRef))) fail('scoringPolicy');
  if (p.extensions !== undefined && !isObj(p.extensions)) fail('extensions');
  if (['tw16-configurable-table','tw16-single-winner-interception','tw16-rob-added-kong','tw16-authoritative-scoring'].includes(p.profileId)) {
    const interception=p.profileId==='tw16-single-winner-interception';
    const authoritative=p.profileId===AUTHORITATIVE_RULE_REF.profileId;
    const robbery=p.profileId==='tw16-rob-added-kong'||authoritative;
    const x=p.extensions?.tw16;
    if (p.ruleVersion !== (interception||robbery?'experimental-v1':'experimental-full-v1') || p.status !== 'experimental'
        || p.scope !== 'four-player' || !isObj(x)
        || p.turnPolicy.claimPriority !== 'configured'
        || p.turnPolicy.replacementDraw !== 'configured'
        || p.winningPolicy.mode !== 'configured'
        || p.winningPolicy.configRef !== 'tw16-win-five-melds-v1'
        || p.scoringPolicy.mode !== 'configured'
        || p.scoringPolicy.configRef !== (authoritative?AUTHORITATIVE_SCORING_VERSION:'tw16-minimal-tai-v1')
        || x.housePolicyVersion !== (interception
          ? 'tw16-single-winner-interception/1.0.0'
          : authoritative ? 'tw16-authoritative-scoring/1.0.0'
          : robbery ? 'tw16-rob-added-kong/1.0.0'
          : 'tw16-table-experimental/1.0.0')
        || x.multipleDiscardWins !== (interception?'single-winner':'unsupported')
        || x.startingPrevailingWind !== 'east'
        || x.windAdvancePolicy !== 'explicit'
        || !Array.isArray(x.claimOrder)
        || x.claimOrder.join(',') !== 'win,kong,pong,chi'
        || x.singleWinner !== true || x.chiFromPreviousSeatOnly !== true
        || x.robAddedKong !== robbery || x.passWinLock !== 'until-own-discard'
        || x.replacementFromTail !== true || x.dealerRetentionOnDraw !== true
        || !Number.isInteger(x.reserveTail) || x.reserveTail < 0 || x.reserveTail > 32
        || !Array.isArray(x.specialHands) || x.specialHands.length
        || !isObj(x.scoring)
        || Object.values(x.scoring).some(n=>typeof n!=='number'
          || !Number.isFinite(n)||n<0)) fail('experimental table policy');
    if (!p.tileSet.flowers.enabled || p.tileSet.flowers.codes.length!==8)
      fail('experimental table flowers');
    if (interception && (x.winPriority !== 'nearest-clockwise-from-discarder'
        || x.claimPriority !== 'win > open-kong > pong > chi'
        || x.settlementPolicy !== 'single-discard-winner'
        || x.scoringPolicy !== 'tw16-minimal-tai-v1'
        || x.verificationStatus !== 'experimental'))
      fail('interception policy');
    if (robbery && (x.robAddedKongSettlement !== (authoritative?'authoritative-single-declarer':'existing-minimal-discard-liability')
        || x.robAddedKongPriority !== 'win-only-legacy-multiwinner-fail-closed'
        || x.verificationStatus !== 'experimental'))
      fail('rob-added-kong policy');
    if(authoritative&&(x.settlementEvidenceContractVersion!==PRE_SETTLEMENT_CONTRACT||x.scoringPolicy!==AUTHORITATIVE_SCORING_VERSION||x.reserveTail!==16))fail('authoritative settlement policy');
  }
  // Verification in this engine is intentionally restricted to the independently
  // regression-tested concealed-hand structure, not local four-player house rules.
  if (p.status === 'verified' && (p.scope !== 'structural-16' || !p.sourceRefs.length
      || p.turnPolicy.claimPriority !== 'unverified' || p.turnPolicy.replacementDraw !== 'unverified'
      || p.winningPolicy.mode !== 'structural-only' || p.scoringPolicy.mode !== 'undefined'
      || f.enabled)) fail('verified scope beyond vetted structural fixtures');
  return true;
}

export function createRuleProfileRegistry(profiles = PRESETS) {
  const entries = new Map();
  const register = p => {
    validateRuleProfile(p);
    const key = p.profileId + '@' + p.ruleVersion;
    if (entries.has(key)) throw new RangeError('Duplicate RuleProfile: ' + key);
    entries.set(key, immutable(clone(p)));
    return key;
  };
  for (const p of profiles) register(p);
  return Object.freeze({
    register,
    resolve(profileId, ruleVersion) {
      if (!string(profileId) || !string(ruleVersion)) throw new RangeError('Explicit RuleProfile id/version required');
      const found = entries.get(profileId + '@' + ruleVersion);
      if (!found) throw new RangeError('Unknown RuleProfile: ' + profileId + '@' + ruleVersion);
      return clone(found);
    },
    list() { return [...entries.values()].map(clone); },
  });
}

export const ruleProfiles = createRuleProfileRegistry();
export function getRuleProfile(profileId, ruleVersion) { return ruleProfiles.resolve(profileId, ruleVersion); }
export function listRuleProfiles() { return ruleProfiles.list(); }
