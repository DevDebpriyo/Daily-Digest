import express from 'express';
import config from './config';
import authRoutes from './auth/routes';
import { startScheduler, runDigestPipeline } from './scheduler/cron';
import { connectDatabase, closeDatabase } from './db/client';
import { DigestRun } from './db/schema';
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
 * Manually trigger the digest pipeline.
 * Protected by CRON_SECRET — requires Authorization: Bearer <secret> header.
 */
app.post('/digest/run', async (req, res) => {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${config.cron.secret}`) {
    logger.warn(AGENT, 'Unauthorized /digest/run attempt blocked.');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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
app.get('/digest/history', async (_req, res) => {
  try {
    const runs = await DigestRun.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select('status details createdAt')
      .lean();
    res.json({ runs });
  } catch (error) {
    logger.error(AGENT, 'Failed to fetch digest history.', error);
    res.status(500).json({ error: 'Failed to retrieve history.' });
  }
});

/**
 * Start the application.
 * Connects to MongoDB first, then starts the Express server.
 */
async function start(): Promise<void> {
  try {
    // Connect to MongoDB Atlas
    await connectDatabase(config.database.uri);

    // Start the Express server
    app.listen(config.server.port, () => {
      logger.info(AGENT, `🚀 Daily Gmail Digest server running on port ${config.server.port}`);
      logger.info(AGENT, `📋 Auth URL: http://localhost:${config.server.port}/auth/google`);
      logger.info(AGENT, `📋 Manual run: POST http://localhost:${config.server.port}/digest/run`);
      logger.info(AGENT, `📋 Run history: GET http://localhost:${config.server.port}/digest/history`);

      // Start the cron scheduler
      if (process.env.ENABLE_INTERNAL_CRON === 'true') {
        startScheduler();
      }
    });
  } catch (error) {
    logger.error(AGENT, 'Failed to start application.', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info(AGENT, 'Received SIGINT. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info(AGENT, 'Received SIGTERM. Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

start();

export default app;
