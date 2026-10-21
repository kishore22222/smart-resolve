export const ROLES = Object.freeze({
  REPORTER: 'reporter',
  STAFF: 'staff',
  ADMIN: 'admin',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const DEPARTMENTS = Object.freeze({
  IT: 'IT Support',
  FACILITIES: 'Facilities',
  ADMINISTRATION: 'Administration',
});

export const DEPARTMENT_VALUES = Object.freeze(Object.values(DEPARTMENTS));

export const STATUSES = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  TRIAGED: 'TRIAGED',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
});

export const STATUS_VALUES = Object.freeze(Object.values(STATUSES));

// Reporter-owned issues may only be soft-deleted while they are still in an
// initial, not-yet-actioned state. Once an issue is assigned or moves into
// active processing it is no longer deletable by its reporter.
export const DELETABLE_STATUSES = Object.freeze([STATUSES.SUBMITTED, STATUSES.TRIAGED]);

export const PRIORITIES = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

export const PRIORITY_VALUES = Object.freeze(Object.values(PRIORITIES));

export const PRIORITY_WEIGHT = Object.freeze({
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
});
