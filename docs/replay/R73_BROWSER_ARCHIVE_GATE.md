# R7.3 continuation: native CI and browser archive gate

Source application pin 661ae598e5cf4d15c8998b8be0e152ceef365b12.

- Native Verify run 45329246393 job 138226128041: 384 tests, 378 pass, 0 fail, 6 skipped; source-only skips do not establish combined authority acceptance.
- Native Phase 3 run 45329246404 job 138226127905: all Node steps PASS; R5 strict 100/100 settled and replay matches, 89 WIN, 11 DRAW, no unsupported/invalid/stalled/mismatch. Legacy R3 Seed87 remains expected unsupported; accepted prefix replay 100/100.
- Same run browser job 138226128377 FAIL: tests/browser/full-table-ui-r3-gates.py:257, AssertionError: offline real R3 result unavailable. Evidence artifact 14890419489. Online full round/Daily steps occurred before the failing offline assertion; this is not overall browser PASS.
- Concrete standalone dependency defect: src/replay/internal.js statically imports ./integrity.js while its existing sw.js cache list contains index.js and internal.js only. R7.2 integration 793bbb1c already lists integrity.js. Missing precache is a demonstrable offline module-graph defect, but the existing browser error alone does not prove it is the only cause. Agent 7/8 own SW correction; no SW edits here.

## Mandatory combined browser gate

New Replay-owned `tests/replay/r73-browser-archive-gate.py` exercises real browser Web Storage, real Rules/Scoring/Replay modules and production SW on the existing isolated localhost server. It checks actual cache bytes against checkout SHA-256, browser-native WebCrypto parity, old FNV and SHA records, new authority SHA archive, index recovery, privacy, idempotent save without byte changes, reload and a new tab opened offline. Frozen archives are synthetic historical test records, not fabricated live UI matches. Missing browser/runtime/cache is a failure, not a skip.

On an exact combined checkout with regenerated SW and installed Playwright browsers:

```sh
python tests/replay/r73-browser-archive-gate.py --engine chromium --evidence artifacts/replay-chromium.json
python tests/replay/r73-browser-archive-gate.py --engine webkit --evidence artifacts/replay-webkit.json
python tests/replay/r73-browser-archive-gate.py --engine firefox --evidence artifacts/replay-firefox.json
```

For actual old-to-new SW upgrade, supply a separate actual earlier integrated checkout supporting both historical FNV and SHA records (e.g. 793bbb1c) with a distinct cache generation, using `--previous-tree /path/to/old-checkout`. The temporary HTTP server switches actual release files and activates the waiting worker; no source checkout modified. Upgrade=true is only recorded for legacy cases that exercised this path. Without previous-tree, the gate covers readback of historical records on the candidate, not SW upgrade.

No browser execution is claimed for this new script at the time of submission. Native combined gate and public HTTPS real UI E2E remain BLOCKED until Agent 8 composes the candidate and Agent 7 regenerates cache. The script uses a secure localhost context and is not actual Safari/iPhone, Android or HTTPS deployment evidence.

Keep PR #46 Draft, NO-GO. Do not edit or bypass existing full-match UI test. No new PR or cross-owner files.
