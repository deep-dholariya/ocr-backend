import mongoose from 'mongoose';
import { env } from './src/config/env.js';
import { connectDatabase } from './src/config/database.js';
import { logger } from './src/utils/logger.js';
import app from './src/app.js';

/**
 * Application entry point.
 * Connects to MongoDB first, and only starts accepting HTTP traffic
 * once the connection is established.
 */
const startServer = async () => {
  await connectDatabase();

  const server = app.listen(env.PORT, "0.0.0.0",() => {
    logger.info(`Server running in ${env.NODE_ENV} mode on ${env.SERVER_URL}`);
  });

  // Graceful shutdown on process signals (e.g. container orchestrator stop, Ctrl+C).
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await mongoose.connection.close(false);
        logger.info('MongoDB connection closed.');
      } catch (error) {
        logger.error('Error closing MongoDB connection', { error: error.message });
      } finally {
        process.exit(0);
      }
    });

    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Fail loudly instead of silently limping along on unexpected errors.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
};

startServer();
