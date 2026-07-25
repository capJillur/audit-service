const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

module.exports = function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.id = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const start = process.hrtime.bigint();
  req.log = logger.child({ requestId: req.id });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        clientId: req.clientId,
      },
      'request completed'
    );
  });

  next();
};
