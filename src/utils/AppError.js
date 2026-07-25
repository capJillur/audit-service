class AppError extends Error {
  /**
   * @param {string} code machine-readable error code, e.g. VALIDATION_ERROR
   * @param {string} message human-readable message
   * @param {number} statusCode HTTP status code
   * @param {object} [details] optional extra context (never leaks internals)
   */
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

module.exports = AppError;
