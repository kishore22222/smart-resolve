import { describe, test, expect } from '@jest/globals';
import { app, request, makeUser, auth, User, ROLES } from './helpers.js';

describe('Authentication', () => {
  const valid = { name: 'Ada Lovelace', email: 'ada@example.edu', password: 'Password123!' };

  test('registers a reporter and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe(ROLES.REPORTER);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  test('rejects an invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, password: 'short' });
    expect(res.status).toBe(422);
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
  });

  test('cannot register with a privileged role from a public client', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, role: 'admin' });
    expect(res.status).toBe(422);
    const count = await User.countDocuments({});
    expect(count).toBe(0);
  });

  test('stores a bcrypt hash, never the plaintext password', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const user = await User.findOne({ email: valid.email }).select('+passwordHash');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toBe(valid.password);
  });

  test('logs in with correct credentials and rejects wrong ones', async () => {
    await request(app).post('/api/auth/register').send(valid);
    const ok = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: valid.password });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: valid.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
  });

  test('returns the current user for a valid token and rejects a missing one', async () => {
    const { user, token } = await makeUser({ email: 'me@example.edu' });
    const ok = await auth(request(app).get('/api/auth/me'), token);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user._id).toBe(user._id.toString());

    const none = await request(app).get('/api/auth/me');
    expect(none.status).toBe(401);
  });
});
