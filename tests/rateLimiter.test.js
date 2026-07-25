const request = require('supertest');

describe('rate limiting', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env.RATE_LIMIT_MAX = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test('blocks a client after exceeding the configured limit', async () => {
    const createApp = require('../src/app');
    const app = createApp();

    const client = 'x-client-id';
    let lastRes;
    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      lastRes = await request(app).get('/api/health').set(client, 'test-client-a');
    }

    expect(lastRes.status).toBe(429);
    expect(lastRes.body.error.code).toBe('RATE_LIMITED');
  });

  test('rate limits are tracked independently per client id', async () => {
    const createApp = require('../src/app');
    const app = createApp();

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await request(app).get('/api/health').set('x-client-id', 'client-b');
    }
    const res = await request(app).get('/api/health').set('x-client-id', 'client-c');
    expect(res.status).toBe(200);
  });
});
