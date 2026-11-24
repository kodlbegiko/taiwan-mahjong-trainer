/** R7.3 immutable public fixture snapshots, generated from Rules replay on 0994b657.
 * No private deck, QA imports, or estimated risk/tai. Retain V1 bytes for replay.
 * Authoritative scorer independently recomputes answers against these snapshots.
 */
export const SCENARIO_BANK_V1 = [
  {
    "key": "tile-identity",
    "lessonId": "academy-l1-01",
    "skill": "tiles.identity",
    "policy": "discard-type",
    "arg": 6,
    "instructions": "請選擇捨出七萬。相同牌種的任一實體副本皆可。",
    "view": {
      "schemaVersion": 1,
      "contractVersion": "master-academy/1.0.0",
      "viewId": "view-r71-academy-concealed-kong-1-seat0",
      "gameId": "r71-academy-concealed-kong",
      "ruleRef": {
        "profileId": "tw16-configurable-table",
        "ruleVersion": "experimental-full-v1"
      },
      "audienceSeat": 0,
      "asOfEventSeq": 1,
      "round": {
        "schemaVersion": 1,
        "contractVersion": "master-academy/1.0.0",
        "roundId": "r71-academy-concealed-kong-round-0",
        "handIndex": 0,
        "dealerSeat": 0,
        "currentSeat": 0,
        "phase": "await_discard",
        "lastPublicEventSeq": 0,
        "prevailingWind": "east"
      },
      "self": {
        "seat": 0,
        "melds": [],
        "river": [],
        "flowers": [],
        "concealed": [
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:0",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:1",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:2",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:3",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:0",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:1",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:2",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:3",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:0",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:1",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:2",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:3",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:0",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:1",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:2",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:3",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:3:0",
            "kind": "standard",
            "tileType": 3,
            "copyIndex": 0
          }
        ]
      },
      "opponents": [
        {
          "seat": 1,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 2,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 3,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        }
      ],
      "publicEvents": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-concealed-kong:1",
          "gameId": "r71-academy-concealed-kong",
          "seq": 1,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "deal",
          "visibility": "public",
          "payload": {
            "countsBySeat": [
              17,
              16,
              16,
              16
            ]
          }
        }
      ],
      "legalActions": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:6:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:6:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:6:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:3",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:6:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:3",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:3",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:3",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:3:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:3:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:kong:CONCEALED_KONG:t:0:0:t:0:1:t:0:2:t:0:3",
          "kind": "kong",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:0",
            "t:0:1",
            "t:0:2",
            "t:0:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:kong:CONCEALED_KONG:t:1:0:t:1:1:t:1:2:t:1:3",
          "kind": "kong",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:0",
            "t:1:1",
            "t:1:2",
            "t:1:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:kong:CONCEALED_KONG:t:2:0:t:2:1:t:2:2:t:2:3",
          "kind": "kong",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:0",
            "t:2:1",
            "t:2:2",
            "t:2:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-concealed-kong:1:0:kong:CONCEALED_KONG:t:6:0:t:6:1:t:6:2:t:6:3",
          "kind": "kong",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:6:0",
            "t:6:1",
            "t:6:2",
            "t:6:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        }
      ],
      "knownUnavailableTypes": [
        0,
        1,
        2,
        6
      ],
      "capabilities": {
        "structuralScore": true,
        "roundActions": false,
        "settlement": false
      }
    },
    "actionIds": [
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:0",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:1",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:2",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:3",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:0",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:1",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:2",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:0:3",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:0",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:1",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:2",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:1:3",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:0",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:1",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:2",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:2:3",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:3:0"
    ],
    "acceptedIds": [
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:0",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:1",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:2",
      "act:r71-academy-concealed-kong:1:0:discard:OWN_DISCARD:t:6:3"
    ],
    "digest": "fnv1a32:c25f5f7b"
  },
  {
    "key": "meld-sequence",
    "lessonId": "academy-l1-02",
    "skill": "structure.melds",
    "policy": "chi-sequence",
    "arg": [
      3,
      4,
      5
    ],
    "instructions": "辨認四、五、六萬組成的順子：選擇能完成該順子的合法吃牌。",
    "view": {
      "schemaVersion": 1,
      "contractVersion": "master-academy/1.0.0",
      "viewId": "view-r71-academy-chi-2-seat1",
      "gameId": "r71-academy-chi",
      "ruleRef": {
        "profileId": "tw16-configurable-table",
        "ruleVersion": "experimental-full-v1"
      },
      "audienceSeat": 1,
      "asOfEventSeq": 2,
      "round": {
        "schemaVersion": 1,
        "contractVersion": "master-academy/1.0.0",
        "roundId": "r71-academy-chi-round-0",
        "handIndex": 0,
        "dealerSeat": 0,
        "currentSeat": 1,
        "phase": "claim_window",
        "lastPublicEventSeq": 2,
        "prevailingWind": "east"
      },
      "self": {
        "seat": 1,
        "melds": [],
        "river": [],
        "flowers": [],
        "concealed": [
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:3:0",
            "kind": "standard",
            "tileType": 3,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:0",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:1",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:2",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:3",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:0",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:1",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:2",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:3",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:0",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:1",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:2",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:3",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:0",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:1",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:2",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 2
          }
        ]
      },
      "opponents": [
        {
          "seat": 0,
          "melds": [],
          "river": [
            {
              "tileId": "t:4:3",
              "seq": 2
            }
          ],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 2,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 3,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        }
      ],
      "publicEvents": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi:1",
          "gameId": "r71-academy-chi",
          "seq": 1,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "deal",
          "visibility": "public",
          "payload": {
            "countsBySeat": [
              17,
              16,
              16,
              16
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi:2",
          "gameId": "r71-academy-chi",
          "seq": 2,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "discard",
          "visibility": "public",
          "actorSeat": 0,
          "payload": {
            "tileId": "t:4:3"
          },
          "previousEventId": "evt:r71-academy-chi:1",
          "causedByActionId": "act:r71-academy-chi:1:0:discard:OWN_DISCARD:t:4:3"
        }
      ],
      "legalActions": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:pass:CLAIM_WINDOW_PASS:evt:r71-academy-chi:2",
          "kind": "pass",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CLAIM_WINDOW_PASS"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:win:DISCARD_WIN:evt:r71-academy-chi:2:t:4:3",
          "kind": "win",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "DISCARD_WIN"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:0",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:3:0",
            "t:4:3",
            "t:5:0"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:1",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:3:0",
            "t:4:3",
            "t:5:1"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:2",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:3:0",
            "t:4:3",
            "t:5:2"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:3",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:3:0",
            "t:4:3",
            "t:5:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:0",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:0",
            "t:6:0"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:1",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:0",
            "t:6:1"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:2",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:0",
            "t:6:2"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:3",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:0",
            "t:6:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:0",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:1",
            "t:6:0"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:1",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:1",
            "t:6:1"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:2",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:1",
            "t:6:2"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:3",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:1",
            "t:6:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:0",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:2",
            "t:6:0"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:1",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:2",
            "t:6:1"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:2",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:2",
            "t:6:2"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:3",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:2",
            "t:6:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:0",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:3",
            "t:6:0"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:1",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:3",
            "t:6:1"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:2",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:3",
            "t:6:2"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:3",
          "kind": "chi",
          "actorSeat": 1,
          "expectedRevision": 2,
          "tileIds": [
            "t:4:3",
            "t:5:3",
            "t:6:3"
          ],
          "claimEventId": "evt:r71-academy-chi:2",
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "NEXT_SEAT_CHI"
            ]
          }
        }
      ],
      "knownUnavailableTypes": [
        5,
        6,
        7
      ],
      "capabilities": {
        "structuralScore": true,
        "roundActions": false,
        "settlement": false
      }
    },
    "actionIds": [
      "act:r71-academy-chi:2:1:pass:CLAIM_WINDOW_PASS:evt:r71-academy-chi:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:3",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:0:t:6:3",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:1:t:6:3",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:2:t:6:3",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:4:3:t:5:3:t:6:3"
    ],
    "acceptedIds": [
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:0",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:1",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:2",
      "act:r71-academy-chi:2:1:chi:NEXT_SEAT_CHI:evt:r71-academy-chi:2:t:3:0:t:4:3:t:5:3"
    ],
    "digest": "fnv1a32:32caddfe"
  },
  {
    "key": "hand16-win",
    "lessonId": "academy-l1-03",
    "skill": "structure.hand16",
    "policy": "structural-win",
    "arg": null,
    "instructions": "這副已摸牌的暗牌若可組成五面子一將眼，請選擇合法和牌；不比較台數或收益。",
    "view": {
      "schemaVersion": 1,
      "contractVersion": "master-academy/1.0.0",
      "viewId": "view-r71-academy-winning-1-seat0",
      "gameId": "r71-academy-winning",
      "ruleRef": {
        "profileId": "tw16-configurable-table",
        "ruleVersion": "experimental-full-v1"
      },
      "audienceSeat": 0,
      "asOfEventSeq": 1,
      "round": {
        "schemaVersion": 1,
        "contractVersion": "master-academy/1.0.0",
        "roundId": "r71-academy-winning-round-0",
        "handIndex": 0,
        "dealerSeat": 0,
        "currentSeat": 0,
        "phase": "await_discard",
        "lastPublicEventSeq": 0,
        "prevailingWind": "east"
      },
      "self": {
        "seat": 0,
        "melds": [],
        "river": [],
        "flowers": [],
        "concealed": [
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:0",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:1",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:0:2",
            "kind": "standard",
            "tileType": 0,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:0",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:1",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:1:2",
            "kind": "standard",
            "tileType": 1,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:0",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:1",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:2:2",
            "kind": "standard",
            "tileType": 2,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:3:0",
            "kind": "standard",
            "tileType": 3,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:3:1",
            "kind": "standard",
            "tileType": 3,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:3:2",
            "kind": "standard",
            "tileType": 3,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:4:0",
            "kind": "standard",
            "tileType": 4,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:4:1",
            "kind": "standard",
            "tileType": 4,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:4:2",
            "kind": "standard",
            "tileType": 4,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:0",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:1",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 1
          }
        ]
      },
      "opponents": [
        {
          "seat": 1,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 2,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 3,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        }
      ],
      "publicEvents": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-winning:1",
          "gameId": "r71-academy-winning",
          "seq": 1,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "deal",
          "visibility": "public",
          "payload": {
            "countsBySeat": [
              17,
              16,
              16,
              16
            ]
          }
        }
      ],
      "legalActions": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:0:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:1:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:2:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:3:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:3:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:3:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:4:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:4:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:2",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:4:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:5:0",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:5:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:5:1",
          "kind": "discard",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [
            "t:5:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-winning:1:0:win:SELF_DRAW_WIN",
          "kind": "win",
          "actorSeat": 0,
          "expectedRevision": 1,
          "tileIds": [],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "SELF_DRAW_WIN"
            ]
          }
        }
      ],
      "knownUnavailableTypes": [],
      "capabilities": {
        "structuralScore": true,
        "roundActions": false,
        "settlement": false
      }
    },
    "actionIds": [
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:1",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:0:2",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:1",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:1:2",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:1",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:2:2",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:1",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:3:2",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:1",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:4:2",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:5:0",
      "act:r71-academy-winning:1:0:discard:OWN_DISCARD:t:5:1",
      "act:r71-academy-winning:1:0:win:SELF_DRAW_WIN"
    ],
    "acceptedIds": [
      "act:r71-academy-winning:1:0:win:SELF_DRAW_WIN"
    ],
    "digest": "fnv1a32:f35e6ad5"
  },
  {
    "key": "structure-change",
    "lessonId": "academy-l3-01",
    "skill": "efficiency.structure-change",
    "policy": "discard-efficiency",
    "arg": null,
    "instructions": "已吃一組固定面子。只按最低向聽、再最多有效進張的順序選擇捨牌；全部同分選項均正確。",
    "view": {
      "schemaVersion": 1,
      "contractVersion": "master-academy/1.0.0",
      "viewId": "view-r71-academy-chi-open-6-seat1",
      "gameId": "r71-academy-chi-open",
      "ruleRef": {
        "profileId": "tw16-configurable-table",
        "ruleVersion": "experimental-full-v1"
      },
      "audienceSeat": 1,
      "asOfEventSeq": 6,
      "round": {
        "schemaVersion": 1,
        "contractVersion": "master-academy/1.0.0",
        "roundId": "r71-academy-chi-open-round-0",
        "handIndex": 0,
        "dealerSeat": 0,
        "currentSeat": 1,
        "phase": "await_discard",
        "lastPublicEventSeq": 6,
        "prevailingWind": "east"
      },
      "self": {
        "seat": 1,
        "melds": [
          {
            "kind": "sequence",
            "open": true,
            "tileIds": [
              "t:3:0",
              "t:4:3",
              "t:5:0"
            ],
            "sourceSeat": 0,
            "sourceEventId": "evt:r71-academy-chi-open:2"
          }
        ],
        "river": [],
        "flowers": [],
        "concealed": [
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:1",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:2",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:3",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:0",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:1",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:2",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:3",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:0",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:1",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:2",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:3",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:0",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:1",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:2",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 2
          }
        ]
      },
      "opponents": [
        {
          "seat": 0,
          "melds": [],
          "river": [
            {
              "tileId": "t:4:3",
              "seq": 2,
              "claimedByEventId": "evt:r71-academy-chi-open:6"
            }
          ],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 2,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 3,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        }
      ],
      "publicEvents": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:1",
          "gameId": "r71-academy-chi-open",
          "seq": 1,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "deal",
          "visibility": "public",
          "payload": {
            "countsBySeat": [
              17,
              16,
              16,
              16
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:2",
          "gameId": "r71-academy-chi-open",
          "seq": 2,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "discard",
          "visibility": "public",
          "actorSeat": 0,
          "payload": {
            "tileId": "t:4:3"
          },
          "previousEventId": "evt:r71-academy-chi-open:1",
          "causedByActionId": "act:r71-academy-chi-open:1:0:discard:OWN_DISCARD:t:4:3"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:3",
          "gameId": "r71-academy-chi-open",
          "seq": 3,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-chi-open:2"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:4",
          "gameId": "r71-academy-chi-open",
          "seq": 4,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-chi-open:3"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:5",
          "gameId": "r71-academy-chi-open",
          "seq": 5,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-chi-open:4"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-chi-open:6",
          "gameId": "r71-academy-chi-open",
          "seq": 6,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "actorSeat": 1,
          "payload": {
            "kind": "chi",
            "sourceSeat": 0,
            "claimEventId": "evt:r71-academy-chi-open:2",
            "tileIds": [
              "t:3:0",
              "t:4:3",
              "t:5:0"
            ]
          },
          "previousEventId": "evt:r71-academy-chi-open:5",
          "causedByActionId": "act:r71-academy-chi-open:4:3:pass:CLAIM_WINDOW_PASS:evt:r71-academy-chi-open:2"
        }
      ],
      "legalActions": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        }
      ],
      "knownUnavailableTypes": [
        5,
        6,
        7
      ],
      "capabilities": {
        "structuralScore": true,
        "roundActions": false,
        "settlement": false
      }
    },
    "actionIds": [
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:3",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:0",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:3",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:0",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:3",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:0",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:8:2"
    ],
    "acceptedIds": [
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:5:3",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:0",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:6:3",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:0",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:1",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:2",
      "act:r71-academy-chi-open:6:1:discard:OWN_DISCARD:t:7:3"
    ],
    "digest": "fnv1a32:6c51043e"
  },
  {
    "key": "visible-count",
    "lessonId": "academy-l4-01",
    "skill": "public.visible-count",
    "policy": "known-count",
    "arg": 2,
    "instructions": "選擇捨出一張：該牌種在自己暗牌及公開河牌／副露合計恰好有兩張已知實體副本。所有符合者皆正確。",
    "view": {
      "schemaVersion": 1,
      "contractVersion": "master-academy/1.0.0",
      "viewId": "view-r71-academy-river-discard-6-seat1",
      "gameId": "r71-academy-river-discard",
      "ruleRef": {
        "profileId": "tw16-configurable-table",
        "ruleVersion": "experimental-full-v1"
      },
      "audienceSeat": 1,
      "asOfEventSeq": 6,
      "round": {
        "schemaVersion": 1,
        "contractVersion": "master-academy/1.0.0",
        "roundId": "r71-academy-river-discard-round-0",
        "handIndex": 0,
        "dealerSeat": 0,
        "currentSeat": 1,
        "phase": "await_discard",
        "lastPublicEventSeq": 2,
        "prevailingWind": "east"
      },
      "self": {
        "seat": 1,
        "melds": [],
        "river": [],
        "flowers": [],
        "concealed": [
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:4:0",
            "kind": "standard",
            "tileType": 4,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:0",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:1",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:2",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:5:3",
            "kind": "standard",
            "tileType": 5,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:0",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:1",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:2",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:6:3",
            "kind": "standard",
            "tileType": 6,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:0",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:1",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:2",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:7:3",
            "kind": "standard",
            "tileType": 7,
            "copyIndex": 3
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:0",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 0
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:1",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 1
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:8:2",
            "kind": "standard",
            "tileType": 8,
            "copyIndex": 2
          },
          {
            "schemaVersion": 1,
            "contractVersion": "master-academy/1.0.0",
            "id": "t:16:1",
            "kind": "standard",
            "tileType": 16,
            "copyIndex": 1
          }
        ]
      },
      "opponents": [
        {
          "seat": 0,
          "melds": [],
          "river": [
            {
              "tileId": "t:4:3",
              "seq": 2
            }
          ],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 2,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        },
        {
          "seat": 3,
          "melds": [],
          "river": [],
          "flowers": [],
          "concealedCount": 16
        }
      ],
      "publicEvents": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:1",
          "gameId": "r71-academy-river-discard",
          "seq": 1,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "deal",
          "visibility": "public",
          "payload": {
            "countsBySeat": [
              17,
              16,
              16,
              16
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:2",
          "gameId": "r71-academy-river-discard",
          "seq": 2,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "discard",
          "visibility": "public",
          "actorSeat": 0,
          "payload": {
            "tileId": "t:4:3"
          },
          "previousEventId": "evt:r71-academy-river-discard:1",
          "causedByActionId": "act:r71-academy-river-discard:1:0:discard:OWN_DISCARD:t:4:3"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:3",
          "gameId": "r71-academy-river-discard",
          "seq": 3,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-river-discard:2"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:4",
          "gameId": "r71-academy-river-discard",
          "seq": 4,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-river-discard:3"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:5",
          "gameId": "r71-academy-river-discard",
          "seq": 5,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "claim",
          "visibility": "public",
          "payload": {},
          "previousEventId": "evt:r71-academy-river-discard:4"
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "eventId": "evt:r71-academy-river-discard:6",
          "gameId": "r71-academy-river-discard",
          "seq": 6,
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "type": "draw",
          "visibility": "public",
          "actorSeat": 1,
          "payload": {
            "count": 1
          },
          "previousEventId": "evt:r71-academy-river-discard:5"
        }
      ],
      "legalActions": [
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:4:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:4:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:3",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:0",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:0"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:2",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:8:2"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:16:1",
          "kind": "discard",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:16:1"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "OWN_DISCARD"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:kong:CONCEALED_KONG:t:5:0:t:5:1:t:5:2:t:5:3",
          "kind": "kong",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:5:0",
            "t:5:1",
            "t:5:2",
            "t:5:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:kong:CONCEALED_KONG:t:6:0:t:6:1:t:6:2:t:6:3",
          "kind": "kong",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:6:0",
            "t:6:1",
            "t:6:2",
            "t:6:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        },
        {
          "schemaVersion": 1,
          "contractVersion": "master-academy/1.0.0",
          "actionId": "act:r71-academy-river-discard:6:1:kong:CONCEALED_KONG:t:7:0:t:7:1:t:7:2:t:7:3",
          "kind": "kong",
          "actorSeat": 1,
          "expectedRevision": 6,
          "tileIds": [
            "t:7:0",
            "t:7:1",
            "t:7:2",
            "t:7:3"
          ],
          "ruleRef": {
            "profileId": "tw16-configurable-table",
            "ruleVersion": "experimental-full-v1"
          },
          "legalityBasis": {
            "engineVersion": "rules-engine/0.2.0-experimental",
            "reasonCodes": [
              "CONCEALED_KONG"
            ]
          }
        }
      ],
      "knownUnavailableTypes": [
        5,
        6,
        7
      ],
      "capabilities": {
        "structuralScore": true,
        "roundActions": false,
        "settlement": false
      }
    },
    "actionIds": [
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:4:0",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:0",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:1",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:2",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:5:3",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:0",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:1",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:2",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:6:3",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:0",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:1",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:2",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:7:3",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:0",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:1",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:8:2",
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:16:1"
    ],
    "acceptedIds": [
      "act:r71-academy-river-discard:6:1:discard:OWN_DISCARD:t:4:0"
    ],
    "digest": "fnv1a32:c8e0ae77"
  }
];
