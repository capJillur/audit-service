# Page Pulse

A production-grade URL audit service. Send it a URL; it returns status, timing,
HTTPS, and lightweight SEO signals (title, meta description, headings, alt-text
coverage, link counts) with a transparent 0–100 score and a list of concrete issues.

Built for the Digital Heroes Software Engineer training task — see the footer
credit on the live page.

## Why it's "production-grade" and not a demo

| Concern | How it's handled |
|---|---|
| Input validation | Strict URL parsing, protocol allow-list (`http`/`https` only), SSRF guard blocking `localhost`/loopback/private IP ranges |
| Timeouts | Every outbound fetch is wrapped in an `AbortController` (`FETCH_TIMEOUT_MS`, default 8s) → `504 UPSTREAM_TIMEOUT` |
| Concurrency limits | A counting semaphore (`CONCURRENCY_LIMIT`, default 5) caps simultaneous outbound audits so one burst of traffic can't exhaust sockets/CPU |
| Size limits | Responses over `MAX_RESPONSE_BYTES` (default 5MB) are rejected with `413` before/while parsing |
| Structured errors | Every error is `{ error: { code, message, requestId, details? } }` with an appropriate HTTP status; unexpected errors never leak stack traces |
| Caching | In-memory TTL cache keyed by normalized URL; window is configurable globally (`CACHE_TTL_SECONDS`) and per-request (`cacheTtlSeconds` in the body) |
| Rate limiting | Per-client sliding window (`RATE_LIMIT_MAX` requests / `RATE_LIMIT_WINDOW_MS`), keyed by `X-Client-Id` header or IP fallback |
| Structured logging | `pino` JSON logs, one line per request, each tagged with a `requestId` (echoed back as `X-Request-Id`) for correlation |
| Tests + CI | 35 tests (Jest + Supertest) across unit and integration layers; GitHub Actions runs the full suite on Node 18.x and 20.x on every push/PR |

## API contract

### `POST /api/audit`

**Request**
```json
{
  "url": "https://example.com",
  "cacheTtlSeconds": 60
}
```
- `url` (required, string) — must be `http`/`https`, publicly routable.
- `cacheTtlSeconds` (optional, integer ≥ 0) — overrides the default cache window for this URL.

**Success — `200`**
```json
{
  "data": {
    "requestedUrl": "https://example.com/",
    "finalUrl": "https://example.com/",
    "redirected": false,
    "statusCode": 200,
    "ok": true,
    "contentType": "text/html; charset=utf-8",
    "sizeBytes": 1256,
    "responseTimeMs": 142,
    "https": true,
    "title": "Example Domain",
    "titleLength": 14,
    "metaDescription": null,
    "metaDescriptionLength": 0,
    "h1Count": 1,
    "imageCount": 0,
    "imagesMissingAlt": 0,
    "internalLinkCount": 1,
    "externalLinkCount": 0,
    "issues": ["Missing meta description"],
    "seoScore": 90
  },
  "meta": { "cache": "MISS", "cacheTtlSeconds": 300, "requestId": "..." }
}
```
`meta.cache` is `"HIT"` or `"MISS"`. On a cache hit, `data` is returned unchanged
from the prior audit and no outbound request is made.

**Errors**
| Status | Code | When |
|---|---|---|
| 422 | `VALIDATION_ERROR` | Missing/malformed URL, disallowed protocol, private/localhost target, bad `cacheTtlSeconds` |
| 413 | `RESPONSE_TOO_LARGE` | Target response exceeds `MAX_RESPONSE_BYTES` |
| 429 | `RATE_LIMITED` | Client exceeded its request quota for the current window |
| 502 | `UPSTREAM_UNREACHABLE` | DNS failure, connection refused, TLS error, etc. |
| 504 | `UPSTREAM_TIMEOUT` | Target didn't respond within `FETCH_TIMEOUT_MS` |
| 500 | `INTERNAL_ERROR` | Unexpected server error (never leaks internals) |

Every error body: `{ "error": { "code", "message", "requestId", "details?" } }`.

### `GET /api/health`
Liveness probe. `200 { "status": "ok", "uptimeSeconds": <n>, "timestamp": <iso> }`.

### Headers
- `X-Request-Id` — echoed on every response; send your own to correlate logs across services, or let the server generate one.
- `X-Client-Id` — optional; identifies your client for rate-limit bucketing. Falls back to IP.
- `RateLimit-*` (standard draft headers) — remaining quota and reset time.

## Configuration

All of these live in `.env` (see `.env.example`):

```
PORT=3000
FETCH_TIMEOUT_MS=8000
MAX_RESPONSE_BYTES=5242880
CONCURRENCY_LIMIT=5
CACHE_TTL_SECONDS=300
CACHE_MAX_ENTRIES=1000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=30
LOG_LEVEL=info
```

## Running locally

```bash
npm install
cp .env.example .env
npm start          # http://localhost:3000
npm run dev         # auto-restart on change
```

## Tests

```bash
npm test             # 35 tests: validation, cache TTL/eviction, concurrency
                      # semaphore, rate limiting, full request/response cycle
npm run test:coverage
```
Outbound HTTP is mocked in integration tests (no real network calls), so CI is
deterministic and fast (~2s for the full suite).

CI: `.github/workflows/ci.yml` runs `npm ci && npm run test:coverage` on Node
18.x and 20.x for every push and pull request.

## Architecture notes

- **Cache**: in-memory `Map` with TTL + LRU-style eviction on overflow
  (`src/services/cache.js`). Single-instance only by design — swap the
  `get`/`set`/`delete` calls for a Redis client if you scale to multiple
  instances behind a load balancer.
- **Concurrency limiter**: a plain counting semaphore
  (`src/services/concurrencyLimiter.js`), independent of the cache and rate
  limiter, so a burst of *new* URLs can't overwhelm the server even when
  every request is a cache miss.
- **Rate limiter vs. concurrency limiter**: these solve different problems —
  rate limiting protects the API surface from any one client; the
  concurrency limiter protects the server's actual outbound connections
  regardless of which clients they came from.
- **SSRF guard**: `src/utils/validateUrl.js` blocks loopback, `10/8`,
  `172.16/12`, `192.168/16`, and link-local ranges before any fetch is
  attempted, since this service accepts arbitrary user-supplied URLs.

## Deployment

Deployed on [Render](https://render.com) (free web service tier):
1. Push this repo to GitHub.
2. New → Web Service → connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Add the environment variables from `.env.example`.
5. Deploy — Render assigns a public HTTPS URL.

**Live URL:** _add after deploying_

---
Built for Digital Heroes Training Task — [digitalheroesco.com](https://digitalheroesco.com)
