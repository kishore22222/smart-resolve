import { cn } from '../../utils/cn.js';

const TONES = {
  neutral: 'bg-white/[0.06] text-muted border-line',
  warn: 'bg-amber/[0.12] text-amber border-amber/30',
  blue: 'bg-blue/[0.12] text-blue border-blue/30',
  violet: 'bg-violet/[0.12] text-violet border-violet/30',
  teal: 'bg-teal/[0.12] text-teal border-teal/30',
  magenta: 'bg-magenta/[0.12] text-magenta border-magenta/30',
  success: 'bg-green/[0.12] text-green border-green/30',
};

export default function Tag({ tone = 'neutral', warn = false, className, children }) {
  const resolved = warn ? 'warn' : tone;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONES[resolved] ?? TONES.neutral,
        className
      )}
    >
      {children}
    </span>
  );
}
