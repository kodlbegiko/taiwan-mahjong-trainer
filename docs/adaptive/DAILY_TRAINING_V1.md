# Phase 3 Daily Training — public API, durability and integration

## R4 durable-grading acceptance (source-owned)

At the current Phase 3 combined SHA `ca7ce4dd0d855ade1827873623e9e7eaf5c2bfb1`, the real Chromium job **Full human + 3 bots / settlement / Replay / Daily / PWA** succeeded: [run 44657599345](https://github.com/kodlbegiko/taiwan-mahjong-trainer/actions/runs/44657599345). The overall workflow is still RED due to an independent full-match/Seed 87 Node gate. This evidence predates the R4 extra proof and must not be presented as same-SHA proof for later source commits.

### Canonical write and independent readback contract

1. The UI must send `QuestionPublic`'s exact `questionRef`, selected `choice`, a stable retry `attemptId`, ISO `asOf`, and measured `durationMs` through `submitSessionAnswerLocked`. It must **await** the returned promise.
2. The Adaptive Learning adapter calls the published Learning scorer. It constructs `DecisionRecord v3` and `RecordRef {kind:'legacy-v3',id}` without inventing an Academy-only grade.
3. The prepared `pendingProvenance` is written before the original local v3 writer. Every submission creates a **fresh** `createLocalTrainingStore(storage)` so an earlier QuotaExceeded phantom in a writer's memory cannot silently block retry. Re-read the archive from storage and require exact canonical record bytes.
4. Store official provenance, rebuild AbilityProfile/ReviewPlan from durable records, and append RecordRef to the authoritative Session. Do not modify original v3 or v1 schemas.
5. **R4 final proof:** `saved` is returned only if an independent `adaptive.readLegacy()` and `adaptive.load()` confirm *one* canonical v3 record, *one* matching provenance link, exactly one Session RecordRef, an AbilityProfile source evidence reference, and a compatible ReviewPlan.
6. On success, `outcome.status === 'saved'`, `outcome.gradingResult` is official Learning output, `outcome.recordRef` references the v3 archive, and `outcome.durabilityProof` is `{status:'verified',archive:'legacy-v3',recordRef,sessionId,sidecarRevision,abilityEvidence:true,reviewPlanId}`. The UI must not announce formal completion on `recovery-required` or `pending-recovery`.
7. `already-answered` on a nonterminal Session also includes a verified `durabilityProof`, without rerunning the scorer. A completed or aborted Session **rejects all new submits**, including previously answered references. Read-only resume and review remain supported.

A damaged v3 archive or inconsistent provenance/derived state **fails closed**; do not recreate source records to repair it. Quota or crash may leave an existing durable canonical v3 answer but unfinished sidecar: use `resumeSessionLocked` under the lock to reconcile `pendingProvenance`; if an interrupted attempt's canonical record is absent, reuse its original `attemptId`, original answer, timestamp and duration (do not silently invent a different attempt).

### Lock / error semantics

The guarded calls use `navigator.locks.request(name,{mode:'exclusive',signal})` with a default **15-second acquisition timeout** (configurable constructor option `lockTimeoutMs` from 10–60000 ms). A request that cannot acquire a lock fails with `LOCK_TIMEOUT` instead of hanging indefinitely; once a lock callback starts, its *operation errors* are preserved, not misclassified as timeout. `LOCK_UNAVAILABLE` means the browser has no abortable Web Locks. Locking only covers cooperating same-origin tabs, not cross-device storage transactions.

`DURABLE_PROOF_FAILED` is an integrity failure: do not show a completed grade. Re-open the Daily panel and run read-only progress/recovery; preserve raw evidence for debugging. A corrupted sidecar must retain original bytes; do not silently overwrite it or retroactively claim verified SkillTags.

### AI 5 / AI 6 connection

AI 5 should consume `outcome.status`, `outcome.gradingResult` and `outcome.durabilityProof.status` *after awaiting the locked submission*. Do not treat an immediate click or a visual progress count as proof of persistence. For newly created sessions, read `getDailyProgressLocked` and `getQuestion`; after refresh call `resumeSessionLocked`. Clear any temporary `sessionStorage` attempt key only after `saved` or verified `already-answered`; preserve the original ID otherwise. AI 6 owns real Chromium gate `tests/browser/full-table-ui-r3-gates.py`, service worker precache, stale source SHA audits and complete integration tests.

### R4 source-level regression matrix

Six new test cases cover full write/readback proof across new controller instances, corrupt derived evidence rejection, corrupt provenance preservation, full Session completion and terminal reject, abortable Web Locks timeout, and IANA local-day differences. Existing tests cover QuotaExceeded with same attemptId retry, injected crash after canonical write, duplicate suppression, concurrent tabs, original v1 byte preservation, and unverified scorer exclusion.

The `node --test tests/adaptive/daily-training.test.js` and `npm run check` outputs must be reported **for the exact final commit**, not inferred from any earlier green Chromium run. Independent R3 Node test failure for unsupported Seed 87 is not a Daily scoring defect, but it keeps the complete project gate RED.


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