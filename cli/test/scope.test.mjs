import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { resolveTargetDir, GLOBAL_SUPPORT, filterAgentsForScope } from '../lib/scope.mjs';

test('resolveTargetDir: global resolves to homedir', () => {
  assert.equal(resolveTargetDir('global'), os.homedir());
});

test('resolveTargetDir: local resolves to cwd', () => {
  assert.equal(resolveTargetDir('local'), process.cwd());
});

test('resolveTargetDir: absolute path passes through', () => {
  assert.equal(resolveTargetDir('/tmp/mydir'), '/tmp/mydir');
});

test('resolveTargetDir: relative path resolves to absolute', () => {
  assert.equal(resolveTargetDir('./foo'), path.resolve('./foo'));
});

test('GLOBAL_SUPPORT: claude is supported', () => {
  assert.equal(GLOBAL_SUPPORT.claude, true);
});

test('GLOBAL_SUPPORT: codex is not supported', () => {
  assert.equal(GLOBAL_SUPPORT.codex, false);
});

test('GLOBAL_SUPPORT: cursor is not supported', () => {
  assert.equal(GLOBAL_SUPPORT.cursor, false);
});

test('filterAgentsForScope: passes all agents for local scope', () => {
  const result = filterAgentsForScope(['claude', 'codex', 'cursor'], process.cwd());
  assert.deepEqual(result, ['claude', 'codex', 'cursor']);
});

test('filterAgentsForScope: keeps only supported agents for global scope', () => {
  const result = filterAgentsForScope(['claude', 'codex', 'cursor'], os.homedir());
  assert.deepEqual(result, ['claude']);
});

test('filterAgentsForScope: passes all agents for custom path', () => {
  const result = filterAgentsForScope(['claude', 'codex', 'cursor'], '/some/custom/path');
  assert.deepEqual(result, ['claude', 'codex', 'cursor']);
});
