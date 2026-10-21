// Runs in `setupFiles` (before the test framework). Sets environment variables
// and imports nothing, so no application module is loaded before this runs.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-1234567890';
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017/smartresolve_test';
process.env.BCRYPT_ROUNDS = '4'; // keep hashing fast in tests

// Controlled test configuration: the shared app instance (used by auth,
// issues, deletion, authorization, classification suites) gets generous
// rate-limit quotas so ordinary workflow tests never trip a limiter.
// These do NOT weaken production defaults — production reads the same
// variables, which default to 10/5/100/20 per 15 minutes when unset.
// Exact limit behaviour is verified in tests/rateLimit.test.js, which builds
// its own isolated apps with tiny explicit limits via createApp({ rateLimit }).
process.env.RATE_LIMIT_LOGIN_MAX = '1000';
process.env.RATE_LIMIT_REGISTER_MAX = '1000';
process.env.RATE_LIMIT_API_MAX = '10000';
process.env.RATE_LIMIT_ISSUE_CREATE_MAX = '1000';

// Point the ML client at an unreachable endpoint so tests are hermetic: the
// "ML unavailable" path is exercised regardless of whether a local ML service
// happens to be running on the developer's machine.
process.env.ML_SERVICE_URL = 'http://127.0.0.1:59999';
process.env.ML_TIMEOUT_MS = '500';
