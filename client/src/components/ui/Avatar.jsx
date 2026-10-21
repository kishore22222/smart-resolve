import { cn } from '../../utils/cn.js';

// Gradients are inline so they never depend on arbitrary-value syntax and stay
// identical across browsers.
const ROLE_GRADIENT = {
  admin: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
  staff: 'linear-gradient(135deg, #318bff, #14d9c5)',
  reporter: 'linear-gradient(135deg, #318bff, #8b5cf6)',
};

const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({ name, role = 'reporter', size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundImage: ROLE_GRADIENT[role] ?? ROLE_GRADIENT.reporter }}
      className={cn(
        'grid flex-none place-items-center rounded-full font-semibold text-white ring-2 ring-white/10',
        SIZES[size] ?? SIZES.md,
        className
      )}
    >
      {initials(name)}
    </span>
  );
}
