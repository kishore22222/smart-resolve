import { describe, test, expect, beforeEach } from '@jest/globals';
import { app, request, makeUser, auth, ROLES } from './helpers.js';
import { DEPARTMENTS, STATUSES } from '../src/config/constants.js';
import Issue from '../src/models/Issue.js';
import User from '../src/models/User.js';

let seq = 0;

async function makeIssue({
  reporter,
  status = STATUSES.SUBMITTED,
  assignedTo = null,
  department = DEPARTMENTS.IT,
  archivedAt = null,
}) {
  seq += 1;
  return Issue.create({
    publicId: `DEL-${Date.now()}-${seq}`,
    title: 'A deletable issue title',
    description: 'This is a sufficiently long description for the deletion tests.',
    department,
    priority: 'medium',
    status,
    reporter: reporter._id,
    assignedTo,
    archivedAt,
    archivedBy: archivedAt ? reporter._id : null,
    history: [{ action: 'created', by: reporter._id }],
  });
}

// Archived rows are hidden by default; this is how tests read them back.
function findIncludingArchived(id) {
  return Issue.findById(id).setOptions({ includeArchived: true });
}

async function reporter() {
  const { user, token } = await makeUser({ email: `rep-${Math.random()}@example.edu` });
  return { user, token };
}

beforeEach(() => {
  seq = 0;
});

describe('Issue deletion — ownership and eligibility', () => {
  test('1. a reporter can delete their own eligible issue (soft delete)', async () => {
    const { user, token } = await reporter();
    const issue = await makeIssue({ reporter: user, status: STATUSES.SUBMITTED });

    const res = await auth(request(app).delete(`/api/issues/${issue._id}`), token);
    expect(res.status).toBe(200);
    expect(res.body.data.issue.publicId).toBe(issue.publicId);

    const stored = await findIncludingArchived(issue._id);
    expect(stored).not.toBeNull();
    expect(stored.archivedAt).not.toBeNull();
    expect(stored.archivedBy.toString()).toBe(user._id.toString());
  });

  test('a TRIAGED but unassigned issue is still deletable', async () => {
    const { user, token } = await reporter();
    const issue = await makeIssue({ reporter: user, status: STATUSES.TRIAGED });

    const res = await auth(request(app).delete(`/api/issues/${issue._id}`), token);
    expect(res.status).toBe(200);
    expect((await findIncludingArchived(issue._id)).archivedAt).not.toBeNull();
  });

  test('2. a reporter cannot delete another reporter issue (and it is untouched)', async () => {
    const { user: alice } = await reporter();
    const { token: bobTok } = await reporter();
    const issue = await makeIssue({ reporter: alice });

    const res = await auth(request(app).delete(`/api/issues/${issue._id}`), bobTok);
    expect(res.status).toBe(403);

    const stored = await findIncludingArchived(issue._id);
    expect(stored.archivedAt).toBeNull();
    expect(stored.history.some((h) => h.action === 'archived')).toBe(false);
  });

  test('3. a reporter cannot delete an assigned or active issue', async () => {
    const { user, token } = await reporter();
    const { user: staff } = await makeUser({
      email: `staff-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });

    const cases = [
      { status: STATUSES.ASSIGNED, assignedTo: staff._id },
      { status: STATUSES.IN_PROGRESS, assignedTo: staff._id },
      // Even without an assignee, active processing is not deletable.
      { status: STATUSES.IN_PROGRESS, assignedTo: null },
      { status: STATUSES.RESOLVED, assignedTo: staff._id },
      { status: STATUSES.CLOSED, assignedTo: staff._id },
      { status: STATUSES.REOPENED, assignedTo: null },
    ];

    for (const state of cases) {
      const issue = await makeIssue({ reporter: user, ...state });
      const res = await auth(request(app).delete(`/api/issues/${issue._id}`), token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ISSUE_NOT_DELETABLE');
      expect((await findIncludingArchived(issue._id)).archivedAt).toBeNull();
    }
  });

  test('4. staff cannot delete issues', async () => {
    const { user: owner } = await reporter();
    const issue = await makeIssue({ reporter: owner });
    const { token: staffTok } = await makeUser({
      email: `staff2-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });

    const res = await auth(request(app).delete(`/api/issues/${issue._id}`), staffTok);
    expect(res.status).toBe(403);
    expect((await findIncludingArchived(issue._id)).archivedAt).toBeNull();
  });

  test('5. admin cannot delete issues', async () => {
    const { user: owner } = await reporter();
    const issue = await makeIssue({ reporter: owner });
    const { token: adminTok } = await makeUser({
      email: `admin-${Math.random()}@example.edu`,
      role: ROLES.ADMIN,
    });

    const res = await auth(request(app).delete(`/api/issues/${issue._id}`), adminTok);
    expect(res.status).toBe(403);
    expect((await findIncludingArchived(issue._id)).archivedAt).toBeNull();
  });

  test('6. unauthenticated users cannot delete issues', async () => {
    const { user: owner } = await reporter();
    const issue = await makeIssue({ reporter: owner });

    const res = await request(app).delete(`/api/issues/${issue._id}`);
    expect(res.status).toBe(401);
    expect((await findIncludingArchived(issue._id)).archivedAt).toBeNull();
  });

  test('7. direct API calls cannot bypass ownership or status checks via the body', async () => {
    const { user: alice } = await reporter();
    const { token: bobTok } = await reporter();
    const issue = await makeIssue({ reporter: alice });

    // A spoofed body claiming ownership/role/archive must not change the outcome.
    const spoofed = await auth(
      request(app)
        .delete(`/api/issues/${issue._id}`)
        .send({ reporter: bobTok, role: 'admin', archivedAt: new Date().toISOString() }),
      bobTok
    );
    expect(spoofed.status).toBe(403);
    expect((await findIncludingArchived(issue._id)).archivedAt).toBeNull();
  });

  test('malformed and unknown identifiers are handled', async () => {
    const { token } = await reporter();
    // The id validator rejects malformed ids with the app's 422 convention.
    expect((await auth(request(app).delete('/api/issues/not-an-id'), token)).status).toBe(422);

    const missing = await auth(
      request(app).delete('/api/issues/507f1f77bcf86cd799439011'),
      token
    );
    expect(missing.status).toBe(404);
  });
});

describe('Issue deletion — archival effects', () => {
  test('8. archived issues disappear from lists and counts', async () => {
    const { user, token } = await reporter();
    const keep = await makeIssue({ reporter: user });
    const remove = await makeIssue({ reporter: user });

    await auth(request(app).delete(`/api/issues/${remove._id}`), token);

    // Reporter list.
    const list = await auth(request(app).get('/api/issues'), token);
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].publicId).toBe(keep.publicId);

    // Reporter dashboard counts.
    const dash = await auth(request(app).get('/api/dashboard/summary'), token);
    expect(dash.body.data.totals.all).toBe(1);

    // Admin analytics exclude it too.
    const { token: adminTok } = await makeUser({
      email: `admin2-${Math.random()}@example.edu`,
      role: ROLES.ADMIN,
    });
    const reports = await auth(request(app).get('/api/reports/summary'), adminTok);
    expect(reports.status).toBe(200);
    expect(reports.body.data.totals.all).toBe(1);

    // Admin list also excludes it.
    const adminList = await auth(request(app).get('/api/issues'), adminTok);
    expect(adminList.body.data.items).toHaveLength(1);
  });

  test('9. other workflow operations reject archived issues', async () => {
    const { user, token: ownerTok } = await reporter();
    const issue = await makeIssue({ reporter: user });
    await auth(request(app).delete(`/api/issues/${issue._id}`), ownerTok);

    const { token: staffTok } = await makeUser({
      email: `staff3-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const { token: adminTok } = await makeUser({
      email: `admin3-${Math.random()}@example.edu`,
      role: ROLES.ADMIN,
    });

    const id = issue._id;
    expect((await auth(request(app).get(`/api/issues/${id}`), adminTok)).status).toBe(404);
    expect((await auth(request(app).get(`/api/issues/${id}/history`), adminTok)).status).toBe(404);
    expect(
      (await auth(request(app).post(`/api/issues/${id}/status`).send({ status: STATUSES.TRIAGED }), staffTok)).status
    ).toBe(404);
    expect(
      (await auth(request(app).post(`/api/issues/${id}/follow-up`).send({ note: 'still here?' }), ownerTok)).status
    ).toBe(404);
    expect(
      (
        await auth(
          request(app)
            .post(`/api/issues/${id}/assign`)
            .send({ assignedTo: user._id.toString() }),
          staffTok
        )
      ).status
    ).toBe(404);
    expect(
      (
        await auth(
          request(app).patch(`/api/issues/${id}/department`).send({ department: DEPARTMENTS.FACILITIES }),
          adminTok
        )
      ).status
    ).toBe(404);

    // A second delete attempt is a no-op / not found, never a re-delete.
    expect((await auth(request(app).delete(`/api/issues/${id}`), ownerTok)).status).toBe(404);
  });

  test('10. audit metadata is preserved on the archived issue', async () => {
    const { user, token } = await reporter();
    const issue = await makeIssue({ reporter: user });

    await auth(request(app).delete(`/api/issues/${issue._id}`), token);

    const stored = await findIncludingArchived(issue._id);
    expect(stored).not.toBeNull();
    const actions = stored.history.map((h) => h.action);
    expect(actions).toContain('created');
    expect(actions).toContain('archived');

    const archivedEntry = stored.history.find((h) => h.action === 'archived');
    expect(archivedEntry.by.toString()).toBe(user._id.toString());
    expect(stored.archivedBy.toString()).toBe(user._id.toString());

    // The reporter account and its data are untouched.
    const stillThere = await User.findById(user._id);
    expect(stillThere).not.toBeNull();
  });
});
