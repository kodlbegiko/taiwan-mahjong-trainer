# TW16 R7.1 public event contract

**Version:** `tw16-rob-added-kong-public/1.0.0` · status: experimental · owner: Rules (#51).
**Negotiation:** `getRuleCapabilities({profileId:'tw16-rob-added-kong',ruleVersion:'experimental-v1'}).publicEventContractVersion` equals this identifier. Older profiles do not advertise it. The underlying V1 envelope (`schemaVersion:1`, `contractVersion:'master-academy/1.0.0'`) and raw event IDs/action IDs remain unchanged. The new public projection intentionally redacts private trigger action IDs. Do not enable this profile in a consumer solely because R5 passed.

## 1. Authority and state machine

Only the Rules-issued LegalAction (actorSeat, actionId, expectedRevision, optional exact tileIds) may advance GameState. Host schedules with `listPendingClaimResponders`; a Bot sees only its detached PlayerView, not that host function or GameState. All inputs are validated before cloning and each accepted action returns a new state plus its entire event group. Rejected submissions preserve the original state, revision and ledger. Full `replayGame` reconstructs from the initial authoritative deal and private action groups, not public events.

| Stage | Raw event(s), in order | State / physical ownership |
|---|---|---|
| Added-kong proposal | public `kong_proposed` | `claim_window`; exposed triplet unchanged, fourth copy still concealed by declarer but publicly identified |
| First / second reply | private `pass` or `claim` (kind win) | No tile transfer; remaining responders only |
| All three PASS | private final `pass` + public `kong` in one action | Upgrade triplet; fourth copy moves into meld; same declarer enters replacement |
| Exactly one WIN | private final reply + public `win` + public `settle` in one action | Triplet unchanged; fourth copy leaves declarer and is recorded in proposal river; winner settles under current minimal discard-liability bridge |
| Two or three WIN | last action rejected, no new event | Typed `UNSUPPORTED_RULE_CAPABILITY/multiple_winners`; original unresolved prefix remains replayable |
| Confirmed kong replacement | private `draw` from tail; if flower, private `flower` for each mandatory replacement | No discard until standard replacement; each replacement consumes exactly one tile |
| Mandatory replacement / empty tail | no legal action; attempt at current revision by active seat throws typed `replacement_tail_exhausted` | Preserve replacement state; no invented draw/settlement/penalty |

Ordinary discard windows keep WIN > open KONG > PONG > CHI and clockwise tie-breaks. R7 does NOT enable R5 interception or true multiwinner payout. A PASS on an available WIN activates the existing until-own-discard pass lock. A legal proposal can never be robbed as CHI/PONG/KONG. No changes to R3/R5 raw ledgers or projections. Empty replacement policy is intentionally unsupported, not a new local rule.

## 2. Wire contract (exact R7 forms)

All events include stable eventId, gameId, seq, ruleRef, schemaVersion, contractVersion, visibility and payload; previousEventId exists after deal. seq increments by one; state.revision equals event count. Public event views retain the event IDs and sequence but are NOT a private replay archive.

| Message | Raw payload | Public projection |
|---|---|---|
| kong_proposed | `{kind:'ADDED_KONG',tileId}`, actorSeat=declarer, causedByActionId=proposal action | Same public payload and declarer/action ID |
| private response | `{kind:'pass',claimEventId:proposalId}` or `{kind:'win',claimEventId:proposalId,tileIds:[tileId]}` | type='claim', payload={}, no actorSeat or causedByActionId; stays masked after resolution |
| committed kong | `{kind:'ADDED_KONG',tileIds:[tileId],proposalEventId:proposalId}`, actorSeat=declarer | Same payload; no private triggering causedByActionId |
| robbery win | `{via:'discard',sourceSeat,winnerSeat,robAddedKong:marker}` | `{seat:winnerSeat,sourceSeat,robAddedKong:marker}`; no private triggering causedByActionId |
| robbery settle | `{reason:'win',winnerSeat,tai,delta,robAddedKong:marker}` | `{robAddedKong:marker}`; public round.scores carries delta; no private triggering causedByActionId |

`marker = {proposalEventId,fromSeat,tileId}` (all required; exact field set). It must match the raw proposal, raw WIN, raw SETTLE, and authoritative result; sourceSeat=fromSeat. A robbed tile's public river entry is `{tileId,seq:proposal.seq}` — not an ordinary discard. A confirmed kong uses only the fourth physical ID in its event; reconstruct the other three from prior public pong and current meld. The raw final response action ID is retained on both derived raw events for replay; the R7 projection omits it on any public event derived from a private claim/PASS, including ordinary claims and exhaustive-draw resolution.

`getClaimWindowPublic(state)` returns the existing public summary plus `sourceKind:'rob-added-kong'`, `sourceEventId:proposalId`, `discardEventId:null` during a robbery window. It includes all three clockwise responder seats, pendingCount, claimPolicyVersion, status, expectedRevision. It does NOT reveal which seats have replied, reply kinds, or legal WIN candidates. A responding seat's LegalAction uses `claimEventId=proposalId`, kind 'pass' or 'win' and reason code `CLAIM_WINDOW_PASS` / `ROB_ADDED_KONG_WIN`; a WIN has the proposed tile ID, PASS has no tiles. Other seats have no legal actions. Do not synthesize any action.

## 3. PlayerView privacy and atomic replay

- Owner's concealed tiles, public melds/flowers/river and opponent concealed counts only. The proposal exposes one fourth copy to everyone; knownUnavailableTypes includes its type once all four physical copies are public/owned. Deduplicate by physical ID, including the proposal in the declarer's own hand. This does not reveal any other concealed tile or future wall.
- Existing public concealed-kong meld IDs and flower projections remain as implemented by the experimental house profile; alternate hidden-kong conventions require a separately reviewed policy. Draw events expose only count; flower events expose flower ID but not the replacement tile.
- Private response kinds, seats, tile choices and action IDs are never disclosed by anonymous response events or their derived public trigger IDs. Outcome winner/source and committed meld are public after arbitration; public legal actions are audience-specific. No raw RNG, seed, wall, fixture deck, opponent concealed hand, or private ledger is supplied to a Bot/UI.
- Raw ledger structural validation also checks proposal/reply action IDs, exact source links, unique responders, payload shapes, outcome order, and markers even at replay:false. Full replay additionally proves each issued action and physical ownership. A partial final multi-event group must be rejected; public history frames exist only at complete atomic action boundaries.
- The current raw engine uses the existing `via:'discard'` for robbery, not a conventional discarded tile. No new universal win type or liability policy is asserted.

## 4. Scoring Agent #52: factual handoff (not a scoring implementation)

Reviewed against `docs/scoring/RULES_EVENT_HANDOFF.md`, proposal schema and `src/scoring/adapter.js` at `202e007de599cd265b1b1b22d645d95914c311c1`. The current adapter requires ordinary discard provenance; for robbery that requirement is intentionally not satisfied. Agent 3 must negotiate R7 and validate the proposal chain before allowing its scorer. Do not insert a fabricated discard.

| Requested fact | Authoritative source / status | Required consumer action |
|---|---|---|
| winner/source/dealer/prevailing wind | raw WIN/SETTLE + round; prevailing east/south/west/north maps 27–30 | validate matching actor, round and ruleRef |
| seat wind | **Unavailable**: no actual opening/dice-seat alignment in current Rules | no inference from dealerSeat; absent fact must not earn seat-wind tai |
| dealer streak | **Unverified**: previousRoundRef links immediate prior hand only, handIndex not proof | require immutable complete continuing-dealer chain; do not infer from handIndex or assume zero for later hands |
| win type | self-draw / ordinary discard / rob-added-kong derived from via + validated marker | add explicit robbery type in adapter (proposal source, not discard); preserve legacy via |
| liability | existing minimal bridge only: source pays sole robber; R5 unchanged | no 包牌, reassignment, multiwinner, or bonus tai without distinct reviewed policy |
| winningTileId | authoritative result, proposal marker for robbery, ordinary discard event for discard win | self-draw initial/flower/deal provenance is not a certified special timing fact; no public self-draw tile disclosure |
| kong evidence | concealed/open: committed public kong; added: prior public pong + committed kong, linked proposal; robbed proposal is NOT completed kong | check physical IDs, event ordering, role, source seat, no double-count; only host/private settled state can supply concealed hand |
| replacement provenance | raw draw source tail/live, raw flower replacementTileId chain, preceding committed kong | public projection deliberately insufficient for exact replacement tile; host validate chain, no automatic bonus after flower |
| special hands, flower-only wins, wait role, heavenly/earthly timing | unsupported/unverified by current policy | fail closed when required; do not infer absence/award from incomplete evidence |

The Scoring Agent's proposed DTO requires seatWindType and dealerStreak; current R7 cannot truthfully emit a complete instance of that proposal. Treat the proposed namespace as absent, not zeros/defaults. Separate versioned scoring facts and settlement evidence require owner approval; no changes to Scoring files here.

## 5. Consumer acceptance handoff

- Agent 4 Bot #48: explicitly allow the exact R7 profile and version only after adapting both Bot and Strategy public event allowlists. Accept source proposal, marker and omitted private trigger action IDs; deduplicate proposed fourth copy when validating knownUnavailableTypes; only Rules-issued WIN/PASS in robbery; never consult private intent or raw GameState. Preserve all R5 Beginner decisions and Seed87 trace.
- Agent 5 Replay #46: whitelist exact R7 profile; archive raw event groups, not redacted projection; validate proposal/commit/robbed source, three distinct replies, marker consistency and source ownership; reject incomplete final groups or forged links. Robbed river seq refers to proposal, not discard. Validate SHA-256 of original raw ledger and deterministic replay; public historical frames must be redacted and atomic; typed unsupported prefix stays incomplete, never settled.
- Agent 1 Table UI #49: explicit opt-in only; show pending added kong separate from completed meld, identify public source tile, render only legal WIN/PASS, and show robbed outcome/source vs completed kong. Do not use private trigger ID or assume every claim source is a discard. Render empty mandatory replacement as unsupported (no fabricated action); use current revision and in-page acknowledgement. Test real HTTPS human+3 bots on combined exact source SHA. Do not enable R7 by default until these gates pass.
- Integrator #44: pin source HEADs; confirm all acknowledgements, test single combined checkout, preserve R5 100/100 and legacy Seed87 fail-closed. Rules-only green CI is not evidence of opt-in R7 end-to-end compatibility.

## 6. Evidence gates

Prior baseline `633d20faf7f9c305b8d972bd0e3f44b639d4d798`: [Verify](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228200664), [Phase 3](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228200804), [Academy integration](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45228200654) all SUCCESS; R5 log 100 executed/settled, 89 wins, 11 draws, 100 replay matches, 0 unsupported/invalid/stalled/replay mismatch. That evidence applies only to that SHA. New R7.1 head requires fresh CI and combined consumer tests. Keep Draft; no release certification.
