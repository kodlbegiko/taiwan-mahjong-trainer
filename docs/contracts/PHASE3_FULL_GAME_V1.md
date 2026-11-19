# Taiwan Mahjong Master Academy — Phase 3 Full-Game Contract Extension

**Extension:** `mahjong-full-game/0.1.0-experimental`  
**Parent contract:** `master-academy/1.0.0` (**immutable**, do not change existing field semantics)  
**Source baseline:** `68fb50bc43746a0e6ff9f2f90712904d06a2ccda`  
**Status:** `DRAFT / INTEGRATION CONTRACT / NOT VERIFIED RULES`

## 0. Scope, identity and authority
- The Phase 3 contract is an **additive namespace**, not a V1 migration. Every DTO MUST contain `schemaVersion:1`, `contractVersion:'mahjong-full-game/0.1.0-experimental'` or its source-owned explicitly documented equivalent, and versioned `ruleRef:{profileId,ruleVersion}` where rule-dependent.
- A `status:'experimental'` RuleProfile **MUST NOT** be promoted to `verified` by the integrator, UI, Bot, scoring or Replay. `scorerStatus:'unverified'` means **no official Academy score, no ability evidence**.
- **Private source of truth**: Rules owns `GameState` and state mutation, private tiles, unexposed wall and RNG. `PlayerView` is an allowlisted seat-specific projection; Bots and UI **never import `GameState` or receive raw private events**.
- `LegalAction.actionId`, `actorSeat`, and `expectedRevision` are obtained verbatim from Rules at the current event seq. UI/Bot cannot invent action IDs, scoring, outcomes, next-actor or claim priority.
- `TurnEvent` order, RuleProfile+ruleVersion, action origin, actor, physical tile ownership, and information visibility **MUST** validate on every durable readback and deterministic replay.
- A controller may stage private `claim` intents, but it must not reveal them before authoritative resolution. `viewAtTime` must be reconstructed at a historical event boundary and must exclude all later events.

## 1. Canonical Phase 3 DTOs (JSON-safe, separate source-owned versions)

| DTO | Minimum immutable fields | Owner |
| --- | --- | --- |
| `FullRoundState` | `gameRef`, `ruleRef`, `revision`, `roundRef`, `phase`, `currentSeat`, `dealerSeat`, `wallRemaining`, `players[4]` (internal), `events[]`, `extensions` | Rules only (private) |
| `ClaimWindow` | `discardEventId`, `fromSeat`, `responders`, `pendingCount`, `claimPolicyVersion`, `status` | Rules only (public summary omits private intents) |
| `FullLegalAction` | `actionId`, `kind`, `actorSeat`, `expectedRevision`, `ruleRef`, `tileIds`, optional `claimEventId`, `legalityBasis` | Rules |
| `SettlementResult` | `roundRef`, `ruleRef`, `reason`, `winnerSeat` or null, `deltas[4]`, `scoringPolicyVersion`, `status` | Rules/scorer; balanced sum required |
| `BotPolicy` | `policyId`, `policyVersion`, `level`, `rngVersion`, `calibrated:false`, `limits` | Bots |
| `BotDecision` | `gameRef`, `viewRef`, `actorSeat`, `expectedRevision`, `actionId`, `policyVersion`, `reasonCodes[]`, `status` | Bots; derived only from PlayerView |
| `ReplayManifest` | `replayId`, `ruleRef`, `ownerSeat`, `sourceEventCount`, `completeness`, `disclosurePolicy`, `integrityVersion` | Replay |
| `ReplayFrame` | `replayId`, `eventSeq`, `perspective`, `viewerSeat`, `playerView`, `authorizedEvents`, `integrityStatus` | Replay; historical projection only |
| `CoachingFinding` | `findingId`, `sourceRecordRef`, `eventSeq`, `evidenceRefs[]`, `claimStatus`, `scorerVersion` or null, `calibration` | Replay, never directly Adaptive |
| `DailySession` | `sessionId`, `profileRef`, `timezone`, `dayKey`, `asOf`, `sessionVersion`, `questionRefs[]`, `completedRecordRefs[]`, `status` | Adaptive, not UI |

The table specifies required **semantic obligations**, not a claim existing source DTOs already use identical fields. Sources must publish `current→proposed` adapters and test vectors before consumers rely on a contract rename.

## 2. Action protocol and complete-round invariants

`createGame(ruleRef,seed)` → private FullRoundState → `createPlayerView(state,seat)` → `legalActions[]` → `applyAction(state,{actorSeat,actionId,expectedRevision})` → atomic ordered events → validated state/Replay. No shortcut mutation or independently computed UI turn switching. A RuleProfile must explicitly specify:

- Physical inventory (136 base + configured flowers), 4 seats, dealer 17/non-dealer 16, legal flower replacements and supplement draw source; **sum** of concealed, river unclaimed, meld ownership, flowers, live wall/tail, and terminal disclosed tiles equals original deck, with each PhysicalTileId counted once.
- Chi responder restriction; pong/open/concealed/added kong; claim priority and simultaneous requests; self-draw and discard win legality; pass-win lock; exhaustion; legal dealer and wind rotation; invalid action and stale revision rejection.
- **Settlement must be zero-sum** under its explicitly verified scoring policy, and wins require a supported, checked win shape. Table-specific tai and exceptions must remain `unknown` or `experimental` when not verified.
- Non-implemented cases (`robAddedKong`, multi-winner, penalty handling, venue variations) must return a typed **unsupported** capability, not silently fall back to an invented rule.

## 3. Bot / replay / learning boundaries
- A Bot receives `PlayerView` **only**, plus seeded policy settings; no wall, raw GameState, opponent concealed tile IDs, private claim intents, or future draw sequence. Every chosen ID must be present in current `legalActions`; cannot claim real win probability / calibration without externally validated data.
- Replay stores authoritative full event ledger in a separate restricted archive; owner-only historical frames reveal **only information available at that moment**. Post-game reveal requires an explicit verified settlement/disclosure policy; advice without verified ground truth is `advisory`.
- `CoachingFinding` does not create `DecisionRecord v3` or AbilityProfile by itself. Only separately verified official scorer provenance and durable `RecordRef` may increment ability evidence, idempotent by the original RecordRef ID (not number of findings).
- `DailySession` is idempotent by `profileRef + IANA timezone local day + sessionVersion`. Store write-ahead intent, durable canonical attempts, readback, and derived progress; never duplicate existing attempts or include a scenario unless its rule/profile/scorer is validated.

## 4. Storage isolation / schema change / security
- Immutable legacy keys: `tw-mahjong-trainer:archive:v3`, `session:v1` and all historical v1/v3 bytes; V1 Academy sidecar `tw-mahjong-master-academy:state:v1` retains its existing authority.
- Phase 3 owns disjoint versioned keys such as `tw-mahjong-full-game:rounds:v1`, `tw-mahjong-full-game:replay:v1`, `tw-mahjong-full-game:bots:v1`; Daily uses **Adaptive's designated versioned session authority**, not a new competing UI truth key.
- A different Vercel origin has different localStorage. Cross-origin user records need user-initiated export/import with checksum, schema validation and rollback; never claim automatic migration.
- Version upgrade must be copy-on-write, reject unknown versions, and preserve original bytes. Strict `GameState`/view separation also applies to logs, browser artifacts, analytics and errors.

## 5. PR ownership and release gates

| Owner | Allowed paths | Required gates |
| --- | --- | --- |
| Daily | `src/adaptive/**`, `tests/adaptive/**`, `docs/adaptive/**` | new user day session, deterministic same-day, reload, crash/quota, no duplicate v3 |
| Rules | `src/rules/**`, `tests/rules/**`, `docs/rules/**` | physical conservation, claim arbitration, flower, win, draw, scoring and deterministic replay per explicit profile |
| Bots | `src/bots/**`, `tests/bots/**`, `docs/bots/**` | PlayerView privacy, seed, 3-bot controller, legal claims, bounded full-match simulation |
| Replay | `src/replay/**`, `src/scenario/**`, `tests/replay/**`, `docs/replay/**` | frame determinism, tamper, future-state denial, post-game disclosure, verified evidence |
| Table UI | `src/table-ui/**`, `tests/browser/full-table-ui-*`, `docs/table-ui/**` | public API, 320/375/390/430/768/1440, action errors, keyboard, PWA, storage |
| Integrator | `src/integration/**`, `tests/integration/**`, `docs/contracts/PHASE3_*`, `docs/quality/MASTER_ACADEMY_PHASE3_REPORT.md`, integration-owned workflows and atomic shell wiring | same-SHA full match, combined CI, Golden fixtures, PWA live browser, Source SHA audit |

Any ownership exception (e.g. Table UI `index.html`/`sw.js`) must be reviewed as an explicit integration change, not overwritten silently. All source PRs target `integration/mahjong-full-game`; V1 PR #33 is preserved Draft. Merge or public Phase 3 preview **requires** combined-source HEAD and real end-to-end game proof; green standalone CI is insufficient.

**Approval matrix:** `BASELINE_GO` (V1 preserved), `EXPERIMENTAL_ENGINE_PASS` (bounded RuleProfile), `FULL_RULES_GO` (table policy covered), `FULL_MATCH_GO` (3 bots complete round), `REPLAY_GO` (privacy + continuity), `PWA_GO` (live offline), `PREVIEW_READY`, `RELEASE_GO` are independent, non-transitive gates.
