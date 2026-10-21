import { cn } from '../../utils/cn.js';

// Shimmering placeholder for list and card loading states. The gradient lives
// inline so it does not depend on arbitrary-value utilities.
export default function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[10px] border border-line-soft bg-surface/60',
        className
      )}
    >
      <div
        className="animate-shimmer absolute inset-0 motion-reduce:animate-none"
        style={{
          backgroundImage:
            'linear-gradient(90deg, transparent, rgba(150,170,230,0.10), transparent)',
          backgroundSize: '200% 100%',
        }}
      />
    </div>
  );
}
