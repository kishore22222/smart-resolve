import Panel from './ui/Panel.jsx';
import { IconInbox } from './ui/icons.jsx';

export default function EmptyState({ title, icon: Icon = IconInbox, children, action }) {
  return (
    <Panel className="px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/[0.04] text-muted">
        <Icon size={24} />
      </div>
      <p className="mb-2 text-h3 font-semibold text-fg">{title}</p>
      {children ? <p className="mx-auto max-w-[46ch] text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Panel>
  );
}
