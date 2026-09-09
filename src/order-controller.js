const DEFAULT_PROCESSING_MS = 10_000;

class OrderController {
  constructor({ scheduler } = {}) {
    this.scheduler = scheduler || {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
    };
    this.nextOrderId = 1;
    this.nextBotId = 1;
    this.pending = [];
    this.complete = [];
    this.bots = [];
  }

  addOrder(type) {
    const order = { id: this.nextOrderId++, type, status: 'PENDING' };
    this.insertPending(order);
    const idleBot = this.bots.find((bot) => bot.status === 'IDLE');
    if (idleBot) this.assignNext(idleBot);
    return order;
  }

  insertPending(order) {
    this.pending.push(order);
    this.pending.sort((a, b) => {
      const priority = (a.type === 'VIP' ? 0 : 1) - (b.type === 'VIP' ? 0 : 1);
      return priority || a.id - b.id;
    });
  }

  addBot() {
    const bot = { id: this.nextBotId++, status: 'IDLE', orderId: null, timerId: null, currentOrder: null };
    this.bots.push(bot);
    this.assignNext(bot);
    return bot;
  }

  assignNext(bot) {
    if (bot.orderId !== null || this.pending.length === 0) return;
    const order = this.pending.shift();
    bot.status = 'PROCESSING';
    bot.orderId = order.id;
    bot.currentOrder = order;
    bot.timerId = this.scheduler.setTimeout(() => {
      order.status = 'COMPLETE';
      this.complete.push(order);
      bot.status = 'IDLE';
      bot.orderId = null;
      bot.timerId = null;
      bot.currentOrder = null;
      this.assignNext(bot);
    }, DEFAULT_PROCESSING_MS);
  }

  removeBot() {
    const bot = this.bots.pop();
    if (!bot) return null;

    if (bot.currentOrder) {
      this.scheduler.clearTimeout(bot.timerId);
      bot.currentOrder.status = 'PENDING';
      this.insertPending(bot.currentOrder);
      bot.currentOrder = null;
      bot.orderId = null;
      bot.timerId = null;
      bot.status = 'IDLE';
    }

    return { id: bot.id, status: bot.status, orderId: bot.orderId };
  }

  snapshot() {
    return {
      pending: this.pending.map((order) => ({ ...order })),
      complete: this.complete.map((order) => ({ ...order })),
      bots: this.bots.map(({ timerId, currentOrder, ...bot }) => ({ ...bot })),
    };
  }
}

module.exports = { OrderController };
