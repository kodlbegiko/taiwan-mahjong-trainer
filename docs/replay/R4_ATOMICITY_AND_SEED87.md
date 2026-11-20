# R4 Replay — atomic action boundaries and Seed 87 unsupported recovery

**Owned in:** Replay PR #41, `feat/tw16-replay-coach`.  
**Source evidence:** Rules #43 `tests/rules/fixtures/seed-87-r4-trace.js`, Rules `replayGame` and `RuleCapabilityError`; Bot #40 sticky capability checkpoint.  
**Scope:** single-hand R3 experimental RuleProfile `tw16-configurable-table@experimental-full-v1`. Nothing here certifies comprehensive Taiwanese house rules or official scorer coverage.

## Authoritative event boundaries, not TurnEvent indices

`listReplayFrameBoundaries(replayId,{viewerSeat})` returns `[1, ...LegalAction.endEventSeq]` where the first item is the canonical `deal`, and later entries are the end of complete, contiguous action groups reconstructed using Rules `replayGame`. The list is sorted, deduplicated, frozen and owner-only.

A submitted LegalAction can append more than one TurnEvent. For example, a third PASS after competing claims can emit `pass + resolved claim`; the final WIN can emit `pass + win + settle`. A partial event prefix is never an eligible frame, even if its `eventSeq` exists and would look like an addressable index. `getReplayFrame` rejects it with `NON_ATOMIC_EVENT_SEQ`. The caller must **not** assume every `eventSeq = index + 1` is a valid player turn.

The Rules Engine alone produces `GameState` transitions and can replay the full seeded private ledger; Replay has no alternate reducer. `getReplayFrame` only emits the original seat-specific `createPlayerView` with public events redacted by Rules.

## Exact Seed 87: accepted prefix and denied 158th submission

Official Rules fixture: `tests/rules/fixtures/seed-87-r4-trace.js`, generated from a real Bot Action Trace.

- `gameId='bot-r3-87'`, `seed='fixed-round-87'`, private initial deck reconstructed by Rules.
- 157 **successful** `LegalAction` submissions; 162 complete `TurnEvent` entries. The start `deal` is event 1.
- The last public discard is at revision 160, seat 2, `t:26:0`. Seat 3 and seat 0 privately declare legal WIN at revisions 161 and 162.
- Seat 1's correctly issued PASS has `expectedRevision=162`, but resolving the two private WIN intents requires a **currently unsupported** `multiple_winners` settlement. Rules raises `RuleCapabilityError('multiple_winners')`. The state, event count and revision remain **162**.
- Hence `completionStatus='incomplete'`, `settlementResultRef=null`, `postgameAvailable=false`, and **there is no event 163**.

Replay accepts an optional, trusted, exact failed Rules submission through:

```js
const replay = createReplayService({storage:localStorage});
const manifest = replay.saveReplay(lastValidRulesState, {
  ownerSeat: 1,
  disclosurePolicy: 'none',
  unsupportedSubmission: {
    actorSeat: 1,
    actionId: lastLegalPass.actionId,
    expectedRevision: 162,
  },
});
const boundaries = replay.listReplayFrameBoundaries(manifest.replayId);
const frame = replay.getReplayFrame(manifest.replayId, 162, {viewerSeat:1});
```

On save and durable readback, Replay checks the exact submission against `listLegalActions` and **calls the official `applyAction`**. It accepts this metadata only when Rules throws `RuleCapabilityError / UNSUPPORTED_RULE_CAPABILITY` and the source state stays unchanged. A caller-supplied error string, forged action ID, stale revision, legal successful action or fabricated settled marker is rejected.

The private archive records the precise capability `multiple_winners` and exact failed submission as validation evidence; **public** manifest shows only `interruptionStatus:'unsupported-rule-capability'`, `lastLegalRevision:162`, and `unsupportedCapability:{code:'UNSUPPORTED_RULE_CAPABILITY',capability:'redacted-private-claim',...}`. The precise capability is withheld from PlayerView and public metadata because revealing it would disclose the existence of unpublished WIN intents. The event ledger remains private, including the Seed, wall, and raw claim payloads. Nothing from the private error path is fed into StrategyAnalysis.

Without `unsupportedSubmission`, an ordinary legitimate unfinished R3 round is still saved as `incomplete` with no unsupported marker. Existing archives and original Sandbox behavior are unchanged.

## Positive, independent settled branch (NOT a Seed87 repair)

`tests/replay/r4-seed87-atomic.test.js` also branches independently at revision 160: seat 3 WIN, seat 0 PASS, seat 1 PASS. This **different legal branch** completes via Rules and proves settlement, public-only opt-in disclosure, multi-event `pass + win + settle` atomicity, replay integrity, and a separately replayable `startNextRound` state with fresh Seed/gameId. This is neither a rewrite of the authentic Seed87 result nor an endorsed multiwinner policy.

## Security, scorer, and archive constraints

- Public historical frames must never contain opponent concealed tiles, private claim seats/IDs, RNG, future wall or events beyond `asOfEventSeq`.
- A `postgame` frame is permitted only for a truly settled R3 replay saved with `disclosurePolicy:'settled-public-only'`; the historical PlayerView is unchanged and the separately scoped settlement cannot be used for decision scoring.
- The current Strategy analysis only provides exact **structural** shanten and one-turn effective counts where applicable; risk and winning probabilities remain typed `unknown`/null. CoachingFinding is advisory, not an official error.
- All replay-originated scenarios remain `unscorable`. No direct Adaptive AbilityProfile updates or changes to v3 archives.
- FNV-1a checksums detect accidental/inconsistent changes but are **not a cryptographic authenticity guarantee**. An authenticated signer is required for proof against malicious replacement of a complete self-consistent private archive.
- Unknown future RuleProfiles and `settled-verified` status must fail closed until an independently certified implementation exists.

## Tests and release gate

Run `node --test tests/replay/*.test.js` and `npm run check` at one **exact** source SHA. The full repository's strict 100/100 full-match gate is deliberately expected to remain **RED** while Rules #43 intentionally rejects seed 87; do not modify that test or relabel it as passed merely to gain a green CI check.

AI 5 can consume `listReplayFrameBoundaries`, `getReplayFrame`, `getPlayerDecision` and owner-only `getDecisionAnalysis`; AI 6 should pin the exact latest Replay/Rules/Bot source SHA and verify all gates on the resulting integration SHA. Both must keep `settled-experimental` and `incomplete` semantically distinct.
