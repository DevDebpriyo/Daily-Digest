import express from 'express';
import config from './config';
import authRoutes from './auth/routes';
import { startScheduler, runDigestPipeline } from './scheduler/cron';
import { getDatabase, closeDatabase } from './db/client';
import { logger } from './utils/logger';

const AGENT = 'Server';

const app = express();

// Middleware
app.use(express.json());

// Auth routes (Google OAuth flow & account management)
app.use(authRoutes);

/**
 * GET /
 * Health check endpoint.
 */
app.get('/', (_req, res) => {
  res.json({
    service: 'Daily Gmail Digest',
    status: 'running',
    version: '1.0.0',
  });
});

/**
 * POST /digest/run
 * Manually trigger the digest pipeline (useful for testing).
 */
app.post('/digest/run', async (_req, res) => {
  try {
    logger.info(AGENT, 'Manual digest run triggered via API.');
    await runDigestPipeline();
    res.json({ success: true, message: 'Digest pipeline executed.' });
  } catch (error) {
    logger.error(AGENT, 'Manual digest run failed.', error);
    res.status(500).json({ error: 'Digest pipeline failed.' });
  }
});

/**
 * GET /digest/history
 * Returns recent digest run history.
 */
app.get('/digest/history', (_req, res) => {
  try {
    const db = getDatabase();
    const runs = db
      .prepare(
        'SELECT id, executed_at, status, details FROM digest_runs ORDER BY executed_at DESC LIMIT 20'
      )
      .all();
    res.json({ runs });
  } catch (error) {
    logger.error(AGENT, 'Failed to fetch digest history.', error);
    res.status(500).json({ error: 'Failed to retrieve history.' });
  }
});

// Start the server
app.listen(config.server.port, () => {
  logger.info(AGENT, `🚀 Daily Gmail Digest server running on port ${config.server.port}`);
  logger.info(AGENT, `📋 Auth URL: http://localhost:${config.server.port}/auth/google`);
  logger.info(AGENT, `📋 Manual run: POST http://localhost:${config.server.port}/digest/run`);
  logger.info(AGENT, `📋 Run history: GET http://localhost:${config.server.port}/digest/history`);

  // Initialize the database on startup
  getDatabase();

  // Start the cron scheduler
  startScheduler();
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info(AGENT, 'Received SIGINT. Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info(AGENT, 'Received SIGTERM. Shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});

export default app;
