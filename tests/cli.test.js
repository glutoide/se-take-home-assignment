const test = require('node:test');
const assert = require('node:assert/strict');
const { OrderController } = require('../src/order-controller');

let executeCommand;
try {
  ({ executeCommand } = require('../src/cli'));
} catch {
  executeCommand = undefined;
}

test('CLI commands drive normal, VIP and bot actions', () => {
  assert.equal(typeof executeCommand, 'function');
  const output = [];
  const controller = new OrderController({ scheduler: { setTimeout: () => 1, clearTimeout: () => {} } });
  const log = (message) => output.push(message);

  executeCommand(controller, 'normal', log);
  executeCommand(controller, 'vip', log);
  executeCommand(controller, '+bot', log);

  const state = controller.snapshot();
  assert.equal(state.bots.length, 1);
  assert.equal(state.bots[0].orderId, 2);
  assert.deepEqual(state.pending.map((o) => o.id), [1]);
  assert.ok(output.length >= 3);
});

test('timestamp output uses HH:MM:SS format', () => {
  const { timestamp } = require('../src/cli');
  assert.equal(timestamp(new Date('2026-09-09T12:34:56Z')), '12:34:56');
});
