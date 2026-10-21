import { DELETABLE_STATUSES } from '../config/constants.js';

// A single source of truth for "can this issue still be deleted by its reporter".
// Kept separate from the controller so both the permission calculation and the
// delete handler reason about eligibility identically.
export function isDeletableIssue(issue) {
  if (!issue) return false;
  if (issue.archivedAt) return false;
  if (issue.assignedTo) return false;
  return DELETABLE_STATUSES.includes(issue.status);
}

export { DELETABLE_STATUSES };
