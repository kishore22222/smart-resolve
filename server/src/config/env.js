import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env. dotenv does not override variables already present in the
// environment, which lets tests and deployment platforms inject their own.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function value(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v;
}

// Parses a positive-integer environment variable. Invalid values fail fast at
// startup instead of silently disabling a limit. Messages name the variable
// but never echo unrelated configuration.
function intEnv(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = value(name, String(fallback));
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `Invalid environment configuration: ${name} must be an integer between ${min} and ${max} (got "${raw}").`
    );
  }
  return parsed;
}

// TRUST_PROXY controls Express's `trust proxy` setting, which decides whether
// rate limiting keys on the real client IP (via X-Forwarded-For) or on the
// immediate connection. Accepts only:
//   false      - default; direct connections, X-Forwarded-For is ignored
//   <integer>  - trust N proxy hops (e.g. "1" behind a single reverse proxy)
// Never accepts `true`: unrestricted proxy trust lets any client spoof its IP
// via X-Forwarded-For and defeats IP-based rate limiting.
function trustProxyEnv() {
  const raw = value('TRUST_PROXY', 'false');
  if (raw === 'false') return false;
  if (raw === 'true') {
    throw new Error(
      'Invalid environment configuration: TRUST_PROXY must be "false" or a positive integer (number of trusted proxy hops). "true" is not allowed because it permits client IP spoofing.'
    );
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1 || hops > 10) {
    throw new Error(
      `Invalid environment configuration: TRUST_PROXY must be "false" or an integer between 1 and 10 (got "${raw}").`
    );
  }
  return hops;
}

const env = {
  nodeEnv: value('NODE_ENV', 'development'),
  port: parseInt(value('PORT', '5000'), 10),
  mongoUri: value('MONGODB_URI', 'mongodb://127.0.0.1:27017/smartresolve'),
  jwtSecret: value('JWT_SECRET', 'insecure-development-secret-change-me'),
  jwtExpiresIn: value('JWT_EXPIRES_IN', '8h'),
  bcryptRounds: parseInt(value('BCRYPT_ROUNDS', '12'), 10),
  corsOrigins: value('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mlServiceUrl: value('ML_SERVICE_URL', 'http://127.0.0.1:8000'),
  mlTimeoutMs: parseInt(value('ML_TIMEOUT_MS', '2500'), 10),
  mlConfidenceThreshold: parseFloat(value('ML_CONFIDENCE_THRESHOLD', '0.45')),
  duplicateThreshold: parseFloat(value('DUPLICATE_THRESHOLD', '0.6')),
  // Reverse-proxy hops Express should trust when deriving the client IP.
  trustProxy: trustProxyEnv(),
  // Per-client rate limits. Defaults are the documented production values;
  // see README "Environment" and README "Rate limiting".
  rateLimit: {
    windowMs: intEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, { min: 1000 }),
    loginMax: intEnv('RATE_LIMIT_LOGIN_MAX', 10),
    registerMax: intEnv('RATE_LIMIT_REGISTER_MAX', 5),
    apiMax: intEnv('RATE_LIMIT_API_MAX', 100),
    issueCreateMax: intEnv('RATE_LIMIT_ISSUE_CREATE_MAX', 20),
  },
};

env.isProduction = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

// Fail fast on insecure production configuration instead of silently falling
// back to development defaults. Messages never include the secret values.
if (env.isProduction) {
  const problems = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    problems.push('JWT_SECRET must be set to a strong value (at least 16 characters).');
  }
  if (process.env.JWT_SECRET === 'insecure-development-secret-change-me') {
    problems.push('JWT_SECRET must not use the built-in development default.');
  }
  if (!process.env.MONGODB_URI) {
    problems.push('MONGODB_URI must be set explicitly; the localhost fallback is development-only.');
  }
  if (!process.env.ML_SERVICE_URL) {
    problems.push(
      'ML_SERVICE_URL must be set explicitly to the deployed ML service; the localhost fallback is development-only.'
    );
  }
  if (problems.length > 0) {
    throw new Error(`Invalid production environment configuration:\n- ${problems.join('\n- ')}`);
  }
}

export default env;
