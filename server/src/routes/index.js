import express from 'express';
import createAuthRoutes from './authRoutes.js';
import createIssueRoutes from './issueRoutes.js';
import userRoutes from './userRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import reportRoutes from './reportRoutes.js';

export default function createApiRouter(limiters) {
  const router = express.Router();

  // Health check first: deployment monitoring stays reachable even when a
  // client has exhausted its rate-limit quota, and it is never counted.
  router.get('/health', (req, res) => {
    res.json({ data: { status: 'ok', service: 'smartresolve-api' } });
  });

  // Auth routes carry their own dedicated login/registration limiters and
  // are mounted BEFORE the general limiter so a login attempt is never
  // counted (or blocked) by two different limiters at once.
  router.use('/auth', createAuthRoutes(limiters));

  // General per-IP quota for every other endpoint.
  router.use(limiters.apiLimiter);

  router.use('/issues', createIssueRoutes(limiters));
  router.use('/users', userRoutes);
  router.use('/dashboard', dashboardRoutes);
  router.use('/reports', reportRoutes);

  return router;
}
