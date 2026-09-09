import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderController } from '../src/order-controller.js';

const commandModule = await import('../src/command-handler.js').catch(() => null);

test('CLI commands create normal/VIP orders and bots through the controller', () => {
  assert.ok(commandModule?.handleCommand, 'handleCommand should be implemented');

  const controller = new OrderController({ setTimeoutFn: () => 1, clearTimeoutFn: () => {} });
  commandModule.handleCommand(controller, 'normal');
  commandModule.handleCommand(controller, 'vip');
  const botResult = commandModule.handleCommand(controller, '+bot');

  const state = controller.getState();
  assert.match(botResult.message, /Bot #1/);
  assert.deepEqual(state.pending.map(({ number, type }) => [number, type]), [[1, 'NORMAL']]);
  assert.equal(state.bots[0].orderNumber, 2);

  const status = commandModule.handleCommand(controller, 'status');
  assert.match(status.message, /PENDING: NORMAL#1/);
  assert.match(status.message, /BOTS: #1 PROCESSING order#2/);
});
