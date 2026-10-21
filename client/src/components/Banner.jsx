import { cn } from '../utils/cn.js';
import { IconAlert, IconCheckCircle, IconInfo } from './ui/icons.jsx';

const TONES = {
  error: { wrap: 'border-danger/40 bg-danger/10 text-danger', Icon: IconAlert },
  success: { wrap: 'border-green/40 bg-green/10 text-green', Icon: IconCheckCircle },
  info: { wrap: 'border-blue/40 bg-blue/10 text-blue', Icon: IconInfo },
};

export default function Banner({ tone = 'info', className, children }) {
  if (!children) return null;
  const { wrap, Icon } = TONES[tone] ?? TONES.info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex items-start gap-3 rounded-[12px] border px-4 py-3 text-sm',
        wrap,
        className
      )}
    >
      <Icon size={18} className="mt-0.5 flex-none" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
