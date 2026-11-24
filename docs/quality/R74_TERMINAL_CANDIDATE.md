# R7.4 isolated terminal Replay candidate

Base: 3b47a4da08ee34bccfe3cece74949a3cc0fffd74 (10/10 workflows passed).
Replay source: 41608c672f6bd5b9af1f7cf41475b128b9eb2d47 (2/2 passed).
Scoring source: cbcfd86806f3272350484368670d790d55648fd8 (Verify passed).
UI source: d3ee6b45f7f93203bfbd55656ac23b798ce0072b (3/4 workflows passed; seeded Beginner/Intermediate rejected claimResolution; older public deployment not retested).

Twelve source-owned files have matching prior blobs on the base and are composed without overwriting unrelated changes. The integration workflow is independent; it runs strict native tests and the three actual seeded Chromium matrix jobs plus aggregate coverage. Existing transactional SW retained with new generation. No public deployment, no main change, no authority table activation. No Academy promotion; its separate candidate remains under test.

Status: NOT_RUN for this exact SHA; no release approval. A successful native test is not a replacement for actual terminal frame UI and aggregate WIN/DRAW/action coverage. Physical devices and public HTTPS remain unverified.
