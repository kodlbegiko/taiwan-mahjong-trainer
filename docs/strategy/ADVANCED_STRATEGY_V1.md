# Advanced Strategy V1 — public-view-only API

Owner: src/strategy/**. Contract: master-academy/1.0.0.

## Usage

Import analyzePlayerView, analyzeEfficiencyRoutes, analyzeTaatsuCandidates, inspectClaimOptions, analyzeAttackDefense, and explainStrategy from src/strategy/index.js.

Call analyzePlayerView(playerView, { seed: 'repeatable-id', samples: 8, maxSimulatedRoutes: 3 }).

Never pass GameState, complete walls, opponents' concealed tiles, internal/private TurnEvents, future events, or answer keys. Inputs are validated against the public PlayerView schema, nested physical ID constraints, and rules references. Unknown schema versions and private fields fail closed.

## API

| Function | Purpose |
| --- | --- |
| analyzePlayerView | Formal StrategyAnalysis V1, exact canonical discard priorities and labelled heuristic/estimated/unknown metrics |
| analyzeEfficiencyRoutes | Canonical discard route, overlapping taatsu candidates and explicit assumptions |
| analyzeTaatsuCandidates | Ryanmen, kanchan, penchan, eye and isolated tile candidates; not a second shanten scorer |
| inspectClaimOptions | Only PlayerView-confirmed legal chi/pong/kong actions; post-claim impacts are unknown without a follow-up public projection |
| compareClaimProjections | Compares two public PlayerViews causally linked by a public claim/kong event, only after a verified legal claim; reports conditional exact structural changes and unknown scoring |
| analyzeAttackDefense | Exact visible public meld count / own shanten and qualitative pressure, never invented deal-in percentages |
| explainStrategy | Exact evidence, unknown information, alternatives, assumptions and risks; does not overwrite canonical |

The PlayerView contract does not provide a full verified RuleProfile with scoringPolicy. Therefore no tai/fan, settlement, post-claim shanten, claim priority or full-game optimality can be inferred.

## Epistemic classifications

| Metric | Class | Basis |
| --- | --- | --- |
| postDiscardShanten | exact | Existing canonical calculateShanten |
| oneTurnEffectiveCopies / oneTurnEffectiveKinds | exact | Shanten-reducing copies conditional on known physical tile inventory; NOT actual wall probability |
| knownVisibleCopies | exact | Self concealed plus distinct public melds/rivers (claimed river tile counted once) |
| ukeireCostVsBest | exact | Canonical effective copy difference; meaningful only at equal shanten |
| overlappingTaatsuQuality | heuristic | Overlapping pattern points, not a unique decomposition |
| twoTurnImprovementFrequency | estimated or unknown | Seeded hypothetical draws under a uniform unseen-pool assumption |
| dealInRisk / expectedFans | unknown (null) | No calibrated danger model or verified scoring |

## Two-draw simulation method

Version: public-unknown-draws/1.0.0.

1. Define all unseen standard physical copies from four copies per tile type minus own hand and already public meld/discard inventory.
2. Seed a deterministic xorshift32 sampler from the supplied seed, view ID, and discard tile.
3. Sample a first hypothetical own draw (without replacement).
4. Find a first discard among all distinct drawn-hand tile types by minimum canonical 16-tile shanten, with tile-code tie-break.
5. Sample a second own draw (without replacement). Count paths where canonical post-draw shanten is below the original post-discard shanten.

No actual wall order, private opponent hand, hidden events, opponent moves, claims, flowers, or scoring is observed. The metric is a *conditional sample frequency*, not a calibrated real-world winning probability. Sample size and approximate Wilson 95% sampling interval are reported, calibrated=false; the interval does not cover incorrect model assumptions.

Default 8 samples across at most three top-ranked discard types; 0 samples disables the model. Maximum 64 samples per action and 17 sampled routes. Non-simulated routes are unknown, not zero. PR / CI should test deterministic replay.

The module ranks discards by canonical shanten then effective copy count then effective tile kinds. Its complete overall status is model-estimate if sampling occurred, heuristic if only qualitative pattern metrics were included, and unavailable when structurally unsupported. Individual exact metrics stay exact even when overall status is model-estimate.

## Rule Engine integration seam

- Only PlayerView, produced by public-view projection, reaches Strategy; no import of src/rules internals.
- Each recommendation actionId must already appear in PlayerView.legalActions.
- Claims are not ranked; inspectClaimOptions returns unavailable because the authoritative after-action public hand, fully verified scoringPolicy, and claim restrictions are not present.
- A future Rule Engine adapter may provide projected after-action PlayerViews, with new privacy/semantic fixtures. Never relax the public event payload allowlist to arbitrary JSON without security review.
- The canonical efficiency API, existing graded exercises, archive versions and UI files are untouched.

## Test and release evidence

tests/strategy/strategy.test.js checks exact canonical alignment, public copy removal, seeded reproducibility, private wall/opponent hand rejection, action legality, unknown fan/risk, epistemic classification, physical-ID de-duplication and traceable explanations.

Run npm run check. Do not remove the two required independent oracle suites, tests/integration-oracle-10k.test.js and tests/adversarial-oracle-10k.test.js. Only a successful run at the final PR HEAD demonstrates passing gates.

## Explicitly not delivered

A real opponent model, calibrated deal-in risk, a verified complete Taiwanese house-rule profile, real wall order, validated fan/tai advice, full claim strategy, MCTS search, human efficacy evidence, or a Mahjong master bot.

## Conditional claim comparison

compareClaimProjections(beforePlayerView, afterPlayerView, claimActionId) requires the action in before.legalActions, the same game, rule and audience, a later after.asOfEventSeq, a public claim/kong event with causedByActionId, the physical IDs of the resulting exposed meld, and valid after-phase legal discard actions. It returns before-phase canonical shanten/ukeire and post-claim *best legal discard* canonical shanten/ukeire, plus structural closure loss, overlapping candidate shapes, and explicit epistemic classifications. As the phases differ, it deliberately does not turn these numbers into a winning probability, tai difference, or an automatic recommendation to claim. Real rule-validity, claims and events must first be verified by Rules Engine; these fixtures do not stand in for formal source rule evidence.

## Rules Engine PR #34 contract compatibility review

Reviewed the public PlayerView/LegalAction emitter on Rules Engine PR #34 (feat/mahjong-rule-engine at 6463132f039c28400f1b8816e683a90ddd77bc03) without editing that branch. The current experimental sandbox exposes only draw/discard as legal actions, structuralScore=true and roundActions=false. Its redacted deal event uses payload.countsBySeat, and its redacted private draw event uses payload.count=1 despite the public-event seq sometimes being greater than RoundState.lastPublicEventSeq. Those approved summaries are explicitly supported by this module; actual concealed draw tile IDs remain forbidden. Contract-specific fixture cases are in tests/strategy/strategy.test.js. This inspection is not a cross-branch runtime integration test. AI 6 should run a combined-sha smoke test with createPlayerView(...) directly before merging. No experimental claim/scoring actions from PR #34 are presented as available.
