import express from 'express';
import mongoose from 'mongoose';
import os from 'os';

const router = express.Router();

// Helper: format uptime in human-readable form
const formatUptime = (seconds) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
};

// Helper: get DB connection state label
const getDbState = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[state] ?? 'unknown';
};

/**
 * @route   GET /api/health  (also /health)
 * @desc    Full health check – used by UptimeRobot and internal monitoring.
 *          Returns 200 when the server is healthy, 503 when unhealthy.
 */
router.get('/', async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbHealthy = dbState === 1;

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  const healthData = {
    status: isDbHealthy ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    server: {
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
    },
    database: {
      status: getDbState(dbState),
      healthy: isDbHealthy,
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A',
    },
    memory: {
      heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
      rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      systemFree: `${(freeMem / 1024 / 1024).toFixed(2)} MB`,
      systemTotal: `${(totalMem / 1024 / 1024).toFixed(2)} MB`,
    },
  };

  const statusCode = isDbHealthy ? 200 : 503;
  return res.status(statusCode).json(healthData);
});

/**
 * @route   GET /api/health/ping  (also /health/ping)
 * @desc    Lightweight ping endpoint – ideal for UptimeRobot HTTP(S) monitors.
 *          Always returns 200 as long as the Express server is alive.
 *          UptimeRobot should monitor THIS endpoint to keep the backend awake.
 */
router.get('/ping', (req, res) => {
  res.status(200).json({ pong: true, ts: Date.now() });
});

export default router;
