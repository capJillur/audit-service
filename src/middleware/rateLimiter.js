const rateLimit = require('express-rate-limit');
const config = require('../config');

// Clients identify themselves with X-Client-Id (e.g. an API key/service name).
// Falls back to IP address for anonymous/unauthenticated callers.
function clientKey(req) {
  const header = req.headers['x-client-id'];
  if (typeof header === 'string' && header.trim()) return `client:${header.trim()}`;
  return `ip:${req.ip}`;
}

const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true, // RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    req.clientId = clientKey(req);
    return req.clientId;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Limit is ${config.rateLimitMax} requests per ${config.rateLimitWindowMs / 1000}s.`,
        requestId: req.id,
      },
    });
  },
});

module.exports = rateLimiter;
