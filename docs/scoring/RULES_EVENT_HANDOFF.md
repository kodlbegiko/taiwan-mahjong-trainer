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
