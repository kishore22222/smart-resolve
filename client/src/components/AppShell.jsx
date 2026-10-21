import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { ROLE_LABELS, formatRelative } from '../utils/labels.js';
import { cn } from '../utils/cn.js';
import { EASE, pageTransition } from '../utils/motion.js';
import AmbientBackground from './AmbientBackground.jsx';
import Brand from './Brand.jsx';
import Avatar from './ui/Avatar.jsx';
import Button from './ui/Button.jsx';
import StatusStamp from './StatusStamp.jsx';
import {
  IconBell,
  IconChart,
  IconChevronLeft,
  IconClose,
  IconDashboard,
  IconInbox,
  IconList,
  IconLogout,
  IconMenu,
  IconPlusCircle,
  IconSearch,
  IconUsers,
} from './ui/icons.jsx';

const NAV = {
  reporter: [
    { to: '/', label: 'Dashboard', end: true, Icon: IconDashboard },
    { to: '/issues', label: 'My issues', Icon: IconList },
    { to: '/issues/new', label: 'Report an issue', Icon: IconPlusCircle },
  ],
  staff: [
    { to: '/', label: 'Dashboard', end: true, Icon: IconDashboard },
    { to: '/issues', label: 'Department queue', Icon: IconInbox },
  ],
  admin: [
    { to: '/', label: 'Overview', end: true, Icon: IconDashboard },
    { to: '/issues', label: 'All issues', Icon: IconList },
    { to: '/issues/new', label: 'Report an issue', Icon: IconPlusCircle },
    { to: '/admin/users', label: 'People', Icon: IconUsers },
    { to: '/admin/reports', label: 'Reports', Icon: IconChart },
  ],
};

const ROLE_TONE = {
  admin: 'text-violet',
  staff: 'text-blue',
  reporter: 'text-teal',
};

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onOutside();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

function NavItems({ items, collapsed, activeId = 'desktop', onNavigate }) {
  return (
    <>
      {items.map(({ to, label, end, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-sm font-medium no-underline transition-colors',
              collapsed && 'justify-center px-0',
              isActive
                ? 'bg-white/[0.06] text-fg'
                : 'text-muted hover:bg-white/[0.04] hover:text-fg'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive ? (
                <motion.span
                  layoutId={`nav-active-${activeId}`}
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-blue shadow-[0_0_14px_2px_rgba(49,139,255,0.7)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                />
              ) : null}
              <Icon size={18} className={cn('flex-none', isActive ? 'text-blue' : 'text-current')} />
              {!collapsed ? <span className="truncate">{label}</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV[user.role] || NAV.reporter;

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('smartresolve_sidebar') === 'collapsed'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  const notifRef = useRef(null);
  const accountRef = useRef(null);
  useClickOutside(notifRef, () => setNotifOpen(false));
  useClickOutside(accountRef, () => setAccountOpen(false));

  useEffect(() => {
    localStorage.setItem('smartresolve_sidebar', collapsed ? 'collapsed' : 'expanded');
  }, [collapsed]);

  useEffect(() => {
    setDrawerOpen(false);
    setNotifOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notifOpen || recentLoaded) return;
    let active = true;
    api
      .listIssues({ limit: 6 })
      .then((data) => {
        if (active) {
          setRecent(data.items || []);
          setRecentLoaded(true);
        }
      })
      .catch(() => active && setRecentLoaded(true));
    return () => {
      active = false;
    };
  }, [notifOpen, recentLoaded]);

  const handleSignOut = () => {
    logout();
    navigate('/signin', { replace: true });
  };

  const onSearch = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q').toString().trim();
    navigate(value ? `/issues?q=${encodeURIComponent(value)}` : '/issues');
  };

  const needsReview = recent.filter((i) => i.needsReview).length;

  return (
    <div className="relative flex min-h-screen">
      <AmbientBackground />

      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-screen flex-col border-r border-line-soft bg-canvas-2/40 px-3 py-5 backdrop-blur-xl transition-[width] duration-300 min-[860px]:flex"
        style={{ width: collapsed ? 80 : 264 }}
      >
        <div className={cn('mb-6 flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
          <Brand size="sm" showText={!collapsed} />
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          <NavItems items={items} collapsed={collapsed} onNavigate={() => {}} />
        </nav>

        <div className="mt-4 border-t border-line-soft pt-4">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex w-full items-center gap-3 rounded-[11px] px-3 py-2 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-fg',
              collapsed && 'justify-center px-0'
            )}
          >
            <IconChevronLeft
              size={18}
              className={cn('transition-transform duration-300', collapsed && 'rotate-180')}
            />
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen ? (
          <div className="fixed inset-0 z-50 min-[860px]:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-canvas/70 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.32, ease: EASE }}
              className="absolute inset-y-0 left-0 flex w-[280px] flex-col border-r border-line-soft bg-canvas-2/95 p-5 backdrop-blur-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <Brand size="sm" />
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="rounded-lg p-2 text-dim hover:bg-white/[0.06] hover:text-fg"
                >
                  <IconClose size={18} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1">
                <NavItems items={items} collapsed={false} activeId="mobile" onNavigate={() => setDrawerOpen(false)} />
              </nav>
              <UserCard user={user} onSignOut={handleSignOut} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line-soft bg-canvas/70 px-4 py-3 backdrop-blur-xl min-[860px]:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-muted hover:bg-white/[0.06] hover:text-fg min-[860px]:hidden"
          >
            <IconMenu size={20} />
          </button>

          <form onSubmit={onSearch} role="search" className="relative hidden flex-1 sm:block sm:max-w-[420px]">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input
              name="q"
              type="search"
              placeholder="Search issues, IDs, people…"
              aria-label="Search issues"
              className="w-full rounded-[10px] border border-line bg-canvas-2/70 py-2.5 pl-9 pr-3 text-sm text-fg placeholder:text-dim outline-none transition-colors focus:border-blue/60 focus:bg-canvas-2 focus:ring-4 focus:ring-blue/10"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Recent activity"
                aria-expanded={notifOpen}
                className="relative rounded-lg p-2.5 text-muted transition-colors hover:bg-white/[0.06] hover:text-fg"
              >
                <IconBell size={19} />
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-2 top-2 h-2 w-2 rounded-full',
                    needsReview > 0 ? 'bg-magenta animate-pulse-ring' : 'bg-blue'
                  )}
                />
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <Dropdown align="right" className="w-[340px]">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-sm font-semibold text-fg">Recent activity</span>
                      <span className="text-xs text-dim">Latest issues</span>
                    </div>
                    {!recentLoaded ? (
                      <p className="px-1 py-6 text-center text-xs text-dim">Loading…</p>
                    ) : recent.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-dim">Nothing yet.</p>
                    ) : (
                      <ul className="flex flex-col">
                        {recent.map((issue) => (
                          <li key={issue._id}>
                            <button
                              type="button"
                              onClick={() => navigate(`/issues/${issue._id}`)}
                              className="flex w-full flex-col gap-1.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[11px] text-dim">{issue.publicId}</span>
                                <StatusStamp status={issue.status} />
                              </span>
                              <span className="truncate text-sm text-fg">{issue.title}</span>
                              <span className="text-[11px] text-dim">{formatRelative(issue.createdAt)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate('/issues')}
                      className="mt-2 w-full rounded-lg border border-line py-2 text-xs font-medium text-muted transition-colors hover:border-blue/40 hover:text-fg"
                    >
                      View all issues
                    </button>
                  </Dropdown>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-white/[0.06]"
              >
                <Avatar name={user.name} role={user.role} size="sm" />
                <span className="hidden text-sm text-muted sm:inline">{user.name}</span>
              </button>
              <AnimatePresence>
                {accountOpen ? (
                  <Dropdown align="right" className="w-[240px]">
                    <div className="flex items-center gap-3 px-1 pb-3">
                      <Avatar name={user.name} role={user.role} size="md" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-fg">{user.name}</div>
                        <div className="truncate text-xs text-dim">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                      <span className={cn('font-semibold', ROLE_TONE[user.role])}>
                        {ROLE_LABELS[user.role]}
                      </span>
                      {user.department ? <span className="text-dim">{user.department}</span> : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <IconLogout size={16} /> Sign out
                    </button>
                  </Dropdown>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 min-[860px]:px-8 min-[860px]:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageTransition}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Dropdown({ align = 'right', className, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={cn(
        'panel absolute top-[calc(100%+8px)] z-40 rounded-[14px] p-3',
        align === 'right' ? 'right-0' : 'left-0',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

function UserCard({ user, onSignOut }) {
  return (
    <div className="mt-4 border-t border-line-soft pt-4">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={user.name} role={user.role} size="md" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-fg">{user.name}</div>
          <div className={cn('text-xs font-medium', ROLE_TONE[user.role])}>
            {ROLE_LABELS[user.role]}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="w-full" onClick={onSignOut}>
        <IconLogout size={15} /> Sign out
      </Button>
    </div>
  );
}
