import test from 'node:test';
import assert from 'node:assert/strict';

const controllerModule = await import('../src/order-controller.js').catch(() => null);

test('a normal order enters the pending queue', () => {
  assert.ok(controllerModule?.OrderController, 'OrderController should be implemented');

  const controller = new controllerModule.OrderController();
  const order = controller.addOrder('NORMAL');
  const state = controller.getState();

  assert.equal(order.number, 1);
  assert.deepEqual(state.pending.map(({ number, type }) => ({ number, type })), [
    { number: 1, type: 'NORMAL' },
  ]);
  assert.equal(state.complete.length, 0);
});

test('VIP orders queue before normal orders while preserving FIFO within priority', () => {
  const controller = new controllerModule.OrderController();

  controller.addOrder('NORMAL'); // #1
  controller.addOrder('VIP');    // #2
  controller.addOrder('VIP');    // #3
  controller.addOrder('NORMAL'); // #4

  assert.deepEqual(controller.getState().pending.map(({ number, type }) => [number, type]), [
    [2, 'VIP'],
    [3, 'VIP'],
    [1, 'NORMAL'],
    [4, 'NORMAL'],
  ]);
});
