/**
 * Counting semaphore used to cap how many audits run against the outside
 * world at once, so one caller can't exhaust the server's sockets/CPU.
 */
class ConcurrencyLimiter {
  constructor(limit) {
    this.limit = limit;
    this.active = 0;
    this.queue = [];
  }

  async run(task) {
    if (this.active >= this.limit) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active += 1;
    try {
      return await task();
    } finally {
      this.active -= 1;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  get pending() {
    return this.queue.length;
  }
}

module.exports = ConcurrencyLimiter;
