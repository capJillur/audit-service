const AppError = require('../utils/AppError');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} does not exist`,
      requestId: req.id,
    },
  });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const log = req.log || require('../utils/logger');

  if (err instanceof AppError) {
    log.warn({ err, code: err.code }, 'handled error');
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id,
      },
    });
  }

  // Unexpected error: never leak internals to the client
  log.error({ err }, 'unhandled error');
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
