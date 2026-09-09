import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderController } from '../src/order-controller.js';

class FakeScheduler {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(fn, delay) {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delay, fn });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  advance(ms) {
    const target = this.now + ms;
    while (true) {
      const due = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!due) break;
      const [id, task] = due;
      this.tasks.delete(id);
      this.now = task.at;
      task.fn();
    }
    this.now = target;
  }
}

function makeController() {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({
    processTimeMs: 10_000,
    setTimeoutFn: scheduler.setTimeout.bind(scheduler),
    clearTimeoutFn: scheduler.clearTimeout.bind(scheduler),
  });
  return { controller, scheduler };
}

test('normal orders enter PENDING in FIFO order with increasing unique numbers', () => {
  const { controller } = makeController();
  const first = controller.addOrder('NORMAL');
  const second = controller.addOrder('NORMAL');

  assert.equal(first.number, 1);
  assert.equal(second.number, 2);
  assert.deepEqual(controller.getState().pending.map((order) => order.number), [1, 2]);
});

test('VIP orders queue before normal orders while preserving FIFO within priority', () => {
  const { controller } = makeController();
  controller.addOrder('NORMAL');
  controller.addOrder('VIP');
  controller.addOrder('NORMAL');
  controller.addOrder('VIP');

  assert.deepEqual(controller.getState().pending.map((order) => order.number), [2, 4, 1, 3]);
});

test('adding a bot immediately starts the highest-priority pending order', () => {
  const { controller } = makeController();
  controller.addOrder('NORMAL');
  controller.addOrder('VIP');
  controller.addBot();

  const state = controller.getState();
  assert.deepEqual(state.pending.map((order) => order.number), [1]);
  assert.equal(state.bots[0].status, 'BUSY');
  assert.equal(state.bots[0].order.number, 2);
});

test('a bot completes an order after exactly 10 seconds and takes the next order', () => {
  const { controller, scheduler } = makeController();
  controller.addOrder('NORMAL');
  controller.addOrder('NORMAL');
  controller.addBot();

  scheduler.advance(9_999);
  assert.equal(controller.getState().complete.length, 0);

  scheduler.advance(1);
  let state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [1]);
  assert.equal(state.bots[0].order.number, 2);

  scheduler.advance(10_000);
  state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [1, 2]);
  assert.equal(state.bots[0].status, 'IDLE');
});

test('an idle bot immediately takes an order that arrives later', () => {
  const { controller } = makeController();
  controller.addBot();
  controller.addOrder('VIP');

  const state = controller.getState();
  assert.equal(state.bots[0].status, 'BUSY');
  assert.equal(state.bots[0].order.number, 1);
});

test('multiple bots process different orders in parallel', () => {
  const { controller, scheduler } = makeController();
  controller.addOrder('NORMAL');
  controller.addOrder('NORMAL');
  controller.addBot();
  controller.addBot();

  assert.deepEqual(controller.getState().bots.map((bot) => bot.order?.number), [1, 2]);
  scheduler.advance(10_000);
  assert.deepEqual(controller.getState().complete.map((order) => order.number), [1, 2]);
});

test('removing a bot destroys the newest bot', () => {
  const { controller } = makeController();
  controller.addBot();
  controller.addBot();
  controller.addBot();

  const removed = controller.removeBot();
  assert.equal(removed.id, 3);
  assert.deepEqual(controller.getState().bots.map((bot) => bot.id), [1, 2]);
});

test('removing a busy newest bot returns its order to the correct priority position', () => {
  const { controller, scheduler } = makeController();
  controller.addOrder('NORMAL'); // #1
  controller.addOrder('VIP');    // #2
  controller.addOrder('VIP');    // #3
  controller.addBot();           // bot 1 -> #2
  controller.addBot();           // bot 2 -> #3

  controller.removeBot();
  assert.deepEqual(controller.getState().pending.map((order) => order.number), [3, 1]);
  assert.equal(controller.getState().bots[0].order.number, 2);

  scheduler.advance(10_000);
  const state = controller.getState();
  assert.deepEqual(state.complete.map((order) => order.number), [2]);
  assert.equal(state.bots[0].order.number, 3);
});

test('a cancelled timer cannot complete an order after its bot is removed', () => {
  const { controller, scheduler } = makeController();
  controller.addOrder('NORMAL');
  controller.addBot();
  controller.removeBot();

  scheduler.advance(20_000);
  const state = controller.getState();
  assert.equal(state.complete.length, 0);
  assert.deepEqual(state.pending.map((order) => order.number), [1]);
});
