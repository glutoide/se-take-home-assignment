export class OrderController {
  #nextOrderNumber = 1;
  #pending = [];
  #complete = [];

  addOrder(type) {
    const order = {
      number: this.#nextOrderNumber++,
      type,
      status: 'PENDING',
    };
    this.#insertPending(order);
    return { ...order };
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
      bots: [],
    };
  }
}
