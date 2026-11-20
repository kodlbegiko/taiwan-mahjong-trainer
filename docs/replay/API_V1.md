# Taiwan Mahjong Master Academy — Replay & Decision Coaching API V1

Implementation branch: `feat/tw16-replay-coach`  
Current PR base: `integration/mahjong-full-game` (R3 experimental Rules dependency)  
Historical source baseline: `integration/mahjong-academy` @ `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`  
Contract: `master-academy/1.0.0`.

## Scope and release honesty

This module preserves the historical Sandbox replay and now supports the real experimental R3 **single-hand full-round** ledger: deal, flower replacement, draw, discard, private multi-responder claim, chi/pong/kong, win, exhaustive draw and settlement. Every GameState is reconstructed using the Rules Engine's canonical `replayGame`, including **atomic multi-Event LegalAction boundaries**. Random access to a partial `win + settle` or `pass + claim-resolution` transition is rejected as `NON_ATOMIC_EVENT_SEQ`.

R3 `tw16-configurable-table@experimental-full-v1` is **not certified**, so completed R3 replays use `completionStatus: 'settled-experimental'`, not `settled-verified`. Unfinished games remain `incomplete`. The inherited Sandbox remains `incomplete` and never enables postgame disclosure. There is no official Taiwan-wide verified scoring or win-rate model.

Existing Academy scenario scorer registry has `VERIFIED_SCENARIO_SCORER_COUNT = 0`. Consequently all generated replay situations are `unscorable`, and no replay-derived finding enters the Adaptive scoring store. Exactly measured shanten/ukeire differences can be displayed, but they **do not establish an unequivocally bad discard** because score, defense and opponent decisions have no validated model.

The Replay module does not edit `src/rules/**`, `src/strategy/**`, `src/academy/**`, `src/adaptive/**`, the v3 DecisionRecord or any UI/PWA file.

## Internal-only archive and integrity

`createReplayArchive(GameState, { ownerSeat })` and `validateReplayArchive(archive)` in `src/replay/internal.js`:

- `ReplayManifest`: versioned `ruleRef` and full RuleProfile snapshot, `gameRef`, internal-only `initialSeed` and `initialSeedRef`, `roundConfig`, `dealerSeat`, replay/Rules/Strategy/scoring versions, `eventCount`, `actionCount`, strict completion status, `settlementResultRef` and checksum, `disclosurePolicy`, and corruption checksums. R3 private fixture deck remains only inside internal TurnEvents. Older Sandbox archives keep their V1 format.
- `ReplayEvent`: versioned immutable TurnEvent entry with full internal event payload and monotonic `seq`.
- `PlayerDecision`: versioned `eventSeq` (first event), `endEventSeq` (last event), `beforeEventSeq` (last atomic boundary), `actorSeat`, `actionId` and actual LegalAction kind. For legacy Sandbox, one event remains one action.
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

`createReplayService` exposes `apiVersion = tw16-replay-api/1.0.0`. All returned DTOs include `schemaVersion:1`, `contractVersion`, and their own type-specific version. The Replay service reads/writes only (no v3, Academy or Adaptive mutation):

- `tw-mahjong-replay:index:v1`
- `tw-mahjong-replay:archive:v1:<replayId>`

It never modifies legacy `archive:v3` or the Academy Adaptive sidecar. Saving the same ID with changed events is rejected. The index is written after the archive; a storage interruption may leave an unindexed archive requiring future recovery tooling, never an invented successful score. A browser persistence instance should be passed explicitly; the default in-memory Map is per service instance.

| API | Access | Return / limitation |
|---|---|---|
| API | Access | Return / limitation |
|---|---|---|
| `listReplays()` / `loadReplay(id)` | Owner-local store | Seed-free safe manifest; R3 reports exact experimental status and disclosure policy |
| `getReplayFrame(id,seq,{viewerSeat,perspective})` | Archived owner only | Historical Rules PlayerView at a complete event-group boundary; `postgame` appends only separately authorized public settlement information |
| `getPlayerDecision(id,seq,{viewerSeat})` | Only archived owner's own actions | Recorded `actionId`, start/end seq, original legal action IDs and source view; accepts action-start or end seq |
| `getDecisionAnalysis(id,seq,{viewerSeat,actionId})` | Archived owner only | Formal StrategyAnalysis exact discard shanten/ukeire when available; claim/pass/kong/win/flower get legal-only advisory alternatives with typed unknown risk/scoring |
| `listCoachingFindings(id)` | Owner | Advisory exact metric comparisons for eligible discards, never official errors or abilities |
| `createReviewQuestion(id,seq)` | Owner, supported discard only | `unscorable` PlayerView snapshot, not an Academy exam |

`ReplayError.code` examples: `INVALID_REPLAY_ID`, `REPLAY_NOT_FOUND`, `CORRUPT_REPLAY`, `UNKNOWN_RULE_PROFILE`, `INVALID_EVENT_SEQ`, `VIEW_FORBIDDEN`, `POSTGAME_UNAVAILABLE`, `DECISION_NOT_FOUND`, `INVALID_ACTION_ID`, `UNVERIFIED_SCORER`, `STORAGE_WRITE_FAILED`. Callers must handle these explicitly, not silently replace invalid data.

## Information-boundary guarantees

A frame with `asOfEventSeq=N` replays exactly events 1..N, where N must be an **atomic Rules action-group boundary**; it returns only the archived owner's **own** concealed tiles, public rivers/melds and legal actions. Opponent concealed information is counts only; draw TurnEvents use the Rules redacted `publicEvents` projection. A later frame, the future event ledger and the wall are never consulted by the Strategy evaluator for a preceding choice.

**Postgame disclosure:** saving a settled R3 game requires the explicit option `disclosurePolicy:'settled-public-only'` to expose a separate final settlement summary (reason, winner seat, zero-sum point deltas and experimental tai where available). This does **not** authorize opponent concealed hands, claim intentions, fixture deck, live/tail wall or Seed. The historical PlayerView is identical in `player-at-time` and `postgame` calls. The extra public outcome has an end-of-hand watermark and `allowedForDecisionScoring:false`; it must never be supplied to the original StrategyAnalysis. Default `disclosurePolicy:'none'`, unfinished games, Sandbox and invalid policy requests all **fail closed**. R3 experimental outcomes are never labeled certified.

**Replacement caveat:** while a concealed flower awaits replacement, the Rules PlayerView is authoritative, but Strategy V1's standard-only tile parser cannot evaluate it; Replay retains that Rules view and returns legal-only/unknown coaching instead of mutating the Strategy contract or manufacturing a score.

## Adaptive and Academy integration policy

`src/scenario/index.js` creates unscored PlayerView-snapshot practice drafts. The separate `prepareVerifiedAdaptiveEvidence({record,question,finding})` accepts **only** an official `validateAcademyDecisionRecord`-verified Academy scenario record with matching original view, decision, SkillTags and scorer provenance. As of this version, no official fixture is registered, so this path fails closed. It cannot mutate `src/adaptive/**` or call legacy `DecisionRecord v3` on scenario data.

For future integration, the Academy must first publish versioned, independently validated scenario fixtures and a scorer; an integrator must authenticate the gameplay source, persist the official Academy V1 record in its own sidecar, and apply `evidenceId` as a **unique transactional idempotency key**. Replaying the same match, refreshing or rescoring the same `recordRef` must never increase AbilityProfile evidence counts. Formally validated findings should be separate from advisory structural-disadvantage findings.

## R4 atomic boundaries and unsupported hand archiving

`listReplayFrameBoundaries(replayId,{viewerSeat})` is owner-only and returns the legal, Rules-reconstructed initial deal/action-end event sequences in ascending order. Multi-event action interiors (e.g., final PASS + resolved claim, WIN + SETTLE) are excluded. Requesting one of those interior `eventSeq` values through `getReplayFrame` returns `NON_ATOMIC_EVENT_SEQ`; clients must not assume consecutive TurnEvent numbers imply legal frames.

`saveReplay(lastValidGameState,{ownerSeat,disclosurePolicy:'none',unsupportedSubmission})` optionally records a **verified** Rules failure after the last successful LegalAction. `unsupportedSubmission` must be the exact `{actorSeat,actionId,expectedRevision}` that was legal at that revision and then rejected by the formal Rules `applyAction` with a typed `RuleCapabilityError`, without mutating the state. Both archival write and readback independently reproduce this failed action. Incomplete, unsupported games **never** receive a SettlementResult or postgame disclosure.

The public manifest exposes `lastLegalRevision`, `interruptionStatus:'unsupported-rule-capability'` and a generic `unsupportedCapability.code='UNSUPPORTED_RULE_CAPABILITY'`; the private capability name and rejected LegalAction identity are **redacted** to avoid revealing still-private multi-seat WIN declarations. The canonical Seed87 `bot-r3-87 / fixed-round-87` intentionally ends at revision 162 after 157 accepted actions; the next legal PASS is rejected with the Rules-private `multiple_winners` capability and must never append an event or be labeled settled.

Full R4 fixture/test and consumer contract: `docs/replay/R4_ATOMICITY_AND_SEED87.md`, `tests/replay/r4-seed87-atomic.test.js`. A distinct counterfactual single-WIN test branch can settle and start the next hand, but never substitutes for the real failed Seed87 history.

## Quality tests and outstanding gates

Run `node --test tests/replay/*.test.js` and `npm run check` on **the exact latest PR head**. Original V1 Sandbox fixtures remain in `tests/replay/replay.test.js`. New `tests/replay/r3-full-round.test.js` covers R3 self-win and discard-win settlement, private concurrent claims and priority, chi/pong, concealed kong and tail replacement, initial flowers, deterministic exhaustion, atomic boundary rejection, player-scoped decisions, public-only postgame outcome, tampered ledger with recomputed checksums, and unchanged v3 persistence.

**Not claimed:** `settled-verified` for R3; certified multiwinner/rob-kong/complete regional tai; private postgame reveal; authoritative win/deal-in probabilities; verified scenario scorer; real Adaptive updates; UI or 3-Bot completion. The integration owner must wire the new Replay public APIs and verify the complete Phase 3 application before release. The R3 source Rules and Bot PRs must also pass their own independent gates.
