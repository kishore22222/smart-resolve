import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import env from './config/env.js';
import createApiRouter from './routes/index.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

// options.rateLimit: optional overrides { windowMs, loginMax, registerMax,
// apiMax, issueCreateMax } used by tests to build isolated apps with fresh
// limiter state; production uses the env-configured defaults.
export default function createApp(options = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());

  // Derive client IPs from X-Forwarded-For only when a reverse proxy is
  // actually in front of the app, and only for a known hop count. Blind
  // `trust proxy = true` would let any client spoof its IP and defeat the
  // rate limiters; leaving it false behind a proxy would collapse every
  // client into the proxy's single bucket. See TRUST_PROXY in .env.example.
  if (env.trustProxy !== false) app.set('trust proxy', env.trustProxy);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / server-to-server (no origin) and allowlisted origins.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  // Strip keys containing $ or . to block NoSQL operator injection.
  app.use(mongoSanitize());

  app.get('/', (req, res) => {
    res.json({ data: { name: 'SmartResolve AI API', docs: '/api/health' } });
  });

  app.use('/api', createApiRouter(createRateLimiters(options.rateLimit)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
