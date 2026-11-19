# Replay R3 — Full single-hand integration contract (experimental)

**Source PR:** #41 `feat/tw16-replay-coach`  
**Dependency:** Rules #43 `tw16-configurable-table@experimental-full-v1` / `rules-engine/0.2.0-experimental`  
**Integration:** #44 `integration/mahjong-full-game`  
**Release disposition:** DRAFT / NO-GO for certified Taiwanese play or official coaching scores.

## Rules-owned reconstruction

Replay uses `replayGame` from `src/rules/index.js` exclusively. It **does not** apply TurnEvents through a replay-specific reducer or infer a GameState from public deltas. Every archived action is reconstructed through the Rules engine, and the entire original private ledger is compared to its canonical output.

The Rules engine emits one or more `TurnEvent` entries for each submitted `LegalAction`. The Replay ledger groups **contiguous events sharing the original `causedByActionId`**. A `PlayerDecision` records the first `eventSeq`, the prior complete `beforeEventSeq` boundary, and its `endEventSeq`. Only `1` (deal) or a completed action group end can be requested as an R3 ReplayFrame. A request for an intermediate `win` before `settle` or an intermediate `pass` before `claim` is rejected with `NON_ATOMIC_EVENT_SEQ`.

The supported experimental private event types are: `deal`, `flower` (replace_flower), `draw` (live/tail), `discard`, `claim` (private chi/pong/kong/win intent, or public resolved meld), `pass`, `kong`, `win`, and `settle`. Initial dealing includes the start of hand. Claims are visible as originally projected by the Rules PlayerView; private tile IDs are not projected. `completeReplayGame` verifies every event and physical tile identity.

R3 accepts the original full private `GameState` only through the trusted `saveReplay` boundary and stores full Seed and fixture permutation in a **private local archive**. It publishes a strict allowlisted manifest and PlayerViews, not their private source objects. This is a local deterministic consistency check, **not authenticated anticheat** or a cryptographic signature.

## Status and disclosure policy

| State | RuleProfile status | Replay status | Public-only postgame |
|---|---|---|---|
| Sandbox, regardless of turn | experimental | `incomplete` | Forbidden |
| R3 active/claim/replacement | experimental | `incomplete` | Forbidden |
| R3 reached Rules settlement | experimental | `settled-experimental` | Only with explicit `settled-public-only` opt-in |
| Hypothetical future vetted game | independently verified | `settled-verified` | Not implemented or claimed |

For permitted R3 settled games, `getReplayFrame({perspective:'postgame'})` returns the **same exact historical own-seat PlayerView**, plus a separate `postgameDisclosure` containing the Rules settlement's public result (reason, winnerSeat, four abstract point deltas and experimental tai if available), final event watermark, and explicit withheld fields. It reveals **no opponent concealed hands, raw claim tiles, live/tail wall, full deck or Seed**. It is always marked `allowedForDecisionScoring:false`.

`settled-verified` is not issued by this implementation. The minimal tai fixture is experimental; no universally certified Taiwanese scoring policy exists.

## AI 5 — Table UI adapter

```js
import {createReplayService} from './src/replay/index.js';
const replay=createReplayService({storage:localStorage});

// Call from trusted game-session code with the canonical Rules GameState.
// Never pass a forged client-side pseudo-state to the archive constructor.
const meta=replay.saveReplay(completedRulesState,{
  ownerSeat:0,
  disclosurePolicy:'settled-public-only', // only settled R3; 'none' is safer default
});

const frame=replay.getReplayFrame(meta.replayId,1,{viewerSeat:0});
const decision=replay.getPlayerDecision(meta.replayId,2,{viewerSeat:0});
const analysis=replay.getDecisionAnalysis(meta.replayId,2,{viewerSeat:0});
const findings=replay.listCoachingFindings(meta.replayId);
const postgame=replay.getReplayFrame(meta.replayId,1,{
  viewerSeat:0,perspective:'postgame',
});
```

A frame for a non-boundary sequence throws. The UI should navigate **decision-group boundaries**, not assume a valid frame at each TurnEvent seq. The UI must keep `postgameDisclosure` separate from the historical decision pane; no postgame information may be fed into `getDecisionAnalysis`. Use `getPlayerDecision` only for the archived seat's own choices. Distinguish an experimental settlement in all labels.

The integration owner must connect real Rules/3-Bot session persistence, provide responsible storage isolation, and demonstrate full-game browser/PWA flows. Replay does not modify the Table UI or Service Worker.

## AI 6 — Adaptive / official scoring boundary

`DecisionAnalysis.analysisStatus='advisory-structural'` is available for qualified discards, with canonical exact shanten/one-turn ukeire metrics; claims, pass, kong, win and replacement are `advisory-legal-only`. All outcomes lack a verified full strategic scorer; defense probabilities, win rates and tai expectations are explicitly `unknown` / `null`. CoachingFinding is an advisory comparison and **cannot** be used as an official wrong answer.

`createReviewQuestion` returns a `status:'unscorable'`, `gradingMode:'none'` PlayerView snapshot and never increases AbilityProfile, ReviewPlan or a v3 record. `prepareVerifiedAdaptiveEvidence` accepts only a genuine `validateAcademyDecisionRecord` with an independently registered verified scenario fixture and exact source-view/RecordRef provenance. Because the Academy's verified scenario fixture registry is empty, the active path must fail closed. Future official updates require an independent scorer, durable readback and transactional idempotent evidence insertion by the Adaptive owner. This Replay PR does not perform those writes.

## QA and known limitations

`tests/replay/r3-full-round.test.js` exercises real Rules fixture decks: self draw win/settlement, discarder-paid win, contested multi-seat claim priority, group-atomic pass/resolve, exposed pong, concealed kong/replacement, initial flower replacement, exhaustion draw, randomly addressed completed frames, separate per-seat privacy, event tamper with recomputed checksums, and fail-closed official scorer. Existing Sandbox tests and legacy v3 storage checks remain intact.

Run `node --test tests/replay/*.test.js` and `npm run check` **on the precise PR #41 HEAD**. A prior green commit cannot certify new R3 behavior. An absence of current CI means **not yet verified**, not a pass. No complete real Taiwanese rules/scoring certification, bot-driven acceptance, production UI flow or private postgame reveal is implied.
