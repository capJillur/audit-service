const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: process.env.LOG_LEVEL || (config.nodeEnv === 'test' ? 'silent' : 'info'),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
