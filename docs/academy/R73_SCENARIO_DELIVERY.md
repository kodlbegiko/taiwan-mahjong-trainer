# R7.3 Academy: registered exact scenario assessment and persistence

## Decision
DRAFT / source implementation available / integrated release NO-GO pending CI, independent review and composed offline acceptance. No promotion of a lesson status. This is formal **learning scoring** for explicit objective tasks in an exact frozen PlayerView under a named experimental table profile, not formal certification of all Taiwanese four-player rules or game-optimal policy.

## Curriculum acceptance matrix
Legacy mapping from the independently CI-verified R7/R7.1 baseline: 10/20 objective tags. Production registry adds five direct target tags; the proposed source-level formal scorer mapping is 15/20 (12/12 published, 3/8 validated). This is NOT student completion/mastery. Independent content approval and exact-head integration remain pending.

| Lesson | Original status | Legacy target scoring | R7.3 formal exact scenario ID (prefix academy-scenario-, @1.0.0) | Target coverage / remaining evidence |
|---|---|---|---|---|
| L1-01 | published | No | tile-identity | Yes: identify seven-wan, any physical copy accepted |
| L1-02 | published | No | meld-sequence | Yes: choose actual legal 4/5/6-wan sequence, all matching combinations accepted |
| L1-03 | published | No | hand16-win | Yes: complete five-meld/eye shape and Rules-issued WIN; no tai estimate |
| L1-04 | published | Yes | — | Yes: canonical v3 wait enumeration |
| L2-01 | published | Yes | — | Yes: canonical shanten |
| L2-02 | published | Yes | — | Yes: canonical effective copies |
| L2-03 | published | Yes | — | Yes: canonical discard |
| L2-04 | published | Yes | — | Yes: canonical multi-wait |
| L3-01 | published | No | structure-change | Yes: fixed-meld, legal-only minimum shanten and maximum ukeire, ties accepted |
| L3-02 | published | Yes | — | Yes: canonical structure metrics |
| L3-03 | published | Yes | — | Yes: canonical one-draw effective copies |
| L3-04 | published | Yes | — | Yes: canonical near-ties |
| L4-01 | validated | No | visible-count | Yes: deduplicated known physical copies; remains unpublished; available through lesson scenario path after prerequisites, excluded from published Daily |
| L4-02 | validated | No | — | NO: legal meld recognition is not evidence of optimal meld tradeoff (strategy.open-meld) |
| L4-03 | validated | No | — | NO: calibrated opponent/round timing and risk policy absent |
| L4-04 | validated | No | — | NO: independently accepted scoring profile and utility/tradeoff absent |
| L5-01 | validated | No | — | NO: multi-factor objective/decision policy beyond conditional examples |
| L5-02 | validated | Yes | — | Yes: legacy exact metric only; speed/human ability not calibrated |
| L5-03 | validated | Yes | — | Yes: legacy structural metric only; free-form explanation rubric not certified |
| L5-04 | validated | No | — | NO: integrated strategy assessment and independent expert calibration |

100 canonical structural questions remain byte-compatible; 27 R7.1 QA exercises remain separate and unregistered. Five new formal question IDs re-use independently recomputable frozen public fixture evidence; do not add preview counts to formal bank. Total 105 formal scored question versions; legacy lesson questionRefs and 1.0.0 completion gates remain intact; supplemental scenario refs are separate and cannot reset historical course completion. No knowledge-choice answer is disguised as a LegalAction.

## Source, scorer and authority
- Production: `src/academy/scenario-bank-v1.js` (five frozen public views), `scenario-scorers.js` (trusted registry, independent exact computation, per-option explanation), `records.js`, `questions.js`, `index.js`. Version `academy-exact-action/1.0.0`; fixture IDs bind question version; FNV-1a32 fingerprints pin source view, objective and all accepted action IDs. These noncryptographic fingerprints are drift checks, not signatures or server-side authentication. Full stored public question and record are compared against code-owned immutable registry data; the scorer recomputes accepted actions from that view. Client code remains inspectable.
- Source snapshots were produced via actual Rules createGame/applyAction, full validate/replay and readPlayerView from R7.1 at 0994b657; no production import of that QA module. No hidden wall/opponent hands. Rules version `tw16-configurable-table@experimental-full-v1`. Do not silently regenerate an old version after rules changes; new versions require new entries and retention of old frozen data.
- `legacy-v3` remains authoritative in archive:v3; `academy-v1` uses existing Adaptive sidecar academyRecords+academyQuestions only. Scenario record, snapshot and Daily session recordRef are committed together in one localStorage sidecar write. Derived AbilityProfile and ReviewPlan are separately rebuilt; failures are reported as partial/recovery-required, never synthetic saved. Identical IDs are idempotent; conflicting attempts, forged snapshots, stale versions and reused session records fail closed. No v3 rewrite or new score DB.
- Daily has explicit structural (default) or scenario mode, one existing session per local day, one ruleRef per session, published/unlocked questions only. Scenario mode uses existing locked Daily API; UI selects actual legal action ID. Direct Academy supplemental practice and review use Master façade and checked readback; original lesson v3 completion remains unchanged. Direct synchronous façade is single-context compatible, not a claim of cross-tab CAS; Daily uses the existing Web Locks protocol. 
- R7-008: only new runtime path is scenario-bank-v1.js, source-branch SW precache and cache version updated. QA-only content-audit.js, unpublished-guides.js and r71-assessments.js stay excluded. Integration must regenerate actual runtime graph; do not replace Agent 7's later SW lifecycle fixes with this older source-branch SW.

## Executed verification, separate from CI
Source code at 52a9363/78557e3/8a306f3 was actually loaded and executed through an isolated ES module adaptation (not native Node or browser).
- 5/5 registered questions, 87/87 legal choices scored and AcademyDecisionRecord validated; accepted counts 4,4,1,11,1 (21 total); score tampering rejected for every choice.
- Actual 32-module Academy + Adaptive Daily: fresh scenario session, saved wrong answer, academy-v1 durability proof, reload complete 1/1, ability evidence and review, next-day session, no v3 archive.
- Actual 32-module store: five distinct scenario question snapshots and five records saved with identical retries; all five corresponding tags rebuilt, five due review items; no v3/v1 write in fresh profile. Simulated write interruption after atomic raw commit recovered complete 1/1 with one evidence ref; four types of record/digest/question/version corruption refused and original corrupt bytes preserved.
- Actual 47-module Master façade: identical retry produces one record, conflicting choice under same ID rejected, locked lesson prerequisite rejected, ability and review proof available. Academy bridge and real HTML renderer start/select/save and review path succeeded with an asset URL adapter (isolate lacks browser URL; no scorer or persistence replacement). Not a browser DOM/physical device test.
- GitHub Actions R7.1 baseline 0994b657: 2/2 SUCCESS (45321274698, 45321274700). New source-head CI must independently run all triggered workflows. New native Node suite includes canonical-v3 byte preservation, all 87 options, duplicate and corrupt records, interrupted Daily recovery, no QA precache, 15/20 mapping. Combined Chromium gate now includes real Academy scenario submission, offline new tab and actual scenario Daily UI duplicate-click/reload. Do not claim CI green until exact HEAD results are inspected.

## Remaining release blockers
Independent Rules, Scoring, Strategy, Adaptive, UI, PWA and Agent 8 reviews; native Node and actual Chromium same-SHA CI; composed SW manifest/regression and real-device acceptance; remaining five target gaps above. No published change, no merge or release until review. 
