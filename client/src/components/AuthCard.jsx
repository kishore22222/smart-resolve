import AmbientBackground from './AmbientBackground.jsx';
import Brand from './Brand.jsx';
import { IconActivity, IconShield, IconSparkles } from './ui/icons.jsx';

const FEATURES = [
  {
    icon: IconSparkles,
    title: 'AI-assisted triage',
    body: 'Issues are classified and routed to the right department automatically.',
  },
  {
    icon: IconActivity,
    title: 'Live status tracking',
    body: 'Follow every issue from submission to resolution with a full audit trail.',
  },
  {
    icon: IconShield,
    title: 'Role-aware access',
    body: 'Reporters, department staff, and administrators each see exactly what they need.',
  },
];

export default function AuthCard({ children, tagline }) {
  return (
    <div className="relative grid min-h-screen min-[980px]:grid-cols-[1.05fr_1fr]">
      <AmbientBackground />

      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line-soft px-12 py-14 min-[980px]:flex">
        <Brand size="md" />

        <div className="max-w-[34ch]">
          <h1 className="text-display font-semibold leading-[1.05] tracking-[-0.03em] text-fg">
            Campus issues, <span className="gradient-text">resolved with clarity</span>.
          </h1>
          {tagline ? <p className="mt-5 text-sm text-muted">{tagline}</p> : null}
        </div>

        <ul className="flex flex-col gap-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-white/[0.04] text-blue">
                <Icon size={17} />
              </span>
              <div>
                <div className="text-sm font-semibold text-fg">{title}</div>
                <div className="mt-0.5 max-w-[42ch] text-xs text-muted">{body}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="relative flex items-center justify-center p-6">
        <div className="w-full max-w-[420px]">
          <Brand className="mb-7 min-[980px]:hidden" />
          <div className="panel rounded-[20px] p-7 sm:p-8">{children}</div>
          <p className="mt-6 text-center text-xs text-dim">
            SmartResolve AI · campus issue operations console
          </p>
        </div>
      </main>
    </div>
  );
}
