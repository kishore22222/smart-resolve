import { describe, test, expect } from '@jest/globals';
import {
  app,
  request,
  makeUser,
  auth,
  ROLES,
} from './helpers.js';
import { DEPARTMENTS, STATUSES } from '../src/config/constants.js';
import Issue from '../src/models/Issue.js';

async function makeIssue({ reporter, department = DEPARTMENTS.IT, title = 'A valid issue title here' }) {
  return Issue.create({
    publicId: `SR-2026-${Math.floor(Math.random() * 9000) + 1000}`,
    title,
    description: 'This is a sufficiently long description for the test issue.',
    category: department,
    department,
    priority: 'medium',
    status: STATUSES.SUBMITTED,
    reporter: reporter._id,
    history: [{ action: 'created', by: reporter._id }],
  });
}

describe('Authorization and role scoping', () => {
  test('reporters only list their own issues', async () => {
    const { user: alice, token: aTok } = await makeUser({ email: 'alice@example.edu' });
    const { user: bob } = await makeUser({ email: 'bob@example.edu' });
    await makeIssue({ reporter: alice });
    await makeIssue({ reporter: bob });

    const res = await auth(request(app).get('/api/issues'), aTok);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].reporter._id).toBe(alice._id.toString());
  });

  test('staff only see issues in their department', async () => {
    const { user: reporter } = await makeUser({ email: 'r@example.edu' });
    await makeIssue({ reporter, department: DEPARTMENTS.IT });
    await makeIssue({ reporter, department: DEPARTMENTS.FACILITIES });

    const { token } = await makeUser({
      email: 'it@example.edu',
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const res = await auth(request(app).get('/api/issues'), token);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].department).toBe(DEPARTMENTS.IT);
  });

  test('admins see all issues', async () => {
    const { user: reporter } = await makeUser({ email: 'r2@example.edu' });
    await makeIssue({ reporter, department: DEPARTMENTS.IT });
    await makeIssue({ reporter, department: DEPARTMENTS.FACILITIES });

    const { token } = await makeUser({ email: 'admin@example.edu', role: ROLES.ADMIN });
    const res = await auth(request(app).get('/api/issues'), token);
    expect(res.body.data.items).toHaveLength(2);
  });

  test('a reporter cannot view another reporter issue', async () => {
    const { user: alice } = await makeUser({ email: 'a@example.edu' });
    const { token: bTok } = await makeUser({ email: 'b@example.edu' });
    const issue = await makeIssue({ reporter: alice });

    const res = await auth(request(app).get(`/api/issues/${issue._id}`), bTok);
    expect(res.status).toBe(403);
  });

  test('staff cannot view an issue from another department', async () => {
    const { user: reporter } = await makeUser({ email: 'r3@example.edu' });
    const issue = await makeIssue({ reporter, department: DEPARTMENTS.FACILITIES });
    const { token } = await makeUser({
      email: 'it2@example.edu',
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const res = await auth(request(app).get(`/api/issues/${issue._id}`), token);
    expect(res.status).toBe(403);
  });

  test('reporters and staff cannot list users; admin can', async () => {
    const { token: rTok } = await makeUser({ email: 'r4@example.edu' });
    const { token: sTok } = await makeUser({
      email: 's@example.edu',
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const { token: aTok } = await makeUser({ email: 'adm@example.edu', role: ROLES.ADMIN });

    expect((await auth(request(app).get('/api/users'), rTok)).status).toBe(403);

    // Staff may list colleagues in their department only (for assignment).
    const staffList = await auth(request(app).get('/api/users'), sTok);
    expect(staffList.status).toBe(200);
    staffList.body.data.items.forEach((u) => {
      expect(u.role).not.toBe(ROLES.REPORTER);
    });

    expect((await auth(request(app).get('/api/users'), aTok)).status).toBe(200);
  });

  test('only admin can provision staff', async () => {
    const { token: rTok } = await makeUser({ email: 'r5@example.edu' });
    const body = {
      name: 'New Staff',
      email: 'newstaff@example.edu',
      password: 'Password123!',
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    };
    expect((await auth(request(app).post('/api/users/staff').send(body), rTok)).status).toBe(403);

    const { token: aTok } = await makeUser({ email: 'adm2@example.edu', role: ROLES.ADMIN });
    const ok = await auth(request(app).post('/api/users/staff').send(body), aTok);
    expect(ok.status).toBe(201);
    expect(ok.body.data.user.role).toBe(ROLES.STAFF);
    expect(ok.body.data.user.department).toBe(DEPARTMENTS.IT);
  });

  test('only admin can read reports; staff receives 403', async () => {
    const { token: sTok } = await makeUser({
      email: 's2@example.edu',
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const { token: aTok } = await makeUser({ email: 'adm3@example.edu', role: ROLES.ADMIN });
    expect((await auth(request(app).get('/api/reports/summary'), sTok)).status).toBe(403);
    expect((await auth(request(app).get('/api/reports/summary'), aTok)).status).toBe(200);
  });
});
