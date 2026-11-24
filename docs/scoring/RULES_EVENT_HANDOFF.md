# Proposed Rules Agent event schema — integration only, NOT emitted in R5

Schema file: rules-scoring-event-proposal.schema.json.

Example proposed **public** factual envelope (no concealed hand, wall or private intents):

    {
      "schemaVersion": 1,
      "contractVersion": "tw16-scoring-facts/1.0.0-proposal",
      "roundId": "round-7",
      "ruleRef": {
        "profileId": "tw16-single-winner-interception",
        "ruleVersion": "experimental-v1"
      },
      "winnerSeat": 1,
      "sourceSeat": 0,
      "via": "discard",
      "dealerSeat": 3,
      "dealerStreak": 2,
      "dealerStreakRoundRefs": ["round-5", "round-6"],
      "seatWindType": 28,
      "prevailingWindType": 27,
      "publicEventRefs": ["evt:game-7:81", "evt:game-7:82"],
      "winningTileId": "t:5:0",
      "winningTileRole": "pair",
      "replacementSource": "none",
      "waitShape": "unknown",
      "liabilityPolicy": "none"
    }

The Rules Agent, not the scorer, must validate the previous two round events, identical and continuing dealer identity, immutable chronological linkage, unique IDs and compatible rule version. The handIndex is **not** proof of dealer streak. Seat wind must come from actual opening/dice-seat alignment, not inferred from dealer seat. All publicEventRefs must point to canonical already authorized and appropriately visible TurnEvents.

For kong-after-draw, added-kong robbery, unique/two-sided waits, heavenly/earthly timing, responsibility/包牌, and flower-only wins, add source-specific, event-verified facts under a versioned contract before scoring. Do not guess from hand shape or a claimed numerical counter. Special flower wins may not satisfy ordinary five-meld-and-pair structure and need a separate policy.

Compatibility: the proposal is **additive**, introduces no new required field on the existing R5 DTO, never changes its scoringPolicy/configRef, and must never leak opponent concealed, RNG, wall or private claim choices. Older clients ignore the new optional scoringFacts namespace. New ScoringProfile consumers fail closed when required facts are absent.

The proposed settlement event extension should carry scoringVersion, scoringStatus=experimental, breakdown[], payments[] with pair-specific dealerItems, playerTransferDeltas[4], fee ledger, houseDelta, and immutable evidence source references. Apply Rules win+settle atomically with replay equality and zero-sum assertion. Any exceptional payer reassignment requires an independently sourced and versioned policy rather than invented 包牌 logic.


## R7.1 current Agent 2 cross-owner contract (PR #51, not merged into this branch)

The opt-in Rules profile \`tw16-rob-added-kong@experimental-v1\` emits
\`TurnEvent{type:'kong_proposed',visibility:'public',actorSeat:fromSeat,
payload:{kind:'ADDED_KONG',tileId}}\`.
During \`claim_window\`, exactly one legal WIN (if any) may prevail; declared
WIN/PASS remain \`seat-private\` until settlement. The single robbery outcome
has **all three matching** \`robAddedKong\` markers:

\`\`\`json
{"proposalEventId":"evt:game:42","fromSeat":0,"tileId":"t:27:3"}
\`\`\`

The marker is present in \`state.extensions.tw16.result.robAddedKong\`,
terminal public \`win.payload.robAddedKong\`, and
\`settle.payload.robAddedKong\`. All must be structurally equal.
The source player's public proposal river retains the fourth tile at the
proposal \`seq\`. The earlier exposed triplet is **not** upgraded to kong.
A preceding \`seat-private claim\` with \`kind:'win'\` and
\`claimEventId===proposalEventId\` must belong to the eventual winner.
If any identity, seat, claimed tile, temporal order or marker differs, the
read-only Scoring adapter rejects settlement, without changing Rules state.

The existing Rules settlement uses \`via:'discard'\`, with
\`sourceSeat=fromSeat\`; R7.1 adds a separately sourced **搶槓胡 +1 tai**
under an opt-in scoring profile. Payer is **only the added-kong declarer**.
This is not self-draw; three other seats do not pay. An ordinary discard
cannot set \`robAddedKong\`, and the legacy R5 RuleProfiles never gain this
marker by default. Multiple simultaneous WIN claimants remain UNSUPPORTED.

For opt-in \`specialDraw\`, the trusted Rules host privately reconstructs
\`drawEventId/sourceEventId\`: \`draw.source:'tail'\` immediately after
a public \`CONCEALED_KONG\` or \`ADDED_KONG\` event, or a non-initial
\`flower.replacementTileId\`, can qualify for 槓上開花. A source-authenticated
last live draw with the experimental profile's fixed 16 reserved tiles
can qualify for 海底撈月. Unsupported open-kong supplement wins and initial
deal-flower variants reject explicitly. Never put replacement identities,
private WIN intents, the remaining wall or hidden hands in the public envelope.

**This contract is unmerged and its own branch can change.** Integration must
pin exact Rules/Scoring commit SHAs and test original event replay before
enabling it in a production RuleProfile.
