'use strict';

const ORDER_TYPES = Object.freeze({
  NORMAL: 'NORMAL',
  VIP: 'VIP',
});

class OrderController {
  constructor({ scheduler, processingMs = 10_000, onEvent } = {}) {
    if (!Number.isFinite(processingMs) || processingMs <= 0) {
      throw new TypeError('processingMs must be a positive number');
    }

    this.scheduler = scheduler ?? {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timerId) => clearTimeout(timerId),
    };
    this.processingMs = processingMs;
    this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};

    this.nextOrderId = 1;
    this.nextBotId = 1;
    this.pending = [];
    this.complete = [];
    this.bots = [];
  }

  addNormalOrder() {
    return this.#addOrder(ORDER_TYPES.NORMAL);
  }

  addVipOrder() {
    return this.#addOrder(ORDER_TYPES.VIP);
  }

  addBot() {
    const bot = {
      id: this.nextBotId++,
      status: 'IDLE',
      order: null,
      timerId: null,
    };
    this.bots.push(bot);
    this.#emit({ type: 'bot-created', botId: bot.id });
    this.#assignNextOrder(bot);
    return this.#publicBot(bot);
  }

  removeBot() {
    const bot = this.bots.pop();
    if (!bot) return null;

    const removed = this.#publicBot(bot);
    if (bot.status === 'PROCESSING' && bot.order) {
      this.scheduler.clearTimeout(bot.timerId);
      const interruptedOrder = bot.order;
      interruptedOrder.status = 'PENDING';
      this.pending.push(interruptedOrder);
      this.#sortPending();
      this.#emit({
        type: 'order-requeued',
        botId: bot.id,
        orderId: interruptedOrder.id,
        orderType: interruptedOrder.type,
      });
    }

    this.#emit({ type: 'bot-removed', botId: bot.id });
    this.#dispatchIdleBots();
    return removed;
  }

  shutdown() {
    for (const bot of this.bots) {
      if (bot.timerId !== null) this.scheduler.clearTimeout(bot.timerId);
      bot.timerId = null;
    }
  }

  getSnapshot() {
    return {
      pending: this.pending.map((order) => this.#publicOrder(order)),
      complete: this.complete.map((order) => this.#publicOrder(order)),
      bots: this.bots.map((bot) => this.#publicBot(bot)),
    };
  }

  #addOrder(type) {
    const order = {
      id: this.nextOrderId++,
      type,
      sequence: this.nextOrderId - 1,
      status: 'PENDING',
    };

    this.pending.push(order);
    this.#sortPending();
    this.#emit({ type: 'order-created', orderId: order.id, orderType: order.type });
    this.#dispatchIdleBots();
    return this.#publicOrder(order);
  }

  #sortPending() {
    this.pending.sort((left, right) => {
      if (left.type !== right.type) return left.type === ORDER_TYPES.VIP ? -1 : 1;
      return left.sequence - right.sequence;
    });
  }

  #dispatchIdleBots() {
    for (const bot of this.bots) {
      if (this.pending.length === 0) break;
      if (bot.status === 'IDLE') this.#assignNextOrder(bot);
    }
  }

  #assignNextOrder(bot) {
    if (bot.status !== 'IDLE') return;
    const order = this.pending.shift();
    if (!order) {
      this.#emit({ type: 'bot-idle', botId: bot.id });
      return;
    }

    order.status = 'PROCESSING';
    bot.status = 'PROCESSING';
    bot.order = order;
    this.#emit({
      type: 'order-started',
      botId: bot.id,
      orderId: order.id,
      orderType: order.type,
    });

    bot.timerId = this.scheduler.setTimeout(
      () => this.#completeOrder(bot.id, order.id),
      this.processingMs,
    );
  }

  #completeOrder(botId, orderId) {
    const bot = this.bots.find((candidate) => candidate.id === botId);
    if (!bot || bot.status !== 'PROCESSING' || bot.order?.id !== orderId) return;

    const order = bot.order;
    order.status = 'COMPLETE';
    this.complete.push(order);
    bot.status = 'IDLE';
    bot.order = null;
    bot.timerId = null;

    this.#emit({
      type: 'order-completed',
      botId: bot.id,
      orderId: order.id,
      orderType: order.type,
    });

    if (this.pending.length > 0) this.#assignNextOrder(bot);
    else this.#emit({ type: 'bot-idle', botId: bot.id });
  }

  #emit(event) {
    this.onEvent(Object.freeze({ ...event }));
  }

  #publicOrder(order) {
    return Object.freeze({ id: order.id, type: order.type, status: order.status });
  }

  #publicBot(bot) {
    return Object.freeze({
      id: bot.id,
      status: bot.status,
      orderId: bot.order?.id ?? null,
    });
  }
}

module.exports = { OrderController, ORDER_TYPES };
