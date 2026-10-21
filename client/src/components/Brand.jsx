import { cn } from '../utils/cn.js';
import { IconSparkles } from './ui/icons.jsx';

const MARK = {
  sm: 'h-7 w-7 rounded-[8px]',
  md: 'h-9 w-9 rounded-[10px]',
  lg: 'h-11 w-11 rounded-[12px]',
};

const TEXT = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
};

export default function Brand({ size = 'md', showText = true, className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'brand-gradient grid flex-none place-items-center text-white shadow-[0_8px_24px_-8px_rgba(49,139,255,0.9)]',
          MARK[size] ?? MARK.md
        )}
      >
        <IconSparkles size={size === 'sm' ? 15 : 18} />
      </span>
      {showText ? (
        <span className={cn('font-semibold tracking-[-0.02em] text-fg', TEXT[size] ?? TEXT.md)}>
          SmartResolve <span className="gradient-text">AI</span>
        </span>
      ) : null}
    </span>
  );
}
