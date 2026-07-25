const request = require('supertest');
const createApp = require('../src/app');
const TtlCache = require('../src/services/cache');
const ConcurrencyLimiter = require('../src/services/concurrencyLimiter');

function htmlResponse({ status = 200, html, url = 'https://example.com/' } = {}) {
  const body = html ?? `<html><head><title>Example Domain</title>
    <meta name="description" content="A sufficiently long description for SEO." />
    </head><body><h1>Example</h1><img src="a.png" alt="a"><a href="/about">about</a>
    <a href="https://other.com">ext</a></body></html>`;
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    redirected: false,
    headers: {
      get: (name) => {
        if (name === 'content-type') return 'text/html; charset=utf-8';
        if (name === 'content-length') return String(Buffer.byteLength(body));
        return null;
      },
    },
    text: async () => body,
  };
}

describe('POST /api/audit', () => {
  let app;
  let cache;
  let limiter;
  let originalFetch;

  beforeEach(() => {
    cache = new TtlCache({ ttlSeconds: 300 });
    limiter = new ConcurrencyLimiter(5);
    app = createApp({ cache, limiter });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('returns 422 for a missing url', async () => {
    const res = await request(app).post('/api/audit').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.requestId).toBeDefined();
  });

  test('returns 422 for an invalid url', async () => {
    const res = await request(app).post('/api/audit').send({ url: 'not-a-url' });
    expect(res.status).toBe(422);
  });

  test('returns 422 for a private/localhost url (SSRF guard)', async () => {
    const res = await request(app).post('/api/audit').send({ url: 'http://localhost:8080' });
    expect(res.status).toBe(422);
  });

  test('audits a reachable HTML page and computes signals', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse());

    const res = await request(app).post('/api/audit').send({ url: 'https://example.com' });

    expect(res.status).toBe(200);
    expect(res.body.meta.cache).toBe('MISS');
    expect(res.body.data.statusCode).toBe(200);
    expect(res.body.data.title).toBe('Example Domain');
    expect(res.body.data.h1Count).toBe(1);
    expect(res.body.data.https).toBe(true);
    expect(typeof res.body.data.seoScore).toBe('number');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('serves repeat requests from cache within the TTL window', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse());

    const first = await request(app).post('/api/audit').send({ url: 'https://example.com' });
    const second = await request(app).post('/api/audit').send({ url: 'https://example.com' });

    expect(first.body.meta.cache).toBe('MISS');
    expect(second.body.meta.cache).toBe('HIT');
    expect(global.fetch).toHaveBeenCalledTimes(1); // second call served from cache, no refetch
  });

  test('respects a per-request cacheTtlSeconds override', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse());

    const res = await request(app)
      .post('/api/audit')
      .send({ url: 'https://example.com', cacheTtlSeconds: 1 });

    expect(res.status).toBe(200);
    expect(res.body.meta.cacheTtlSeconds).toBe(1);
  });

  test('rejects a non-integer cacheTtlSeconds', async () => {
    const res = await request(app)
      .post('/api/audit')
      .send({ url: 'https://example.com', cacheTtlSeconds: 'soon' });
    expect(res.status).toBe(422);
  });

  test('maps upstream non-2xx responses into the report rather than throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue(htmlResponse({ status: 404 }));

    const res = await request(app).post('/api/audit').send({ url: 'https://example.com/missing' });

    expect(res.status).toBe(200);
    expect(res.body.data.statusCode).toBe(404);
    expect(res.body.data.ok).toBe(false);
    expect(res.body.data.issues).toEqual(expect.arrayContaining([expect.stringContaining('404')]));
  });

  test('returns 504 when the upstream request times out', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const res = await request(app).post('/api/audit').send({ url: 'https://slow.example.com' });
    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('UPSTREAM_TIMEOUT');
  });

  test('returns 502 when the upstream host is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const res = await request(app).post('/api/audit').send({ url: 'https://doesnotexist.invalid' });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('UPSTREAM_UNREACHABLE');
  });

  test('every response carries an X-Request-Id header', async () => {
    const res = await request(app).post('/api/audit').send({});
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

describe('GET /api/health', () => {
  test('reports ok status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('unknown routes', () => {
  test('returns a structured 404', async () => {
    const app = createApp();
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
