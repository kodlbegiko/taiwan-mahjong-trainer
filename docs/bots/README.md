# Taiwan Mahjong Master Academy — Offline Opponent Bots (Experimental)

Contract: master-academy/1.0.0. Bot API version: tw16-bots/0.1.0.
Source base: integration/mahjong-academy @ 68fb50bc43746a0e6ff9f2f90712904d06a2ccda.

## Release gate (critical)

**This is a bounded experimental draw/discard Bot prototype, NOT a complete four-player Taiwanese 16-tile mahjong game.**

At implementation time, the requested integration/mahjong-full-game and
feat/tw16-complete-rules branches did not exist. The latest available Phase 2
integration was selected instead of the stale main branch. The temporary Draft
PR targets integration/mahjong-academy. Rebase/review against the real Phase 3
integration only when that branch exists; do not automatically merge.

The actual Rules Engine is tw16-four-player-sandbox@experimental-move-v1:
- Executable: four seats, deterministic dealing, draw, discard, revision checks,
  real Rules-owned event ledger, public PlayerView and replay.
- **Not executable:** chi, pong, kong, pass/claim priority, flower replacement,
  win adjudication, settled/score, exhausted-wall draw. The engine only emits
  draw and discard LegalActions. No settled event/round follows exhaustion.
- PlayerView.capabilities.roundActions=false and settlement=false even though
  the limited draw/discard sandbox is executable.
- No precise deal-in percentage, expected fans or real-world human skill
  should be inferred from this implementation.

## API

Exports from src/bots/index.js:

- createBot({seat,difficulty,seed}) — independent bot identity for seat 0..3;
  supported difficulties Beginner, Intermediate, Advanced.
- chooseBotAction(bot,playerView) — pure deterministic public-information policy,
  returns actionId, expectedRevision, actorSeat, status, reasonCodes,
  botVersion, strategyVersion, gameId, rngSeed.
- validateBotDecision(bot,playerView,decision) — checks against the CURRENT
  Rules-issued LegalAction list. Throws on a forged/stale/foreign action.
- runBotTurn({bot,playerView,submitAction}) — calls the authoritative adapter;
  never forwards the returned GameState/event.
- createBotController({bots,humanSeat,getActingSeat,getPlayerView,submitAction,
  checkpoint?,yieldControl?}) — controls three opponent bots plus the human
  seat, pause/resume, bounded runUntilHuman, human action validation,
  public-event reads, non-secret decision history and pause checkpoint.

No Bot accepts a GameState, wall, hidden opponent hand, or future RNG.
The Strategy readPlayerView validator recursively checks permitted data shapes
and detaches JSON input, rejecting unknown/private fields and accessors. The
Rules Engine must create the PlayerView; no client-provided action list is a
source of authority. applyAction revalidates every submitted action.

Example host integration (GameState stays INSIDE the Rules-owned adapter):

    import { createGame, createPlayerView, applyAction } from './src/rules/index.js';
    import { createBot, createBotController } from './src/bots/index.js';

    let authoritative = createGame({
      gameId: 'demo-bots', seed: 'game-secret-seed',
      profileId: 'tw16-four-player-sandbox', ruleVersion: 'experimental-move-v1',
    });

    const controller = createBotController({
      bots: [
        createBot({seat:1,difficulty:'Beginner',seed:'bot-a'}),
        createBot({seat:2,difficulty:'Intermediate',seed:'bot-b'}),
        createBot({seat:3,difficulty:'Advanced',seed:'bot-c'}),
      ],
      humanSeat:0,
      getActingSeat: () => authoritative.round.currentSeat, // Rules owns scheduling
      getPlayerView: seat => createPlayerView(authoritative,seat),
      submitAction: submission => {
        authoritative = applyAction(authoritative,submission).state;
        // NEVER return the private state to Bot/UI.
      },
    });

    // On human's turn, call controller.submitHumanAction({actionId,expectedRevision})
    // with a current Rules-projected human LegalAction.
    // Afterwards: await controller.runUntilHuman({maxActions:12});
    // If no executable Rules action exists: status = no-legal-action.

This sample is an in-process *trust boundary*, not cryptographic isolation
against malicious users inspecting their own offline JavaScript. Never give the
Bot's tie-break seed the Rules shuffle seed. For a real multiplayer service,
move the authority and hidden state into an isolated trusted process.

## Difficulty and epistemic boundaries

| Level | Current verified behavior | Not claimed |
| --- | --- | --- |
| Beginner | canonical 16-tile shanten + basic ukeire, seeded choice among up to three same-shanten candidates | opponent risk, optimal play |
| Intermediate | existing Strategy public PlayerView canonical discard ranking using known visible physical copies and taatsu heuristics | real claim evaluation, calibrated defense |
| Advanced | Intermediate baseline plus capped 2 route x 4 simulated two-draw samples as a conservative equal-shanten/near-equal-ukeire tie-break | real wall prediction, calibrated win or deal-in probability |

Every policy prefers a Rules-offered win/draw when available. For claim actions
not currently offered by the sandbox, a legal pass is conservatively preferred
when offered, and otherwise only an existing LegalAction could be selected.
No Bot invents a claim or computes score. In an unvalidated claim_window the
controller returns claim-adjudication-unavailable rather than inventing conflict
priority; a Rules adjudication interface and Golden fixtures are REQUIRED.

## Runtime / persistence

- runUntilHuman({maxActions}) bounds each invocation to 1..128 submitted
  actions; default 32. It yields to the browser event loop between actions.
- A single tick submits at most one engine action. After a submission or
  rejection on a revision, another attempt on that same revision is blocked.
- No infinite retries and no draw after the engine's legal action list empties.
- pause(), resume(), checkpoint() preserve only controller paused state.
  The host (Rules/replay/persistence owner) must independently persist and
  restore the authoritative GameState and then reinstantiate a controller
  with its restored closures. Never serialize private state into a Bot
  checkpoint or leak it through Bot history.
- Neither physical iPhone Safari performance nor Worker isolation is proven;
  the bounded synchronous decision is a prototype. Production UI should
  profile worst-case device latency and move work to an offline Worker if
  it cannot meet the responsiveness budget.
- Bot decision event history is public-facing metadata, not a replacement
  for the Rules Engine's event ledger. Public events come only from PlayerView.

## Reproducible checks

    node --test tests/bots/*.test.js
    npm run check

tests/bots/decision-controller.test.js checks legal action membership, revision,
replay, deterministic seed, different strategy versions, GameState/private-field
rejection, opponent+wall counterfactual secrecy, draw with no wall prediction,
pause/resume, bounded scheduling, authority rejection, claim-window fail-closed,
and 71-wall-tile exhaustive bounded simulation. That simulation must NOT count
as a settled or won hand.

tests/bots/benchmark.test.js emits a BOT_BENCHMARK JSON line for 8 fixed seeds
x 3 difficulties (24 decisions), including average/p95/max milliseconds and
valid/repeated decision rates. Timings are environment-specific; no
hardware-independent threshold is asserted. Full-round completion is null
(not measurable) until the real Rules engine supports win or settled.

## To unlock full four-player game (external blockers)

1. Phase 3 Rules API must generate complete, validated LegalActions for
   claim/priority, pass, kong, replacement, legal win, exhaustive draw, result
   settlement and rule profile.
2. Integrate an authoritative claim-window seat scheduler/arbitrator with
   collision fixtures. Do not implement this logic in bots.
3. Add fixed full-round Golden fixtures, seeded full-game replay, valid
   settlement rate, and win/score accuracy tests. Only then report game
   completion rate or empirical win rates.
4. Integrate the authorized PWA/table UI/persistence owner, without editing
   src/app.js, src/table-ui/**, src/rules/**, src/replay/** or sw.js here.
