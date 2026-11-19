# Phase 3 Daily Training — Source-owned Implementation

**Source:** `feat/academy-daily-training` · Contract `master-academy/1.0.0`, additive `academy-daily/1.0.0`

Public API: `createDailyTrainingController(storage,{learning,registry,validateAcademyDecisionRecord,profileId,timezone})` exposes `ensureToday`, `readToday`, `getQuestion`, `progress`, `submit`. Official Learning callbacks are injected; no hidden answerKey enters the UI. Only `published` lessons with exact public Question identity and a working canonical `gradeAcademyQuestion` probe enter a new user's catalog. No speculative scenario, Bot or human ability metrics.

The **existing** Adaptive `trainingSessions[]` inside `tw-mahjong-master-academy:state:v1` is authoritative. New Daily metadata lives inside `session.extensions['adaptive.daily']`; no new competing UI score DB. Repeated same-day calls reuse the original persisted session, preserving its question order and revision; responses are scored via V1 `submitAnswer(...,sessionId)`, producing durable v3 + two-phase provenance + profile/review reconstruction. Duplicate QuestionRef is rejected before official scoring; no duplicate ability record is created. No unscored exercise counted.

This source PR **does not modify** legacy `archive:v3` schema or V1 `session:v1` bytes. Tests are in `tests/adaptive/daily-training.test.js`. Browser UI wiring and combined Phase 3 integration **not included**, so standalone green CI does not mean production Daily UI is complete. Concurrency across simultaneous tabs requires a separate transaction/lease review; Storage quota/write errors must surface as partial, not saved. Physical iPhone NOT_RUN.
