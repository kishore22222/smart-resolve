import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Classification + routing acceptance tests. The classifier is stubbed so every
// branch (confident, low-confidence, invalid, unavailable) is deterministic.
jest.unstable_mockModule('../src/services/mlClient.js', () => ({
  classify: jest.fn(),
  similarity: jest.fn(async () => ({ available: false, error: 'ml_unreachable' })),
}));

const mlClient = await import('../src/services/mlClient.js');
const { app, request, makeUser, auth, ROLES } = await import('./helpers.js');
const { DEPARTMENT_VALUES } = await import('../src/config/constants.js');

const [IT, FACILITIES, ADMINISTRATION] = DEPARTMENT_VALUES;

const payload = {
  title: 'A sufficiently descriptive issue title',
  description: 'A description that is long enough to pass validation for the tests.',
  location: 'Main Building',
};

function confident(department, confidence = 0.85) {
  mlClient.classify.mockResolvedValue({ available: true, department, confidence });
}

async function reporterToken() {
  const { token } = await makeUser({ email: `rep-${Math.random()}@example.edu` });
  return token;
}

function createIssue(body = payload) {
  return reporterToken().then((token) => auth(request(app).post('/api/issues').send(body), token));
}

beforeEach(() => {
  confident(IT);
});

describe('Automatic classification', () => {
  test('routes a confident prediction into each supported department', async () => {
    for (const department of DEPARTMENT_VALUES) {
      confident(department, 0.85);
      const res = await createIssue();
      expect(res.status).toBe(201);
      const issue = res.body.data.issue;
      expect(issue.department).toBe(department);
      expect(issue.needsReview).toBe(false);
      expect(issue.ml.available).toBe(true);
      expect(issue.ml.suggestedDepartment).toBe(department);
      expect(issue.ml.confidence).toBeCloseTo(0.85);
    }
  });

  test('low confidence flags the issue for review and keeps it out of staff queues', async () => {
    confident(IT, 0.05);
    const created = await createIssue();
    expect(created.status).toBe(201);
    const issue = created.body.data.issue;
    expect(issue.department).toBeNull();
    expect(issue.needsReview).toBe(true);

    const { token: adminTok } = await makeUser({ email: 'admin@x.edu', role: ROLES.ADMIN });
    const adminList = await auth(request(app).get('/api/issues'), adminTok);
    expect(adminList.body.data.items.map((i) => i._id)).toContain(issue._id);

    const { token: staffTok } = await makeUser({
      email: 'it-staff@x.edu',
      role: ROLES.STAFF,
      department: IT,
    });
    const staffList = await auth(request(app).get('/api/issues'), staffTok);
    expect(staffList.body.data.items.map((i) => i._id)).not.toContain(issue._id);
  });

  test('an unsupported prediction is never trusted', async () => {
    confident('Bogus Department', 0.99);
    const res = await createIssue();
    expect(res.status).toBe(201);
    expect(res.body.data.issue.department).toBeNull();
    expect(res.body.data.issue.needsReview).toBe(true);
  });

  test('classifier failure flags review instead of routing', async () => {
    mlClient.classify.mockResolvedValue({ available: false, error: 'ml_unreachable' });
    const res = await createIssue();
    expect(res.status).toBe(201);
    const issue = res.body.data.issue;
    expect(issue.department).toBeNull();
    expect(issue.needsReview).toBe(true);
    expect(issue.ml.available).toBe(false);
  });
});

describe('Reporter cannot influence routing', () => {
  test('rejects a payload that supplies department or category', async () => {
    for (const field of ['department', 'category']) {
      const res = await createIssue({ ...payload, [field]: FACILITIES });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('the stored department always matches the classifier, not the payload', async () => {
    confident(ADMINISTRATION, 0.9);
    const res = await createIssue({ ...payload, department: IT });
    expect(res.status).toBe(422);
  });
});

describe('Admin manual review', () => {
  async function unreviewedIssue() {
    mlClient.classify.mockResolvedValue({ available: false, error: 'ml_unreachable' });
    const created = await createIssue();
    return created.body.data.issue;
  }

  test('only an admin may correct the department', async () => {
    const issue = await unreviewedIssue();

    const { token: repTok } = await makeUser({ email: 'rep2@x.edu' });
    const { token: staffTok } = await makeUser({
      email: 'staff2@x.edu',
      role: ROLES.STAFF,
      department: IT,
    });

    expect(
      (await auth(request(app).patch(`/api/issues/${issue._id}/department`).send({ department: IT }), repTok))
        .status
    ).toBe(403);
    expect(
      (await auth(request(app).patch(`/api/issues/${issue._id}/department`).send({ department: IT }), staffTok))
        .status
    ).toBe(403);
  });

  test('admin correction sets the department, clears review, and is audited', async () => {
    const issue = await unreviewedIssue();
    const { token: adminTok } = await makeUser({ email: 'admin2@x.edu', role: ROLES.ADMIN });

    const res = await auth(
      request(app)
        .patch(`/api/issues/${issue._id}/department`)
        .send({ department: FACILITIES, note: 'Rerouted after review.' }),
      adminTok
    );

    expect(res.status).toBe(200);
    expect(res.body.data.issue.department).toBe(FACILITIES);
    expect(res.body.data.issue.needsReview).toBe(false);

    const entry = res.body.data.issue.history.find((h) => h.action === 'department_corrected');
    expect(entry).toBeTruthy();
    expect(entry.from).toBeNull();
    expect(entry.to).toBe(FACILITIES);
  });

  test('rejects an unsupported department value on correction', async () => {
    const issue = await unreviewedIssue();
    const { token: adminTok } = await makeUser({ email: 'admin3@x.edu', role: ROLES.ADMIN });
    const res = await auth(
      request(app).patch(`/api/issues/${issue._id}/department`).send({ department: 'Bogus' }),
      adminTok
    );
    expect(res.status).toBe(422);
  });
});

describe('Department-based authorization', () => {
  test('a classified issue is visible to its department staff only', async () => {
    confident(IT, 0.9);
    const created = await createIssue();
    const issue = created.body.data.issue;

    const { token: itTok } = await makeUser({
      email: 'it@x.edu',
      role: ROLES.STAFF,
      department: IT,
    });
    const { token: facTok } = await makeUser({
      email: 'fac@x.edu',
      role: ROLES.STAFF,
      department: FACILITIES,
    });

    expect((await auth(request(app).get(`/api/issues/${issue._id}`), itTok)).status).toBe(200);
    expect((await auth(request(app).get(`/api/issues/${issue._id}`), facTok)).status).toBe(403);
  });
});
