// Shared display vocabulary. Using one source of truth keeps statuses,
// priorities, and departments labelled identically everywhere in the UI.

export const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  TRIAGED: 'Triaged',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
};

export const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const DEPARTMENTS = ['IT Support', 'Facilities', 'Administration'];

export const STATUS_ORDER = [
  'SUBMITTED',
  'TRIAGED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

export const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];

export const ROLE_LABELS = {
  reporter: 'Reporter',
  staff: 'Department staff',
  admin: 'Administrator',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function priorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

// Human-friendly relative age ("3 days ago") for ledger rows.
export function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.round(days / 30);
  return `${months} mo ago`;
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
