import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { STATUSES, DEPARTMENT_VALUES, PRIORITY_VALUES, ROLES } from '../config/constants.js';
import asyncHandler from '../utils/asyncHandler.js';

const RESOLVED = [STATUSES.RESOLVED, STATUSES.CLOSED];

function emptyCounts(keys) {
  const out = {};
  keys.forEach((k) => (out[k] = 0));
  return out;
}

export const summary = asyncHandler(async (req, res) => {
  const issues = await Issue.find({}).select(
    'department status priority createdAt history assignedTo'
  );

  const byDepartment = {};
  DEPARTMENT_VALUES.forEach((d) => {
    byDepartment[d] = { total: 0, open: 0, resolved: 0 };
  });
  const byPriority = emptyCounts(PRIORITY_VALUES);
  const byStatus = emptyCounts(Object.values(STATUSES));

  let resolutionHoursTotal = 0;
  let resolutionSamples = 0;

  // Last 6 months trend.
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      created: 0,
      resolved: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  issues.forEach((issue) => {
    const dept = byDepartment[issue.department];
    if (dept) {
      dept.total += 1;
      if (RESOLVED.includes(issue.status)) dept.resolved += 1;
      else dept.open += 1;
    }
    byPriority[issue.priority] = (byPriority[issue.priority] || 0) + 1;
    byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;

    const created = new Date(issue.createdAt);
    const ck = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    if (monthIndex.has(ck)) months[monthIndex.get(ck)].created += 1;

    const resolvedEntry = (issue.history || []).find(
      (h) => h.action === 'status_changed' && h.to === STATUSES.RESOLVED
    );
    if (resolvedEntry) {
      const rDate = new Date(resolvedEntry.at);
      const rk = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}`;
      if (monthIndex.has(rk)) months[monthIndex.get(rk)].resolved += 1;
      resolutionHoursTotal += (rDate - created) / 36e5;
      resolutionSamples += 1;
    }
  });

  const staff = await User.find({
    role: { $in: [ROLES.STAFF, ROLES.ADMIN] },
    isActive: true,
  }).select('name email department');

  const staffWorkload = staff.map((s) => {
    const assigned = issues.filter(
      (i) => i.assignedTo && i.assignedTo.toString() === s._id.toString()
    );
    return {
      user: { id: s._id, name: s.name, department: s.department },
      assigned: assigned.length,
      resolved: assigned.filter((i) => RESOLVED.includes(i.status)).length,
      open: assigned.filter((i) => !RESOLVED.includes(i.status)).length,
    };
  });

  res.json({
    data: {
      totals: {
        all: issues.length,
        resolved: issues.filter((i) => RESOLVED.includes(i.status)).length,
        open: issues.filter((i) => !RESOLVED.includes(i.status)).length,
      },
      byDepartment,
      byPriority,
      byStatus,
      avgResolutionHours: resolutionSamples
        ? Math.round((resolutionHoursTotal / resolutionSamples) * 10) / 10
        : null,
      resolutionSamples,
      monthly: months,
      staffWorkload,
    },
  });
});
