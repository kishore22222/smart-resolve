import { motion } from 'motion/react';
import { cn } from '../../utils/cn.js';
import { staggerContainer, staggerItem } from '../../utils/motion.js';
import { useCountUp } from '../../hooks/useCountUp.js';

const ACCENTS = {
  blue: { chip: 'text-blue border-blue/30 bg-blue/10', glow: 'bg-blue/25' },
  violet: { chip: 'text-violet border-violet/30 bg-violet/10', glow: 'bg-violet/25' },
  teal: { chip: 'text-teal border-teal/30 bg-teal/10', glow: 'bg-teal/25' },
  amber: { chip: 'text-amber border-amber/30 bg-amber/10', glow: 'bg-amber/25' },
  green: { chip: 'text-green border-green/30 bg-green/10', glow: 'bg-green/25' },
  magenta: { chip: 'text-magenta border-magenta/30 bg-magenta/10', glow: 'bg-magenta/25' },
  danger: { chip: 'text-danger border-danger/30 bg-danger/10', glow: 'bg-danger/25' },
};

export function Tiles({ className, children }) {
  return (
    <motion.div
      variants={staggerContainer(0.07)}
      initial="hidden"
      animate="show"
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-4',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

export default function Tile({ label, value, alert = false, icon: Icon, tone, hint }) {
  const numeric = typeof value === 'number';
  const counted = useCountUp(numeric ? value : 0);
  const display = numeric ? counted : value;
  const accent = ACCENTS[alert ? 'danger' : tone] ?? ACCENTS.blue;

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="glass card-hover relative overflow-hidden rounded-[16px] p-4"
    >
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-2xl', accent.glow)}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="font-mono text-[1.85rem] font-medium leading-none tracking-[-0.02em] text-fg">
          {display}
        </div>
        {Icon ? (
          <span className={cn('grid h-8 w-8 flex-none place-items-center rounded-lg border', accent.chip)}>
            <Icon size={16} />
          </span>
        ) : null}
      </div>
      <div className="relative mt-3 text-xs font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </div>
      {hint ? <div className="relative mt-1 text-xs text-dim">{hint}</div> : null}
    </motion.div>
  );
}
