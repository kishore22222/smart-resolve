import { cn } from '../../utils/cn.js';

export default function Panel({ as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={cn('glass rounded-[16px] p-5 shadow-card sm:p-6', className)} {...props}>
      {children}
    </Tag>
  );
}

export function PanelTitle({ className, icon: Icon, action, eyebrow, children }) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-4', className)}>
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-white/[0.04] text-blue">
            <Icon size={16} />
          </span>
        ) : null}
        <div>
          {eyebrow ? (
            <div className="text-eyebrow font-semibold uppercase text-dim">{eyebrow}</div>
          ) : null}
          <h2 className="text-h3 text-fg">{children}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}
