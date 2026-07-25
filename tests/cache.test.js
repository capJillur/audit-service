const TtlCache = require('../src/services/cache');

describe('TtlCache', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('stores and retrieves a value within the TTL window', () => {
    const cache = new TtlCache({ ttlSeconds: 60 });
    cache.set('key', { hello: 'world' });
    expect(cache.get('key')).toEqual({ hello: 'world' });
  });

  test('returns undefined for a missing key', () => {
    const cache = new TtlCache({ ttlSeconds: 60 });
    expect(cache.get('missing')).toBeUndefined();
  });

  test('expires entries after the configured window', () => {
    const cache = new TtlCache({ ttlSeconds: 5 });
    cache.set('key', 'value');
    jest.advanceTimersByTime(4_000);
    expect(cache.get('key')).toBe('value');
    jest.advanceTimersByTime(2_000);
    expect(cache.get('key')).toBeUndefined();
  });

  test('honors a per-entry TTL override', () => {
    const cache = new TtlCache({ ttlSeconds: 300 });
    cache.set('short', 'value', 1);
    jest.advanceTimersByTime(1_500);
    expect(cache.get('short')).toBeUndefined();
  });

  test('evicts the oldest entry once maxEntries is exceeded', () => {
    const cache = new TtlCache({ ttlSeconds: 60, maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.size).toBe(2);
  });

  test('delete and clear remove entries', () => {
    const cache = new TtlCache({ ttlSeconds: 60 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
    cache.clear();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});
