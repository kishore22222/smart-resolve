import { motion } from 'motion/react';
import { cn } from '../../utils/cn.js';
import { fadeUp } from '../../utils/motion.js';

export default function PageHead({ eyebrow, title, subtitle, action, className }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-eyebrow font-semibold uppercase text-blue">{eyebrow}</div>
        ) : null}
        <h1 className="text-h1 text-fg">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-[60ch] text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </motion.div>
  );
}
