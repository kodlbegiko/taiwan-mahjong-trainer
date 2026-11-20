# R3 Claim Arbitration & Rules-host API — experimental

**RuleProfile:** `tw16-configurable-table@experimental-full-v1`  
**Engine:** `rules-engine/0.2.0-experimental`  
**Status:** EXPERIMENTAL. This is **not** a certified Taiwan 16-tile house rule, scoring or full-match release approval.

## Scope and authority

Rules is the **only** authority over `GameState`, revision, legal actions, wall, physical IDs, score and simultaneous claims. A Bot must receive only detached `createPlayerView(state, seat)` output. It must select one of the view's exact `legalActions` (including `actionId`, `actorSeat` and `expectedRevision`) and submit it via the host to `applyAction(state, submission)`. The host, not the Bot, owns the state and calls the scheduling APIs.

Exports from `src/rules/index.js`:

- `listPendingClaimResponders(state): Seat[]`. In `claim_window`, returns *unanswered* seats in clockwise order from the discarder. Otherwise returns `[]`. This is **host-only scheduling metadata**; never give the GameState to Bots.
- `getClaimWindowPublic(state): object | null`. Null unless there is an active window. Fields: `schemaVersion`, `contractVersion`, `discardEventId`, `fromSeat`, `responders` (all three eligible seats in fixed clockwise order), `pendingCount`, `claimPolicyVersion`, `status:'open'`, `expectedRevision`. This is a detached public **summary**, not a list of responses; it never exposes `decisions`, responded-seat identities, `kind`, tile choices or win intents.
- `createPlayerView(state, seat)`: complete R3 projection; its existing V1 allowlist and field shape are unchanged. A seat already answered has `legalActions:[]`; another pending seat receives only its own options and the redacted event ledger.
- `listLegalActions(state, seat)`: authoritative `LegalAction[]` for this seat and revision. A pending seat gets PASS and any allowed win/pong/kong/chi. No legal actions after its response, or after settlement.
- `applyAction(state, { actorSeat, actionId, expectedRevision })`: revalidates current state, actor, revision and exact action ID, returns `{state,event,events}`. It appends one private claim/PASS intent. The **third** valid response automatically resolves the window; no separate manual resolution is required or permitted.
- `RuleCapabilityError`: `RangeError` with `code:'UNSUPPORTED_RULE_CAPABILITY'` and `capability`. Simultaneous two win intents are currently fail-closed as `multiple_winners` and leave the input state untouched; no arbitrary tie-break or fabricated payment.

The original `tw16-four-player-sandbox` retains the old draw/discard behavior. The new scheduling helpers return `[]` and `null` on that profile and do not activate claim support.

## Claim lifecycle

1. Discard creates a `claim_window` containing source discard ID, source seat, physical discarded tile ID (Rules-private) and an empty private decision list. Exactly the other three seats may respond.
2. The Rules host asks `listPendingClaimResponders` which seats are still pending. It obtains `createPlayerView` **for the chosen seat**, checks that the submitted action is in `legalActions`, and calls `applyAction` with its expected revision. A human seat must be routed to a human; never silently synthesize a human PASS.
3. An answer increments `revision`, invalidating every previously issued action at the old revision. The host must **refresh** the next PlayerView before each response. Repeated responses, stale IDs and forged tiles fail closed.
4. All intermediate claim and PASS intents are `seat-private`. Their public ledger projection uses a generic `claim` event, no actor, no action ID and empty payload. PASS and PONG (and WIN) generate indistinguishable public state until resolution. The original private event ledger remains replayable by Rules.
5. The last response atomically resolves priority `win > kong > pong > chi`. With no claims, the next seat draws or the reserved-wall exhaustion is settled. Chi/PONG transition to the claimant's discard; open kong transitions to tail replacement. WIN settles at zero sum under **minimal experimental** scoring. When two seats submit win, `RuleCapabilityError('multiple_winners')` is thrown instead of settling with a guessed multiwinner rule.
6. A single early WIN does **not** disclose itself or truncate the window: doing so would leak a private claim and prevent another legitimate winner from declaring. Responses finish; lower-priority claims have no effect once WIN takes priority. `settled` accepts no further actions or settlement.

## AI 3 (Bot) integration, requiring a separate Bot-owned change

The current `src/bots/controller.js` explicitly returns `claim-adjudication-unavailable` whenever `view.round.phase === 'claim_window'`. **Rules APIs alone do not lift this Bot gate.** AI 3 should update its controller and tests **only** in Bot-owned files to use an authoritative host-side `getActingSeat` callback that chooses an unanswered seat using `listPendingClaimResponders`; it must allow `runBotTurn` to choose an action from the claimant's current `PlayerView.legalActions`. Do not pass the responder array, the private claim window, or `GameState` into the Bot policy. Where the first pending seat is human, return human-turn. Retry only with a fresh view/revision following another actor's successful submission.

**Additional cross-owner blocker:** the current `src/strategy/view.js` `readPlayerView` validator rejects flower `TileIdentity` in `self.concealed` and flower `PhysicalTileId` in a `replace_flower` legal action. R3 Rules correctly includes both in the view. AI 6 must coordinate an additive, explicitly reviewed Strategy/Bot adapter or validator contract extension. Do **not** strip flower identities from Rules PlayerView or silently cast them to one of 34 standard types; that would corrupt the V1 contract. Until this is repaired, do not claim an end-to-end three-Bot flower game passes.

## AI 6 (integration) gates

- Pin the new PR #43 **actual HEAD** only after the source checks succeed, then update the exact Rules blob/SHA in the Phase3 integration tree. Do not edit Rules files in PR #44 directly.
- Cross-test the PR #40 controller against an **authoritative** host wrapper invoking `listPendingClaimResponders`, `createPlayerView` and `applyAction`; do not infer an actor from `round.currentSeat` during `claim_window`.
- Run 4-seat seeded terminal simulations (including flowers and PASS), concurrent competing claims, win/draw, replay and all V1 Golden + both 10,000-hand Oracles against **one same SHA**. Exercise browser and installed PWA separately.
- Keep `FULL_RULES_GO`, `FULL_MATCH_GO`, `REPLAY_GO`, `PREVIEW_READY` and `RELEASE_GO` blocked until independently verified. Never change the RuleProfile to `verified` on the basis of this source PR alone.

## Uncertified variations and explicit limitations

Unsupported: robbery of added kong, simultaneous multiwinner settlement, flower-only/special hands, complete regional tai and penalties, complex late declaration/deadline policy, authenticated cross-client anti-cheat, tournament dealer/wind progression and verified real-device play. The current minimal scorer `tw16-minimal-tai-v1` uses abstract zero-sum points; it is **not a general Taiwan tai calculator**.

## Regression commands

```bash
node --test tests/rules/*.test.js
npm run check
```

The root `npm run check` already runs `node --test` and therefore preserves the two mandatory 10,000-hand Oracle suites. The added `tests/rules/claim-arbitration.test.js` exercises hidden-intent noninterference, stale and duplicate claims, typed unsupported multiwinner, four fixed-seed full round lifecycles, terminal zero sum and replay. Existing `tests/rules/complete-golden.test.js` continues to cover chi, pong, open/concealed/added kong, win, flower, collision and exhaustive-draw Golden fixtures.


## R4 — Seed 87 multiwinner capability diagnosis (2026-11-20)

### Verified reproduction (no Bot code modified here)

The full 157-action successful trace generated from Bot PR #40's actual Beginner policy is stored under `tests/rules/fixtures/seed-87-r4-trace.js` and re-executed by `tests/rules/r4-seed-87.test.js`.

- `gameId: bot-r3-87`, `seed: fixed-round-87`.
- At revision **160**, seat **2** discarded physical tile `t:26:0`.
- Seat **3** submitted Rules-issued `WIN` (160 → 161); seat **0** submitted a second Rules-issued `WIN` (161 → 162). Both are independently legal five-meld-and-eye discard-win intents under the current experimental structural checker.
- Seat **1** was the final pending responder; Rules issued only `PASS` with `expectedRevision:162`. Its attempted submission triggers `resolveClaim`, which cannot settle two winners under this explicitly unsupported profile.
- Original `RuleCapabilityError`: `name:'RuleCapabilityError'`, `code:'UNSUPPORTED_RULE_CAPABILITY'`, `capability:'multiple_winners'`. The source state is unchanged, at revision/events 162, with no fabricated `SettlementResult`; it validates and replays deterministically.
- **Classification:** not an illegal Bot action (A), nor evidence of a wrong win declaration or claim priority (C). The PASS is legal as a **response**, but completing its associated atomic arbitration is **unsupported** (B at transaction completion, D/E policy gap). Do not turn either winning declaration into PASS, pick an arbitrary winner, or classify this as exhaustive draw.

### R4 static RuleProfile capability query

`getRuleCapabilities(ruleRef)` is exported from `src/rules/index.js`. This takes **only** a public `{profileId,ruleVersion}`, not GameState, and always returns detached static metadata. It cannot reveal current claim actors, actual winners, concealed tiles, wall, private intents or outcome.

```js
import { getRuleCapabilities } from './src/rules/index.js';
const caps=getRuleCapabilities({
  profileId:'tw16-configurable-table',
  ruleVersion:'experimental-full-v1',
});
console.log(caps.claimArbitration.multipleDiscardWins);
// {status:'unsupported', capability:'multiple_winners'}
console.log(caps.claimArbitration.robAddedKong);
// {status:'unsupported', capability:'rob_added_kong'}
```

The R4 response also contains versioned `ruleRef`, `status:'experimental'`, `claimArbitration.responders:3`, `supportedActions`, `priority`, `singleDiscardWin:'experimental-supported'`, `unsupportedDisposition:'fail-closed-without-settlement'` and `scoring:{status:'experimental',policy:'tw16-minimal-tai-v1'}`. The old draw/discard-only sandbox returns `supportedActions:[]` and unsupported win capability. This is a **capability contract**, not a new RuleProfile version and does not change any legal winner selection.

### Future configurable settlement contract (PROPOSED ONLY, NOT IMPLEMENTED)

A future *distinct versioned profile* may support simultaneous winning claims only after an externally reviewed and version-pinned table policy defines all of:

1. `winMultiplicity.mode` and explicit behavior when two or three seats legally claim one discard; whether all win or a precisely ranked single claimant wins; which tie rules and deadline/cancellation semantics apply.
2. Payment matrix and dealer adjustments for every supported number of winners, negative deltas and discharger liability; require `sum(deltas) === 0` for every fixture, with no currency or unverified regional tai invented.
3. Physical winning tile ownership and event ledger semantics with multiple winners referring to one discarded physical ID without duplicate ownership; deterministic Action/replay and post-game disclosure.
4. Mandatory positive and negative Golden fixtures for all competing WIN/PASS/PONG/KONG/CHI combinations, zero-sum payoff, no double settlement, historical PlayerView redaction and fixed-seed replay.
5. A separate `ruleVersion`, explicitly declared scoring policy and version migration/replay compatibility approval.

Until these requirements are provided and tested, the current `tw16-configurable-table@experimental-full-v1` must **continue to reject** Seed 87 with `UNSUPPORTED_RULE_CAPABILITY / multiple_winners`, and Phase 3's 100/100 completion and release gate remain **NO-GO**.

### AI 3 and AI 6 boundary

**AI 3 (Bots):** `getRuleCapabilities(ruleRef)` may be read at initialization, but must not peek at `GameState`, inspect current opponent private claim intent, suppress a legitimate WIN, or change last PASS merely to bypass the capability block. Continue returning `{status:'unsupported',reason:'unsupported-rule-capability',capability:'multiple_winners'}` when Rules refuses the atomic settlement.

**AI 6 (Integrator):** pin the exact latest Rules PR #43 HEAD; preserve the original Seed 87 failure as an **expected, explicitly reported unsupported fixture**, not a successful terminal game. Keep the strict original 100/100 test gate; it cannot pass until a *separately approved* and tested multiwinner RuleProfile is implemented or a different explicit contractual acceptance criterion is authorized. Re-run combined Node, two 10k Oracles, browser/PWA and full-match replay at the same source SHA. Do not mark experimental profiles verified.
