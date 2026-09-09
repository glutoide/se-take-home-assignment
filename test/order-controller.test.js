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
