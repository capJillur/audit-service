const express = require('express');
const path = require('path');
const config = require('./config');
const requestId = require('./middleware/requestId');
const rateLimiter = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const buildAuditRouter = require('./routes/audit');
const buildHealthRouter = require('./routes/health');
const TtlCache = require('./services/cache');
const ConcurrencyLimiter = require('./services/concurrencyLimiter');

function createApp({ cache, limiter } = {}) {
  const app = express();

  const sharedCache = cache || new TtlCache({ ttlSeconds: config.cacheTtlSeconds, maxEntries: config.cacheMaxEntries });
  const sharedLimiter = limiter || new ConcurrencyLimiter(config.concurrencyLimit);

  app.disable('x-powered-by');
  app.set('trust proxy', true); // needed for correct req.ip behind Render/Vercel/etc.
  app.use(express.json({ limit: '32kb' }));
  app.use(requestId);

  // Static docs/demo page (includes the required footer credit line)
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', rateLimiter, buildHealthRouter());
  app.use('/api', rateLimiter, buildAuditRouter({ cache: sharedCache, limiter: sharedLimiter }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  // Exposed for tests/introspection
  app.locals.cache = sharedCache;
  app.locals.limiter = sharedLimiter;

  return app;
}

module.exports = createApp;
