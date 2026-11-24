# R7.3 mixed-version archive inventory

Existing strict listReplays() aborts on the first unreadable indexed entry. This is safe but prevents older readable records from being discovered by a host with only legacy runtime when an authoritative archive is present. Add an opt-in, read-only listReplayAvailability() method. Original listReplays(), loadReplay(), saveReplay(), recoverReplay(), getReplayFrame() and their validation semantics remain unchanged.

The new inventory returns only:
- {replayId,status:'verified',manifest}: canonical archive validated under exact original policy/runtime; ordinary public manifest.
- {replayId,status:'incompatible',code}: unknown historical Rules, scoring policy, event contract or missing trusted scoring runtime.
- {replayId,status:'unavailable',code}: indexed record absent or corrupt.

The ID in an unsuccessful row is an index entry, not verified archive identity. Never treat these rows as valid replays or synthesize manifests. No unverified metadata, private causes or raw archive data is returned. Index corruption and systemic storage read failures still throw. No mutation, deletion, policy fallback, reindexing or rewriting occurs. Hosts may opt into the inventory API and display unavailable records explicitly; UI integration belongs to Agent 1, not this PR.

Tests: real historical FNV/SHA and real frozen authoritative archive plus synthetic negative records. Standalone test verifies legacy discovery and explicit authority refusal; strict combined environment must also verify both records with actual Rules/Scoring runtime. No new runtime import path.

Latest prior source 274f533a exact native Verify 378/384 PASS, 0 FAIL, 6 SKIP; strict R5 100/100 settlement/replay (89 WIN, 11 DRAW) again PASS. Phase3 Chromium again fails offline result unavailable; standalone cache omission remains. R7.3 combined checkout and new browser gate NOT_RUN; no release approval.
