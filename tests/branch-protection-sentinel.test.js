/**
 * Issue #13 ONLY: intentional failing CI check on an isolated draft PR.
 * DO NOT MERGE this file or branch into main.
 * Remove this sentinel after ruleset enforcement has been verified.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('Issue #13 negative control — Verify must fail; DO NOT MERGE', () => {
  assert.fail('Intentional failing governance sentinel: this PR must remain unmerged');
});
