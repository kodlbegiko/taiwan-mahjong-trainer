# Taiwanese 16-tile table rules — experimental, version-pinned implementation

## Scope and evidence boundary

This document describes **one explicitly configured, experimental table policy**, not the unique Taiwan-wide official Mahjong standard. The only pre-existing *verified* policy is the 16/17 concealed-hand five-meld-and-one-pair structural scorer. R3 adds an isolated **experimental** whole-table engine while preserving the original \`tw16-four-player-sandbox@experimental-move-v1\` for callers of the previous public API.

External reference points used for comparative interpretation (different sources **do not** establish a single authoritative policy):

- [Chinese Mahjong Competition League — competition rules](https://cml88.com/%E8%B3%BD%E4%BA%8B%E8%A6%8F%E5%89%87/): five melds plus pair, competition-specific pass-win restriction, flower and dead-wall rules, and game penalties.
- [Gogogame 16-tile game rules](https://www.gogogame.com.tw/htm/rule_3000.html): dealer 17, others 16, flower replacements, win > kong > pong > chi ordering, and explicit regional variation.
- [Mahjong Orchid detailed table rules](https://mahjongorchid.com/zh-tw/rules/): examples of non-universal added-kong robbery, allowed discarder for open kong, pass-win release and tai combinations.

These references differ on added-kong robbery, open-kong seating, flower-only winning, tail reserve, tai names/values and winner priority. The selected policy is a documented **fixture policy**, never promoted to \`verified\` merely by passing software unit tests.

## RuleProfile

\`tw16-configurable-table@experimental-full-v1\` is in \`src/rules/profiles.js\`:

| Dimension | Explicit experimental policy | Status |
| --- | --- | --- |
| Deck | 34 tile types × 4 + 8 uniquely coded flowers = 144 physical IDs | Contract structural inventory |
| Deal | 16 to each player, 17 to dealer; fixed seed with Fisher–Yates; sequential seed-deal order | Experimental dealing procedure |
| Flower | Flowers are identified outside 0..33, exposed and replaced from tail in fixed seat order | Experimental |
| Claim | 3-seat response window: win > open kong > pong > chi, nearest seat as tie-break | Experimental |
| Chi | Only first next seat may take a valid same-suit sequence; claimed tile type cannot be immediately discarded | Experimental |
| Pong | Two owned matching tiles plus public discarded matching tile; first discard required before any self kong | Experimental |
| Exposed kong | Three owned matching tiles plus a publicly discarded matching tile | Experimental |
| Concealed kong | Four owned matching tiles; this experimental profile publicly reveals all four identities | Experimental, visibility differs from some table practices |
| Added kong | Exposed triplet + one owned matching tile; **rob-added-kong disabled** | Experimental |
| Kong tail | Every kong yields a replacement draw from the tail; replacement flowers handled repeatedly | Experimental |
| Win | Canonical 16-tile five completed melds + a pair, using \`fixedMelds\`; self draw or discard | Structural gate exact; full gameplay experimental |
| Pass win | If eligible to win on a discard but electing any other action, block wins until the actor's own next discard | Experimental; variants differ |
| Exhaustive draw | When the live wall reaches 16 reserved tiles and all responses pass, declare no-winner settlement | Experimental |
| Winner count | One-winner settlement only; two or three simultaneous legal discard-WIN declarations are **UNSUPPORTED** (`multiple_winners`) and fail closed without adjudication or payout. Nearest-seat tie-break applies only where the supported claim kinds can be resolved. | Experimental / multiwinner unavailable |
| Next round | `startNextRound(previous,{gameId,seed})` initializes a separately replayable next hand, links previous game/revision and rotates or retains dealer | Experimental; **not** one continuous multi-round ledger |
| Special hands | Flower-only wins, seven-pair variants, and other non-five-meld hands **not implemented** | Unavailable |

\`RuleProfile.status='experimental'\` and the pinned \`extensions.tw16.housePolicyVersion\` are authoritative. The implementation refuses other profile IDs and incompatible rule versions. The original \`tw16-structural-verified\` remains strictly structural and does not gain a four-player verification label.

## State machine, ownership and replay

Public API remains:

\`\`\`js
import {
  createGame, validateGameState, createPlayerView, listLegalActions,
  applyAction, replayGame, getRuleProfile,
  scoreWinningHand, settleWin,
} from './src/rules/index.js';

let game=createGame({
  gameId:'table-1',seed:'replay-seed-1',
  profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1',
  dealerSeat:0,
});
validateGameState(game);
const view=createPlayerView(game,game.round.currentSeat);
const available=view.legalActions;
const action=available[0];
game=applyAction(game,{
  actorSeat:action.actorSeat,actionId:action.actionId,
  expectedRevision:action.expectedRevision,
}).state;
validateGameState(game);
const reconstructed=replayGame(game);
\`\`\`

Legal actions depend on phase. \`replacement\` offers \`replace_flower\` for exposed own flowers, otherwise a tail \`draw\` for a pending kong. \`await_discard\` offers only owned standard discards, structurally confirmed self-win, and owned concealed/added kong moves. \`claim_window\` offers own \`pass\`, structurally eligible discard-win, and matching chi/pong/open kong declarations. All three other seats must respond; declarations are first stored privately, then a single public resolution moves the claimed discard from the river into the meld. The river's \`claimedByEventId\` is **only a reference**, not a second physical owner. Winner and settlement transitions are atomic, even when one submitted action appends multiple events.

Internal state is versioned V1 with the pre-existing \`GameState\` core fields. Extra table state is namespaced under \`GameState.extensions.tw16\` and NEVER projected into PlayerView. PlayerView is an independently constructed allowlist. Its \`opponents[*]\` contains **no concealed hand**, and public event DTOs never reveal live/tail draws or hidden claim-intent tile IDs. Once a meld is resolved, tile identities in that meld are public in this explicitly configured profile. Public \`RoundState.scores\` is only emitted at a configured settlement, and is **abstract points**, not currency.

Replay regenerates the entire shuffled deal from the saved seed and compares each atomic action's appended event group including hidden event payloads. Replay is key-order independent, but not tolerant of changed values, action IDs, timestamps, event sequence, duplicate physical cards or missing ledger entries. Historical \`createPlayerView(state,seat,eventSeq)\` must request an **atomic action boundary**; a partial multi-event transition cannot be reconstructed as a stand-alone valid GameState.

## Minimal ScoringPolicy — **only three verified-by-test arithmetic components**

\`tw16-minimal-tai-v1\` under the experimental RuleProfile is deliberately **not** a comprehensive Taiwan tai catalogue.

| Rule ID | Condition | Tai in this experimental policy | Stack |
| --- | --- | --- | --- |
| \`concealed\` | No open meld; closed kong does not forfeit concealed status | 1 | With self-draw |
| \`self-draw\` | Winner draws a structural winning tile | 1 | With concealed |
| \`concealed-self-draw-bonus\` | Both previous conditions hold | 1 | Both are required |
| \`dealerInteractionTai\` | The winner or particular payer is the dealer | +1 for that pair | Per payment only |

Only these rules produce scored tai. Example Golden checks: concealed discard-win = 1 tai, concealed self-draw = 3 tai, opened self-draw = 1 tai. Their opposing cases and negative version conflicts are in \`tests/rules/complete-engine.test.js\`.

Current *abstract* payment formula per payer: \`100 + (winningTai + dealerInteractionTai) × 20\`. Self draw uses three payers; discard win uses the responsible discarder only. Sum of four deltas is zero. This is a demonstrator policy; it does NOT implement real-money stakes, dealer streaks, flowers, special hands, dragon/wind tai, hidden patterns, hard table limits or a complete payout liability model. Do not show it as fully verified Taiwan scoring.

## Gates R3-A / R3-B / R3-C

- **R3-A**: seeded 17/16 deal, flower tail replacement, actor+revision gating, real claim window decisions, chi, pong, open/closed/added kong transitions, wall/hand/meld conservation, full replay after each action.
- **R3-B (bounded)**: structural five-meld/eye win eligibility, pass-win lock, wall-exhaustive draw, explicitly minimal versioned tai arithmetic and zero-sum settlement; special hands/complete family tai/rob-kong policy unverified.
- **R3-C (bounded)**: old sandbox Golden tests retained, deterministic action-group replay, opponent concealed/wall physical swap (public view unchanged), bad action/forged hand/replay mutation rejection, canonical 10k independent Oracles unchanged.

\`npm run check\` must run at the exact PR head. CI passing this experimental table policy does not certify the complete R-01 gate or authorize its integration into a published academy player match without human table policy review.


## Golden fixtures, private security and next-hand boundary

\`tests/rules/complete-golden.test.js\` constructs a **valid physical 144-tile permutation** with explicit hands and wall ordering, but only in the experimental engine fixture API. The actual full permutation is recorded inside the **system-private** \`deal.payload.fixtureDeck\` and passed into deterministic replay as part of the saved event ledger. Public \`deal\` projection includes **only four starting hand counts**, never that permutation. Production games that omit \`fixtureDeck\` use the version-pinned shuffled Seed as usual. A fixture permutation is not cryptographically signed; if a malicious actor rewrites the private ledger **and** the full state consistently, the local offline replay validator is not an authenticated anti-cheat service.

These forced legal real-engine scenarios include:

- Dealer 5-meld/eye self-win with a complete zero-sum settlement and a new replayable dealer-retained hand.
- Discard-win (ron) with only the discarder paying; simultaneous win outranks a competing pong.
- Eligible win deliberately passed, then a different self-drawn matching tile cannot bypass the pass-win lock.
- Pong outranks next-seat chi regardless of declaration order.
- Concealed kong from four owned matching physical copies and a tail replacement draw.
- Exposed pong followed by the mandatory discard and next rotation, then an added kong using the last owned matching copy.
- Multi-action \`win + settle\` and \`pass + resolved claim\` are replayed as **one submitted LegalAction** producing a deterministic group of TurnEvents.
- Exhaustive live wall draw with exactly 16 tiles retained and zero-score settlement.

Every rule is limited to the explicitly versioned experimental table, not a blanket certification of other Taiwan house rules. RuleProfile changes that introduce unsupported configurations, including multiwinner and rob-kong, must fail closed until separate action/settlement logic and Golden cases are implemented.

The \`startNextRound\` API accepts only a previously **settled** hand, a **distinct gameId** and a **new explicit seed**. It increments \`round.handIndex\`, retains the dealer on self-win or drawn hand according to the pinned table policy, and otherwise rotates dealer. The new \`deal\` event persistently records \`previousRoundRef={gameId,roundId,revision}\`; each hand is independently replayable. A cryptographically authenticated cross-round match ledger, dealer streak tai, and annual/match score accumulation are outside this implementation.


## R4 correction: simultaneous WIN claims are a capability gap, not a nearest-seat win

The previous text incorrectly implied the engine implemented nearest-seat priority for multiple `WIN` declarations. In the actual `tw16-configurable-table@experimental-full-v1` implementation, **multiple legal discard winners cannot be settled**. The current `extensions.tw16.singleWinner=true` describes the only supported *terminal settlement* case; it must **not** be used to invalidate a second legal WIN intent or silently award one winner.

For a concrete reproducible negative Golden, see `tests/rules/r4-seed-87.test.js`. At Seed `fixed-round-87`, after Seat 2's discard `t:26:0`, Seat 3 and Seat 0 independently declare valid WIN, then Seat 1's valid PASS cannot close the transaction; the Rules engine returns `UNSUPPORTED_RULE_CAPABILITY` with `capability:'multiple_winners'`, preserving revision 162, original private decisions, physical tile conservation and replay.

Use the **public, static** `getRuleCapabilities({profileId,ruleVersion})` API for the current version's supported/unsupported capabilities; it never inspects the window and cannot leak private intents. No unsupported capability is automatically enabled by this change. An actual multiwinner rule needs a **new, distinctly versioned RuleProfile** with declared arbitration, score liability and event ownership, plus table-source-reviewed fixtures. See [R4 capability design](./CLAIM_ARBITRATION_API.md#r4--seed-87-multiwinner-capability-diagnosis-2026-11-20).

## R5 alternative single-winner interception — experimental

The pre-existing `tw16-configurable-table@experimental-full-v1` is immutable in meaning: multiple simultaneous discard WIN declarations remain **UNSUPPORTED** and fail closed. The new, separately versioned `tw16-single-winner-interception@experimental-v1` supports several *legal declarations*, but picks only one winning claimant after every responder answers. Interception priority follows the engine's authoritative clockwise successor `(seat+1)%4`, nearest from the discarder; WIN outranks open KONG, PONG and CHI. The winning discarder pays exactly once under existing `tw16-minimal-tai-v1` abstract zero-sum scoring. Intercepted WIN declarations are retained for audit/replay and do not become PASS.

This is a table-policy choice rather than a claim about all Taiwan 16-tile variants. Neither multi-*winner* settlement nor robbing an added kong, regional tai, venue-specific dealer penalties, special winning hands or official Academy scorer verification is implemented. See [R5 capability and additive `claimResolution` schema](CLAIM_ARBITRATION_API.md#r5-single-winner-interception-implemented-experimental).
