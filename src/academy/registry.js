/** Master Academy V1 taxonomy. These labels describe observable answers, not a player's psychology. */
export const CONTRACT_VERSION = 'master-academy/1.0.0';
export const SCHEMA_VERSION = 1;
const V = { schemaVersion: SCHEMA_VERSION, contractVersion: CONTRACT_VERSION };

const definitions = [
  ['tiles.identity','牌種辨識','exact-structural',[]],
  ['structure.melds','順子、刻子與將眼','exact-structural',['tiles.identity']],
  ['structure.hand16','十六張基本結構','exact-structural',['structure.melds']],
  ['waits.enumeration','聽張辨識','exact-structural',['structure.hand16']],
  ['waits.multi','多面聽枚舉','exact-structural',['waits.enumeration']],
  ['efficiency.shanten','向聽數','exact-structural',['structure.hand16']],
  ['efficiency.ukeire','有效進張枚數','exact-structural',['efficiency.shanten']],
  ['efficiency.discard','何切牌效率','exact-structural',['efficiency.ukeire']],
  ['efficiency.near-tie','接近最佳選項比較','exact-structural',['efficiency.discard']],
  ['efficiency.structure-change','拆搭與牌型變化','exact-structural',['efficiency.discard']],
  ['public.visible-count','已知明牌與剩餘張數','exact-structural',['tiles.identity']],
  ['strategy.open-meld','副露取捨','unverified',['structure.hand16']],
  ['strategy.risk-awareness','牌河與攻守風險','strategy-heuristic',['public.visible-count']],
  ['strategy.round-timing','巡目與攻防切換','strategy-heuristic',['strategy.risk-awareness']],
  ['strategy.scoring-tradeoff','台數與速度取捨','unverified',['strategy.risk-awareness']],
  ['strategy.synthesis','多因素綜合判斷','strategy-heuristic',['strategy.round-timing','efficiency.near-tie']]
];
export const SKILL_TAGS = Object.freeze(definitions.map(([tagId,labelZhTW,scope,prerequisiteTagIds]) =>
  Object.freeze({ ...V, tagId, labelZhTW, scope, prerequisiteTagIds:Object.freeze(prerequisiteTagIds),
    status:scope==='exact-structural'?'active':'experimental' })));
const errors = [
  ['higher-shanten',['efficiency.shanten','efficiency.discard'],'捨牌使向聽數增加','critical'],
  ['lower-ukeire',['efficiency.ukeire','efficiency.discard'],'同向聽下有效進張較少','practice'],
  ['missed-winning-tile',['waits.enumeration'],'漏選可完成五面子一將眼的聽張','practice'],
  ['false-winning-tile',['waits.enumeration'],'選入無法完成五面子一將眼的牌','practice']
];
export const ERROR_TYPES = Object.freeze(errors.map(([errorId,skillTagIds,descriptionZhTW,severity]) =>
  Object.freeze({ ...V,errorId,skillTagIds:Object.freeze(skillTagIds),descriptionZhTW,severity,source:'canonical-grade' })));
export const LEGACY_ERROR_TO_SKILLS = Object.freeze(Object.fromEntries(
  ERROR_TYPES.map(e => [e.errorId,e.skillTagIds])));

export function assertContract(o) {
  if (!o || o.schemaVersion !== SCHEMA_VERSION || o.contractVersion !== CONTRACT_VERSION) {
    throw new RangeError('不支援的 Master Academy 契約版本');
  }
}
export function validateTaxonomy(tags=SKILL_TAGS,types=ERROR_TYPES) {
  const ids=new Set();
  for(const t of tags) {
    assertContract(t);
    if(!t.tagId || ids.has(t.tagId) || !t.labelZhTW ||
       !['exact-structural','strategy-heuristic','unverified'].includes(t.scope) ||
       !['active','experimental','retired'].includes(t.status) ||
       !Array.isArray(t.prerequisiteTagIds)) throw new RangeError('SkillTag 不合法或重複');
    ids.add(t.tagId);
  }
  const byId=new Map(tags.map(t=>[t.tagId,t]));
  const active=new Set(),visited=new Set();
  function visit(id) {
    if(!byId.has(id)) throw new RangeError('不存在的 SkillTag 依賴');
    if(active.has(id)) throw new RangeError('SkillTag 先修循環');
    if(visited.has(id))return;
    active.add(id);
    for(const dep of byId.get(id).prerequisiteTagIds)visit(dep);
    active.delete(id);visited.add(id);
  }
  for(const id of ids)visit(id);
  const err=new Set();
  for(const e of types) {
    assertContract(e);
    if(!e.errorId || err.has(e.errorId) || !Array.isArray(e.skillTagIds) ||
       !e.skillTagIds.length || e.skillTagIds.some(id=>!ids.has(id)) ||
       !e.descriptionZhTW || !['informational','practice','critical'].includes(e.severity) ||
       !['canonical-grade','heuristic','expert-reviewed'].includes(e.source))
      throw new RangeError('ErrorType 不合法或重複');
    err.add(e.errorId);
  }
  return true;
}
export function getSkillTag(id) { return SKILL_TAGS.find(t=>t.tagId===id) ?? null; }
export function getErrorType(id) { return ERROR_TYPES.find(e=>e.errorId===id) ?? null; }
