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
];

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
    if (!isObj(item) || !/^[a-z]+(?:-[a-z]+)*$/.test(item.code)
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
