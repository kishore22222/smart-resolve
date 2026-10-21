/**
 * Secure provisioning for privileged accounts.
 *
 * Default run: creates one admin and one staff per department, using credentials
 * from environment variables. Passwords are NEVER printed.
 *
 *   node scripts/seed.js            # admin + staff only
 *   node scripts/seed.js --demo     # also creates a labeled demo reporter + issues
 *
 * Real credentials must come from the environment. The script refuses to run in
 * production with the placeholder defaults.
 */
import { pathToFileURL } from 'url';
import env from '../src/config/env.js';
import { connect, disconnect } from '../src/config/db.js';
import User from '../src/models/User.js';
import Issue from '../src/models/Issue.js';
import { ROLES, DEPARTMENTS, STATUSES } from '../src/config/constants.js';
import { computePriority } from '../src/services/priority.js';
import { nextPublicId } from '../src/services/issueId.js';

const DEFAULT_ADMIN_EMAIL = 'admin@example.edu';

async function upsertUser({ name, email, password, role, department }) {
  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (existing) {
    // Reconcile instead of skipping. The old "skip if exists" behaviour kept a
    // stale password (or role) in place, so rotating SEED_* values never
    // actually worked and login kept failing with "Invalid email or password".
    const nextDepartment = role === ROLES.STAFF ? department : null;
    const passwordMatches = await existing.verifyPassword(password);
    const upToDate =
      existing.name === name &&
      existing.role === role &&
      existing.department === nextDepartment &&
      existing.isActive &&
      passwordMatches;

    if (upToDate) {
      // eslint-disable-next-line no-console
      console.log(`skip  ${normalizedEmail} (already up to date)`);
      return existing;
    }

    existing.name = name;
    existing.role = role;
    existing.department = nextDepartment;
    existing.isActive = true;
    if (!passwordMatches) await existing.setPassword(password);
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`update ${normalizedEmail} as ${role}${nextDepartment ? ` (${nextDepartment})` : ''}`);
    return existing;
  }

  const user = new User({
    name,
    email: normalizedEmail,
    role,
    department: role === ROLES.STAFF ? department : null,
  });
  await user.setPassword(password);
  await user.save();
  // eslint-disable-next-line no-console
  console.log(`create ${normalizedEmail} as ${role}${department ? ` (${department})` : ''}`);
  return user;
}

async function seedDemo(reporter) {
  const samples = [
    {
      title: 'Wi-Fi drops in the North Library every afternoon',
      description:
        'Students lose connection to eduroam between 2pm and 4pm in the north reading room. Login to the portal fails too.',
      department: DEPARTMENTS.IT,
      location: 'North Library, 2nd floor',
    },
    {
      title: 'Water leak under the restroom sink in Hall B',
      description:
        'There is a steady water leak under the sink in the Hall B restroom. The floor is becoming slippery and could be a hazard.',
      department: DEPARTMENTS.FACILITIES,
      location: 'Hall B restroom',
    },
    {
      title: 'Tuition payment not reflected on my student account',
      description:
        'I paid my tuition last week but the payment is not showing on my student account and I have a registration hold.',
      department: DEPARTMENTS.ADMINISTRATION,
      location: 'Student Accounts',
    },
  ];

  for (const sample of samples) {
    const exists = await Issue.findOne({ title: sample.title });
    if (exists) continue;
    const { priority } = computePriority(sample);
    const publicId = await nextPublicId();
    // Demo issues are curated fixtures, so their department is set explicitly
    // rather than through the classifier (which may be offline during seeding).
    const issue = new Issue({
      publicId,
      ...sample,
      priority,
      status: STATUSES.SUBMITTED,
      reporter: reporter._id,
      needsReview: false,
      history: [
        {
          action: 'created',
          to: STATUSES.SUBMITTED,
          by: reporter._id,
          note: 'Demo data (dev only).',
        },
        {
          action: 'routed',
          to: sample.department,
          by: reporter._id,
          note: 'Curated demo routing (dev only).',
        },
      ],
    });
    await issue.save();
    // eslint-disable-next-line no-console
    console.log(`create demo issue ${publicId} (${sample.department})`);
  }
}

async function main() {
  const demo = process.argv.includes('--demo');
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const staffPassword = process.env.SEED_STAFF_PASSWORD;

  if (env.isProduction) {
    if (!adminPassword || adminPassword === 'ChangeMe123!') {
      throw new Error(
        'Refusing to seed production with a default admin password. Set SEED_ADMIN_PASSWORD.'
      );
    }
    if (adminEmail === DEFAULT_ADMIN_EMAIL) {
      throw new Error(
        'Refusing to seed production with the default admin email. Set SEED_ADMIN_EMAIL.'
      );
    }
  }

  if (!adminPassword) {
    // eslint-disable-next-line no-console
    console.log('SEED_ADMIN_PASSWORD not set; skipping admin creation.');
  } else {
    await upsertUser({
      name: process.env.SEED_ADMIN_NAME || 'System Administrator',
      email: adminEmail,
      password: adminPassword,
      role: ROLES.ADMIN,
    });
  }

  if (staffPassword) {
    await upsertUser({
      name: 'IT Support Staff',
      email: 'it.staff@example.edu',
      password: staffPassword,
      role: ROLES.STAFF,
      department: DEPARTMENTS.IT,
    });
    await upsertUser({
      name: 'Facilities Staff',
      email: 'facilities.staff@example.edu',
      password: staffPassword,
      role: ROLES.STAFF,
      department: DEPARTMENTS.FACILITIES,
    });
    await upsertUser({
      name: 'Administration Staff',
      email: 'admin.staff@example.edu',
      password: staffPassword,
      role: ROLES.STAFF,
      department: DEPARTMENTS.ADMINISTRATION,
    });
  } else {
    // eslint-disable-next-line no-console
    console.log('SEED_STAFF_PASSWORD not set; skipping staff creation.');
  }

  if (demo) {
    const reporter =
      (await User.findOne({ email: 'demo.reporter@example.edu' })) ||
      (await upsertUser({
        name: 'Demo Reporter',
        email: 'demo.reporter@example.edu',
        password: process.env.SEED_STAFF_PASSWORD || 'ChangeMe123!',
        role: ROLES.REPORTER,
      }));
    await seedDemo(reporter);
    // eslint-disable-next-line no-console
    console.log('Demo reporter and issues created. This is development-only sample data.');
  }

  // eslint-disable-next-line no-console
  console.log('\nSeed complete. Passwords are taken from SEED_* environment variables and are not shown.');
}

async function run() {
  try {
    await connect();
    await main();
    await disconnect();
    process.exit(0);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err.message);
    await disconnect().catch(() => {});
    process.exit(1);
  }
}

// Only run when executed directly (`node scripts/seed.js`); importing this
// module (e.g. from tests) must not open a database connection or exit.
const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  run();
}

export { upsertUser, main, run };
