export class OrderController {
  #nextOrderNumber = 1;
  #nextBotId = 1;
  #pending = [];
  #complete = [];
  #bots = [];

  constructor({
    processTimeMs = 10_000,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    onEvent = () => {},
  } = {}) {
    this.processTimeMs = processTimeMs;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.onEvent = onEvent;
  }

  addOrder(type) {
    const normalizedType = String(type).toUpperCase();
    if (!['NORMAL', 'VIP'].includes(normalizedType)) {
      throw new Error('Order type must be NORMAL or VIP');
    }

    const order = {
      number: this.#nextOrderNumber++,
      type: normalizedType,
      status: 'PENDING',
    };

    this.#pending.push(order);
    this.#sortPending();
    this.onEvent({ type: 'ORDER_CREATED', order: { ...order } });
    this.#dispatch();
    return { ...order };
  }

  addBot() {
    const bot = {
      id: this.#nextBotId++,
      status: 'IDLE',
      order: null,
      timer: null,
    };

    this.#bots.push(bot);
    this.onEvent({ type: 'BOT_ADDED', botId: bot.id });
    this.#dispatch();
    return this.#publicBot(bot);
  }

  removeBot() {
    if (this.#bots.length === 0) return null;

    const bot = this.#bots.pop();
    if (bot.timer !== null) {
      this.clearTimeoutFn(bot.timer);
      bot.timer = null;
    }

    if (bot.order) {
      const interruptedOrder = { ...bot.order, status: 'PENDING' };
      this.#pending.push(interruptedOrder);
      this.#sortPending();
      this.onEvent({
        type: 'ORDER_RETURNED',
        order: { ...interruptedOrder },
        botId: bot.id,
      });
    }

    this.onEvent({ type: 'BOT_REMOVED', botId: bot.id });
    this.#dispatch();
    return { id: bot.id };
  }

  getState() {
    return {
      pending: this.#pending.map((order) => ({ ...order })),
      complete: this.#complete.map((order) => ({ ...order })),
      bots: this.#bots.map((bot) => this.#publicBot(bot)),
    };
  }

  shutdown() {
    for (const bot of this.#bots) {
      if (bot.timer !== null) {
        this.clearTimeoutFn(bot.timer);
        bot.timer = null;
      }
    }
  }

  #sortPending() {
    this.#pending.sort((left, right) => {
      const leftPriority = left.type === 'VIP' ? 0 : 1;
      const rightPriority = right.type === 'VIP' ? 0 : 1;
      return leftPriority - rightPriority || left.number - right.number;
    });
  }

  #dispatch() {
    for (const bot of this.#bots) {
      if (bot.status !== 'IDLE' || this.#pending.length === 0) continue;
      this.#startProcessing(bot, this.#pending.shift());
    }
  }

  #startProcessing(bot, order) {
    const processingOrder = { ...order, status: 'PROCESSING' };
    bot.status = 'BUSY';
    bot.order = processingOrder;
    this.onEvent({
      type: 'ORDER_STARTED',
      order: { ...processingOrder },
      botId: bot.id,
    });

    bot.timer = this.setTimeoutFn(() => {
      if (!this.#bots.includes(bot) || bot.order?.number !== processingOrder.number) return;

      const completedOrder = { ...processingOrder, status: 'COMPLETE' };
      bot.timer = null;
      bot.order = null;
      bot.status = 'IDLE';
      this.#complete.push(completedOrder);
      this.onEvent({
        type: 'ORDER_COMPLETED',
        order: { ...completedOrder },
        botId: bot.id,
      });
      this.#dispatch();
    }, this.processTimeMs);
  }

  #publicBot(bot) {
    return {
      id: bot.id,
      status: bot.status,
      order: bot.order ? { ...bot.order } : null,
    };
  }
}
