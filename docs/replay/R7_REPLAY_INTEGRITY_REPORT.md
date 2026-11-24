# R7 Replay Integrity Report

Status: **DRAFT / NO-GO**, pending exact-head CI and public HTTPS end-to-end completion.
Source branch: `feat/r7-replay-integrity`; base: `integration/mahjong-full-game` at `a29bebfc01e05c05450b964a41ce34cbecf40365`.
Pull request: https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46

## 1. Existing authoritative data flow (audit)

1. Rules Engine `createGame / applyAction` issues canonical private GameState with monotonically ordered TurnEvents, Rules-issued LegalAction identifiers and expected revisions.
2. `src/table-ui/full-round.js` persists a separate private `tw-mahjong-master-academy:full-table:r3:v1` GameState checkpoint on accepted actions, and invokes Replay `saveReplay` after Rules reports `round.phase === 'settled'`. Restoring a settled checkpoint retries the archive operation. This file is **read-only for R7**.
3. `src/replay/internal.js` archives private `initialSeed`, exact ordered TurnEvents, PlayerDecision groups, versioned RuleProfile snapshot, final state digest, and private settlement reference. Canonical reconstruction uses **Rules `replayGame`**, never a second Replay reducer.
4. `src/replay/index.js` stores `tw-mahjong-replay:archive:v1:<replayId>` then indexes the archive at `tw-mahjong-replay:index:v1`. Public outputs are allowlisted manifests and Rules `createPlayerView` at historical complete-action boundaries.
5. R3/R5 actions that append multiple TurnEvents (including PASS + resolution; WIN + SETTLE) must be treated atomically by `decisionsOf` / `replayStateAt`. `getReplayFrame` rejects interior sequences with `NON_ATOMIC_EVENT_SEQ`.
6. Owner-only analysis uses historic PlayerView; postgame output is an explicit, separately marked public settlement, **not** private opponent hands or the future wall.
7. Existing R5 acceptance recorded 100/100 deterministic seeded simulations and zero Replay mismatches. That evidence does **not** constitute a public HTTPS postgame Replay acceptance.

## 2. R7 changes

### Private deterministic hash

- Add `src/replay/integrity.js`, a synchronous browser/Node compatible, UTF-8 SHA-256 function, independent of asynchronous WebCrypto and Node-only crypto.
- New private archive field `manifest.integrity.sha256` contains a versioned, ordered **event-chain** hash (domain-separated initial game identity, RuleProfile, private seed, dealer, round configuration; then one hash per canonical event), deterministic decision digest, and Rules-reconstructed final GameState digest.
- The legacy `fnv1a-32-canonical-checksum-not-signature` fields remain for V1 backwards compatibility. Reading archives without `sha256` is allowed after original canonical validation; new archives include the stronger field.
- Malformed, altered, unknown-version, partially missing or mismatched present SHA-256 evidence is rejected as `CORRUPT_REPLAY`.
- SHA-256 is **not** an authenticity signature. An attacker authorized to replace all browser-local bytes can recalculate digests or remove the optional V1-compatible field. Authenticate or sign remote receipts before treating them as adversarial-proof audit records.
- These hashes are **private**, not returned by the public manifest, to avoid revealing a stable commitment to low-entropy Seeds or unpublished events.

### Persistence and error recovery

- `saveReplay` checks the index before writing archive bytes. A corrupt index fails as `STORAGE_CORRUPT` without persisting a new archive.
- Exact idempotent saves compare full canonical archive content rather than merely a 32-bit collision-prone checksum; divergent same-ID histories fail as `REPLAY_ALREADY_EXISTS`.
- If an earlier write stored valid archive bytes but failed to update the index, a repeated save repairs **only** the missing index entry.
- New explicit `recoverReplay(replayId,{viewerSeat})` reads **existing** private bytes, validates every event against canonical Rules reconstruction and its checksums, verifies the viewer seat, and only then indexes the archive. Invalid, absent and damaged archives are refused. Recovery never regenerates seed, events, settlement or claims.
- Web Storage does not provide a two-key transaction. A quota/IO failure can still strand a valid unindexed archive; the tested retry/recover path repairs the index when writes resume. Untrusted or damaged bytes must remain unrecoverable without external trusted backup.

## 3. R7 test matrix

| Test condition | Expected behavior | Test source |
| --- | --- | --- |
| Fixed inputs, Unicode SHA-256 | identical 64-hex deterministic digests and known vectors | `r7-integrity.test.js` |
| R5 settled self-WIN + settlement | all action-end frames equal authoritative historical Rules PlayerView | R7 + existing R5 |
| Partial WIN/SETTLE sequence | `NON_ATOMIC_EVENT_SEQ` | R7 + existing R3/R5 |
| Event removal, duplication, altered type | `CORRUPT_REPLAY` | R7 |
| Altered decision/action ID and final digest | `CORRUPT_REPLAY` | R7 |
| Unknown replay/digest version | `CORRUPT_REPLAY` | R7 |
| Wrong seat, old-frame inspection, unsettled postgame | `VIEW_FORBIDDEN` or `POSTGAME_UNAVAILABLE`; no opponent concealed or future wall | R7 + existing R3/R4/R5 |
| Failure between archive and index writes | `STORAGE_WRITE_FAILED`, no false completion; valid existing archive survives | R7 |
| Restart, recover/retry, same-ID reuse | indexed after verified repair; no overwrite or fabricated event | R7 |
| Corrupt orphan or malformed index | fail closed; never add it as a valid replay | R7 |
| Legacy V1 FNV-only archive | readable without pretending it has SHA-256 evidence | R7 |

Run: `node --test tests/replay/*.test.js`; `npm run check`. These results must be taken from the **same exact commit SHA**. No CI result is asserted here until the run concludes.

## 4. Open risk and release gates

1. **Public-site R6 blocker (historical, not confirmed as root cause):** on 2026-11-20 the published HTTPS site could start an R5 full table, but the run stopped during flower replacement/PASS in a claim window. The R6 acceptance document records `fullGame.status = BLOCKED`, `settlementStatus = NOT_RUN`, and `replayFromSettledMatch = NOT_RUN`. Source `src/table-ui/main.js` calls native `window.confirm` for non-discard submissions; whether this caused the blockage is not proven. Reference: `docs/quality/MASTER_ACADEMY_PHASE3_R6_ACCEPTANCE.json`.
2. **Agent 1 handoff (UI owner):** open `https://taiwan-mahjong-phase3-r5-experimental-sign2.vercel.app/`, start four-player R5 profile, replace initial flowers if applicable, submit a valid PASS when the claim window appears, record confirmation dialog behavior, expectedRevision, and phase/revision before/after. Continue to a real settled round and then click Replay; record browser console, action IDs (redacted from public logs), exact deployed SHA, screenshot/video and terminal frame. Do not classify `window.confirm` as root cause until independently replicated.
3. **No R7 public deployment:** the R6 fixed URL points to older SHA `7c4b08a4fce6d7ad2458f23397489ea7f6e2c042`; it cannot validate newly committed R7 behavior until an authorized deployment of this branch. R7 does not modify Table UI, Rules, Bot, Scoring, Academy or Service Worker.
4. **Security boundary:** owner-local storage and JS module boundaries are not multi-user authentication. Browser scripts with the same origin's localStorage access can read private seed/ledger. A server-authoritative authenticated archive or encryption model is needed for adversarial multiplayer.
5. **Rules/scoring scope:** R5 one-winner policy and `tw16-minimal-tai-v1` remain experimental; no official Taiwanese house-rule/scoring certification, no full multi-round match archiving guarantee, and no proven production postgame Replay UX.
6. **No fabricated recovery:** missing or unreplayable events require a trusted backup, not guesswork, a synthesized settlement, or silently skipped turns.

## 5. Exact-head evidence

- PR: https://github.com/kodlbegiko/taiwan-mahjong-trainer/pull/46
- Verification workflow: https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45226079094
- Phase 3 workflow: https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/45226079136
- Final test SHA and pass/fail status: **pending** (fill from GitHub Actions on the final report commit).
