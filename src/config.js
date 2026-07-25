require('dotenv').config();

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

module.exports = {
  port: int('PORT', 3000),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Outbound fetch behavior when auditing a target URL
  fetchTimeoutMs: int('FETCH_TIMEOUT_MS', 8000),
  maxResponseBytes: int('MAX_RESPONSE_BYTES', 5 * 1024 * 1024), // 5MB cap

  // How many audits may run concurrently against the outside world
  concurrencyLimit: int('CONCURRENCY_LIMIT', 5),

  // Caching window for repeat audits of the same URL
  cacheTtlSeconds: int('CACHE_TTL_SECONDS', 300),
  cacheMaxEntries: int('CACHE_MAX_ENTRIES', 1000),

  // Per-client rate limiting
  rateLimitWindowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitMax: int('RATE_LIMIT_MAX', 30),
};
