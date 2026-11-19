import { knownTileCounts } from '../tiles.js';

export const CONTRACT_VERSION = 'master-academy/1.0.0';

/**
 * A detached JSON snapshot is the ONLY object consumed by the analysis.
 * Reject accessors, non-JSON values, custom array metadata, and cycles before
 * serialization so JSON.stringify cannot silently drop a private field.
 */
function detachedPublicSnapshot(input) {
  const ancestors=new WeakSet();
  function walk(v,depth) {
    if (depth>64) throw new RangeError('PlayerView 巢狀深度異常');
    if (v===null || typeof v==='string' || typeof v==='boolean') return;
    if (typeof v==='number' && Number.isFinite(v)) return;
    if (typeof v!=='object') throw new TypeError('PlayerView 只能含 JSON 資料');
    if (!Array.isArray(v) && Object.getPrototypeOf(v)!==Object.prototype) throw new TypeError('PlayerView 只接受普通 JSON 物件');
    if (ancestors.has(v)) throw new TypeError('PlayerView 不接受循環參照');
    ancestors.add(v);
    if (Array.isArray(v)) {
      for (const key of Reflect.ownKeys(v)) {
        if (typeof key !== 'string' || (key!=='length' && !/^(0|[1-9]\d*)$/.test(key)))
          throw new TypeError('陣列含非 JSON 欄位');
      }
      for (let i=0;i<v.length;i++) {
        const d=Object.getOwnPropertyDescriptor(v,String(i));
        if (!d || !('value' in d)) throw new TypeError('陣列不允許空洞或 accessor');
        walk(d.value,depth+1);
      }
    } else for (const key of Reflect.ownKeys(v)) {
      if (typeof key!=='string') throw new TypeError('物件不允許 Symbol 欄位');
      const d=Object.getOwnPropertyDescriptor(v,key);
      if (!d.enumerable || !('value' in d)) throw new TypeError('物件不允許隱藏欄位或 accessor');
      walk(d.value,depth+1);
    }
    ancestors.delete(v);
  }
  walk(input,0);
  return JSON.parse(JSON.stringify(input));
}

const types = new Set(['discard', 'draw', 'chi', 'pong', 'kong', 'win', 'pass', 'replace_flower']);
const phases = new Set(['dealing', 'await_draw', 'await_discard', 'claim_window', 'replacement', 'settled']);
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

function object(v, label, keys, required = []) {
  if (!plain(v)) throw new TypeError(label + ' 必須是普通 JSON 物件');
  for (const key of Reflect.ownKeys(v)) {
    if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(label + ' 含非公開欄位：' + String(key));
    const desc = Object.getOwnPropertyDescriptor(v, key);
    if (!('value' in desc)) throw new TypeError(label + ' 不允許 getter / setter');
  }
  for (const k of required) if (!Object.hasOwn(v, k)) throw new TypeError(label + ' 缺少 ' + k);
}
function array(v, label) { if (!Array.isArray(v)) throw new TypeError(label + ' 必須是陣列'); return v; }
function id(v, label) { if (typeof v !== 'string' || !v.trim()) throw new TypeError(label + ' 必須是非空字串'); }
function integer(v, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new RangeError(label + ' 不合法');
}
function v1(o, label) {
  if (o.schemaVersion !== 1 || o.contractVersion !== CONTRACT_VERSION) throw new RangeError(label + ' 版本不支援');
}
function rule(r) {
  object(r, 'ruleRef', ['profileId','ruleVersion'], ['profileId','ruleVersion']);
  id(r.profileId, 'profileId'); id(r.ruleVersion, 'ruleVersion');
}
function sameRule(r, expected) {
  rule(r);
  if (r.profileId !== expected.profileId || r.ruleVersion !== expected.ruleVersion) throw new RangeError('ruleRef 版本不一致');
}
function physical(s) {
  if (typeof s !== 'string') throw new TypeError('tileId 必須是字串');
  const match = /^t:(\d{1,2}):([0-3])$/.exec(s);
  if (!match || Number(match[1]) > 33 || s !== 't:' + Number(match[1]) + ':' + match[2]) throw new RangeError('無效 standard physical tileId：' + s);
  return Number(match[1]);
}
function flowerPhysical(s) {
  if (typeof s !== 'string' || !/^f:[a-z][a-z0-9-]*:[0-9]+$/.test(s)) throw new RangeError('無效 flower physical tileId');
  return s;
}
function identity(t, kind = 'standard') {
  object(t, 'TileIdentity', ['schemaVersion','contractVersion','id','kind','tileType','flowerCode','copyIndex'],
    ['schemaVersion','contractVersion','id','kind','copyIndex']);
  v1(t, 'TileIdentity');
  if (kind !== t.kind) throw new TypeError('TileIdentity.kind 不符');
  if (kind === 'standard') {
    const tile = physical(t.id);
    integer(t.tileType, 'tileType', 0, 33); integer(t.copyIndex, 'copyIndex', 0, 3);
    if (tile !== t.tileType || t.id !== 't:' + tile + ':' + t.copyIndex || 'flowerCode' in t) throw new RangeError('TileIdentity 身分不一致');
    return tile;
  }
  id(t.flowerCode, 'flowerCode');
  integer(t.copyIndex, 'copyIndex');
  if ('tileType' in t || !t.id.startsWith('f:') || t.id !== 'f:' + t.flowerCode + ':' + t.copyIndex) throw new RangeError('花牌 ID 不一致');
  return null;
}
function meld(m) {
  object(m, 'Meld', ['kind','tileIds','open','sourceSeat','sourceEventId'], ['kind','tileIds','open']);
  if (!['sequence','triplet','kong'].includes(m.kind) || typeof m.open !== 'boolean') throw new TypeError('Meld 形態不合法');
  const tiles = array(m.tileIds, 'Meld.tileIds').map(physical);
  if (tiles.length !== (m.kind === 'kong' ? 4 : 3)) throw new RangeError('Meld 張數錯誤');
  const sorted = [...tiles].sort((a,b)=>a-b);
  if (m.kind === 'sequence' && !(sorted[0] < 27 && sorted[0] % 9 <= 6 && sorted[1] === sorted[0] + 1 && sorted[2] === sorted[0] + 2)) throw new RangeError('非法順子結構');
  if (m.kind !== 'sequence' && !tiles.every(t => t === tiles[0])) throw new RangeError('非法刻子／槓結構');
  if (m.sourceSeat !== undefined) integer(m.sourceSeat, 'sourceSeat', 0, 3);
  if (m.sourceEventId !== undefined) id(m.sourceEventId, 'sourceEventId');
}
function discard(d) {
  object(d, 'Discard', ['tileId','seq','claimedByEventId'], ['tileId','seq']);
  physical(d.tileId); integer(d.seq, 'Discard.seq');
  if (d.claimedByEventId !== undefined) id(d.claimedByEventId, 'claimedByEventId');
}
function member(s, self = false) {
  const keys = self ? ['seat','concealed','melds','river','flowers'] : ['seat','concealedCount','melds','river','flowers'];
  object(s, 'player', keys, keys);
  integer(s.seat, 'seat', 0, 3);
  if (self) array(s.concealed, 'concealed').forEach(t => identity(t));
  else integer(s.concealedCount, 'concealedCount');
  array(s.melds, 'melds').forEach(meld);
  array(s.river, 'river').forEach(discard);
  array(s.flowers, 'flowers').forEach(t => identity(t, 'flower'));
}
function publicEvent(e, asOf) {
  object(e, 'TurnEventPublic', ['schemaVersion','contractVersion','eventId','gameId','seq','ruleRef','actorSeat','type','visibility','payload','causedByActionId','previousEventId','occurredAt'],
    ['schemaVersion','contractVersion','eventId','gameId','seq','ruleRef','type','visibility','payload']);
  v1(e, 'TurnEventPublic'); id(e.eventId, 'eventId'); integer(e.seq, 'event.seq', 1, asOf);
  if (e.visibility !== 'public') throw new TypeError('不得使用私人 TurnEvent');
  if (!['deal','draw','discard','claim','kong','flower','win','pass','settle'].includes(e.type)) throw new RangeError('未知公開事件');
  if (e.actorSeat !== undefined) integer(e.actorSeat, 'actorSeat', 0, 3);
  if (e.causedByActionId !== undefined) id(e.causedByActionId, 'causedByActionId');
  if (e.previousEventId !== undefined) id(e.previousEventId, 'previousEventId');
  // The adapter deliberately accepts only unambiguous public payload fields.
  object(e.payload, 'public payload', ['seat','tileId','tileIds','kind','claimEventId','concealedCount','reasonCode','sourceSeat','count','countsBySeat'], []);
  if (e.payload.tileId !== undefined) {
    if (!['discard','claim','kong','flower'].includes(e.type)) throw new TypeError('摸牌等事件不得曝光 tileId');
    if (e.type === 'flower') flowerPhysical(e.payload.tileId);
    else physical(e.payload.tileId);
  }
  if (e.payload.tileIds !== undefined) {
    if (!['claim','kong'].includes(e.type)) throw new TypeError('事件不得曝光隱藏 tileIds');
    array(e.payload.tileIds, 'payload.tileIds').forEach(physical);
  }
  if (e.payload.seat !== undefined) integer(e.payload.seat, 'payload.seat', 0, 3);
  if (e.payload.sourceSeat !== undefined) integer(e.payload.sourceSeat, 'payload.sourceSeat', 0, 3);
  if (e.payload.concealedCount !== undefined) integer(e.payload.concealedCount, 'payload.concealedCount');
  if (e.payload.count !== undefined) {
    if (e.type !== 'draw') throw new TypeError('count 只可用於 redacted draw');
    integer(e.payload.count, 'payload.count', 1, 1);
  }
  if (e.payload.countsBySeat !== undefined) {
    if (e.type !== 'deal') throw new TypeError('countsBySeat 只可用於 redacted deal');
    if (!Array.isArray(e.payload.countsBySeat) || e.payload.countsBySeat.length !== 4)
      throw new TypeError('countsBySeat 應為四席公開數量');
    e.payload.countsBySeat.forEach(n=>integer(n, 'countsBySeat'));
  }
  for (const k of ['kind','claimEventId','reasonCode']) if (e.payload[k] !== undefined) id(e.payload[k], k);
}
function action(a, v) {
  object(a, 'LegalAction', ['schemaVersion','contractVersion','actionId','kind','actorSeat','expectedRevision','tileIds','claimEventId','ruleRef','legalityBasis'],
    ['schemaVersion','contractVersion','actionId','kind','actorSeat','expectedRevision','tileIds','ruleRef','legalityBasis']);
  v1(a, 'LegalAction'); id(a.actionId, 'actionId');
  if (!types.has(a.kind) || a.actorSeat !== v.audienceSeat) throw new RangeError('非法 actor/action kind');
  integer(a.expectedRevision, 'expectedRevision');
  if (a.expectedRevision !== v.asOfEventSeq) throw new RangeError('LegalAction expectedRevision 與 PlayerView.asOfEventSeq 不一致');
  sameRule(a.ruleRef, v.ruleRef);
  array(a.tileIds, 'action.tileIds').forEach(physical);
  if (a.claimEventId !== undefined) id(a.claimEventId, 'claimEventId');
  object(a.legalityBasis, 'legalityBasis', ['engineVersion','reasonCodes'], ['engineVersion','reasonCodes']);
  id(a.legalityBasis.engineVersion, 'engineVersion');
  array(a.legalityBasis.reasonCodes, 'reasonCodes').forEach(x => id(x, 'reasonCode'));
  if (a.kind === 'discard' && (a.tileIds.length !== 1 || !v.self.concealed.some(t => t.id === a.tileIds[0]))) throw new RangeError('discard 必須使用當前自己暗牌的 physical ID');
}
function countVisible(v) {
  const hand = v.self.concealed.map(t => t.tileType);
  const seen = new Set(v.self.concealed.map(t => t.id));
  const meldIds = new Set([v.self,...v.opponents].flatMap(p=>p.melds.flatMap(m=>m.tileIds)));
  const visible = [];
  const add = tileId => {
    if (seen.has(tileId)) throw new RangeError('相同 physical tileId 在多個實體區域重複出現');
    seen.add(tileId); visible.push(physical(tileId));
  };
  for (const p of [v.self,...v.opponents]) for (const m of p.melds) for (const tileId of m.tileIds) add(tileId);
  for (const p of [v.self,...v.opponents]) for (const d of p.river) {
    if (d.claimedByEventId && meldIds.has(d.tileId) && seen.has(d.tileId)) continue; // 已領取之河牌仍只扣一次
    add(d.tileId);
  }
  const counts = knownTileCounts(hand, visible);
  for (const tile of v.knownUnavailableTypes) if (counts[tile] !== 4) throw new RangeError('knownUnavailableTypes 不能暗示不可見的額外牌');
  return { hand, visible, counts };
}

/** Rejects GameState and non-allowlisted nested data; never consults a wall or opponent private hand. */
export function readPlayerView(input) {
  const v=detachedPublicSnapshot(input);
  object(v, 'PlayerView', ['schemaVersion','contractVersion','viewId','gameId','ruleRef','audienceSeat','asOfEventSeq','round','self','opponents','publicEvents','legalActions','knownUnavailableTypes','capabilities'],
    ['schemaVersion','contractVersion','viewId','gameId','ruleRef','audienceSeat','asOfEventSeq','round','self','opponents','publicEvents','legalActions','knownUnavailableTypes','capabilities']);
  v1(v, 'PlayerView'); id(v.viewId, 'viewId'); id(v.gameId, 'gameId');
  rule(v.ruleRef); integer(v.audienceSeat, 'audienceSeat', 0, 3); integer(v.asOfEventSeq, 'asOfEventSeq');
  object(v.round, 'RoundState', ['schemaVersion','contractVersion','roundId','handIndex','dealerSeat','currentSeat','phase','prevailingWind','roundWind','scores','lastPublicEventSeq'],
    ['schemaVersion','contractVersion','roundId','handIndex','dealerSeat','currentSeat','phase','lastPublicEventSeq']);
  v1(v.round, 'RoundState'); id(v.round.roundId, 'roundId'); integer(v.round.handIndex, 'handIndex');
  integer(v.round.dealerSeat, 'dealerSeat', 0, 3); integer(v.round.currentSeat, 'currentSeat', 0, 3);
  integer(v.round.lastPublicEventSeq, 'lastPublicEventSeq');
  if (v.round.lastPublicEventSeq > v.asOfEventSeq || !phases.has(v.round.phase)) throw new RangeError('公開事件序號或階段不符');
  for (const k of ['prevailingWind','roundWind']) if (v.round[k] !== undefined && !['east','south','west','north'].includes(v.round[k])) throw new RangeError(k+' 不合法');
  if (v.round.scores !== undefined) {
    if (!Array.isArray(v.round.scores) || v.round.scores.length !== 4 || v.round.scores.some(x=>typeof x !== 'number' || !Number.isFinite(x))) throw new RangeError('scores 必須為四個有限數字');
  }
  member(v.self, true); if (v.self.seat !== v.audienceSeat) throw new RangeError('self.seat 不符');
  array(v.opponents, 'opponents'); if (v.opponents.length !== 3) throw new RangeError('必須提供其他三席公開視角');
  v.opponents.forEach(p=>member(p));
  const seats = new Set([v.self.seat,...v.opponents.map(p=>p.seat)]);
  if (seats.size !== 4) throw new RangeError('席位重複');
  array(v.publicEvents, 'publicEvents').forEach(e => { publicEvent(e, v.asOfEventSeq); if (e.gameId !== v.gameId) throw new RangeError('event.gameId 不符'); sameRule(e.ruleRef, v.ruleRef); });
  array(v.legalActions, 'legalActions').forEach(a=>action(a, v));
  if (new Set(v.legalActions.map(a=>a.actionId)).size !== v.legalActions.length) throw new RangeError('actionId 重複');
  array(v.knownUnavailableTypes, 'knownUnavailableTypes').forEach(t=>integer(t, 'knownUnavailableType', 0, 33));
  if (new Set(v.knownUnavailableTypes).size !== v.knownUnavailableTypes.length) throw new RangeError('knownUnavailableTypes 重複');
  object(v.capabilities, 'capabilities', ['structuralScore','roundActions','settlement'], ['structuralScore','roundActions','settlement']);
  if (Object.values(v.capabilities).some(x => typeof x !== 'boolean')) throw new TypeError('capabilities 必須為布林值');
  const {hand,visible,counts} = countVisible(v);
  const fixedMelds = v.self.melds.length;
  if (fixedMelds > 5 || ![16-3*fixedMelds,17-3*fixedMelds].includes(hand.length)) throw new RangeError('暗牌有效張數不合法');
  return { view: v, hand, visible, counts, fixedMelds };
}
export function validatePlayerView(view) { readPlayerView(view); return true; }
