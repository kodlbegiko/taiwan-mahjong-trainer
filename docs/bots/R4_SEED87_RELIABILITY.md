# R4 Bot Seed 87 — deterministic unsupported / controller reliability

**Owner:** Bots, original Draft PR #40 (`feat/tw16-opponent-bots`).
**Status:** **diagnosed / Bot fail-closed hardened; FULL_MATCH_GO=false**.
**RuleProfile:** `tw16-configurable-table@experimental-full-v1`, not certified.
**Source of measured evidence:** [combined Verify #44647873450](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44647873450) at integration SHA `232c9457350c69224f12b346f2a1e4b528dd0b65`.
The newer Rules #43 has its own exact 157-action Golden trace fixture at
`tests/rules/fixtures/seed-87-r4-trace.js`; see `tests/rules/r4-seed-87.test.js`.
**DO NOT** infer the old Bot 100/100 source run validated R4.

## Root cause / exact public claim transition

`createGame({gameId:'bot-r3-87',seed:'fixed-round-87',
profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1'})`
deterministically executes 157 submitted actions, producing revision **162**.
The last public-action sequence (actionId is copied from each seat's legalActions,
never synthesized by a Bot) is:

| Before → after | Actor | Rules-issued LegalAction | Claim phase |
| --- | --- | --- | --- |
| 159 → 160 | Seat 2 | `act:bot-r3-87:159:2:discard:OWN_DISCARD:t:26:0` | Opens window |
| 160 → 161 | Seat 3 | `act:bot-r3-87:160:3:win:DISCARD_WIN:evt:bot-r3-87:160:t:26:0` | WIN intent stored privately |
| 161 → 162 | Seat 0 | `act:bot-r3-87:161:0:win:DISCARD_WIN:evt:bot-r3-87:160:t:26:0` | Second WIN intent stored privately |
| 162 → 162 | Seat 1 | `act:bot-r3-87:162:1:pass:CLAIM_WINDOW_PASS:evt:bot-r3-87:160` | **UNSUPPORTED** (no transition) |

Seat 1's PASS is **legal** and `expectedRevision=162`, so neither a
stale revision nor a forged/repeated claim caused the failure. On the third
response, Rules attempts to arbitrate the already-private **two WIN intents**;
its `RuleCapabilityError` reports:

```json
{"code":"UNSUPPORTED_RULE_CAPABILITY","capability":"multiple_winners"}
```

The rejected `applyAction` is atomic, with `revision=162`,
`phase='claim_window'`, **no settlement** and zero invalid/stall events.
A Bot must **not** change either legitimate WIN to PASS, invent a priority
or produce a fictional draw/score. The policy decision belongs to Rules #43
and requires a new versioned RuleProfile plus verified multiwinner payout.

## Actual 100-seed result on the measured integration SHA

| Classification | Actual count |
| --- | ---: |
| Executed | **100** |
| Settled | **99** |
| Win | **88** |
| Exhaustive draw | **11** |
| Typed unsupported | **1** (Seed 87, `multiple_winners`) |
| Invalid Rules action | **0** |
| Stalled | **0** |
| Completed Replay match | **99** |
| Failed seed | `87` |
| Claim windows | **4,449** |
| Seed 87 events / successful steps | **162 / 157** (158th submission rejected) |
| Seed 87 Claim windows / successful responses | **32 / 95** |

The sampled GitHub-runner metrics on that SHA were: mean of per-hand
mean decision duration **5.607 ms**, P95 of per-hand means **8.651 ms**;
Seed 87 total decision duration **602.284 ms** and end-to-end
simulation wall time **1,021.998 ms**. These are not device CPU metrics,
not a calibrated Bot skill test, and not current-head timing evidence.

## Bot-owned R4 safety repairs

- Latch the exact `UNSUPPORTED_RULE_CAPABILITY` code,
  `multiple_winners` capability, triggering `gameId`,
  `actorSeat` and `expectedRevision` **without raw GameState**.
- After a typed Rules rejection, `tick()`, `runUntilHuman()` and
  `submitHumanAction()` must return the same blocked status, with no
  repeated `applyAction`, hidden PASS substitution or spin retry.
- Persist that small allowlisted block in `checkpoint()` so pause/resume
  cannot accidentally replay the final claim; new game requires a trusted
  host to start a new controller.
- The 100-seed runner reports **separate** `settled`,
  `unsupported`, `invalid`, `stalled`, `replayMismatch`,
  `prefixReplayMatched`, `fullMatchGo`, and individual failure context.
  The complete unsuccessful public action sequence includes before/after
  revision, phase, actor, exact legal ID, decision reason codes, and terminal
  Rules error. Diagnostics use only the seat-specific `PlayerView`, redact
  all other concealed hands and never reveal private claim intents.
- Dedicated Seed 87 replay regression checks revision 162, two legal WINs,
  a fresh legal final PASS, unchanged state, Replay prefix match,
  and duplicate-call fail-closed behavior. A 10-seed representative case
  is distinct from the 100-seed strict full-match gate.
- Counterfactual hidden-hand/wall swap and existing Bot seat-level
  PlayerView validation stay enabled.

**Do not change the strict 100/100 full-match assertion.** With unsupported
Seed 87, the 100-seed classification output is honest but the
`FULL_MATCH_GO` test intentionally FAILS. A separate investigation/
classification test may pass without granting a release gate.

## Commands / evidence

```bash
node --test --test-name-pattern='R4 Seed 87' tests/bots/r3-full-round.test.js
node --test --test-name-pattern='R4 10 representative' tests/bots/r3-full-round.test.js
node --test tests/bots/r4-capability.test.js
node --test --test-name-pattern='R3 100 fixed-seed' tests/bots/r3-full-round.test.js
npm run check
```

`tests/bots/r3-full-round.test.js` generates the original physical
deterministic seed from Rules, not an independent fake draw/discard sandbox.
The full 157-submission source trace is also available in the linked
GitHub Actions `BOT_FULL_ROUND_SEED` and Rules fixture. For privacy,
persist public actor/action/view metadata only; never copy the sealed wall
or opponents' actual concealed tiles into Bot artifacts.

**Evidence distinction:** the measured 99/100 run is an existing integrator
SHA; newly committed Bot fixes and newer Rules #43
(`1d51c7a723f27eaf5cfa5dba25144adce7450494` at report time) have
**not yet** passed a new combined same-SHA run. Source PR #40 remains Draft.
Do not mark Preview, FULL_MATCH_GO or RELEASE_GO before verified same-SHA CI.

## Rules / integration coordination

- **AI 2 / Rules #43:** implement and independently verify a formally
  specified future multiple-winner/priority/payment policy, if product
  chooses one. R4 explicitly documents the current capability as unsupported;
  do not change the experimental profile in-place just to pass Seed 87.
- **AI 6 / Integration #44:** pin the latest Bot-owned SHA and Rules-owned
  SHA by actual Git blobs in one integration commit; run Seed 87, 10-seed,
  100-seed, replay, both 10k Oracles, browser and offline gates. Report the
  Seed 87 typed unsupported as **one unfinished round**, not as a legal win.
