# Taiwan Mahjong Master Academy — R3 Three-Bot Controller (Experimental)

**Scope:** original Draft PR #40, `feat/tw16-opponent-bots`.
**Contract:** `master-academy/1.0.0`, additive Phase 3 `mahjong-full-game/0.1.0-experimental`.
**Bot version:** `tw16-bots/0.2.0-r3-experimental`.
**Rules profile:** `tw16-configurable-table@experimental-full-v1` (experimental, **not** certified Taiwanese rules).

## Real R3 integration

Bot code never receives `GameState`, `wall`, `rng`, opponent concealed tiles, private
claim intents or the engine's private event archive. The Rules-authoritative **host**
owns `GameState` in a private closure and provides only:

- `getActingSeat()`: Rules' current scheduler hint (`round.currentSeat`);
- `getPlayerView(seat)`: `createPlayerView(authoritative,seat)` for the exact revision;
- `submitAction({actorSeat,actionId,expectedRevision})`: delegates to
  `applyAction(authoritative,submission)`, storing the resulting state **inside the host**.
  It must not return private state to Bot/UI.

`createBotController` handles one human seat + exactly three Bots. At a
`claim_window` it inspects seat-specific `PlayerView.legalActions` at the same
revision and chooses one pending responder with `pass` available. It never
accesses `extensions.tw16.window.decisions`, invents a claim ID, computes claim
priority or settles a hand. After each claim/pass, the controller asks Rules for a
fresh PlayerView. The **third** response triggers Rules' own arbitration.

Normal phases use the actual Rules-issued draw/discard/win/kong/replacement actions.
A special narrow `readBotView` adapter permits the current R3 replacement actor
to hold initial physical flowers before the standard-only Strategy validator can
accept the hand. This is strictly for `replace_flower` and does not grant strategy
access to unexposed tiles or weaken the canonical validator.

An R3 settlement is detected by `round.phase === 'settled'` and returned as
`{status:'settled'}`; any settlement result belongs to Rules' state. No Bot
forges a score. `startNextRound(previous,{gameId,seed})` must be called by the
trusted host after a genuine settlement.

## API and use

Exports from `src/bots/index.js`:

- `createBot({seat,difficulty,seed})`;
- `chooseBotAction(bot,playerView)` and `validateBotDecision(...)`;
- `runBotTurn({bot,playerView,submitAction})`: public-only decision and
  bounded decision timing `decisionMs`;
- `createBotController({bots,humanSeat,getActingSeat,getPlayerView,submitAction,
  maxRevision?,checkpoint?,yieldControl?})`.

Example trusted host (state is **not** sent to bots):

```js
import {createGame,createPlayerView,applyAction} from './src/rules/index.js';
import {createBot,createBotController} from './src/bots/index.js';

let authoritative = createGame({
  gameId:'sample-r3',seed:'private-game-seed',
  profileId:'tw16-configurable-table',ruleVersion:'experimental-full-v1',
});
const controller=createBotController({
  humanSeat:0,
  bots:[1,2,3].map(seat=>createBot({
    seat,difficulty:'Beginner',seed:'independent-bot-'+seat,
  })),
  getActingSeat:()=>authoritative.round.currentSeat,
  getPlayerView:seat=>createPlayerView(authoritative,seat),
  submitAction:submission=>{
    authoritative=applyAction(authoritative,submission).state;
  },
});
// Repeatedly call tick or bounded runUntilHuman; for 'human-turn',
// display createPlayerView(authoritative,0).legalActions to the human.
// When controller reports 'settled', trusted host reads Rules' result.
```

`submitHumanAction` checks the **current** human LegalAction. During an R3
claim window, the human may submit an outstanding response in any order;
during other phases the human must be Rules' current actor.

## Failure and resource budgets

- Each `tick` submits **at most one** authorized action. `runUntilHuman`
  has bounded `maxActions=32` (allowed 1–128) and yields between steps.
- `maxRevision=2048` by default (allowed 1–100000) bounds cumulative
  event growth. `duplicate-revision-blocked` blocks re-submission.
- Mixed PlayerView revisions, no active responder, impossible action set,
  or exceeding event budget return typed `{status:'unsupported',reason:'...'}`
  rather than false win/draw.
- Missing R3 capabilities in old draw/discard sandbox still fail closed as
  `claim-adjudication-unavailable`; the experimental sandbox is not a full game.
- `pause()`, `resume()`, `checkpoint()` preserve the controller's pause
  bit only. The host must persist and restore its authoritative Rules state.
  In-flight calls cannot be paused mid-submission.

## Policies and limitations

All policies choose a Rules-authorized win first and never invent actions.
Beginner uses canonical shanten/ukeire and seeded top-three ties; Intermediate
uses existing public Strategy analysis; Advanced uses bounded conditional
two-draw sampling on up to two discard routes. The new R3 claim heuristic
compares public, structural shanten after a legal meld. Claims and self-kongs
are conservative and uncalibrated; they are **not** a win probability, real
opponent model, verified scoring value, or evidence Advanced beats Intermediate.

## Reproducible verification

```bash
node --test tests/bots/*.test.js
npm run check
```

`tests/bots/r3-full-round.test.js` contains a **real** experimental R3
100-fixed-seed one-hand coverage run with a controlled human policy, three
Bots, per-seed `BOT_FULL_ROUND_SEED` JSON results and an aggregated
`BOT_FULL_ROUND_SUMMARY` (including failure seeds, claim windows, illegal
actions, stalls, replay, timings and actual settlements). Failure of any
case fails the test; results must be read from the exact-source CI logs,
**not** this documentation. This does not prove competitive Bot strength,
real-device latency, or universal Taiwanese rules compliance.

**Open external rules gates:** rob added kong, simultaneous multiwinner,
special winning hands, comprehensive regional tai, venue-specific penalties,
and certified multi-round match/real hardware behavior. No Phase 3 release
may be inferred from this module's isolated green CI.
