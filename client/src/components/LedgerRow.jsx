import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import StatusStamp from './StatusStamp.jsx';
import PriorityBadge from './PriorityBadge.jsx';
import Tag from './ui/Tag.jsx';
import { formatRelative } from '../utils/labels.js';

const MotionLink = motion.create(Link);

const BAR = {
  SUBMITTED: 'bg-dim',
  TRIAGED: 'bg-amber',
  ASSIGNED: 'bg-blue',
  IN_PROGRESS: 'bg-teal',
  RESOLVED: 'bg-green',
  CLOSED: 'bg-line',
  REOPENED: 'bg-magenta',
};

// A single work-order entry. Rows (not uniform cards) carry the hierarchy:
// identifier, title, routing metadata, status signal, and age.
export default function LedgerRow({ issue, showReporter = false }) {
  return (
    <MotionLink
      to={`/issues/${issue._id}`}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="group relative grid grid-cols-1 items-center gap-3 overflow-hidden rounded-[14px] border border-line-soft bg-surface/40 px-4 py-3.5 text-inherit no-underline transition-colors hover:border-blue/40 hover:bg-surface-2/70 min-[860px]:grid-cols-[128px_1fr_auto] min-[860px]:gap-5"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-3 left-0 w-[3px] rounded-full ${BAR[issue.status] ?? BAR.SUBMITTED}`}
      />

      <span className="pl-2 min-[860px]:pl-0">
        <span className="block font-mono text-xs tracking-[-0.01em] text-dim">{issue.publicId}</span>
        <span className="mt-1 block text-xs text-muted">
          {issue.department || 'Unrouted'}
        </span>
      </span>

      <span className="min-w-0">
        <span className="mb-1.5 block truncate font-semibold text-fg">{issue.title}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
          <PriorityBadge priority={issue.priority} />
          {issue.location ? <span className="truncate">{issue.location}</span> : null}
          {showReporter && issue.reporter ? <span>by {issue.reporter.name}</span> : null}
          {issue.needsReview ? <Tag warn>Needs review</Tag> : null}
        </span>
      </span>

      <span className="flex flex-row items-center justify-between gap-3 min-[860px]:flex-col min-[860px]:items-end min-[860px]:gap-2">
        <StatusStamp status={issue.status} />
        <span className="text-xs text-dim">{formatRelative(issue.createdAt)}</span>
      </span>
    </MotionLink>
  );
}
