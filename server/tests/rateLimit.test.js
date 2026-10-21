import { describe, test, expect, jest } from '@jest/globals';

// The issue-creation tests need createIssue to be fast and deterministic, so
// the ML client is stubbed (same pattern as issues.test.js). Must be declared
// before any module that imports mlClient is loaded.
jest.unstable_mockModule('../src/services/mlClient.js', () => ({
  classify: jest.fn(async () => ({
    available: true,
    department: 'IT Support',
    confidence: 0.9,
    allScores: { 'IT Support': 0.9 },
  })),
  similarity: jest.fn(async () => ({ available: false, error: 'ml_unreachable' })),
}));

const appModule = await import('../src/app.js');
const createApp = appModule.default;
const { app: sharedApp, request, makeUser, auth, ROLES } = await import('./helpers.js');

// Every test builds its own app with fresh limiter instances and tiny
// explicit limits. State never leaks between tests, and the production
// defaults in env.js are never weakened for any test.
function appWithLimits(overrides = {}) {
  return createApp({ rateLimit: { windowMs: 60 * 1000, ...overrides } });
}

const validIssue = {
  title: 'Wi-Fi keeps dropping in the library',
  description: 'The eduroam network drops repeatedly in the north reading room.',
  location: 'North Library',
};

describe('Login rate limiting', () => {
  test('logins below the limit succeed and expose draft-6 rate-limit headers', async () => {
    const app = appWithLimits({ loginMax: 3 });
    await makeUser({ email: 'under-limit@example.edu' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'under-limit@example.edu', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-limit']).toBe('3');
    expect(res.headers['ratelimit-remaining']).toBe('2');
    expect(res.headers['ratelimit-reset']).toBeTruthy();
  });

  test('exceeding the login limit returns 429 with the app error envelope', async () => {
    const app = appWithLimits({ loginMax: 2 });
    await makeUser({ email: 'brute@example.edu' });

    for (let i = 0; i < 2; i += 1) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: 'brute@example.edu', password: 'wrong-password' });
      expect(r.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/api/auth/login')
      .send({ email: 'brute@example.edu', password: 'wrong-password' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBeDefined();
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(typeof blocked.body.error.message).toBe('string');
    expect(blocked.headers['retry-after']).toBeTruthy();
    expect(blocked.headers['ratelimit-limit']).toBe('2');
    expect(blocked.headers['ratelimit-remaining']).toBe('0');
  });

  test('the login limiter runs before password verification: valid credentials are also blocked', async () => {
    const app = appWithLimits({ loginMax: 1 });
    await makeUser({ email: 'early-block@example.edu' });

    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'early-block@example.edu', password: 'wrong-password' });
    expect(first.status).toBe(401);

    // Correct password must not matter once the limit is reached: the limiter
    // short-circuits ahead of bcrypt and the controller.
    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'early-block@example.edu', password: 'Password123!' });
    expect(second.status).toBe(429);
    expect(second.body.data).toBeUndefined();
    expect(JSON.stringify(second.body)).not.toMatch(/password|secret|hash/i);
  });
});

describe('Registration rate limiting', () => {
  test('registrations below the limit succeed and above it return 429', async () => {
    const app = appWithLimits({ registerMax: 2 });

    for (let i = 0; i < 2; i += 1) {
      const r = await request(app).post('/api/auth/register').send({
        name: `New Reporter ${i}`,
        email: `new-${i}@example.edu`,
        password: 'Password123!',
      });
      expect(r.status).toBe(201);
    }

    const blocked = await request(app).post('/api/auth/register').send({
      name: 'Third Reporter',
      email: 'new-2@example.edu',
      password: 'Password123!',
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.stack).toBeUndefined();
  });

  test('login and registration limits are enforced by independent counters', async () => {
    const app = appWithLimits({ registerMax: 1, loginMax: 3 });

    const ok = await request(app).post('/api/auth/register').send({
      name: 'First Reporter',
      email: 'first@example.edu',
      password: 'Password123!',
    });
    expect(ok.status).toBe(201);

    const blockedRegister = await request(app).post('/api/auth/register').send({
      name: 'Second Reporter',
      email: 'second@example.edu',
      password: 'Password123!',
    });
    expect(blockedRegister.status).toBe(429);

    // Registration traffic must not have consumed the login quota.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'first@example.edu', password: 'Password123!' });
    expect(login.status).toBe(200);
  });

  test('a drained login quota does not block registration', async () => {
    const app = appWithLimits({ loginMax: 1, registerMax: 2 });

    const first = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.edu', password: 'wrong-password' });
    expect(first.status).toBe(401);

    const second = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.edu', password: 'wrong-password' });
    expect(second.status).toBe(429);

    const registered = await request(app).post('/api/auth/register').send({
      name: 'Still Allowed',
      email: 'still-allowed@example.edu',
      password: 'Password123!',
    });
    expect(registered.status).toBe(201);
  });
});

describe('General API rate limiting', () => {
  test('requests under the general limit succeed; exceeding it returns 429', async () => {
    const app = appWithLimits({ apiMax: 3 });
    const { token } = await makeUser({ email: 'general@example.edu' });

    for (let i = 0; i < 3; i += 1) {
      const r = await auth(request(app).get('/api/issues'), token);
      expect(r.status).toBe(200);
    }

    const blocked = await auth(request(app).get('/api/issues'), token);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  test('auth endpoints are not double-counted against, or blocked by, the general quota', async () => {
    const app = appWithLimits({ apiMax: 2, loginMax: 5 });
    const { token } = await makeUser({ email: 'no-double@example.edu' });

    // Drain the general quota on a non-auth route.
    await auth(request(app).get('/api/issues'), token);
    await auth(request(app).get('/api/issues'), token);
    const blockedGeneral = await auth(request(app).get('/api/issues'), token);
    expect(blockedGeneral.status).toBe(429);

    // Login has its own counter and is mounted before the general limiter,
    // so credential checks still work while the general quota is exhausted.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-double@example.edu', password: 'Password123!' });
    expect(login.status).toBe(200);
  });
});

describe('Issue-creation rate limiting', () => {
  test('keys on the authenticated user, not client-supplied identity fields', async () => {
    const app = appWithLimits({ issueCreateMax: 1 });
    const { token: tokenA } = await makeUser({ email: 'creator-a@example.edu' });
    const { token: creatorB } = await makeUser({ email: 'creator-b@example.edu' });

    const first = await auth(request(app).post('/api/issues').send(validIssue), tokenA);
    expect(first.status).toBe(201);

    // Same user trying to sneak past with spoofed identity fields in the
    // body: the limiter keys on req.user._id from the verified JWT.
    const spoofed = await auth(
      request(app)
        .post('/api/issues')
        .send({ ...validIssue, reporter: 'someone-else', userId: creatorB, role: 'admin' }),
      tokenA
    );
    expect(spoofed.status).toBe(429);
    expect(spoofed.body.error.code).toBe('RATE_LIMITED');

    // A different authenticated user from the same IP still has quota.
    const other = await auth(request(app).post('/api/issues').send(validIssue), creatorB);
    expect(other.status).toBe(201);
  });

  test('unauthenticated creation is rejected before the limiter', async () => {
    const app = appWithLimits({ issueCreateMax: 1 });
    const res = await request(app).post('/api/issues').send(validIssue);
    expect(res.status).toBe(401);
  });
});

describe('Exemptions and unchanged security behaviour', () => {
  test('the health check stays reachable even when the general quota is exhausted', async () => {
    const app = appWithLimits({ apiMax: 2 });
    const { token } = await makeUser({ email: 'health@example.edu' });

    await auth(request(app).get('/api/issues'), token);
    await auth(request(app).get('/api/issues'), token);
    expect((await auth(request(app).get('/api/issues'), token)).status).toBe(429);

    for (let i = 0; i < 3; i += 1) {
      const health = await request(app).get('/api/health');
      expect(health.status).toBe(200);
      expect(health.body.data.status).toBe('ok');
    }
  });

  test('authentication, role gates, and credential errors behave exactly as before', async () => {
    const { token } = await makeUser({ email: 'regression@example.edu' });

    // Protected routes still require authentication.
    expect((await request(sharedApp).get('/api/issues')).status).toBe(401);

    // Invalid credentials still get the generic 401 (no enumeration).
    const bad = await request(sharedApp)
      .post('/api/auth/login')
      .send({ email: 'regression@example.edu', password: 'not-the-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.message).toBe('Invalid email or password.');

    // Valid token still works.
    expect((await auth(request(sharedApp).get('/api/auth/me'), token)).status).toBe(200);

    // Role gates are unchanged: staff cannot create issues.
    const { token: staffToken } = await makeUser({
      email: 'staff-gate@example.edu',
      role: ROLES.STAFF,
      department: 'IT Support',
    });
    const staffCreate = await auth(request(sharedApp).post('/api/issues').send(validIssue), staffToken);
    expect(staffCreate.status).toBe(403);
  });
});
