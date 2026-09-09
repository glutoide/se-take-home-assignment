import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('interactive CLI accepts commands from stdin', () => {
  const run = spawnSync(process.execPath, ['src/cli.js'], {
    cwd: process.cwd(),
    input: 'normal\nvip\nstatus\nexit\n',
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Normal order #1 created/);
  assert.match(run.stdout, /VIP order #2 created/);
  assert.match(run.stdout, /PENDING: VIP#2, NORMAL#1/);
  assert.match(run.stdout, /Bye/);
});
