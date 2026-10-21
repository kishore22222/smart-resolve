import Issue from '../models/Issue.js';
import User from '../models/User.js';
import { ROLES, STATUSES, DEPARTMENT_VALUES, PRIORITY_VALUES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { computePriority } from '../services/priority.js';
import { routeIssue } from '../services/routing.js';
import { canTransition, allowedNextStatuses } from '../services/transitions.js';
import { isDeletableIssue, DELETABLE_STATUSES } from '../services/deletion.js';
import { nextPublicId } from '../services/issueId.js';
import * as mlClient from '../services/mlClient.js';
import env from '../config/env.js';

const POPULATE = [
  { path: 'reporter', select: 'name email role department' },
  { path: 'assignedTo', select: 'name email role department' },
  { path: 'history.by', select: 'name role' },
  { path: 'duplicateCandidates.issue', select: 'publicId title status department priority' },
  { path: 'duplicateOf', select: 'publicId title status' },
];

export function isStaffForIssue(user, issue) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role !== ROLES.STAFF) return false;
  const assigned = issue.assignedTo && issue.assignedTo.toString() === user._id.toString();
  return issue.department === user.department || Boolean(assigned);
}

export function canView(user, issue) {
  if (user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.STAFF) return isStaffForIssue(user, issue);
  return issue.reporter.toString() === user._id.toString();
}

export function scopeQuery(user) {
  if (user.role === ROLES.ADMIN) return {};
  if (user.role === ROLES.STAFF) {
    return { $or: [{ department: user.department }, { assignedTo: user._id }] };
  }
  return { reporter: user._id };
}

async function attachDuplicateCandidates(issue) {
  const recent = await Issue.find({ _id: { $ne: issue._id } })
    .sort({ createdAt: -1 })
    .limit(150)
    .select('publicId title description');

  if (!recent.length) return;

  const result = await mlClient.similarity({
    text: `${issue.title}. ${issue.description}`,
    candidates: recent.map((i) => ({
      id: i._id.toString(),
      text: `${i.title}. ${i.description}`,
    })),
    threshold: env.duplicateThreshold,
  });

  if (!result.available || !result.matches || !result.matches.length) return;

  const byId = new Map(recent.map((i) => [i._id.toString(), i]));
  issue.duplicateCandidates = result.matches
    .filter((m) => byId.has(m.id))
    .slice(0, 5)
    .map((m) => ({
      issue: byId.get(m.id)._id,
      publicId: byId.get(m.id).publicId,
      score: m.score,
    }));

  if (issue.duplicateCandidates.length) {
    issue.addHistory({
      action: 'duplicate_suggested',
      by: issue.reporter,
      note: `${issue.duplicateCandidates.length} possible duplicate(s) found for review.`,
    });
  }
}

export const createIssue = asyncHandler(async (req, res) => {
  // Only free-text fields come from the reporter. Department is never accepted
  // from the client: it is derived from the classifier below.
  const { title, description, location } = req.body;

  // 1. Deterministic priority (no ML influence).
  const { priority, reasons: priorityReasons } = computePriority({ title, description });

  // 2. The classifier is the authority for department routing (never fatal).
  const ml = await mlClient.classify(`${title}. ${description}`);

  // 3. Validate the prediction; flag for Admin review when it is not reliable.
  const routing = routeIssue({
    ml: ml.available
      ? { available: true, department: ml.department, confidence: ml.confidence }
      : { available: false },
  });

  const publicId = await nextPublicId();

  const issue = new Issue({
    publicId,
    title,
    description,
    location: location || '',
    department: routing.department,
    priority,
    status: STATUSES.SUBMITTED,
    reporter: req.user._id,
    needsReview: routing.needsReview,
    ml: routing.ml,
    history: [],
  });

  issue.addHistory({
    action: 'created',
    to: STATUSES.SUBMITTED,
    by: req.user._id,
    note: 'Issue reported.',
  });
  issue.addHistory(
    routing.department
      ? {
          action: 'routed',
          to: routing.department,
          by: req.user._id,
          note: routing.reasons.join(' '),
          meta: { method: routing.method, confidence: routing.ml.confidence },
        }
      : {
          action: 'flagged_for_review',
          by: req.user._id,
          note: routing.reasons.join(' '),
          meta: {
            method: routing.method,
            mlAvailable: routing.ml.available,
            mlConfidence: routing.ml.confidence,
          },
        }
  );
  issue.addHistory({
    action: 'prioritized',
    to: priority,
    by: req.user._id,
    note: priorityReasons.join(' '),
  });

  await issue.save();

  // 4. Best-effort duplicate candidates. Failure must not affect creation.
  try {
    await attachDuplicateCandidates(issue);
    await issue.save();
  } catch (err) {
    // Swallow: duplicate detection is advisory only.
  }

  await issue.populate(POPULATE);
  res.status(201).json({ data: { issue } });
});

export const listIssues = asyncHandler(async (req, res) => {
  const { status, department, priority, q, assignedTo, mine, page = 1, limit = 20 } = req.query;

  const filter = { ...scopeQuery(req.user) };
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (priority) filter.priority = priority;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (mine === 'true') filter.assignedTo = req.user._id;
  if (q) {
    const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safe, 'i');
    filter.$and = [{ $or: [{ title: re }, { description: re }, { publicId: re }, { location: re }] }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    Issue.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate(POPULATE),
    Issue.countDocuments(filter),
  ]);

  res.json({
    data: {
      items,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    },
  });
});

export const getIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate(POPULATE);
  if (!issue) throw ApiError.notFound('Issue not found.');
  if (!canView(req.user, issue)) throw ApiError.forbidden('You cannot view this issue.');

  const staffForIssue = req.user.role !== ROLES.REPORTER && isStaffForIssue(req.user, issue);

  const isOwner =
    req.user.role === ROLES.REPORTER && issue.reporter.toString() === req.user._id.toString();

  res.json({
    data: {
      issue,
      permissions: {
        canUpdateStatus: staffForIssue,
        canAssign: staffForIssue,
        canAddFollowUp: true,
        canMarkDuplicate: staffForIssue,
        // Reporters may soft-delete only their own, not-yet-actioned issues.
        canDelete: isOwner && isDeletableIssue(issue),
        allowedTransitions: allowedNextStatuses(issue.status, req.user.role).filter((to) => {
          if (req.user.role === ROLES.REPORTER) return true;
          return isStaffForIssue(req.user, issue);
        }),
      },
    },
  });
});

export const addFollowUp = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');
  if (!canView(req.user, issue)) throw ApiError.forbidden('You cannot update this issue.');

  issue.addHistory({ action: 'comment', by: req.user._id, note: req.body.note });
  await issue.save();
  await issue.populate(POPULATE);
  res.json({ data: { issue } });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const { status: next, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');

  const isReporter = req.user.role === ROLES.REPORTER;
  if (isReporter) {
    // Reporters may only reopen their own resolved issue.
    const owns = issue.reporter.toString() === req.user._id.toString();
    if (!owns) throw ApiError.forbidden('You cannot update this issue.');
  } else if (!isStaffForIssue(req.user, issue)) {
    throw ApiError.forbidden('This issue is not in your department.');
  }

  if (!canTransition(issue.status, next, req.user.role)) {
    throw ApiError.badRequest(
      `Cannot move an issue from ${issue.status} to ${next} as ${req.user.role}.`,
      { from: issue.status, to: next, allowed: allowedNextStatuses(issue.status, req.user.role) },
      'INVALID_TRANSITION'
    );
  }

  const from = issue.status;
  issue.status = next;
  issue.addHistory({
    action: 'status_changed',
    from,
    to: next,
    by: req.user._id,
    note: note || null,
  });
  await issue.save();
  await issue.populate(POPULATE);
  res.json({ data: { issue } });
});

export const assignIssue = asyncHandler(async (req, res) => {
  const { assignedTo, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (!isStaffForIssue(req.user, issue)) {
    throw ApiError.forbidden('This issue is not in your department.');
  }

  if ([STATUSES.RESOLVED, STATUSES.CLOSED].includes(issue.status)) {
    throw ApiError.badRequest('Resolved or closed issues cannot be reassigned. Reopen it first.');
  }

  const staff = await User.findById(assignedTo);
  if (!staff || !staff.isActive) throw ApiError.badRequest('Selected staff member is not available.');
  if (staff.role !== ROLES.STAFF && staff.role !== ROLES.ADMIN) {
    throw ApiError.badRequest('Issues can only be assigned to staff or administrators.');
  }
  if (staff.role === ROLES.STAFF && staff.department !== issue.department) {
    throw ApiError.badRequest('Staff member belongs to a different department.');
  }

  const from = issue.status;
  issue.assignedTo = staff._id;
  if ([STATUSES.SUBMITTED, STATUSES.TRIAGED, STATUSES.REOPENED].includes(issue.status)) {
    issue.status = STATUSES.ASSIGNED;
  }
  issue.addHistory({
    action: 'assigned',
    from,
    to: issue.status,
    by: req.user._id,
    note: note || `Assigned to ${staff.name}.`,
    meta: { assignedTo: staff._id },
  });
  await issue.save();
  await issue.populate(POPULATE);
  res.json({ data: { issue } });
});

export const markDuplicate = asyncHandler(async (req, res) => {
  const { duplicateOf, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');
  if (!isStaffForIssue(req.user, issue)) {
    throw ApiError.forbidden('This issue is not in your department.');
  }

  if (duplicateOf === issue._id.toString()) {
    throw ApiError.badRequest('An issue cannot be a duplicate of itself.');
  }
  const original = await Issue.findById(duplicateOf);
  if (!original) throw ApiError.badRequest('The referenced original issue does not exist.');

  issue.duplicateOf = original._id;
  issue.needsReview = false;
  issue.addHistory({
    action: 'marked_duplicate',
    by: req.user._id,
    note: note || `Marked as duplicate of ${original.publicId}.`,
    meta: { duplicateOf: original._id, duplicateOfPublicId: original.publicId },
  });
  await issue.save();
  await issue.populate(POPULATE);
  res.json({ data: { issue } });
});

// Admin-only manual review: set/correct the department the classifier chose.
// The correction is recorded in the audit history and clears the review flag.
export const updateDepartment = asyncHandler(async (req, res) => {
  const { department, note } = req.body;
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');

  const from = issue.department;
  if (from === department) {
    throw ApiError.badRequest(`Issue is already routed to ${department}.`);
  }

  issue.department = department;
  issue.needsReview = false;
  issue.addHistory({
    action: 'department_corrected',
    from,
    to: department,
    by: req.user._id,
    note: note || `Department set to ${department} during manual review.`,
  });
  await issue.save();
  await issue.populate(POPULATE);
  res.json({ data: { issue } });
});

// Reporter-only soft delete. Ownership and eligibility are verified from the
// authenticated user and the stored issue — never from client-supplied fields.
// The final update is a single conditional write so an issue that becomes
// assigned (or moves into processing) concurrently cannot be deleted.
export const deleteIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);
  if (!issue) throw ApiError.notFound('Issue not found.');

  if (issue.reporter.toString() !== req.user._id.toString()) {
    throw ApiError.forbidden('You can only delete your own issues.');
  }

  if (!isDeletableIssue(issue)) {
    throw ApiError.conflict(
      'This issue can no longer be deleted because it has been assigned or is already being processed.',
      { status: issue.status, assignedTo: issue.assignedTo },
      'ISSUE_NOT_DELETABLE'
    );
  }

  const archivedAt = new Date();
  const updated = await Issue.findOneAndUpdate(
    {
      _id: issue._id,
      reporter: req.user._id,
      status: { $in: DELETABLE_STATUSES },
      assignedTo: null,
      archivedAt: null,
    },
    {
      $set: { archivedAt, archivedBy: req.user._id },
      $push: {
        history: {
          action: 'archived',
          by: req.user._id,
          at: archivedAt,
          note: 'Issue archived by the reporter.',
        },
      },
    },
    { new: true }
  );

  if (!updated) {
    // The issue changed state between the eligibility check and the write.
    throw ApiError.conflict(
      'This issue can no longer be deleted because its status changed.',
      undefined,
      'ISSUE_NOT_DELETABLE'
    );
  }

  await updated.populate(POPULATE);
  res.json({ data: { issue: updated } });
});

export const getDuplicates = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate(POPULATE);
  if (!issue) throw ApiError.notFound('Issue not found.');
  if (!canView(req.user, issue)) throw ApiError.forbidden('You cannot view this issue.');

  // Refresh candidates on demand (advisory only; never auto-merges).
  let matches = issue.duplicateCandidates || [];
  try {
    await attachDuplicateCandidates(issue);
    await issue.save();
    await issue.populate(POPULATE);
    matches = issue.duplicateCandidates;
  } catch (err) {
    // Keep any previously stored candidates.
  }

  res.json({
    data: {
      candidates: matches,
      threshold: env.duplicateThreshold,
      note: 'Similarity scores are suggestions for review, not proof of duplication.',
    },
  });
});

export const getHistory = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id).populate('history.by', 'name role');
  if (!issue) throw ApiError.notFound('Issue not found.');
  if (!canView(req.user, issue)) throw ApiError.forbidden('You cannot view this issue.');
  res.json({ data: { history: issue.history } });
});

export const filters = asyncHandler(async (req, res) => {
  res.json({
    data: {
      departments: DEPARTMENT_VALUES,
      statuses: Object.values(STATUSES),
      priorities: PRIORITY_VALUES,
    },
  });
});
