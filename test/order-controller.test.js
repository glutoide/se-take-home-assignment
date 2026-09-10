'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { OrderController } = require('../src/order-controller');

class ManualScheduler {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delayMs) {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + delayMs, callback });
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
      task.callback();
    }
    this.now = target;
  }
}

function createController(options = {}) {
  const scheduler = options.scheduler ?? new ManualScheduler();
  const events = [];
  const controller = new OrderController({
    scheduler,
    processingMs: 10_000,
    onEvent: (event) => events.push(event),
  });
  return { controller, scheduler, events };
}

function pendingIds(controller) {
  return controller.getSnapshot().pending.map((order) => order.id);
}

test('normal and VIP orders keep VIP priority and FIFO while IDs increase uniquely', () => {
  const { controller } = createController();

  const normal1 = controller.addNormalOrder();
  const normal2 = controller.addNormalOrder();
  const vip3 = controller.addVipOrder();
  const vip4 = controller.addVipOrder();

  assert.deepEqual([normal1.id, normal2.id, vip3.id, vip4.id], [1, 2, 3, 4]);
  assert.deepEqual(pendingIds(controller), [3, 4, 1, 2]);
  assert.deepEqual(
    controller.getSnapshot().pending.map((order) => order.type),
    ['VIP', 'VIP', 'NORMAL', 'NORMAL'],
  );
});

test('a new bot immediately picks an order and completes it only after 10 seconds', () => {
  const { controller, scheduler } = createController();
  controller.addNormalOrder();

  const bot = controller.addBot();
  let snapshot = controller.getSnapshot();
  assert.equal(bot.id, 1);
  assert.deepEqual(snapshot.pending, []);
  assert.equal(snapshot.bots[0].status, 'PROCESSING');
  assert.equal(snapshot.bots[0].orderId, 1);

  scheduler.advance(9_999);
  snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.complete, []);
  assert.equal(snapshot.bots[0].status, 'PROCESSING');

  scheduler.advance(1);
  snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.complete.map((order) => order.id), [1]);
  assert.equal(snapshot.bots[0].status, 'IDLE');
  assert.equal(snapshot.bots[0].orderId, null);
});

test('an idle bot immediately picks a newly submitted order', () => {
  const { controller } = createController();
  controller.addBot();
  assert.equal(controller.getSnapshot().bots[0].status, 'IDLE');

  controller.addVipOrder();
  const snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.pending, []);
  assert.equal(snapshot.bots[0].status, 'PROCESSING');
  assert.equal(snapshot.bots[0].orderId, 1);
});

test('a bot automatically processes the next pending order after completion', () => {
  const { controller, scheduler } = createController();
  controller.addNormalOrder();
  controller.addNormalOrder();
  controller.addBot();

  scheduler.advance(10_000);
  let snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.complete.map((order) => order.id), [1]);
  assert.equal(snapshot.bots[0].orderId, 2);
  assert.equal(snapshot.bots[0].status, 'PROCESSING');

  scheduler.advance(10_000);
  snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.complete.map((order) => order.id), [1, 2]);
  assert.equal(snapshot.bots[0].status, 'IDLE');
});

test('multiple bots process at most one order each in parallel', () => {
  const { controller } = createController();
  controller.addNormalOrder();
  controller.addNormalOrder();
  controller.addNormalOrder();

  controller.addBot();
  controller.addBot();

  const snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.bots.map((bot) => bot.orderId), [1, 2]);
  assert.deepEqual(snapshot.pending.map((order) => order.id), [3]);
  assert.equal(new Set(snapshot.bots.map((bot) => bot.orderId)).size, 2);
});

test('removing a processing bot cancels its timer and restores the order to original priority position', () => {
  const { controller, scheduler } = createController();
  controller.addVipOrder();
  controller.addVipOrder();
  controller.addNormalOrder();
  controller.addBot();
  controller.addNormalOrder();

  const removed = controller.removeBot();
  assert.equal(removed.id, 1);
  assert.deepEqual(pendingIds(controller), [1, 2, 3, 4]);
  assert.deepEqual(controller.getSnapshot().bots, []);

  scheduler.advance(20_000);
  const snapshot = controller.getSnapshot();
  assert.deepEqual(snapshot.complete, []);
  assert.deepEqual(snapshot.pending.map((order) => order.id), [1, 2, 3, 4]);
});

test('removing a bot always destroys the newest bot first', () => {
  const { controller } = createController();
  controller.addBot();
  controller.addBot();
  controller.addBot();

  assert.equal(controller.removeBot().id, 3);
  assert.deepEqual(controller.getSnapshot().bots.map((bot) => bot.id), [1, 2]);
  assert.equal(controller.removeBot().id, 2);
  assert.deepEqual(controller.getSnapshot().bots.map((bot) => bot.id), [1]);
});

test('removing a bot when none exist is a safe no-op', () => {
  const { controller } = createController();
  assert.equal(controller.removeBot(), null);
  assert.deepEqual(controller.getSnapshot().bots, []);
});
