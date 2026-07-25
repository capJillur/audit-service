const express = require('express');

function buildHealthRouter() {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = buildHealthRouter;
