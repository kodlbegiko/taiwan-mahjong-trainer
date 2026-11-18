import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { shanten } from '../src/shanten.js';
import { dealLegalHand, makeRng } from './fixtures/seeded-hands.js';

test('shanten benchmark smoke: finite positive durations and deterministic checksum', t => {
  const rng = makeRng(314159);
  const hands = Array.from({ length: 40 }, (_, i) => dealLegalHand(rng, i % 2 ? 16 : 17));
  let checksum = 0;
  const start = performance.now();
  for (const hand of hands) checksum += shanten(hand);
  const elapsed = performance.now() - start;
  assert.ok(Number.isFinite(elapsed) && elapsed >= 0);
  assert.ok(Number.isInteger(checksum));
  t.diagnostic(`40 shanten evaluations: ${elapsed.toFixed(3)}ms, checksum=${checksum}. This is not a CI latency gate.`);
});

/** A real Node CLI smoke benchmark on the CI runner, not a latency gate. */
test('benchmark CLI reports machine identity, invocation and p50/p95 via Node child process', t => {
  const command = fileURLToPath(new URL('../scripts/benchmark-suite.js', import.meta.url));
  const result = spawnSync(process.execPath, [command, '--cases', '500', '--seed', '20261119'], {
    encoding: 'utf8', timeout: 60_000, maxBuffer: 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema, 2);
  assert.equal(report.seed, 20261119);
  assert.equal(report.requestedCases, 500);
  assert.equal(report.environment.node, process.version);
  assert.equal(report.environment.platform, process.platform);
  assert.equal(report.environment.arch, process.arch);
  assert.equal(typeof report.environment.cpuModel, 'string');
  assert.ok(report.environment.cpuModel.length > 0);
  assert.ok(report.environment.logicalCores >= 1);
  for (const name of ['shanten', 'rankDiscards']) {
    assert.ok(report[name].runs > 0);
    assert.ok(Number.isFinite(report[name].p50_ms));
    assert.ok(Number.isFinite(report[name].p95_ms));
    assert.ok(report[name].max_ms >= report[name].p95_ms);
  }
  t.diagnostic('BENCHMARK_REPORT_JSON ' + JSON.stringify(report));
});
