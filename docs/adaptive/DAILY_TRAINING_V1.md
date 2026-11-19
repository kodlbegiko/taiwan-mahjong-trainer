# Phase 3 Daily Training — public API, durability and integration

**Owner:** Adaptive · `feat/academy-daily-training` / PR #45  
**Contract:** `master-academy/1.0.0` + `academy-daily/1.0.0` under experimental Phase 3  
**Release:** Draft source; not a full-game feature, not a production deployment gate.

## Authority / invariants

- `tw-mahjong-master-academy:state:v1` **trainingSessions[]** is the *only* DailySession authority. There is no second UI score or progress key.
- `tw-mahjong-trainer:archive:v3` and `tw-mahjong-trainer:session:v1` retain their original schemas and keys. A submission uses the Learning-approved canonical v3 grading and original RecordRef; only linked, durable, verified records count toward AbilityProfile.
- Answer-to-Session provenance uses the V1 sidecar `pendingProvenance` write-ahead intent. A canonical v3 write is read back before provenance is finalized; derivations rebuild from durable RecordRefs. Quota/write failure is not `saved`.
- Session identity is `profileId + IANA timezone + localDayKey + algorithmVersion`. Once a day is created, a later 10/20/30/60-minute request returns that unchanged Session. New local calendar day creates another Session.
- The catalog only admits `status=validated` structural `discard/tenpai/multi_wait` QuestionPublic, exact Learning public lookup and actual canonical grading probe, from `published` Lessons whose prerequisites are already completed **by durable linked answers**. Level 4/5 `validated` content and unverified Bot/scenario scorers are excluded. Unavailable/retired sources fail closed.
- Skill estimates remain `null` when uncalibrated; a deterministic training score is not a calibrated Mahjong rating.
- If the valid unlocked bank cannot fill the requested minutes, the Session is honestly shorter. Questions and RecordRefs are never fabricated to fill time.

## Controller / UI wiring for AI 5 and AI 6

```js
import { createDailyTrainingController } from './src/adaptive/index.js';
import * as learning from './src/academy/index.js';
import { APPROVED_LEGACY_REGISTRY } from './src/integration/master-academy-facade.js';

const daily = createDailyTrainingController(localStorage, {
  learning,
  registry: APPROVED_LEGACY_REGISTRY,
  validateAcademyDecisionRecord: learning.validateAcademyDecisionRecord,
  profileId: 'local-academy-profile',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei',
});
const asOf = new Date().toISOString();
const session = await daily.ensureTodayLocked({ asOf, minutes: 30 });
const summary = await daily.getDailyProgressLocked({ asOf });
const question = daily.getQuestion(summary.nextQuestionRef, { asOf });
// Render QuestionPublic only; never import private answerKey into UI.
const outcome = await daily.submitSessionAnswerLocked({
  questionRef: summary.nextQuestionRef,
  choice: playerChoice,
  asOf: new Date().toISOString(),
  durationMs: measuredElapsedMs,
  attemptId: stableAttemptId, // stable across retry, unique to the answer
});
if (outcome.status === 'saved') {
  // outcome.gradingResult is from canonical Learning grading.
}
const resumed = await daily.resumeSessionLocked({ asOf: new Date().toISOString() });
```

**Asynchronous, Web-Lock guarded write API (required for multi-tab UI):**

| Method | Inputs | Contract |
| --- | --- | --- |
| `ensureTodayLocked({asOf,minutes=30})` | explicit ISO with zone; 10/20/30/60 minutes | create or reuse durable today's immutable TrainingSession |
| `resumeSessionLocked({asOf,sessionId?})` | ISO; optional guard ID | rebuild/reconcile interrupted canonical evidence and return UI DTO |
| `submitSessionAnswerLocked({questionRef,choice,asOf,durationMs,attemptId})` | exact QuestionRef, deterministic retry attempt ID | official grader and three-stage durable readback; returns `saved`, `already-answered`, `pending-recovery` or `recovery-required` |
| `completeSessionLocked({asOf})` | ISO | only when all planned questions have verified RecordRefs; idempotent after completion |
| `abortSessionLocked({asOf,reason?})` | ISO | abort planned/active Session without deleting already durable answers; idempotent once aborted |
| `getDailyProgressLocked({asOf})` | ISO | serialized UI read; no independently calculated scores |

Compatibility **synchronous** methods remain available: `ensureToday`, `readToday`/`getTodaySession`, `getQuestion`, `progress`, `submit`/`submitSessionAnswer`, `getDailyProgress`, `resumeSession`, `completeSession`, `abortSession`. These alone **do not** ensure cross-tab exclusion. The official UI must use the `*Locked` methods for mutations and serialized progress reads.

`getDailyProgress` returns `sessionId`, `dayKey`, `timezone`, `status`, `revision`, `minutes`, `sources` (question source, generator version and training section), `completed`, `total`, `completedQuestions[]` (QuestionRef + RecordRef), `remainingQuestions[]`, `recordRefs[]`, `nextQuestionRef`, `nextStep`, `abilityProfile` summary, `reviewPlan` summary (`due` included), `pendingRecovery`, `error`. `not-started` returns a non-scored blank state. On malformed/corrupt sidecar it returns `status:'error'`, `nextStep:'recover'`, `error:{code,message}` **without rewriting corrupted bytes**.

`getQuestion(ref,{asOf})` returns canonical **QuestionPublic** with no private answerKey. After submission, the UI may display the canonical `gradingResult` but must not generate a second score, inferred skill percentage, or unsaved completion counter.

## Failure / race protocol

1. Call `ensureTodayLocked` from the UI; every Daily mutation across same-origin tabs must obtain the same named `navigator.locks` exclusive lock for this profile. Lock scope includes canonical grade, legacy v3 write/readback, pending provenance, derived profile and session update.
2. If `navigator.locks` is unavailable, `*Locked` rejects with `AcademyStorageError('LOCK_UNAVAILABLE')`; UI must offer an explicit unsupported/retry path, not silently claim atomicity. Node tests inject a FIFO lock provider through `{locks}`.
3. If a sidecar already contains an outstanding intent for a QuestionRef, retry with its **original attemptId**. A different ID returns `pending-recovery`; on readback failure the result is `recovery-required`. Call `resumeSessionLocked` before any new attempt. Never delete or overwrite canonical archives during recovery.
4. Session `active -> active` appends are monotonic: existing RecordRefs and question order cannot be rewritten, and same local-day duplicate Sessions are rejected. The Sidecar revision increments for writes and is surfaced for stale-view diagnostics; **this is not an atomic compare-and-swap**.
5. `localStorage` offers **no transaction across keys**. Web Locks protect cooperating same-origin tabs, not independent cross-device writes, other apps that bypass these APIs, a browser crash mid-write, or malicious/manual storage modifications. Readback and pending recovery reduce but do not eliminate these risks. A server-backed transaction would be required for strict cross-device consistency.
6. The IANA time zone is persisted at Session creation. Clock skew that crosses the local-day boundary can select a different day; no trustworthy server time is available offline. UI must display the persisted `dayKey/timezone` and not assume device clocks are synchronized.
7. A v3 write with no previously durable sidecar intent is not automatically linked to an Academy question: provenance must never be invented from visual similarity. Surface a recoverable error for manual reconciliation.
8. `sw.js` is **integrator-owned**. AI 6 must add/import the new Adaptive source files to the atomic service-worker cache and run a real online→offline cold new-tab Chromium/iOS PWA regression. The Daily source PR must not patch `sw.js`.

## Test matrix / boundaries

`node --test tests/adaptive/daily-training.test.js` verifies new user, immutable same-day selection, official v3 readback, two-answer append, duplicate suppression, public DTO, uncalibrated estimate, simulated dual-tab FIFO lock, quota/pending recovery, terminal states, IANA midnight, corrupt sidecar, invalid lesson/scorer. A FIFO test provider demonstrates the **controller's lock protocol**; it is not a real two-browser-context race. End-to-end cross-tab and iPhone Safari/offline tests remain AI 6/QA integration gates.

Do not merge PR #45 or announce Daily UI production readiness solely from standalone Node CI.