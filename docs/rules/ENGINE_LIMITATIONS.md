# Rules Engine V1 — runnable structural inventory and experimental move sandbox

Contract: `master-academy/1.0.0` (`schemaVersion: 1`).

> **Historical sandbox scope only:** This document describes the original two Rules PR #34 profiles. New R3 profile `tw16-configurable-table@experimental-full-v1` has runnable **experimental** claims, flowers, wins, settlement and linked next-hand initialization. See [TW16_TABLE_POLICY.md](./TW16_TABLE_POLICY.md) for its separately version-pinned support matrix and limits. No complete profile is `verified`.

## Verification scope

| Capability | Profile | Status |
| --- | --- | --- |
| 0..33 standard tile types × 4, physical identity, 136-tile conservation, deterministic seeded shuffle | `tw16-structural-verified@structural-only-v1` | Structural fixtures verified |
| Concealed 16/17, 5 melds + 1 eye shape | `tw16-structural-verified@structural-only-v1` | Structural-only; existing canonical scorer remains authoritative |
| Four seats dealt 16 each + one extra to dealer | `tw16-four-player-sandbox@experimental-move-v1` | **Experimental fixture**, NOT externally verified game procedure |
| Discard own physical tile, rotate seat, draw next wall tile, immutable state and revision lock | `tw16-four-player-sandbox@experimental-move-v1` | **Experimental bounded subset** |
| Chi / pong / kong / pass / flower replacement / win / furiten / prioritization / exhaustive draw / score settlement | `tw16-structural-verified` and legacy `tw16-four-player-sandbox` only | **Unavailable in these two legacy profiles** |
| Flower inventory with explicit codes and copies | Original sandbox only | Inventory only in the sandbox; new **separate experimental R3 profile** supports flower replacement |

The V1 contract does NOT establish a complete official Taiwanese house-rules source.
No four-player RuleProfile in this implementation is marked `verified`.
The original draw/discard sandbox does not announce a winning hand, resolve collisions, handle exposed melds,
implement flower replacement or award points. After the wall is exhausted it provides
no draw or settlement action; callers must report the round as **unavailable/incomplete**,
not as a verified draw.

The experimental dealing implementation assigns 16 cards to each seat in seat order,
then one extra to the dealer, taking the front of a seeded deck. This is a deliberate
reproducible test protocol, **not** an assertion about real wall breaking, flower
replacement or actual dealer turn sequencing.

## Public Node/browser imports

```js
import {
  getRuleProfile, validateRuleProfile, createDeck, makeTileIdentity, typeOf,
  createGame, listLegalActions, applyAction, replayGame,
  createPlayerView, validateGameState,
} from './src/rules/index.js';

const structural = getRuleProfile('tw16-structural-verified', 'structural-only-v1');
validateRuleProfile(structural);
console.log(createDeck(structural).length); // 136
console.log(typeOf('t:27:3')); // 27

// Explicitly experimental. Never label the resulting four-player round verified.
let game = createGame({
  gameId: 'sample-001',
  seed: 'demo-seed-v1',
  profileId: 'tw16-four-player-sandbox',
  ruleVersion: 'experimental-move-v1',
  dealerSeat: 0,
});

const seat = game.round.currentSeat;
const view = createPlayerView(game, seat); // publish this, NEVER game
const choice = view.legalActions[0];
const { state, event } = applyAction(game, {
  actionId: choice.actionId,
  actorSeat: seat,
  expectedRevision: choice.expectedRevision,
});
game = state;

console.log(event.type); // discard
console.log(validateGameState(game)); // true, includes full deterministic replay
console.log(JSON.stringify(replayGame(game)) === JSON.stringify(game)); // true
```

### API contracts and fail-closed behaviors

- `createDeck(profile)`: physical-ID strings, with standard ID `t:<0..33>:<0..3>` and profile-gated `f:<code>:<copy>`; does **not** rename existing SVGs or pass flower IDs into `shanten`.
- `makeTileIdentity(id, profile?)` / `validateTileIdentity(identity,profile)`: V1 DTO identity checks.
- `shuffleDeck(deck, seed)`: independent deterministic `fnv1a-mulberry32-fisher-yates-v1`, with RNG counter. Intended for reproducible simulation, **not cryptographic secrecy**.
- `createRuleProfileRegistry`, `getRuleProfile(id,version)`, `validateRuleProfile`: explicit profile/version required for registry lookups; unknown versions rejected. Registry changes do not silently grant experimental four-player authority.
- `createGame(options)`: creates full **internal-only** GameState with seed, private wall, private hands, a `deal` TurnEvent and revision 1. The original profile is bounded; the new R3 profile is separately experimental (see linked policy).
- `listLegalActions(game,seat)`: **for the legacy sandbox** only `draw` and `discard` in the supported phase; returns [] for unsupported actors or when the wall has run out. `draw` never exposes the next tile.
- `applyAction(game,{actionId,actorSeat,expectedRevision})`: re-resolves legal actions from the authoritative state; rejects outdated revisions, illegal actor/phase, forged IDs and optional forged tileIds; returns an immutable `{state,event}`.
- `replayGame({gameId,seed|rng,ruleRef,dealerSeat|round,events})`: starts from seed and compares each canonical event to the submitted ledger, including its private payload. Never blindly patches state from recorded events.
- `validateGameState(game,{replay:true})`: **in the legacy sandbox** strict conservation, physical ID uniqueness, no unsupported melds/flowers/claims, event ordering, round phase and full replay. Set `replay:false` only for deliberately counterfactual private-state tests.
- `createPlayerView(game,seat,eventSeq?)` / `projectPlayerView`: independent allowlist DTO. The current seat's private hand, public river and public events only; opposing hands are counts; wall and RNG are excluded. Historical views reconstruct the appropriate earlier state. `capabilities.roundActions=false` means **no verified full-round rules**, even though the bounded sandbox offers draw/discard.

## Security, event visibility and limitations

`GameState` is internal only. The public UI and Strategy integration must receive
`PlayerView`, **never** a `GameState`, `TurnEvent` with private payload, or
a direct reference to the full game. Public `draw` events show only `{count:1}`
and system `deal` events show seat counts, without private identities.

The **engine must be the server-side/authority owner** when used for multiplayer:
a same-origin offline PWA cannot hide its downloaded JavaScript, a seed handed to
the client permits recomputing the wall, and a malicious client with direct access
to `GameState` is not stopped by a DTO projection. The tests prove that the
`PlayerView` representation itself leaks no physical wall/opponent identifiers,
not that local-device multiplayer is cryptographically secure.

External reviewers must supply documented house-rule text, Golden Fixtures and
a separately approved profile before **certifying** a new claim,
replacement draw, win, pass, exhaustive draw or settlement capability.
Any contract field change goes through the integration lead's amendment procedure.

## Tests and CI

```bash
node --test tests/rules/*.test.js
npm run check
```

`tests/rules/engine.test.js` covers deterministic Golden IDs, canonical seed,
four-seat conservation, revision/rules rejection, event replay, private-wall
permutations that preserve the public `PlayerView`, and property trials.
The root `npm run check` already executes `node --test`, so Rules Engine
tests are included without changing existing testing scripts or protected files.

## R5 one-winner policy distinction

The original `tw16-configurable-table@experimental-full-v1` rejects concurrent discard-win claims. A separate `tw16-single-winner-interception@experimental-v1` accepts concurrent legal WIN **intents** but resolves to a single nearest-clockwise winner; it is still experimental. It does **not** implement payment to multiple winners, added-kong robbery, regional scoring or certified real-table rules. The `claimResolution` metadata is additive for new-profile discard wins and requires cross-owner Phase 3 / Replay adaptation review. See `docs/rules/CLAIM_ARBITRATION_API.md`.
