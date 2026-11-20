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
