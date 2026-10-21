import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// The classifier (ML service) is the authority for department routing, so the
// tests stub it. `jest.unstable_mockModule` must run before the modules that
// import mlClient are loaded, hence the dynamic imports below.
jest.unstable_mockModule('../src/services/mlClient.js', () => ({
  classify: jest.fn(),
  similarity: jest.fn(async () => ({ available: false, error: 'ml_unreachable' })),
}));

const mlClient = await import('../src/services/mlClient.js');
const { app, request, makeUser, auth, ROLES } = await import('./helpers.js');
const { DEPARTMENTS, STATUSES, PRIORITIES } = await import('../src/config/constants.js');
const { computePriority } = await import('../src/services/priority.js');
const { routeIssue } = await import('../src/services/routing.js');

beforeEach(() => {
  // Default: a confident IT Support classification.
  mlClient.classify.mockResolvedValue({
    available: true,
    department: DEPARTMENTS.IT,
    confidence: 0.91,
    allScores: { [DEPARTMENTS.IT]: 0.91 },
  });
});

describe('Priority rules (deterministic)', () => {
  test('critical keywords win', () => {
    expect(computePriority({ title: 'Fire in the chemistry lab', description: 'smoke and flames' }).priority).toBe(
      PRIORITIES.CRITICAL
    );
  });
  test('high keywords', () => {
    expect(computePriority({ title: 'Power outage in Hall C', description: 'no electricity since morning' }).priority).toBe(
      PRIORITIES.HIGH
    );
  });
  test('defaults to medium', () => {
    expect(computePriority({ title: 'A note about the notice board', description: 'nothing urgent' }).priority).toBe(
      PRIORITIES.MEDIUM
    );
  });
});

describe('Department routing (classifier-driven)', () => {
  test('routes on a confident classifier prediction', () => {
    const r = routeIssue({
      ml: { available: true, department: DEPARTMENTS.FACILITIES, confidence: 0.8 },
    });
    expect(r.department).toBe(DEPARTMENTS.FACILITIES);
    expect(r.method).toBe('ml');
    expect(r.needsReview).toBe(false);
  });

  test('flags review when confidence is below the threshold', () => {
    const r = routeIssue({ ml: { available: true, department: DEPARTMENTS.IT, confidence: 0.2 } });
    expect(r.department).toBeNull();
    expect(r.method).toBe('review');
    expect(r.needsReview).toBe(true);
  });

  test('ignores an unsupported predicted department', () => {
    const r = routeIssue({ ml: { available: true, department: 'Bogus', confidence: 0.99 } });
    expect(r.department).toBeNull();
    expect(r.needsReview).toBe(true);
  });

  test('flags review when the classifier is unavailable', () => {
    const r = routeIssue({ ml: { available: false } });
    expect(r.department).toBeNull();
    expect(r.method).toBe('review');
    expect(r.needsReview).toBe(true);
    expect(r.ml.available).toBe(false);
  });
});

describe('Issue lifecycle', () => {
  const payload = {
    title: 'Wi-Fi keeps dropping in the library',
    description: 'The eduroam network drops repeatedly in the north reading room.',
    location: 'North Library',
  };

  async function reporterToken() {
    const { token } = await makeUser({ email: `rep-${Math.random()}@example.edu` });
    return token;
  }

  test('reporter creates an issue with server-derived priority and routing', async () => {
    const token = await reporterToken();
    const res = await auth(request(app).post('/api/issues').send(payload), token);
    expect(res.status).toBe(201);
    const issue = res.body.data.issue;
    expect(issue.publicId).toMatch(/^SR-\d{4}-\d{4}$/);
    expect(issue.department).toBe(DEPARTMENTS.IT);
    expect(issue.status).toBe(STATUSES.SUBMITTED);
    expect(issue.priority).toBe(PRIORITIES.MEDIUM);
    expect(issue.needsReview).toBe(false);
    expect(issue.history.map((h) => h.action)).toEqual(
      expect.arrayContaining(['created', 'routed', 'prioritized'])
    );
  });

  test('creation survives the classifier being unavailable', async () => {
    mlClient.classify.mockResolvedValue({ available: false, error: 'ml_unreachable' });
    const token = await reporterToken();
    const res = await auth(request(app).post('/api/issues').send(payload), token);
    expect(res.status).toBe(201);
    const issue = res.body.data.issue;
    expect(issue.ml.available).toBe(false);
    expect(issue.department).toBeNull();
    expect(issue.needsReview).toBe(true);
    expect(issue.history.map((h) => h.action)).toEqual(
      expect.arrayContaining(['created', 'flagged_for_review', 'prioritized'])
    );
  });

  test('rejects invalid payloads and client-supplied routing fields', async () => {
    const token = await reporterToken();
    const bad = await auth(request(app).post('/api/issues').send({ title: 'no', description: 'too short' }), token);
    expect(bad.status).toBe(422);

    for (const field of ['priority', 'status', 'department', 'category']) {
      const forced = await auth(
        request(app)
          .post('/api/issues')
          .send({ ...payload, [field]: field === 'priority' ? 'critical' : DEPARTMENTS.IT }),
        token
      );
      expect(forced.status).toBe(422);
    }
  });

  test('staff cannot create issues via the reporter endpoint', async () => {
    const { token } = await makeUser({
      email: `staff-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const res = await auth(request(app).post('/api/issues').send(payload), token);
    expect(res.status).toBe(403);
  });

  test('enforces valid status transitions and records history', async () => {
    const repTok = await reporterToken();
    const created = await auth(request(app).post('/api/issues').send(payload), repTok);
    const id = created.body.data.issue._id;

    const { token: staffTok } = await makeUser({
      email: `staff2-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });

    const bad = await auth(
      request(app).post(`/api/issues/${id}/status`).send({ status: STATUSES.RESOLVED }),
      staffTok
    );
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('INVALID_TRANSITION');

    const triaged = await auth(
      request(app).post(`/api/issues/${id}/status`).send({ status: STATUSES.TRIAGED }),
      staffTok
    );
    expect(triaged.status).toBe(200);
    expect(triaged.body.data.issue.status).toBe(STATUSES.TRIAGED);
    expect(
      triaged.body.data.issue.history.some((h) => h.action === 'status_changed' && h.to === STATUSES.TRIAGED)
    ).toBe(true);
  });

  test('assignment requires a staff member in the same department', async () => {
    const repTok = await reporterToken();
    const created = await auth(request(app).post('/api/issues').send(payload), repTok);
    const id = created.body.data.issue._id;

    const { token: itTok } = await makeUser({
      email: `itassign-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    const { user: facStaff } = await makeUser({
      email: `fac-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.FACILITIES,
    });
    const { user: itStaff } = await makeUser({
      email: `itstaff-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });

    const wrongDept = await auth(
      request(app).post(`/api/issues/${id}/assign`).send({ assignedTo: facStaff._id.toString() }),
      itTok
    );
    expect(wrongDept.status).toBe(400);

    const ok = await auth(
      request(app).post(`/api/issues/${id}/assign`).send({ assignedTo: itStaff._id.toString() }),
      itTok
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data.issue.status).toBe(STATUSES.ASSIGNED);
    expect(ok.body.data.issue.assignedTo._id).toBe(itStaff._id.toString());
  });

  test('reporter may reopen their own resolved issue but not triage it', async () => {
    const repTok = await reporterToken();
    const created = await auth(request(app).post('/api/issues').send(payload), repTok);
    const id = created.body.data.issue._id;

    const { token: staffTok } = await makeUser({
      email: `staff3-${Math.random()}@example.edu`,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    for (const status of [STATUSES.TRIAGED, STATUSES.IN_PROGRESS, STATUSES.RESOLVED]) {
      await auth(request(app).post(`/api/issues/${id}/status`).send({ status }), staffTok);
    }

    const badReopen = await auth(
      request(app).post(`/api/issues/${id}/status`).send({ status: STATUSES.ASSIGNED }),
      repTok
    );
    expect(badReopen.status).toBe(400);

    const reopen = await auth(
      request(app).post(`/api/issues/${id}/status`).send({ status: STATUSES.REOPENED }),
      repTok
    );
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.issue.status).toBe(STATUSES.REOPENED);
  });
});
