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
    this.#pending.push(order);
    return { ...order };
  }

  getState() {
    return {
      pending: this.#pending.map((order) => ({ ...order })),
      complete: this.#complete.map((order) => ({ ...order })),
      bots: [],
    };
  }
}
