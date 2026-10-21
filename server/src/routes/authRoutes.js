import express from 'express';
import { registerRules, loginRules } from '../validators/authValidators.js';
import validate from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';

// Auth routes are mounted ahead of the general API limiter and therefore
// carry their own dedicated limiters: login and registration have separate
// counters, and neither request is double-counted against the general quota.
export default function createAuthRoutes({ loginLimiter, registerLimiter, apiLimiter }) {
  const router = express.Router();

  // Limiters run before validation and before the controller so a flood of
  // attempts never reaches bcrypt hashing or verification.
  router.post('/register', registerLimiter, registerRules, validate, authController.register);
  router.post('/login', loginLimiter, loginRules, validate, authController.login);
  // /me is not a credential endpoint but still deserves the general quota.
  router.get('/me', apiLimiter, authenticate, authController.me);

  return router;
}
