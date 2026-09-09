export class OrderController {
  #nextOrderNumber = 1;
  #nextBotId = 1;
  #pending = [];
  #complete = [];
  #bots = [];
  #processingMs;
  #setTimeoutFn;
  #clearTimeoutFn;

  constructor({ processingMs = 10_000, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
    this.#processingMs = processingMs;
    this.#setTimeoutFn = setTimeoutFn;
    this.#clearTimeoutFn = clearTimeoutFn;
  }

  addOrder(type) {
    const order = {
      number: this.#nextOrderNumber++,
      type,
      status: 'PENDING',
    };
    this.#insertPending(order);
    this.#dispatchIdleBots();
    return { ...order };
  }

  addBot() {
    const bot = {
      id: this.#nextBotId++,
      status: 'IDLE',
      order: null,
      timerId: null,
    };
    this.#bots.push(bot);
    this.#dispatchIdleBots();
    return bot.id;
  }

  #dispatchIdleBots() {
    for (const bot of this.#bots) {
      if (bot.status !== 'IDLE' || this.#pending.length === 0) continue;

      const order = this.#pending.shift();
      order.status = 'PROCESSING';
      bot.status = 'PROCESSING';
      bot.order = order;
      bot.timerId = this.#setTimeoutFn(
        () => this.#finishOrder(bot.id, order.number),
        this.#processingMs,
      );
    }
  }

  #finishOrder(botId, orderNumber) {
    const bot = this.#bots.find((candidate) => candidate.id === botId);
    if (!bot || bot.status !== 'PROCESSING' || bot.order?.number !== orderNumber) return;

    const order = bot.order;
    order.status = 'COMPLETE';
    this.#complete.push(order);
    bot.status = 'IDLE';
    bot.order = null;
    bot.timerId = null;
    this.#dispatchIdleBots();
  }

  #insertPending(order) {
    const priority = order.type === 'VIP' ? 0 : 1;
    const index = this.#pending.findIndex((queued) => {
      const queuedPriority = queued.type === 'VIP' ? 0 : 1;
      return queuedPriority > priority || (queuedPriority === priority && queued.number > order.number);
    });
    if (index === -1) this.#pending.push(order);
    else this.#pending.splice(index, 0, order);
  }

  getState() {
    return {
      pending: this.#pending.map((order) => ({ ...order })),
      complete: this.#complete.map((order) => ({ ...order })),
      bots: this.#bots.map((bot) => ({
        id: bot.id,
        status: bot.status,
        orderNumber: bot.order?.number ?? null,
      })),
    };
  }
}
