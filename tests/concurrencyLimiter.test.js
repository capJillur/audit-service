const ConcurrencyLimiter = require('../src/services/concurrencyLimiter');

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

describe('ConcurrencyLimiter', () => {
  test('runs tasks up to the limit immediately', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const d1 = deferred();
    const d2 = deferred();

    const p1 = limiter.run(() => d1.promise);
    const p2 = limiter.run(() => d2.promise);

    expect(limiter.active).toBe(2);
    d1.resolve('a');
    d2.resolve('b');
    await expect(p1).resolves.toBe('a');
    await expect(p2).resolves.toBe('b');
  });

  test('queues tasks beyond the limit and runs them after a slot frees up', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const d1 = deferred();
    const order = [];

    const p1 = limiter.run(async () => {
      order.push('start-1');
      await d1.promise;
      order.push('end-1');
      return 1;
    });

    // second task should be queued, not started, until the first finishes
    const p2 = limiter.run(async () => {
      order.push('start-2');
      return 2;
    });

    expect(limiter.pending).toBe(1);
    d1.resolve();
    await Promise.all([p1, p2]);
    expect(order).toEqual(['start-1', 'end-1', 'start-2']);
  });

  test('propagates task errors without leaking a permit', async () => {
    const limiter = new ConcurrencyLimiter(1);
    await expect(limiter.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(limiter.active).toBe(0);
    // a subsequent task should still be able to run immediately
    await expect(limiter.run(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
