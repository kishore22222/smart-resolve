import { motion } from 'motion/react';
import { cn } from '../../utils/cn.js';
import { EASE } from '../../utils/motion.js';

const FILLS = {
  ink: 'bg-blue',
  blue: 'bg-blue',
  amber: 'bg-amber',
  green: 'bg-green',
  violet: 'bg-violet',
  magenta: 'bg-magenta',
  teal: 'bg-teal',
};

// A labelled progress bar. Width is data-driven (inline); everything else is a
// Tailwind utility. The fill animates in on mount and whenever the value moves.
export default function Bar({ label, value, detail, tone = 'blue' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="text-fg">{label}</span>
        {detail ? <span className="text-xs text-muted">{detail}</span> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className={cn('h-full rounded-full', FILLS[tone] ?? FILLS.blue)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE }}
        />
      </div>
    </div>
  );
}
