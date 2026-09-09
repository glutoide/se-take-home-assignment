import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(here, '..', 'src', 'cli.js');

test('CLI accepts commands and prints timestamped order state', () => {
  const result = spawnSync(process.execPath, [cliPath], {
    input: 'normal\nvip\n+bot\nwait 30\nstatus\nexit\n',
    encoding: 'utf8',
    env: { ...process.env, ORDER_PROCESS_MS: '20' },
    timeout: 5_000,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[\d{2}:\d{2}:\d{2}\]/);
  assert.match(result.stdout, /VIP order #2 started by Bot #1/);
  assert.match(result.stdout, /Order #2 COMPLETE/);
  assert.match(result.stdout, /PENDING: empty/);
  assert.match(result.stdout, /BOTS: #1 BUSY\(#1 NORMAL\)/);
  assert.match(result.stdout, /COMPLETE: #2 VIP/);
});
