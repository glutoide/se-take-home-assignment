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

function createFakeScheduler() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();

  return {
    setTimeout(fn, delay) {
      const id = nextId++;
      tasks.set(id, { at: now + delay, fn });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      while (true) {
        const due = [...tasks.entries()]
          .filter(([, task]) => task.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        const [id, task] = due;
        tasks.delete(id);
        now = task.at;
        task.fn();
      }
      now = target;
    },
  };
}

test('a bot processes one order at a time, completes after 10 seconds, then becomes idle', () => {
  const scheduler = createFakeScheduler();
  const controller = new controllerModule.OrderController({
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
  });

  controller.addOrder('NORMAL');
  controller.addOrder('NORMAL');
  controller.addBot();

  let state = controller.getState();
  assert.deepEqual(state.pending.map((order) => order.number), [2]);
  assert.equal(state.bots[0].status, 'PROCESSING');
  assert.equal(state.bots[0].orderNumber, 1);

  scheduler.advance(9_999);
  assert.equal(controller.getState().complete.length, 0);

  scheduler.advance(1);
  state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [1]);
  assert.equal(state.bots[0].status, 'PROCESSING');
  assert.equal(state.bots[0].orderNumber, 2);

  scheduler.advance(10_000);
  state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [1, 2]);
  assert.equal(state.bots[0].status, 'IDLE');
  assert.equal(state.bots[0].orderNumber, null);
});

test('removing the newest bot cancels its work and returns the order to its priority position', () => {
  const scheduler = createFakeScheduler();
  const controller = new controllerModule.OrderController({
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout,
  });

  controller.addOrder('NORMAL'); // #1
  controller.addOrder('VIP');    // #2
  controller.addOrder('NORMAL'); // #3
  controller.addOrder('VIP');    // #4
  controller.addBot();           // bot #1 -> order #2
  controller.addBot();           // bot #2 -> order #4
  controller.addOrder('VIP');    // #5 pending

  const removedBotId = controller.removeBot();
  let state = controller.getState();

  assert.equal(removedBotId, 2);
  assert.deepEqual(state.bots.map((bot) => bot.id), [1]);
  assert.deepEqual(state.pending.map(({ number, type }) => [number, type]), [
    [4, 'VIP'],
    [5, 'VIP'],
    [1, 'NORMAL'],
    [3, 'NORMAL'],
  ]);

  scheduler.advance(10_000);
  state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [2]);
  assert.equal(state.bots[0].orderNumber, 4);

  scheduler.advance(10_000);
  state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [2, 4]);
});
