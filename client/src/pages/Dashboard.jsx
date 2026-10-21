import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import LedgerRow from '../components/LedgerRow.jsx';
import Banner from '../components/Banner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Tile, { Tiles } from '../components/ui/Tile.jsx';
import Bar from '../components/ui/Bar.jsx';
import Panel, { PanelTitle } from '../components/ui/Panel.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import Donut from '../components/charts/Donut.jsx';
import { buttonClass } from '../components/ui/Button.jsx';
import { staggerContainer, staggerItem } from '../utils/motion.js';
import { ROLE_LABELS, STATUS_LABELS, STATUS_ORDER, PRIORITY_LABELS, PRIORITY_ORDER } from '../utils/labels.js';
import {
  IconAlert,
  IconBuilding,
  IconCheckCircle,
  IconInbox,
  IconLayers,
  IconPlusCircle,
  IconUser,
  IconUsers,
} from '../components/ui/icons.jsx';

const HEADINGS = {
  reporter: { title: 'Your dashboard', sub: 'A summary of the issues you have reported.' },
  staff: { title: 'Department dashboard', sub: 'Issues routed to your department.' },
  admin: { title: 'System overview', sub: 'Campus-wide issue activity at a glance.' },
};

const STATUS_COLORS = {
  SUBMITTED: '#64739a',
  TRIAGED: '#f59e0b',
  ASSIGNED: '#318bff',
  IN_PROGRESS: '#14d9c5',
  RESOLVED: '#22c55e',
  CLOSED: '#93a2c6',
  REOPENED: '#ec4899',
};

const PRIORITY_TONES = { low: 'ink', medium: 'blue', high: 'amber', critical: 'magenta' };

function DashboardSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-16 w-[320px]" />
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(158px,1fr))] gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.dashboard(), api.listIssues({ limit: 5 })])
      .then(([summaryData, issuesData]) => {
        if (!active) return;
        setSummary(summaryData);
        setRecent(issuesData.items);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const heading = HEADINGS[user.role];

  if (loading) return <DashboardSkeleton />;

  const statusSegments = summary
    ? STATUS_ORDER.map((s) => ({
        label: STATUS_LABELS[s],
        value: summary.byStatus?.[s] ?? 0,
        color: STATUS_COLORS[s],
      }))
    : [];

  const priorityMax = summary ? Math.max(1, ...Object.values(summary.byPriority || {})) : 1;

  return (
    <div>
      <PageHead
        eyebrow={ROLE_LABELS[user.role]}
        title={heading.title}
        subtitle={heading.sub}
        action={
          user.role !== 'staff' ? (
            <Link className={buttonClass()} to="/issues/new">
              <IconPlusCircle size={16} /> Report an issue
            </Link>
          ) : null
        }
      />

      {error ? <Banner tone="error">{error}</Banner> : null}

      {summary ? (
        <>
          <Tiles className="mb-6">
            <Tile label="Open" value={summary.totals.open} icon={IconInbox} tone="blue" />
            <Tile label="Resolved" value={summary.totals.resolved} icon={IconCheckCircle} tone="green" />
            <Tile
              label="Needs review"
              value={summary.totals.needsReview}
              alert={summary.totals.needsReview > 0}
              icon={IconAlert}
              tone="amber"
            />
            <Tile label="Unassigned" value={summary.totals.unassigned} icon={IconUser} tone="violet" />
            {user.role === 'staff' ? (
              <Tile
                label="Assigned to me"
                value={summary.assignedToMe || 0}
                icon={IconUser}
                tone="teal"
              />
            ) : null}
            {user.role === 'admin' && summary.users ? (
              <Tile label="Accounts" value={summary.users.total} icon={IconUsers} tone="magenta" />
            ) : null}
          </Tiles>

          <div className="mb-6 grid gap-5 lg:grid-cols-2">
            <Panel>
              <PanelTitle icon={IconLayers} eyebrow="Distribution">
                Issues by status
              </PanelTitle>
              <Donut segments={statusSegments} centerLabel="total" />
            </Panel>

            <Panel>
              <PanelTitle icon={IconAlert} eyebrow="Priority">
                Priority mix
              </PanelTitle>
              <div className="flex flex-col gap-4">
                {PRIORITY_ORDER.map((p) => (
                  <Bar
                    key={p}
                    label={PRIORITY_LABELS[p]}
                    value={((summary.byPriority?.[p] ?? 0) / priorityMax) * 100}
                    detail={`${summary.byPriority?.[p] ?? 0}`}
                    tone={PRIORITY_TONES[p]}
                  />
                ))}
              </div>
            </Panel>
          </div>

          {user.role === 'admin' && summary.byDepartment ? (
            <Panel className="mb-6">
              <PanelTitle
                icon={IconBuilding}
                eyebrow="Routing"
                action={
                  summary.users ? (
                    <span className="text-xs text-muted">
                      {summary.users.staff} staff · {summary.users.admins} admins ·{' '}
                      {summary.users.reporters} reporters
                    </span>
                  ) : null
                }
              >
                By department
              </PanelTitle>
              <div className="flex flex-col gap-4">
                {Object.entries(summary.byDepartment).map(([dept, count]) => {
                  const max = Math.max(1, ...Object.values(summary.byDepartment));
                  return (
                    <Bar
                      key={dept}
                      label={dept}
                      value={(count / max) * 100}
                      detail={`${count}`}
                      tone="blue"
                    />
                  );
                })}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-h3">Recent activity</h2>
        {recent.length > 0 ? (
          <Link to="/issues" className="text-sm font-medium">
            View all
          </Link>
        ) : null}
      </div>

      {recent.length === 0 ? (
        <EmptyState
          title="No issues yet"
          action={
            user.role !== 'staff' ? (
              <Link className={buttonClass()} to="/issues/new">
                <IconPlusCircle size={16} /> Report the first issue
              </Link>
            ) : null
          }
        >
          {user.role === 'staff'
            ? 'Nothing is routed to your department right now.'
            : 'When you report an issue it will appear here.'}
        </EmptyState>
      ) : (
        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-2.5"
        >
          {recent.map((issue) => (
            <motion.div key={issue._id} variants={staggerItem}>
              <LedgerRow issue={issue} showReporter={user.role !== 'reporter'} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
