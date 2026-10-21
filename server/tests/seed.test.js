import { describe, test, expect } from '@jest/globals';
import { upsertUser } from '../scripts/seed.js';
import User from '../src/models/User.js';
import { ROLES } from '../src/config/constants.js';

// Regression tests for the admin login failure: re-running the seed must
// reconcile an existing account's credentials rather than silently skipping it.
describe('Seed account reconciliation', () => {
  const email = 'root@example.edu';

  test('creates a privileged account with a bcrypt-hashed password', async () => {
    const user = await upsertUser({
      name: 'System Administrator',
      email,
      password: 'first-password-123',
      role: ROLES.ADMIN,
    });

    expect(user.email).toBe(email);
    const stored = await User.findOne({ email }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await stored.verifyPassword('first-password-123')).toBe(true);
  });

  test('rotates the password of an existing account instead of skipping it', async () => {
    await upsertUser({
      name: 'System Administrator',
      email,
      password: 'first-password-123',
      role: ROLES.ADMIN,
    });

    // Same email, rotated password and renamed: this used to be skipped,
    // leaving the old password in the database and breaking login.
    const updated = await upsertUser({
      name: 'Renamed Administrator',
      email,
      password: 'second-password-456',
      role: ROLES.ADMIN,
    });

    expect(updated.name).toBe('Renamed Administrator');
    expect(await User.countDocuments({ email })).toBe(1);

    const stored = await User.findOne({ email }).select('+passwordHash');
    expect(await stored.verifyPassword('second-password-456')).toBe(true);
    expect(await stored.verifyPassword('first-password-123')).toBe(false);
  });

  test('normalizes the email so casing never causes a duplicate or miss', async () => {
    await upsertUser({
      name: 'System Administrator',
      email: 'Mixed.Case@Example.edu',
      password: 'first-password-123',
      role: ROLES.ADMIN,
    });

    const stored = await User.findOne({ email: 'mixed.case@example.edu' });
    expect(stored).not.toBeNull();
  });
});
