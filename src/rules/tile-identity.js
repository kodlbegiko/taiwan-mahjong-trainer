/**
 * Physical tile IDs deliberately do not extend the canonical 0..33 tile types.
 * The public tile-efficiency API remains completely independent.
 */
import { validateRuleProfile } from './profiles.js';

export const SCHEMA_VERSION = 1;
export const CONTRACT_VERSION = 'master-academy/1.0.0';

export const FLOWER_CODES = Object.freeze([
  'season-spring', 'season-summer', 'season-autumn', 'season-winter',
  'plant-plum', 'plant-orchid', 'plant-bamboo', 'plant-chrysanthemum',
]);

const STANDARD = /^t:(0|[1-9]|[12][0-9]|3[0-3]):([0-3])$/;
const FLOWER = /^f:([a-z]+(?:-[a-z]+)*):(0|[1-9][0-9]*)$/;

export function parsePhysicalTileId(id) {
  if (typeof id !== 'string') throw new TypeError('PhysicalTileId must be a string');
  const standard = STANDARD.exec(id);
  if (standard) return { kind: 'standard', tileType: Number(standard[1]), copyIndex: Number(standard[2]) };
  const flower = FLOWER.exec(id);
  if (flower && Number.isSafeInteger(Number(flower[2]))) {
    return { kind: 'flower', flowerCode: flower[1], copyIndex: Number(flower[2]) };
  }
  throw new RangeError('Invalid or noncanonical PhysicalTileId: ' + id);
}

export function typeOf(id) {
  const parsed = parsePhysicalTileId(id);
  if (parsed.kind !== 'standard') throw new RangeError('Flower has no TileType (0..33)');
  return parsed.tileType;
}

export function makeTileIdentity(id, profile) {
  const parsed = parsePhysicalTileId(id);
  if (profile) {
    validateRuleProfile(profile);
    if (parsed.kind === 'flower') {
      const entry = profile.tileSet.flowers.enabled && profile.tileSet.flowers.codes
        .find(({ code }) => code === parsed.flowerCode);
      if (!entry || parsed.copyIndex >= entry.copies) throw new RangeError('Flower is not enabled in this RuleProfile');
    } else if (parsed.copyIndex >= profile.tileSet.copiesPerType) {
      throw new RangeError('Standard tile copy out of range');
    }
  }
  return { schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION, id, ...parsed };
}

export function validateTileIdentity(identity, profile) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)
      || identity.schemaVersion !== SCHEMA_VERSION || identity.contractVersion !== CONTRACT_VERSION) {
    throw new TypeError('Invalid TileIdentity schema');
  }
  const canonical = makeTileIdentity(identity.id, profile);
  const allowed = Object.keys(canonical).sort();
  if (JSON.stringify(Object.keys(identity).sort()) !== JSON.stringify(allowed)
      || allowed.some(k => identity[k] !== canonical[k])) throw new RangeError('TileIdentity does not match physical ID');
  return true;
}

export function createDeck(profile) {
  validateRuleProfile(profile);
  const result = [];
  for (let tileType = 0; tileType < 34; tileType++) {
    for (let copyIndex = 0; copyIndex < profile.tileSet.copiesPerType; copyIndex++) {
      result.push('t:' + tileType + ':' + copyIndex);
    }
  }
  if (profile.tileSet.flowers.enabled) {
    for (const { code, copies } of profile.tileSet.flowers.codes) {
      for (let i = 0; i < copies; i++) result.push('f:' + code + ':' + i);
    }
  }
  if (new Set(result).size !== result.length) throw new Error('Duplicate physical tile in deck');
  return result;
}

/**
 * FNV-1a over UTF-16 code units + mulberry32; version-pinned and not cryptographic.
 * Every shuffle consumes precisely (deck.length - 1) pseudorandom values.
 */
export const RNG_ALGORITHM_VERSION = 'fnv1a-mulberry32-fisher-yates-v1';

function hashSeed(seed) {
  if (typeof seed !== 'string' || !seed.length) throw new TypeError('seed must be a non-empty string');
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}
function drawRandom(ctx) {
  ctx.state = (ctx.state + 0x6d2b79f5) >>> 0;
  let t = ctx.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  ctx.counter += 1;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffleDeck(deck, seed) {
  if (!Array.isArray(deck) || new Set(deck).size !== deck.length) {
    throw new RangeError('Deck must contain unique PhysicalTileIds');
  }
  for (const id of deck) parsePhysicalTileId(id);
  const tiles = [...deck];
  const ctx = { state: hashSeed(seed), counter: 0 };
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(drawRandom(ctx) * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { tiles, rng: { seed, algorithmVersion: RNG_ALGORITHM_VERSION, counter: ctx.counter } };
}
