import { cn } from '../utils/cn.js';
import { priorityLabel } from '../utils/labels.js';

const TONE = {
  low: 'text-dim',
  medium: 'text-blue',
  high: 'text-amber',
  critical: 'text-danger',
};

const DOT = {
  low: 'bg-dim',
  medium: 'bg-blue',
  high: 'bg-amber',
  critical: 'bg-danger',
};

export default function PriorityBadge({ priority, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold',
        TONE[priority] ?? TONE.low,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-2 w-2 flex-none rounded-full',
          DOT[priority] ?? DOT.low,
          priority === 'critical' && 'animate-pulse-ring'
        )}
      />
      {priorityLabel(priority)}
    </span>
  );
}
