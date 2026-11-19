import { analyzeDiscards, analyzeDraws } from '../core/efficiency.js';
import { knownTileCounts } from '../tiles.js';
import { readPlayerView, CONTRACT_VERSION } from './view.js';
import { structuralCandidates } from './structure.js';
import { simulateTwoDraws, SIMULATOR_VERSION, stableHash } from './simulate.js';

export const STRATEGY_ENGINE_VERSION = 'advanced-strategy/1.0.0';
/** Stable identity for semantically equivalent public JSON, independent of object key order. */
function canonicalJSON(value) {
  if (Array.isArray(value)) return '['+value.map(canonicalJSON).join(',')+']';
  if (value && typeof value === 'object') {
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSON(value[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}

const claimKinds = new Set(['chi','pong','kong']);
const metric = (name,value,unit,epistemic,method,ruleRef,extra={}) => ({
  name,value,unit,epistemic,method,ruleRef:{...ruleRef},...extra,
});
function optionsOf(o={}) {
  if (o === null || Array.isArray(o) || typeof o !== 'object' ||
      Object.keys(o).some(k => !['seed','samples','maxSimulatedRoutes'].includes(k))) {
    throw new TypeError('僅允許 seed、samples、maxSimulatedRoutes；不可傳入 GameState 或未來牌山');
  }
  const seed=o.seed ?? 'strategy-v1';
  const samples=o.samples ?? 8;
  const maxSimulatedRoutes=o.maxSimulatedRoutes ?? 3;
  if (typeof seed !== 'string' || !seed || seed.length > 128) throw new TypeError('seed 必須是 1–128 字元字串');
  if (!Number.isInteger(samples) || samples < 0 || samples > 64) throw new RangeError('samples 必須介於 0–64');
  if (!Number.isInteger(maxSimulatedRoutes) || maxSimulatedRoutes < 0 || maxSimulatedRoutes > 17) throw new RangeError('maxSimulatedRoutes 必須介於 0–17');
  return {seed,samples,maxSimulatedRoutes};
}
function context(parsed, opts) {
  const {view} = parsed;
  const viewRef={gameId:view.gameId,viewId:view.viewId,asOfEventSeq:view.asOfEventSeq,audienceSeat:view.audienceSeat};
  const allIds=view.legalActions.map(a=>a.actionId);
  const identifier=stableHash(canonicalJSON(view)+canonicalJSON(opts)+STRATEGY_ENGINE_VERSION);
  const base={
    schemaVersion:1,contractVersion:CONTRACT_VERSION,
    analysisId:'strategy:'+view.gameId+':'+view.viewId+':'+identifier,
    viewRef,ruleRef:{...view.ruleRef},engineVersion:STRATEGY_ENGINE_VERSION,
    legalActionIds:allIds,recommendations:[],
    assumptions:['只依據 PlayerView 自身暗牌、公開明牌和 legalActions；不可見牌池由 4 張實體副本扣除。'],
    limitations:['非完整四人麻將最佳策略；未建立牌河安全性統計、對手牌型分布或真實壁牌模型。'],
    evidenceRefs:['canonical:src/core/efficiency.js','contract:master-academy/1.0.0'],
    status:'unavailable',
  };
  if (view.capabilities.roundActions) base.assumptions.push('合法行動由 Rules Engine 的當下 PlayerView 決定，策略器不自行增加。');
  else base.limitations.push('當前 PlayerView 未宣告可驗證四人回合動作；無法評判吃碰槓或結算。');
  return base;
}

/** Formal StrategyAnalysis V1. Ranks only legally offered discard actions by canonical efficiency. */
export function analyzePlayerView(playerView, options={}) {
  const opts=optionsOf(options);
  const parsed=readPlayerView(playerView);
  const {view,hand,visible,fixedMelds,counts}=parsed;
  const result=context(parsed,opts);
  if (!view.capabilities.structuralScore) {
    result.limitations.push('structuralScore=false，不能宣稱具備正式向聽分析能力。');
    return result;
  }
  const discards=view.legalActions.filter(a=>a.kind==='discard');
  if (hand.length !== 17-3*fixedMelds || !discards.length) {
    result.limitations.push('目前沒有適用 17−3×固定面子數的合法捨牌動作，返回 unavailable。');
    return result;
  }
  const ranked=analyzeDiscards(hand,{visible,fixedMelds});
  const position=new Map(ranked.map((r,i)=>[r.tile,i]));
  const sorted=discards.map(a=>({action:a,tile:Number(a.tileIds[0].split(':')[1])}))
    .sort((a,b)=>position.get(a.tile)-position.get(b.tile) || a.action.actionId.localeCompare(b.action.actionId));
  const best=ranked[0];
  let simulated=0;
  const seenTiles=new Map();
  const opened=view.opponents.reduce((n,p)=>n+p.melds.filter(m=>m.open).length,0);
  for (let i=0;i<sorted.length;i++) {
    const {action,tile}=sorted[i];
    const r=ranked.find(item=>item.tile===tile);
    const after=[...hand]; after.splice(after.indexOf(tile),1);
    const visibleAfter=[...visible,tile]; // this exact physical discard is now publicly unavailable
    const nextCounts=knownTileCounts(after,visibleAfter);
    const shapes=structuralCandidates(after,nextCounts);
    const quality=shapes.taatsu.reduce((total,t)=>total+t.shapeQuality,0);
    let simulation=seenTiles.get(tile);
    if (!simulation && opts.samples > 0 && simulated < opts.maxSimulatedRoutes) {
      simulation=simulateTwoDraws(after,{visible:visibleAfter,fixedMelds,samples:opts.samples,
        seed:opts.seed+'|'+view.viewId+'|'+tile});
      seenTiles.set(tile,simulation); simulated++;
    }
    const metrics=[
      metric('postDiscardShanten',r.shanten,'shanten','exact','canonical.calculateShanten',view.ruleRef),
      metric('oneTurnEffectiveCopies',r.copies,'physical-copies','exact','canonical.analyzeDraws; known visible union',view.ruleRef),
      metric('oneTurnEffectiveKinds',r.kinds,'tile-types','exact','canonical.analyzeDraws',view.ruleRef),
      metric('knownVisibleCopies',counts.reduce((s,n)=>s+n,0),'physical-copies','exact','self hand + deduplicated public melds/rivers',view.ruleRef),
      metric('ukeireCostVsBest',best.copies-r.copies,'physical-copies','exact','canonical best copies minus candidate copies; only meaningful at equal shanten',view.ruleRef),
      metric('overlappingTaatsuQuality',quality,'candidate-points','heuristic','non-exclusive shape candidates: ryanmen=2, others=1',view.ruleRef),
      metric('opponentOpenMeldCount',opened,'melds','exact','visible open opponents melds',view.ruleRef),
      metric('twoTurnImprovementFrequency',simulation ? simulation.rate : null,'fraction',simulation ? 'estimated' : 'unknown',
        simulation ? SIMULATOR_VERSION+'; uniform unseen copies, fixed first-discard policy, not real wall odds' : 'not simulated',
        view.ruleRef,simulation ? {sampleSize:simulation.samples,interval:simulation.interval,calibrated:false}:{ }),
      metric('dealInRisk',null,'probability','unknown','no opponent danger model or calibrated training data',view.ruleRef),
      metric('expectedFans',null,'tai','unknown','verified scoring policy unavailable at Strategy PlayerView boundary',view.ruleRef),
    ];
    result.recommendations.push({
      actionId:action.actionId,rank:i,
      reasonCodes:['CANONICAL_SHANTEN','VISIBLE_UKEIRE','OVERLAPPING_TAATSU_HEURISTIC',
        ...(simulation ? ['CONDITIONAL_TWO_DRAW_SAMPLE']:[]),'UNCALIBRATED_DEFENSE','UNKNOWN_SCORING'],
      metrics,
    });
  }
  result.assumptions.push('捨牌優先序採 canonical 向聽小、進張副本多、進張種類多；不等於完整實戰唯一最佳解。');
  result.limitations.push('搭子候選可彼此重疊，不視為獨立最優拆解；未驗證計台與門清機會成本。');
  result.limitations.push('防守放槍率與台數未建模，輸出 unknown/null；公開牌河無法揭露對手暗牌。');
  if (view.legalActions.some(a=>claimKinds.has(a.kind))) result.limitations.push('吃碰槓只有合法性資訊，缺少經認證的規則與副露後 PlayerView，暫不做完整實戰排序。');
  if (simulated) {
    result.status='model-estimate'; result.modelVersion=SIMULATOR_VERSION;
    result.assumptions.push('兩巡樣本是假設剩餘不可見標準牌均勻、無放槍/副露/補花與他人干預之條件化情境，不是真實未來牌山。');
    result.limitations.push('兩巡僅前 '+simulated+' 種捨牌路線抽樣，各 '+opts.samples+' 次；其他路線標 unknown，未校準不能當實戰勝率。');
    result.evidenceRefs.push('simulation:'+SIMULATOR_VERSION+';seed:'+opts.seed);
  } else {
    result.status='heuristic';
    result.limitations.push('本次未進行兩巡模擬；僅提供 canonical 一巡牌效及候選搭子啟發式。');
  }
  return result;
}

/** Supplemental display DTO; never modifies canonical ranking or formal StrategyAnalysis. */
export function analyzeEfficiencyRoutes(playerView, options={}) {
  const parsed=readPlayerView(playerView), analysis=analyzePlayerView(playerView,options);
  if (!analysis.recommendations.length) return {analysis,routes:[]};
  const ranked=analyzeDiscards(parsed.hand,{visible:parsed.visible,fixedMelds:parsed.fixedMelds});
  return {analysis,routes:analysis.recommendations.map(rec=>{
    const a=parsed.view.legalActions.find(x=>x.actionId===rec.actionId);
    const tile=Number(a.tileIds[0].split(':')[1]);
    const after=[...parsed.hand];after.splice(after.indexOf(tile),1);
    return {
      actionId:a.actionId,discardTile:tile,
      canonical:ranked.find(r=>r.tile===tile),
      shapeCandidates:structuralCandidates(after,parsed.counts),
      remainingPoolAssumption:'physical 4 copies minus own concealed and observable public tile IDs',
      epistemic:{canonical:'exact',shape:'heuristic',twoTurn:rec.metrics.find(m=>m.name==='twoTurnImprovementFrequency').epistemic},
    };
  })};
}

/** Only confirmed legal actions can reach this interface; unavailable means no post-claim projection. */
export function inspectClaimOptions(playerView) {
  const {view}=readPlayerView(playerView);
  return view.legalActions.filter(a=>claimKinds.has(a.kind)).map(a=>({
    actionId:a.actionId,kind:a.kind,legalitySource:a.legalityBasis.engineVersion,
    status:'unavailable',
    factors:[
      {name:'postClaimShanten',value:null,epistemic:'unknown',reason:'requires projected post-claim concealed hand and phase'},
      {name:'scoringOpportunityCost',value:null,epistemic:'unknown',reason:'verified RuleProfile scoring policy unavailable'},
      {name:'discardRisk',value:null,epistemic:'unknown',reason:'no calibrated opponent model'},
    ],
    limitations:['僅確認此動作由 PlayerView.legalActions 提供；不代表值得副露或安全。'],
  }));
}

/** Visible pressure factors are qualitative signals, never percent risk. */
export function analyzeAttackDefense(playerView) {
  const {view,hand,visible,fixedMelds}=readPlayerView(playerView);
  const openMelds=view.opponents.reduce((sum,p)=>sum+p.melds.filter(m=>m.open).length,0);
  const ownShanten=view.capabilities.structuralScore
    ? (hand.length===17-3*fixedMelds
      ? Math.min(...analyzeDiscards(hand,{visible,fixedMelds}).map(x=>x.shanten))
      : analyzeDraws(hand,{visible,fixedMelds}).shanten) : null;
  return {
    openOpponentMelds:{value:openMelds,epistemic:'exact'},
    ownMinimumShanten:{value:ownShanten,epistemic:ownShanten===null?'unknown':'exact'},
    pressureHint:{value:openMelds>=2?'inspect-defense-tradeoff':'insufficient-public-evidence',epistemic:'heuristic'},
    dealInRisk:{value:null,epistemic:'unknown'},
    limitations:['公開副露數目不是放槍機率；牌河安全牌判斷須額外 verified 規則或統計。'],
  };
}

/** Human-readable explanation is downstream and NEVER rewrites exact metric values. */
export function explainStrategy(analysis, playerView) {
  const {view}=readPlayerView(playerView);
  if (analysis.contractVersion!==CONTRACT_VERSION || analysis.viewRef?.viewId!==view.viewId ||
      analysis.viewRef?.gameId!==view.gameId || analysis.viewRef?.asOfEventSeq!==view.asOfEventSeq ||
      analysis.viewRef?.audienceSeat!==view.audienceSeat) throw new RangeError('解說對應的 PlayerView 不符');
  const ids=new Set(view.legalActions.map(a=>a.actionId));
  if (analysis.recommendations.some(r=>!ids.has(r.actionId))) throw new RangeError('不能解說非法 actionId');
  return analysis.recommendations.map(r=>{
    const evidence=r.metrics.filter(m=>m.epistemic==='exact');
    const speculative=r.metrics.filter(m=>m.epistemic==='heuristic'||m.epistemic==='estimated');
    const unknown=r.metrics.filter(m=>m.epistemic==='unknown');
    const alternatives=analysis.recommendations.filter(x=>x.actionId!==r.actionId).slice(0,3).map(x=>x.actionId);
    return {
      actionId:r.actionId,rank:r.rank,reasonCodes:[...r.reasonCodes],
      evidence,conditionalEstimates:speculative,unknownInformation:unknown,
      alternatives,assumptions:[...analysis.assumptions],
      riskAndCost:['放槍率、台數及未來牆牌不可確認','與最佳捨牌的進張差距僅按 canonical 指標比較'],
      limitations:[...analysis.limitations],
    };
  });
}


/**
 * Compare TWO Rules Engine public PlayerView projections for a claim event.
 * This is structural evidence conditional on an externally verified transition,
 * never an independent confirmation of claim legality or full-game optimality.
 */
export function compareClaimProjections(beforeView, afterView, actionId) {
  const before=readPlayerView(beforeView), after=readPlayerView(afterView);
  const a=before.view.legalActions.find(x=>x.actionId===actionId && claimKinds.has(x.kind));
  if (!a) throw new RangeError('副露動作不在 before PlayerView 合法清單');
  if (before.view.gameId!==after.view.gameId ||
      before.view.ruleRef.profileId!==after.view.ruleRef.profileId ||
      before.view.ruleRef.ruleVersion!==after.view.ruleRef.ruleVersion ||
      before.view.audienceSeat!==after.view.audienceSeat ||
      before.view.round.roundId!==after.view.round.roundId ||
      after.view.asOfEventSeq<=before.view.asOfEventSeq) {
    throw new RangeError('副露前後視角或事件時間不一致');
  }
  const evidence=after.view.publicEvents.find(e=>e.causedByActionId===actionId && ['claim','kong'].includes(e.type));
  if (!evidence) return {
    actionId,kind:a.kind,status:'unavailable',
    limitations:['缺少公開 claim/kong 事件關聯；不能相信任意傳入的後續手牌就是此動作結果。'],
  };
  const added=after.view.self.melds.filter(m=>m.tileIds.every(id=>a.tileIds.includes(id)) && m.tileIds.length===a.tileIds.length);
  if (after.fixedMelds!==before.fixedMelds+1 || added.length!==1) return {
    actionId,kind:a.kind,status:'unavailable',
    limitations:['副露後的公開面子無法與指定 legalAction physical IDs 核對。'],
  };
  if (!before.view.capabilities.structuralScore || !after.view.capabilities.structuralScore ||
      before.hand.length!==16-3*before.fixedMelds ||
      after.hand.length!==17-3*after.fixedMelds) return {
    actionId,kind:a.kind,status:'unavailable',
    limitations:['副露前後有效暗牌張數或 canonical structuralScore 能力不符合本介面。'],
  };
  const postLegal=new Set(after.view.legalActions.filter(x=>x.kind==='discard')
    .map(x=>Number(x.tileIds[0].split(':')[1])));
  const postRanks=analyzeDiscards(after.hand,{visible:after.visible,fixedMelds:after.fixedMelds})
    .filter(x=>postLegal.has(x.tile));
  if (!postRanks.length) return {
    actionId,kind:a.kind,status:'unavailable',
    limitations:['副露後沒有可確認的合法捨牌；不會建議未宣告 legalAction 的出牌。'],
  };
  const initial=analyzeDraws(before.hand,{visible:before.visible,fixedMelds:before.fixedMelds});
  const post=postRanks[0];
  const wasClosed=before.view.self.melds.every(m=>!m.open);
  const remainsClosed=after.view.self.melds.every(m=>!m.open);
  return {
    actionId,kind:a.kind,status:'exact-structural',
    evidenceEventId:evidence.eventId,
    before:{shanten:initial.shanten,effectiveCopies:initial.copies,effectiveKinds:initial.kinds,
      shapeCandidates:structuralCandidates(before.hand,before.counts)},
    afterBestLegalDiscard:{tile:post.tile,shanten:post.shanten,effectiveCopies:post.copies,
      effectiveKinds:post.kinds,shapeCandidates:structuralCandidates(after.hand,after.counts)},
    structuralClosureLost:wasClosed && !remainsClosed,
    epistemic:{shanten:'exact',effectiveCopies:'exact',closure:'exact',shapeCandidates:'heuristic',
      scoringOpportunityCost:'unknown',fullGameOptimality:'unknown'},
    limitations:[
      'before 為副露前等待階段，after 為副露後合法捨牌的最優結構路線，階段不同，不能把差值直接當勝率或策略價值。',
      '公開 event 證明關聯，但跨局規則與事件有效性仍由 Rules Engine 驗證；本函式不重播 GameState。',
      '失去門清僅是公開結構狀態；台數、過水、吃碰槓優先權與風險仍未知。',
    ],
  };
}
