# R7.1 Academy assessment delivery and release matrix

## Status and authority
Baseline PR #47 at `f2cc6e3`: Verify and Master Academy combined workflows both SUCCESS (runs 45228529587 and 45228529370). R7.1 adds a separate versioned assessment implementation, **not** an automatic release or verified strategy certification.

- Original 20 lessons, 100 canonical v3 questions, 12 published / 8 validated remain unchanged. The legacy direct scored-tag intersection remains 10/20; no old question IDs, seed, lesson version, archive or score is altered.
- New 20 lesson teaching supplements and 27 playable assessment definitions: 15 exact-objective questions, 12 explicitly conditional / information-boundary questions. All 20 lessons now have at least one targeted practice question. This is **20/20 practice availability, 15/20 with an exact-objective question, NOT 20/20 formal skill certification**.
- Four missing published target skills (L1-01, L1-02, L1-03, L3-01) now have concrete targeted questions in the review bank. The prior formal objective-tag coverage is still 8/12 published and 2/8 validated until the record contract/review gates are met.
- Scorer version `academy-r71-assessment/1.0.0`, question version 1.0.0, lesson supplement version `academy-r71-lesson-plan/1.0.0`. Scorer actually evaluates each supplied choice and explains the result; preview grades are deliberately non-persistent, `officialCredit:false`, `recordRef:null`.
- 11 legal-action review bundles map directly to the existing scenario record contract, but are draft/unverified, not registered. 16 knowledge-choice questions cannot masquerade as Rules-issued action IDs. Existing AcademyDecisionRecord V1 is action-only; a contract amendment or explicit review and integration is required before official knowledge-choice records. No second grade database.
- No new runtime import from the production index or UI. This bank is accessible via direct module import; UI/Daily registration remains intentionally off pending review and integration.

## 20-lesson matrix

| Lesson | Existing status | Legacy target-tag assessed | R7.1 question keys (prefix academy-r71-) | New exact / conditional | Scope / remaining gate |
|---|---|---|---|---:|---|
| L1-01 牌種與數字索引 | published | No | tile-label | 1 / 0 | Actual public discard tile ID; independent content / record contract |
| L1-02 面子、搭子與將眼 | published | No | meld-class | 1 / 0 | Actual resolved CHI sequence; broader classification and review |
| L1-03 台灣十六張結構 | published | No | hand-shape | 1 / 0 | Complete five-meld-one-pair 17-tile fixture |
| L1-04 聽牌的必要條件 | published | Yes | winning-draw | 1 / 0 | Real 16-tile ready hand plus public discard |
| L2-01 向聽數的意義 | published | Yes | shanten | 1 / 0 | Exact canonical distance |
| L2-02 有效進張與孤張 | published | Yes | ukeire | 1 / 0 | Physical copy deduction |
| L2-03 何切的評分次序 | published | Yes | discard | 1 / 0 | All legal min-shanten/max-ukeire ties |
| L2-04 單面與多面聽 | published | Yes | wait-count | 1 / 0 | Count available winning tile types; broader hand coverage pending |
| L3-01 拆搭選擇 | published | No | structure-change | 1 / 0 | Fixed-meld structure after actual CHI; free-form decomposition rubric not certified |
| L3-02 牌型變化 | published | Yes | open-efficiency | 1 / 0 | Actual PONG then legal-only discard metrics |
| L3-03 一巡效率的精確範圍 | published | Yes | one-turn | 1 / 0 | Distinguish effective copies from probability |
| L3-04 接近最佳答案比較 | published | Yes | tie | 1 / 0 | Exact two-metric tie policy |
| L4-01 牌河是已知資訊 | validated | No | visible | 1 / 0 | Deduplicate claimed river tile and meld; independent fixture review |
| L4-02 公開副露不代表暗牌已知 | validated | No | chi, pong, kong, concealed-kong | 0 / 4 | Legal action identification under explicit goal; no strategy optimum, no added/rob-kong |
| L4-03 巡目與攻守的條件性 | validated | No | risk, public-river-policy | 0 / 2 | Public signal and stated filter only; no calibrated defense/risk or round-timing model |
| L4-04 台數和速度不可混用評分 | validated | No | tai | 0 / 1 | Understand missing information; verified scoring/utility still missing |
| L5-01 多因素但僅限可驗證結構 | validated | No | tradeoff, constrained-tradeoff | 0 / 2 | Explicit teaching objective, not actual strategic optimality |
| L5-02 限時答題不等於能力認證 | validated | Yes | speed, near-tie-metric | 1 / 1 | Exact structural metric; human calibration not available |
| L5-03 提出可重播的理由 | validated | Yes | evidence, evidence-shanten | 1 / 1 | Exact shanten and evidence recognition; free-text rubric not certified |
| L5-04 綜合測驗與未知因素 | validated | No | synthesis | 0 / 1 | Recognition of evidence limits, not a complete strategy challenge |
| Total | 12 published / 8 validated | 10/20 | 27 | 15 / 12 | No status promotion |

## Actual scorer and fixture contracts
`src/academy/r71-assessments.js`:
- `getR71LessonPlan(lessonId)` returns distinct teaching/practice material and unchanged prerequisites.
- `listR71QuestionRefs`, `getR71Question`, `gradeR71Question`, `validateR71Question`, `getR71Coverage`: versioned standalone API, strict public view / no answer before grading, explanation and evidence after grading.
- `buildR71ScenarioReviewBundle`: instructor-only, candidate question+fixture, verified=false, no digest fabricated, no formal record. Existing scenario registry remains empty.
- The private arranged 144-tile fixture is passed through public createGame APIs (not state mutation), legal applyAction transitions, validateGameState, replayGame, createPlayerView and strict readPlayerView. Scoring consumes only detached PlayerView and canonical structural calculations. Profile is tw16-configurable-table@experimental-full-v1, not certified Taiwanese rules. Rule and engine versions returned with each grade.
- CHI/PONG/KONG goals accept every matching Rules-issued physical action. Discard questions compare lowest shanten then maximum effective copies among legal options, preserving ties. Public-river exercises explicitly specify preference: a previously discarded tile type is NOT proved safe; risk and expected tai remain null. No strategy model, unknown risk, or experimental tai is used as a universal correct answer.

## Verification
At source SHA `d411cf6`, an isolated JavaScript loader executed the actual 19 GitHub source modules (ESM imports/exports adapted by a local loader, not Node/Chromium CI), built and replayed 27/27 questions, graded 222/222 legal or knowledge-choice options, checked snapshot readback, answer availability, privacy and no official credit. Observed 15 exact and 12 conditional questions. Regression fingerprints in the test pin these observed full public snapshots and grading outputs using noncryptographic FNV-style checksums; they detect drift, not authenticate data.

The full new Node suite, complete Daily/Adaptive regression, both 10k Oracles and real Chromium offline workflow must be checked on the final PR SHA. Do not treat the isolated execution as passing those gates. Original R7 CI is historical baseline only.

## Cross-owner handoff and release gates
- Rules #51, Scoring #52, Bot #48: comments request independent exact-SHA review; no response or approval assumed. PWA Agent 7 #50 notified of standalone module dependency graph and mandatory precache/cache version update before runtime integration.
- Before formal registration: review the exact action-based fixtures and hash canonical answer snapshots, agree record contract for knowledge-choice prompts, preserve archived versions, add controlled official Adaptive and UI routing, verify prerequisite and Daily/review semantics without duplicate credit, update SW graph and rerun real offline/new tab/reload tests. No published status change in R7.1.
- Remaining full objective assessment gaps: verified round-timing/defense, scored tai/utility tradeoffs, multi-factor strategy, human calibration, free-form explanation rubric, integrated mastery challenge. No claim of certified optimal strategy.

**Release decision: DRAFT / NO-GO for formal new scenario records or new published lessons. Instructor-review scorer and bank implemented.**
