import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

// Rate limiting is built through a factory so each limiter gets its own
// in-memory store (express-rate-limit rejects store sharing) and so tests can
// construct isolated apps with fresh counters and explicit small limits,
// without weakening the production defaults.
//
// Defaults (env-configurable, see README "Environment"):
//   login      10 requests / IP       / RATE_LIMIT_WINDOW_MS (15 min)
//   register    5 requests / IP       / RATE_LIMIT_WINDOW_MS
//   general   100 requests / IP       / RATE_LIMIT_WINDOW_MS
//   create     20 requests / user id  / RATE_LIMIT_WINDOW_MS
//
// In-memory counters are per-process. That is sufficient for a single
// instance; a multi-instance deployment needs a shared store (e.g. Redis)
// — see README "Rate limiting".

const RATE_LIMITED = 'RATE_LIMITED';

function limited(message) {
  return { error: { code: RATE_LIMITED, message } };
}

// Validates factory overrides so a misconfigured test or caller fails loudly
// instead of silently disabling a limit.
function assertLimit(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Rate-limit ${name} must be a positive integer (got ${value}).`);
  }
  return value;
}

/**
 * Creates a fresh, fully isolated set of limiters.
 *
 * @param {object} [overrides] partial config: { windowMs, loginMax,
 *   registerMax, apiMax, issueCreateMax }. Unspecified values come from env.
 */
export function createRateLimiters(overrides = {}) {
  const config = { ...env.rateLimit, ...overrides };
  const windowMs = config.windowMs;
  if (!Number.isInteger(windowMs) || windowMs < 1000) {
    throw new Error(`Rate-limit windowMs must be an integer >= 1000 (got ${windowMs}).`);
  }

  const shared = {
    windowMs,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    statusCode: 429,
    validate: true,
  };

  // Login: keyed by client IP, placed ahead of validation and bcrypt work in
  // the route chain so password hashing/verification is never reached once
  // the limit is exceeded.
  const loginLimiter = rateLimit({
    ...shared,
    limit: assertLimit('loginMax', config.loginMax),
    message: limited('Too many login attempts. Please try again later.'),
  });

  // Registration: its own limiter and counter so login and registration
  // limits are enforced independently of each other.
  const registerLimiter = rateLimit({
    ...shared,
    limit: assertLimit('registerMax', config.registerMax),
    message: limited('Too many registration attempts. Please try again later.'),
  });

  // General API: keyed by client IP, applied to every non-auth route (auth
  // routes have their own dedicated limiters).
  const apiLimiter = rateLimit({
    ...shared,
    limit: assertLimit('apiMax', config.apiMax),
    message: limited('Too many requests. Please slow down.'),
  });

  // Issue creation: keyed by the authenticated user's id from the verified
  // JWT (never a client-supplied field), so one user cannot exhaust another
  // user's quota and cannot bypass the limit by sending a different id.
  const issueCreateLimiter = rateLimit({
    ...shared,
    limit: assertLimit('issueCreateMax', config.issueCreateMax),
    keyGenerator: (req) => (req.user ? `user:${req.user._id.toString()}` : `ip:${req.ip}`),
    message: limited('Too many issues submitted. Please try again later.'),
  });

  return { loginLimiter, registerLimiter, apiLimiter, issueCreateLimiter };
}

// Default instances built from the process environment; used by the running
// server. Tests that need exact limit behaviour build their own via
// createRateLimiters / createApp({ rateLimit }).
const defaultRateLimiters = createRateLimiters();

export const { loginLimiter, registerLimiter, apiLimiter, issueCreateLimiter } = defaultRateLimiters;
