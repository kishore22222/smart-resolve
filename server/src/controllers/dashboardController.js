import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { ROLES, STATUSES, DEPARTMENT_VALUES, PRIORITY_VALUES } from '../config/constants.js';
import asyncHandler from '../utils/asyncHandler.js';
import { scopeQuery } from './issueController.js';

const OPEN_STATUSES = [
  STATUSES.SUBMITTED,
  STATUSES.TRIAGED,
  STATUSES.ASSIGNED,
  STATUSES.IN_PROGRESS,
  STATUSES.REOPENED,
];

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function fill(counts, keys) {
  const out = {};
  keys.forEach((k) => {
    out[k] = counts[k] || 0;
  });
  return out;
}

export const summary = asyncHandler(async (req, res) => {
  const scope = scopeQuery(req.user);
  const issues = await Issue.find(scope).select(
    'status department priority createdAt updatedAt assignedTo needsReview'
  );

  const byStatus = countBy(issues, 'status');
  const byDepartment = countBy(issues, 'department');
  const byPriority = countBy(issues, 'priority');

  const open = issues.filter((i) => OPEN_STATUSES.includes(i.status)).length;
  const resolved = issues.filter((i) => [STATUSES.RESOLVED, STATUSES.CLOSED].includes(i.status)).length;
  const needsReview = issues.filter((i) => i.needsReview).length;
  const unassigned = issues.filter((i) => OPEN_STATUSES.includes(i.status) && !i.assignedTo).length;

  const data = {
    scope: req.user.role,
    totals: { all: issues.length, open, resolved, needsReview, unassigned },
    byStatus: fill(byStatus, Object.values(STATUSES)),
    byPriority: fill(byPriority, PRIORITY_VALUES),
  };

  if (req.user.role === ROLES.ADMIN) {
    data.byDepartment = fill(byDepartment, DEPARTMENT_VALUES);
    data.users = {
      total: await User.countDocuments({}),
      staff: await User.countDocuments({ role: ROLES.STAFF }),
      admins: await User.countDocuments({ role: ROLES.ADMIN }),
      reporters: await User.countDocuments({ role: ROLES.REPORTER }),
      inactive: await User.countDocuments({ isActive: false }),
    };
  } else if (req.user.role === ROLES.STAFF) {
    data.department = req.user.department;
    data.assignedToMe = issues.filter(
      (i) => i.assignedTo && i.assignedTo.toString() === req.user._id.toString()
    ).length;
  }

  res.json({ data });
});
