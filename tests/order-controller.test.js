const test = require('node:test');
const assert = require('node:assert/strict');

let OrderController;
try {
  ({ OrderController } = require('../src/order-controller'));
} catch {
  OrderController = undefined;
}

test('creates a normal order in pending with an increasing id', () => {
  assert.equal(typeof OrderController, 'function');
  const controller = new OrderController();
  const first = controller.addOrder('NORMAL');
  const second = controller.addOrder('NORMAL');
  assert.equal(first.id, 1);
  assert.equal(second.id, 2);
  assert.deepEqual(controller.snapshot().pending.map((o) => o.id), [1, 2]);
});

test('queues VIP orders before normal orders while preserving FIFO within each priority', () => {
  const controller = new OrderController();
  controller.addOrder('NORMAL'); // 1
  controller.addOrder('VIP');    // 2
  controller.addOrder('NORMAL'); // 3
  controller.addOrder('VIP');    // 4
  assert.deepEqual(controller.snapshot().pending.map((o) => o.id), [2, 4, 1, 3]);
});

class FakeScheduler {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = [];
  }

  setTimeout(fn, delay) {
    const id = this.nextId++;
    this.tasks.push({ id, at: this.now + delay, fn, cancelled: false });
    return id;
  }

  clearTimeout(id) {
    const task = this.tasks.find((item) => item.id === id);
    if (task) task.cancelled = true;
  }

  advance(ms) {
    const target = this.now + ms;
    while (true) {
      const task = this.tasks
        .filter((item) => !item.cancelled && item.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!task) break;
      task.cancelled = true;
      this.now = task.at;
      task.fn();
    }
    this.now = target;
  }
}

test('a new bot immediately processes pending orders and completes each after 10 seconds', () => {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({ scheduler });
  controller.addOrder('NORMAL');
  controller.addOrder('NORMAL');

  controller.addBot();
  let state = controller.snapshot();
  assert.equal(state.bots[0].orderId, 1);
  assert.deepEqual(state.pending.map((o) => o.id), [2]);

  scheduler.advance(9_999);
  assert.deepEqual(controller.snapshot().complete, []);

  scheduler.advance(1);
  state = controller.snapshot();
  assert.deepEqual(state.complete.map((o) => o.id), [1]);
  assert.equal(state.bots[0].orderId, 2);

  scheduler.advance(10_000);
  state = controller.snapshot();
  assert.deepEqual(state.complete.map((o) => o.id), [1, 2]);
  assert.equal(state.bots[0].orderId, null);
  assert.equal(state.bots[0].status, 'IDLE');
});

test('an idle bot immediately picks up a newly submitted order', () => {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({ scheduler });
  controller.addBot();
  assert.equal(controller.snapshot().bots[0].status, 'IDLE');

  controller.addOrder('VIP');
  const state = controller.snapshot();
  assert.equal(state.bots[0].status, 'PROCESSING');
  assert.equal(state.bots[0].orderId, 1);
  assert.deepEqual(state.pending, []);
});

test('removing the newest bot cancels its work and restores the order to its original queue position', () => {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({ scheduler });
  controller.addOrder('NORMAL'); // 1
  controller.addOrder('NORMAL'); // 2
  controller.addOrder('NORMAL'); // 3
  controller.addBot(); // works 1
  controller.addBot(); // works 2 (newest)

  const removed = controller.removeBot();
  assert.equal(removed.id, 2);
  const state = controller.snapshot();
  assert.deepEqual(state.bots.map((b) => b.id), [1]);
  assert.equal(state.bots[0].orderId, 1);
  assert.deepEqual(state.pending.map((o) => o.id), [2, 3]);

  scheduler.advance(10_000);
  const after = controller.snapshot();
  assert.deepEqual(after.complete.map((o) => o.id), [1]);
  assert.equal(after.bots[0].orderId, 2);
});

test('multiple bots process different orders in parallel', () => {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({ scheduler });
  controller.addOrder('VIP');
  controller.addOrder('NORMAL');
  controller.addBot();
  controller.addBot();

  let state = controller.snapshot();
  assert.deepEqual(state.bots.map((b) => b.orderId), [1, 2]);
  assert.deepEqual(state.pending, []);

  scheduler.advance(10_000);
  state = controller.snapshot();
  assert.deepEqual(state.complete.map((o) => o.id), [1, 2]);
  assert.deepEqual(state.bots.map((b) => b.status), ['IDLE', 'IDLE']);
});

test('a cancelled VIP order returns ahead of pending normal orders', () => {
  const scheduler = new FakeScheduler();
  const controller = new OrderController({ scheduler });
  controller.addOrder('VIP');    // 1
  controller.addOrder('VIP');    // 2
  controller.addOrder('NORMAL'); // 3
  controller.addBot(); // VIP 1
  controller.addBot(); // VIP 2 newest bot

  controller.removeBot();
  assert.deepEqual(controller.snapshot().pending.map((o) => o.id), [2, 3]);
});
