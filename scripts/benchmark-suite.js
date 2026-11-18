#!/usr/bin/env node
/**
 * Deterministic performance report. No dependency and no brittle hard-coded CI gate.
 * Usage: node scripts/benchmark-suite.js --cases 500 --seed 20261119
 * Compare: node scripts/benchmark-suite.js --baseline docs/quality/baseline.example.json --max-regression 1.5
 */
import { performance } from 'node:perf_hooks';
import { readFile, writeFile } from 'node:fs/promises';
import { shanten } from '../src/shanten.js';
import { rankDiscards } from '../src/practice.js';
import { dealLegalHand, makeRng } from '../tests/fixtures/seeded-hands.js';

function options(argv) {
  const opts = { cases: 500, seed: 20261119, maxRegression: 1.5 };
  const fields = { '--cases': 'cases', '--seed': 'seed', '--out': 'out', '--baseline': 'baseline', '--max-regression': 'maxRegression' };
  for (let i = 0; i < argv.length; i++) {
    const field = fields[argv[i]];
    if (!field || i + 1 >= argv.length) throw new Error(`unknown or incomplete argument: ${argv[i]}`);
    const value = argv[++i];
    opts[field] = ['cases', 'seed', 'maxRegression'].includes(field) ? Number(value) : value;
  }
  if (!Number.isSafeInteger(opts.cases) || opts.cases < 1 || opts.cases > 100000) throw new RangeError('cases: 1..100000');
  if (!Number.isSafeInteger(opts.seed)) throw new RangeError('seed must be a safe integer');
  if (!Number.isFinite(opts.maxRegression) || opts.maxRegression <= 1) throw new RangeError('max-regression must exceed 1');
  return opts;
}

function metric(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
  return {
    runs: sorted.length,
    p50_ms: Number(percentile(0.5).toFixed(4)),
    p95_ms: Number(percentile(0.95).toFixed(4)),
    max_ms: Number(sorted.at(-1).toFixed(4)),
    total_ms: Number(sorted.reduce((a, b) => a + b, 0).toFixed(3)),
  };
}

function runTimed(fn, hands) {
  const elapsed = [];
  let checksum = 0;
  for (const hand of hands) {
    const begin = performance.now();
    const result = fn(hand);
    elapsed.push(performance.now() - begin);
    checksum += typeof result === 'number' ? result : result.length;
  }
  return { ...metric(elapsed), checksum };
}

async function main() {
  const opts = options(process.argv.slice(2));
  const rng = makeRng(opts.seed);
  const hands = Array.from({ length: opts.cases }, (_, i) => dealLegalHand(rng, i % 2 ? 16 : 17));
  const ranks = Array.from({ length: Math.max(1, Math.ceil(opts.cases / 20)) }, () => dealLegalHand(rng, 17));
  for (const hand of hands.slice(0, Math.min(50, hands.length))) shanten(hand);
  for (const hand of ranks.slice(0, 2)) rankDiscards(hand);
  const shantenResult = runTimed(shanten, hands);
  const rankingResult = runTimed(rankDiscards, ranks);
  const report = {
    schema: 1,
    seed: opts.seed,
    requestedCases: opts.cases,
    environment: { node: process.version, platform: process.platform, arch: process.arch, cpuNote: 'Record machine model externally for cross-machine comparison' },
    shanten: shantenResult,
    rankDiscards: rankingResult,
    caveat: 'Time is environment-dependent; compare on the same runner, Node version and seed. Use stable p50/p95 and inspect noise.',
  };
  if (opts.baseline) {
    const base = JSON.parse(await readFile(opts.baseline, 'utf8'));
    if (base.seed !== opts.seed || base.requestedCases !== opts.cases || base.environment?.node !== process.version) {
      throw new Error('baseline seed/cases/Node version differ; cannot compare');
    }
    report.regressions = {};
    for (const name of ['shanten', 'rankDiscards']) {
      const ratio = report[name].p95_ms / base[name].p95_ms;
      report.regressions[name] = { p95_ratio: Number(ratio.toFixed(3)), limit: opts.maxRegression, exceeded: ratio > opts.maxRegression };
    }
  }
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (opts.out) await writeFile(opts.out, output, 'utf8');
  console.log(output);
  if (report.regressions && Object.values(report.regressions).some(result => result.exceeded)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
