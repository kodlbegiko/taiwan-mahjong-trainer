# R7.1 Rule Coverage Matrix — Taiwan 16-tile Phase 3 (experimental)

> This is a source-level and deterministic-test **engineering coverage** record, **not**
> certification of Taiwan-wide house rules. The three complete-table profiles
> remain `status: experimental`. R3/R5 contracts and their fixed-seed Golden
> cases must not change. Scoring, Bots, Replay, Academy and Table UI are NOT
> modified by R7.

## Profile boundaries

| Profile | Version | Added-kong robbery | Multiple legal discard WIN | Status |
| --- | --- | --- | --- | --- |
| `tw16-configurable-table` | `experimental-full-v1` | Disabled; immediate added kong | Typed `UNSUPPORTED_RULE_CAPABILITY: multiple_winners`, atomic | Unchanged, experimental |
| `tw16-single-winner-interception` | `experimental-v1` | Disabled; immediate added kong | One nearest-clockwise winner; intercepted declarations preserved | Unchanged R5, experimental |
| **`tw16-rob-added-kong`** | **`experimental-v1`** | **Opt-in WIN/PASS proposal window** | **Two or more WIN declarations remain typed UNSUPPORTED** | **New R7 experimental implementation, not integrated by default** |
| `tw16-four-player-sandbox` | `experimental-move-v1` | Unavailable | Unavailable | Unchanged legacy sandbox |

R7's profile explicitly sets `robAddedKong=true`, `robAddedKongSettlement='existing-minimal-discard-liability'`, `robAddedKongPriority='win-only-legacy-multiwinner-fail-closed'` and `verificationStatus='experimental'`.
It does not silently turn on robbery in either older complete-table profile.

## Feature coverage

| Rule/transition | R3/R5 | R7 opt-in | Evidence or unresolved edge |
| --- | --- | --- | --- |
| 144 physical cards, 17 dealer / 16 others, deterministic deal | Supported, experimental | Preserved | R3 fixture-deck and seeded tests |
| Ordinary draw/discard, turn and revision gate | Supported | Preserved | Action ID / revision validation; input is cloned |
| Initial flowers and flower chaining | Supported, experimental | Preserved | Tail replacement and private draw redaction; R7.1 chained kong→flower→flower→standard fixture; zero tail explicitly blocked |
| Chi only by next seat | Supported, experimental | Preserved | R3 chi Goldens, physical ownership validation |
| Pong, open kong; reaction order WIN > kong > pong > chi | Supported, experimental | Preserved for ordinary discard | Three private responses, deterministic resolution; R3/R5 Goldens and R7.1 permutations |
| Concealed kong and replacement | Supported, experimental | Preserved | R3 fixed-deck Golden, supplement from tail |
| Added kong without robbery | Supported, experimental | No: explicit proposal first | R3/R5 unchanged; R7 proposal and PASS-commit Golden |
| **Rob added kong** | **UNSUPPORTED by profile** | **Partially supported (one WIN)** | Three WIN/PASS-only replies; winning tile remains physically accounted in proposal river; existing scorer treats as discard liability. Rob-kong-specific tai is **not** calculated |
| Multiple WIN on one discard | Legacy: UNSUPPORTED; R5: single-winner interception | UNSUPPORTED | R5 Seed87 and 100-seed gates; R7 typed rejection |
| Multiple simultaneous robbers | UNSUPPORTED | **UNSUPPORTED, typed failure** | R7.1 two/three WIN declarations and six response orders; no arbitrary first winner |
| PASS win-lock | Supported, experimental | Preserved | Until next own discard; house variants intentionally not generalized |
| Live wall reaches reserved tail | Supported, experimental | Preserved | Zero-point exhaustive draw at configured reserve; R3 fixed Golden |
| Replacement tail fully exhausted | **Partial / policy unresolved** | **Unsupported, explicitly blocked** | Reachable 9-open-kong / 8-flower Golden; no legal replacement action, typed `replacement_tail_exhausted`, no fabricated settlement |
| Special hands, flower-only win, four kongs, dead-wall changes | Unsupported / house-dependent | Unsupported / house-dependent | Require distinct reviewed RuleProfile + Goldens |
| Dealer streak / round wind automatic progression | Partial | Partial | Only explicit next-round hand and dealer retention/rotation |
| Illegal action / duplicated tile / forged event | Validated | R7.1 fast proposal/reply/resolution linkage and forged-ledger rejection Goldens | `applyAction` clones before mutation; no partial authoritative update |
| Public PlayerView privacy | Supported | Proposal tile is public; private WIN/PASS remains masked | R7.1 redacts private trigger action IDs even in derived public results; existing public concealed-kong visibility is not changed |
| Full regional tai, rob-kong bonus, multiwinner payout | Unsupported | **UNSUPPORTED by minimal scorer** | Separate Scoring Agent contract required |

## R7.1 versioned public interface (for Scoring / Bot / Replay / Table UI review)

Normative wire/projection specification: [R7_PUBLIC_EVENT_CONTRACT_V1.md](./R7_PUBLIC_EVENT_CONTRACT_V1.md).

This proposal is **implemented in the opt-in Rules profile only**. Consumers must not
assume the new profile is supported without adapting their event handling.
No Scoring, Bot, Replay, Academy or UI module is changed by this PR.

1. The Rules-issued `ADDED_KONG` LegalAction is unchanged. Under the R7 profile it
   emits a new `TurnEvent` with `type:'kong_proposed'`,
   `visibility:'public'`, `actorSeat:declarer`,
   `payload:{kind:'ADDED_KONG',tileId:PhysicalTileId}`.
   The declarer's exposed triplet and owned fourth tile are **not mutated yet**.
2. The round enters `claim_window`. Three clockwise responders receive only
   `pass` and, where eligible, `win` with
   `legalityBasis.reasonCodes:['ROB_ADDED_KONG_WIN']`.
   Public claim summary **additively** includes
   `sourceKind:'rob-added-kong'`, `sourceEventId:<proposalEventId>`
   and `discardEventId:null`. Existing discard claim summaries are unchanged.
   `claimEventId` for R7 LegalActions refers to the proposal event.
3. WIN/PASS submissions are `seat-private`; public projections replace them
   with anonymous masked claim events permanently; only the outcome becomes public. R7.1 also omits the private final response action ID from derived public events. The host
   uses the same `listPendingClaimResponders` API.
4. Three PASSes append the committed public `kong` event with
   `payload.proposalEventId`, convert the triplet to kong, and enter
   `replacement` for a tail draw. The final PASS and kong event are one
   atomic action group.
5. A single winning claimant cancels the pending kong. The physical added tile
   leaves the declarer's concealed hand and is recorded in the declarer's
   **public proposal river**, linked to the `kong_proposed` event sequence.
   `win` and `settle` include
   `payload.robAddedKong:{proposalEventId,fromSeat,tileId}`;
   the terminal `extensions.tw16.result` contains the same marker.
   Scoring receives the **existing** `via:'discard'` and source/winner seats:
   *no new Scoring API parameter*. This is an accounting compatibility
   bridge, **not** verified rob-kong bonus tai or conventional discard semantics.
6. Two or three legal robbing WIN declarations cause
   `RuleCapabilityError('multiple_winners')` on the last submission, without
   modifying input state, creating winners, or inventing settlement.
7. There is no `status:'verified'` promotion. Scoring Agent should separately
   propose `ScoringProfile` treatment for rob-kong tai and liability; only
   after its explicit interface review should other agent modules opt into
   `tw16-rob-added-kong@experimental-v1`.

## Mandatory verification and NO-GO conditions

- `node --test tests/rules/*.test.js`
- `npm run check` — includes all prior R5 and Oracle tests.
- CI `Phase 3 Real Full-Match Acceptance`: 100-seed job must not regress.
- R7 fixed-deck Goldens for declared kong, one robber, no robber, hidden declarations, wrong actor, forged physical IDs, stale revision, two/three robbers, response-order permutations, atomic replay prefixes, kong-to-flower chains, and reachable empty replacement wall.
- The new projection contract is opt-in; R5 raw ledger, actions, and public projection remain pinned.
- Agent 3/4/5/1 acknowledgements and exact combined-head acceptance remain open. Source-owner CI is not evidence of R7 consumer compatibility.
- Check `base=integration/mahjong-full-game` and Draft PR.
- Do not merge or claim whole-game/regional-rule certification until verified
  across Scoring / Replay / Table UI adapters and their real-browser gates.

## Reference interpretation (not one canonical Taiwan rulebook)

- [Gogogame 16-tile rules](https://www.gogogame.com.tw/htm/rule_3000.html):
  17/16 dealing, replacement, and common reaction ordering; notes local variations.
- [Mahjong Orchid rules](https://mahjongorchid.com/zh-tw/rules/):
  added-kong robbery and related house-dependent rule differences.
- [TW16_TABLE_POLICY.md](./TW16_TABLE_POLICY.md) and
  [CLAIM_ARBITRATION_API.md](./CLAIM_ARBITRATION_API.md): pre-existing R3/R5
  fixture policies and typed multiwinner limitations.

These are comparative interpretations. The new R7 rules are experimental
**software policy**, not legal/official certification.
