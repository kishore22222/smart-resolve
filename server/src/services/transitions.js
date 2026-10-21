import { ROLES, STATUSES } from '../config/constants.js';

// Allowed status transitions, keyed from -> to, gated by role.
// ASSIGNED is normally entered through the assignment endpoint, but is also a
// legal explicit transition so staff can re-assign via the status flow.
export const TRANSITIONS = {
  [STATUSES.SUBMITTED]: {
    [STATUSES.TRIAGED]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.ASSIGNED]: [ROLES.STAFF, ROLES.ADMIN],
  },
  [STATUSES.TRIAGED]: {
    [STATUSES.ASSIGNED]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.IN_PROGRESS]: [ROLES.STAFF, ROLES.ADMIN],
  },
  [STATUSES.ASSIGNED]: {
    [STATUSES.IN_PROGRESS]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.TRIAGED]: [ROLES.STAFF, ROLES.ADMIN],
  },
  [STATUSES.IN_PROGRESS]: {
    [STATUSES.RESOLVED]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.TRIAGED]: [ROLES.ADMIN],
  },
  [STATUSES.RESOLVED]: {
    [STATUSES.CLOSED]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.REOPENED]: [ROLES.REPORTER, ROLES.STAFF, ROLES.ADMIN],
  },
  [STATUSES.CLOSED]: {
    [STATUSES.REOPENED]: [ROLES.ADMIN],
  },
  [STATUSES.REOPENED]: {
    [STATUSES.IN_PROGRESS]: [ROLES.STAFF, ROLES.ADMIN],
    [STATUSES.TRIAGED]: [ROLES.STAFF, ROLES.ADMIN],
  },
};

export function canTransition(from, to, role) {
  const targets = TRANSITIONS[from];
  if (!targets || !targets[to]) return false;
  return targets[to].includes(role);
}

export function allowedNextStatuses(from, role) {
  const targets = TRANSITIONS[from] || {};
  return Object.keys(targets).filter((to) => targets[to].includes(role));
}
