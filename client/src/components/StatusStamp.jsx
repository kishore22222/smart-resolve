import { cn } from '../utils/cn.js';
import { statusLabel } from '../utils/labels.js';

// The status "signal" — the recurring glowing mark. Colour carries meaning and
// a leading dot ties it to the timeline vocabulary used across the app.
const TONE = {
  SUBMITTED: 'text-dim border-line bg-white/[0.04]',
  TRIAGED: 'text-amber border-amber/[0.35] bg-amber/10',
  ASSIGNED: 'text-blue border-blue/[0.35] bg-blue/10',
  IN_PROGRESS: 'text-teal border-teal/[0.35] bg-teal/10',
  RESOLVED: 'text-green border-green/[0.35] bg-green/10',
  CLOSED: 'text-muted border-line bg-white/[0.04]',
  REOPENED: 'text-magenta border-magenta/[0.35] bg-magenta/10',
};

export default function StatusStamp({ status, flash = false }) {
  return (
    <span
      data-status={status}
      data-flash={flash || undefined}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
        TONE[status] ?? TONE.SUBMITTED,
        flash && 'animate-stamp-in motion-reduce:animate-none'
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}
