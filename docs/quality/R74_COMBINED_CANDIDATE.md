# R7.4 composed candidate (not release approval)

Parent 358afd9853b285081e570aadc6f5d214ee023f33: authority host native 29/29 (run 45444552957), including previously accepted Bot contract 26/26.
Academy parent a31afc423cab5b19835b4c09bf2af4a0df2f4165: 3/3 (45442324867).
Adaptive d4cbb32867a12bbc444d0910f827785ca3c1c296: PASS (45443354296).
PWA test d7fdc5fbcb9073d41cf2ecb4b41a3286013ecb4b: source CI in progress, integration regression reproduced at 45441897212.
Existing PR #53 e89e3623: 9/10, terminal candidate 5/5.

Academy/Adaptive delta checked against prior source blobs; only table-ui/main.js and sw.js overlap. Table entrance retains fixed-seed QA and adds Daily mode capture before rerender. Academy transaction SW retains rollback policy and adds shell entry and read-only attestation, with unique combined generation. PWA lifecycle test is exact source revision. No public authority selection or deployment. All release gates NO-GO; full composed workflow must independently pass. Existing PWA ownership pin in PR #53 requires reconciliation: mobile-update test matches d7fdc5fb; combined transaction test includes Academy attestation regression beyond prior owner revision. Do not weaken ownership assertions or promote until reconciled. Physical-device and public HTTPS unverified.
