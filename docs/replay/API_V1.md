# Taiwan Mahjong Master Academy — Replay & Decision Coaching API V1

Implementation branch: `feat/tw16-replay-coach`  
Source baseline: `integration/mahjong-academy` @ `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`  
Target for Phase 3 (not yet created during implementation): `integration/mahjong-full-game`  
Contract: `master-academy/1.0.0`.

## Scope and release honesty

This module implements **genuine deterministic event-ledger replay and owner-only historical PlayerView** for the existing experimental Rules Engine. It is *not* a complete playable four-player Taiwanese mahjong round, a settlement replay, or a verified win/claim/scoring analysis. Current Rules offers only experimental `draw` and `discard` operations; an archive is always `completionStatus: "incomplete"`. The module intentionally refuses postgame omniscience.

Existing Academy scenario scorer registry has `VERIFIED_SCENARIO_SCORER_COUNT = 0`. Consequently all generated replay situations are `unscorable`, and no replay-derived finding enters the Adaptive scoring store. Exactly measured shanten/ukeire differences can be displayed, but they **do not establish an unequivocally bad discard** because score, defense and opponent decisions have no validated model.

The Replay module does not edit `src/rules/**`, `src/strategy/**`, `src/academy/**`, `src/adaptive/**`, the v3 DecisionRecord or any UI/PWA file.

## Internal-only archive and integrity

`createReplayArchive(GameState, { ownerSeat })` and `validateReplayArchive(archive)` in `src/replay/internal.js`:

- `ReplayManifest`: `schemaVersion`, `contractVersion`, `replayVersion = tw16-replay/1.0.0`, complete RuleProfile snapshot and `ruleRef`, `initialSeed`, `dealerSeat`, engine/strategy/scoring/decision versions, game status and corruption checksums.
- `ReplayEvent`: versioned immutable TurnEvent entry with full internal event payload and monotonic `seq`.
- `PlayerDecision`: versioned `eventSeq`, `beforeEventSeq`, `actorSeat`, `actionId` and action kind.
- `ReplayFrame`: derived **on demand** by seeded canonical replay to event N and Rules Engine `createPlayerView`; never by applying event payload as a trusted mutation.
- `DecisionAnalysis`: pinned to exact `viewId`, historical event, current engine/strategy versions, and `legalActionIds`; two-draw sampling forced off for deterministic exact comparisons.
- `CoachingFinding`: contains source replay/event/action, exact comparison evidence, skill tags, explicit heuristic-recommendation status, and `canCountAsWrong:false` / `canScheduleReview:false`.

Integrity verification checks canonical JSON digest for events, decisions and final state, replays all original events from seed via the authoritative Rules Engine, validates the resulting GameState, and compares its checksum. Merely changing a TurnEvent, `causedByActionId`, Seed, profile or event order is rejected even when an attacker recomputes simple digests (unless the entire underlying valid session is intentionally replaced). FNV-1a is **not a digital signature** and must not be described as cryptographic proof or tamper-proof storage. Cryptographic tamper resistance across untrusted hosts requires an authenticated signer and signature verification in a future architecture.

**SECURITY:** internal archives reveal private hands and future wall when combined with the seed. Store them in owner-private storage; never return an archive, raw TurnEvent ledger, Seed, or GameState through public APIs. For multiplayer, browser-local seed is not a cryptographic secrecy boundary.

## Public service

```js
import { createReplayService } from './src/replay/index.js';
import { createGame, listLegalActions, applyAction } from './src/rules/index.js';

const replay = createReplayService({ storage: localStorage }); // or Map in tests
let state = createGame({
  gameId:'sample-replay-01',
  seed:'sample-replay-seed',
  profileId:'tw16-four-player-sandbox',
  ruleVersion:'experimental-move-v1',
});
const seat = state.round.currentSeat;
const action = listLegalActions(state,seat)[0];
state = applyAction(state,{
  actorSeat:seat,actionId:action.actionId,expectedRevision:action.expectedRevision
}).state;

// Must be called by trusted archive owner; not with untrusted caller-supplied state.
const metadata = replay.saveReplay(state,{ownerSeat:0});
const summaries = replay.listReplays();
const replayMeta = replay.loadReplay(metadata.replayId);
const frame = replay.getReplayFrame(metadata.replayId,1);
const analysis = replay.getDecisionAnalysis(metadata.replayId,2);
const findings = replay.listCoachingFindings(metadata.replayId);
const scenario = replay.createReviewQuestion(metadata.replayId,2);
```

`createReplayService` exposes `apiVersion = tw16-replay-api/1.0.0`. All returned DTOs include `schemaVersion:1`, `contractVersion`, and their own type-specific version. The Replay service reads/writes only:

- `tw-mahjong-replay:index:v1`
- `tw-mahjong-replay:archive:v1:<replayId>`

It never modifies legacy `archive:v3` or the Academy Adaptive sidecar. Saving the same ID with changed events is rejected. The index is written after the archive; a storage interruption may leave an unindexed archive requiring future recovery tooling, never an invented successful score. A browser persistence instance should be passed explicitly; the default in-memory Map is per service instance.

| API | Access | Return / limitation |
|---|---|---|
| `listReplays()` | Owner-local store | Safe metadata array, no Seed/events |
| `loadReplay(replayId)` | Owner-local store | Public manifest only |
| `getReplayFrame(replayId,eventSeq,{viewerSeat,perspective})` | Only archived owner seat; `player-at-time` | Historic PlayerView, safe current public event, legal actions; refuses `postgame` |
| `getDecisionAnalysis(replayId,eventSeq,{viewerSeat,actionId})` | Only original owner decisions | All legal candidate analyses, exact shanten/ukeire deltas; unknown risk/scoring |
| `listCoachingFindings(replayId)` | Owner | Exact metric disadvantages labeled advisory, no unverified score |
| `createReviewQuestion(replayId,eventSeq)` | Owner, supported discard only | Safe, unscorable `tw16-replay-scenario/1.0.0` |

`ReplayError.code` examples: `INVALID_REPLAY_ID`, `REPLAY_NOT_FOUND`, `CORRUPT_REPLAY`, `UNKNOWN_RULE_PROFILE`, `INVALID_EVENT_SEQ`, `VIEW_FORBIDDEN`, `POSTGAME_UNAVAILABLE`, `DECISION_NOT_FOUND`, `INVALID_ACTION_ID`, `UNVERIFIED_SCORER`, `STORAGE_WRITE_FAILED`. Callers must handle these explicitly, not silently replace invalid data.

## Information-boundary guarantees

A frame with `asOfEventSeq=N` replays exactly events 1..N; it returns only the archived owner's **own** concealed tiles, public rivers/melds and legal actions. Opponent concealed information is counts only; draw TurnEvents use the Rules redacted `publicEvents` projection. A later frame, the future event ledger and the wall are never consulted by the Strategy evaluator for a preceding choice.

Postgame omniscient mode is unavailable until a *settled, verified* RuleProfile and an explicit, audited end-of-match disclosure policy exist. Even then, postgame revealed information may be for display and retrospective counterfactual study only: never used as an input to the original decision's `StrategyAnalysis` or official ability score.

## Adaptive and Academy integration policy

`src/scenario/index.js` creates unscored PlayerView-snapshot practice drafts. The separate `prepareVerifiedAdaptiveEvidence({record,question,finding})` accepts **only** an official `validateAcademyDecisionRecord`-verified Academy scenario record with matching original view, decision, SkillTags and scorer provenance. As of this version, no official fixture is registered, so this path fails closed. It cannot mutate `src/adaptive/**` or call legacy `DecisionRecord v3` on scenario data.

For future integration, the Academy must first publish versioned, independently validated scenario fixtures and a scorer; an integrator must authenticate the gameplay source, persist the official Academy V1 record in its own sidecar, and apply `evidenceId` as a **unique transactional idempotency key**. Replaying the same match, refreshing or rescoring the same `recordRef` must never increase AbilityProfile evidence counts. Formally validated findings should be separate from advisory structural-disadvantage findings.

## Quality tests

Run `node --test tests/replay/replay.test.js` and the repository's `npm run check`. Tests exercise deterministic seeded replay and random access, post-deal historical views, no future wall or opponent draw IDs, canonical tamper rejection even when checksums are refreshed, invalid action ID, invalid profile, owner scoping, Golden inferior-discard finding classification, unknown probability fields, unverified scorer rejection, persistent reopen, no duplicate saves and unchanged canonical v3 data.

**Blocked Phase 3 acceptance:** verified complete chi/pong/kong/flower/win/settlement actions, finished-game postgame disclosure, full scoring Golden fixtures, officially verified scenario scorer, Adaptive write integration, bot-driven end-to-end games, and production UI/PWA wiring. None of these may be declared complete by this PR.
