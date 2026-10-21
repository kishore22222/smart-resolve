import { motion } from 'motion/react';
import { cn } from '../../utils/cn.js';

const VARIANTS = {
  primary:
    'brand-gradient text-white border border-white/10 shadow-[0_14px_34px_-14px_rgba(49,139,255,0.85)] hover:brightness-[1.08]',
  ghost:
    'bg-white/[0.04] text-fg border border-line hover:border-blue/50 hover:bg-white/[0.07]',
  subtle: 'bg-transparent text-muted border border-transparent hover:text-fg hover:bg-white/[0.06]',
  danger: 'bg-danger/10 text-danger border border-danger/40 hover:bg-danger/20',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

// Shared with non-<button> elements (e.g. a router <Link> that should look like
// a button) so the visual language lives in one place.
export function buttonClass({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex cursor-pointer select-none items-center justify-center rounded-[10px] font-sans font-semibold no-underline transition-[filter,background-color,border-color,color,box-shadow] duration-200 disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className
  );
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  disabled,
  ...props
}) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
