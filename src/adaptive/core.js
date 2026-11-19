/** Shared, dependency-free, versioned Academy adaptive primitives. */
export const CONTRACT_VERSION = 'master-academy/1.0.0';
export const ADAPTIVE_SCHEMA_VERSION = 1;
export const ABILITY_ALGORITHM_VERSION = 'adaptive-evidence/1.0.0';
export const REVIEW_ALGORITHM_VERSION = 'adaptive-review/1.0.0';
export const SESSION_ALGORITHM_VERSION = 'adaptive-session/1.0.0';
export const DEFAULT_TIMEZONE = 'Asia/Taipei';
export const V1 = Object.freeze({ schemaVersion: 1, contractVersion: CONTRACT_VERSION });

export function requireObject(value, name = 'value') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(name + ' must be an object');
  return value;
}
export function requireId(value, name = 'id') {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new RangeError('Invalid ' + name);
  return value;
}
export function requireUtc(value, name = 'asOf') {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !/(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new RangeError('Invalid explicit ISO time: ' + name);
  }
  return new Date(value).toISOString();
}
export function requireTimezone(timezone) {
  requireId(timezone, 'timezone');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date(0)); }
  catch { throw new RangeError('Invalid IANA timezone: ' + timezone); }
  return timezone;
}
export function requireV1(object, name = 'Academy object') {
  requireObject(object, name);
  if (object.schemaVersion !== 1 || object.contractVersion !== CONTRACT_VERSION) {
    throw new RangeError(name + ' has an unsupported schema or contract version');
  }
  return object;
}
export function cloneJson(value) {
  const output = JSON.stringify(value);
  if (output === undefined) throw new TypeError('Value is not JSON-serializable');
  const cloned = JSON.parse(output);
  if (canonicalJson(cloned) !== canonicalJson(value)) throw new TypeError('Value is not canonical JSON');
  return cloned;
}
export function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('Non-finite JSON number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  requireObject(value, 'JSON value');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new TypeError('Only plain JSON objects are accepted');
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}
export function compareByRef(a, b) {
  return a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}
export function recordKey(ref) { return ref.kind + ':' + ref.id; }
export function uniqueRefs(refs) {
  const seen = new Map();
  for (const ref of refs) {
    if (!ref || !['legacy-v3', 'academy-v1'].includes(ref.kind)) throw new RangeError('Unknown RecordRef kind');
    requireId(ref.id, 'RecordRef.id');
    seen.set(recordKey(ref), { kind: ref.kind, id: ref.id });
  }
  return [...seen.values()].sort(compareByRef);
}
export function validateRegistry(registry) {
  requireObject(registry, 'SkillTag registry');
  if (!Array.isArray(registry.skills)) throw new TypeError('Registry.skills is required');
  const ids = new Set();
  for (const tag of registry.skills) {
    requireV1(tag, 'SkillTag');
    requireId(tag.tagId, 'SkillTag.tagId');
    requireId(tag.labelZhTW, 'SkillTag.labelZhTW');
    if (!['exact-structural', 'strategy-heuristic', 'unverified'].includes(tag.scope) ||
      !['active', 'experimental', 'retired'].includes(tag.status) || !Array.isArray(tag.prerequisiteTagIds)) {
      throw new RangeError('Invalid SkillTag');
    }
    if (ids.has(tag.tagId)) throw new RangeError('Duplicate SkillTag');
    ids.add(tag.tagId);
  }
  for (const tag of registry.skills) {
    for (const dep of tag.prerequisiteTagIds) if (!ids.has(dep) || dep === tag.tagId) throw new RangeError('Unknown or self-referential prerequisite');
  }
  const byId = new Map(registry.skills.map(x => [x.tagId, x]));
  const visiting = new Set(), visited = new Set();
  const visit = id => {
    if (visiting.has(id)) throw new RangeError('Circular SkillTag prerequisites');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of byId.get(id).prerequisiteTagIds) visit(dep);
    visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return byId;
}
export function localParts(iso, timezone) {
  requireTimezone(timezone);
  const dt = new Date(requireUtc(iso));
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(dt).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
  return { ...parts, millisecond: dt.getUTCMilliseconds() };
}
/** Calendar-day arithmetic in the user's IANA zone, including DST boundaries. */
export function addLocalCalendarDays(iso, days, timezone = DEFAULT_TIMEZONE) {
  if (!Number.isSafeInteger(days) || days < 0) throw new RangeError('Invalid day interval');
  const p = localParts(iso, timezone);
  const newDay = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  const target = Date.UTC(newDay.getUTCFullYear(), newDay.getUTCMonth(), newDay.getUTCDate(),
    p.hour, p.minute, p.second, p.millisecond);
  let guess = target;
  for (let i = 0; i < 6; i++) {
    const actual = localParts(new Date(guess).toISOString(), timezone);
    const apparent = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second, actual.millisecond);
    const delta = target - apparent;
    if (delta === 0) break;
    guess += delta;
  }
  // Spring-forward gaps are rare: deterministically use the first legal instant after the gap.
  return new Date(guess).toISOString();
}
export function localDayKey(iso, timezone = DEFAULT_TIMEZONE) {
  const p = localParts(iso, timezone);
  return [p.year, String(p.month).padStart(2, '0'), String(p.day).padStart(2, '0')].join('-');
}
export function stableId(prefix, ...parts) {
  const value = parts.join('|');
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return prefix + '-' + (h >>> 0).toString(16).padStart(8, '0');
}
