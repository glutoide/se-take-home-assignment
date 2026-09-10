'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

test('interactive CLI accepts order and bot commands and timestamps every output line', () => {
  const result = spawnSync(process.execPath, [cliPath], {
    input: 'normal\nvip\nstatus\n+bot\n-bot\nexit\n',
    encoding: 'utf8',
    timeout: 2_000,
  });

  assert.equal(result.status, 0, `CLI failed:\n${result.stderr}`);
  assert.match(result.stdout, /Order #1 NORMAL -> PENDING/);
  assert.match(result.stdout, /Order #2 VIP -> PENDING/);
  assert.match(result.stdout, /PENDING: \[VIP #2, NORMAL #1\]/);
  assert.match(result.stdout, /Bot #1 created/);
  assert.match(result.stdout, /Bot #1 started VIP order #2/);
  assert.match(result.stdout, /Order #2 VIP -> PENDING \(Bot #1 removed\)/);
  assert.match(result.stdout, /Bot #1 removed/);

  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.match(line, /^\d{2}:\d{2}:\d{2} /, `missing timestamp: ${line}`);
  }
});

test('exit terminates promptly even while a bot is processing', () => {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [cliPath], {
    input: 'normal\n+bot\nexit\n',
    encoding: 'utf8',
    timeout: 1_000,
  });
  const elapsed = Date.now() - startedAt;

  assert.equal(result.status, 0, `CLI did not exit cleanly: ${result.error?.message ?? result.stderr}`);
  assert.ok(elapsed < 1_000, `CLI exit took ${elapsed}ms with an active bot`);
});
