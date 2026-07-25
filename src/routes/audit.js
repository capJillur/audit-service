const express = require('express');
const { validateUrl } = require('../utils/validateUrl');
const { runAudit } = require('../services/auditService');
const AppError = require('../utils/AppError');
const config = require('../config');

function buildAuditRouter({ cache, limiter }) {
  const router = express.Router();

  router.post('/audit', async (req, res, next) => {
    try {
      const { url: rawUrl, cacheTtlSeconds } = req.body || {};
      const url = validateUrl(rawUrl);

      if (cacheTtlSeconds !== undefined) {
        if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds < 0) {
          throw new AppError(
            'VALIDATION_ERROR',
            '"cacheTtlSeconds" must be a non-negative integer',
            422
          );
        }
      }

      const cacheKey = url.href;
      const cached = cache.get(cacheKey);
      if (cached) {
        return res.status(200).json({
          data: cached,
          meta: { cache: 'HIT', requestId: req.id },
        });
      }

      const report = await limiter.run(() => runAudit(url));
      cache.set(cacheKey, report, cacheTtlSeconds);

      return res.status(200).json({
        data: report,
        meta: {
          cache: 'MISS',
          cacheTtlSeconds: cacheTtlSeconds ?? config.cacheTtlSeconds,
          requestId: req.id,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = buildAuditRouter;
