import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';

import passport from './config/passport.js';
import { corsOptions } from './config/cors.js';
import { globalLimiter } from './middleware/rateLimiter.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import apiRoutes from './routes/index.js';
import { env } from './config/env.js';
import { detectEnvironment } from './utils/environment.js';

const app = express();

// Render/ngrok both terminate TLS in front of this process, so trust the
// first hop's X-Forwarded-* headers (req.secure, req.ip, rate-limit keys).
app.set('trust proxy', 1);

app.use(
  helmet({
    // Business card images are served from /uploads and consumed by a
    // frontend on a DIFFERENT origin (LAN IP, ngrok, or a separate Render
    // service) — the default same-origin CORP would silently block them.
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Strips any key starting with `$` or containing `.` from req.body/query/params,
// preventing MongoDB operator injection (e.g. { "email": { "$gt": "" } }).
app.use(mongoSanitize());

app.use(passport.initialize());

app.use(globalLimiter);

/**
 * GET /health
 * Liveness/readiness probe for Render (and any uptime monitor). Reports
 * the MongoDB connection state so an orchestrator can tell "process is up
 * but DB is down" apart from "everything is fine".
 */
app.get('/health', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const dbState = dbStateMap[mongoose.connection.readyState] || 'unknown';
  const isHealthy = mongoose.connection.readyState === 1;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy ? 'OK' : 'Database not connected',
    env: env.NODE_ENV,
    environment: detectEnvironment(req),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbState,
    timestamp: new Date().toISOString(),
  });
});

// Serve uploaded business card images.
app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)));

// API Routes
app.use('/api', apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
