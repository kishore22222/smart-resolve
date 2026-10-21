import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import Banner from '../components/Banner.jsx';
import Spinner from '../components/Spinner.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Tile, { Tiles } from '../components/ui/Tile.jsx';
import Bar from '../components/ui/Bar.jsx';
import Panel, { PanelTitle } from '../components/ui/Panel.jsx';
import Donut from '../components/charts/Donut.jsx';
import TrendChart from '../components/charts/TrendChart.jsx';
import {
  IconActivity,
  IconBuilding,
  IconChart,
  IconCheckCircle,
  IconClock,
  IconInbox,
  IconLayers,
  IconTrending,
} from '../components/ui/icons.jsx';
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from '../utils/labels.js';

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

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .reports()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading reports" />;

  const statusSegments = data
    ? STATUS_ORDER.map((s) => ({
        label: STATUS_LABELS[s],
        value: data.byStatus?.[s] ?? 0,
        color: STATUS_COLORS[s],
      }))
    : [];

  const priorityMax = data ? Math.max(1, ...Object.values(data.byPriority || {})) : 1;

  return (
    <div>
      <PageHead
        eyebrow="Analytics"
        title="Reports"
        subtitle="Aggregate activity across every department."
      />

      {error ? <Banner tone="error">{error}</Banner> : null}
      {!data ? null : (
        <div className="flex flex-col gap-6">
          <Tiles className="mb-0">
            <Tile label="Total issues" value={data.totals.all} icon={IconLayers} tone="blue" />
            <Tile label="Open" value={data.totals.open} icon={IconInbox} tone="amber" />
            <Tile label="Resolved" value={data.totals.resolved} icon={IconCheckCircle} tone="green" />
            <Tile
              label="Avg resolution"
              value={data.avgResolutionHours == null ? '—' : `${data.avgResolutionHours}h`}
              icon={IconClock}
              tone="teal"
              hint={data.resolutionSamples ? `${data.resolutionSamples} samples` : undefined}
            />
          </Tiles>

          <Panel>
            <PanelTitle icon={IconTrending} eyebrow="Last 6 months">
              Created vs resolved
            </PanelTitle>
            <TrendChart data={data.monthly} />
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel>
              <PanelTitle icon={IconBuilding} eyebrow="Department">
                Resolution by department
              </PanelTitle>
              <div className="flex flex-col gap-4">
                {Object.entries(data.byDepartment).map(([dept, counts]) => (
                  <Bar
                    key={dept}
                    label={dept}
                    value={(counts.resolved / Math.max(1, counts.total)) * 100}
                    detail={`${counts.open} open · ${counts.resolved} resolved`}
                    tone="green"
                  />
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelTitle icon={IconChart} eyebrow="Breakdown">
                Status & priority
              </PanelTitle>
              <Donut segments={statusSegments} centerLabel="issues" />
              <div className="mt-6 flex flex-col gap-4 border-t border-line-soft pt-6">
                {PRIORITY_ORDER.map((p) => (
                  <Bar
                    key={p}
                    label={PRIORITY_LABELS[p]}
                    value={((data.byPriority?.[p] ?? 0) / priorityMax) * 100}
                    detail={`${data.byPriority?.[p] ?? 0}`}
                    tone={PRIORITY_TONES[p]}
                  />
                ))}
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelTitle icon={IconActivity} eyebrow="Team">
              Staff workload
            </PanelTitle>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-dim">
                    <th className="pb-3 pr-3 font-medium">Staff</th>
                    <th className="pb-3 pr-3 font-medium">Department</th>
                    <th className="pb-3 pr-3 font-medium">Assigned</th>
                    <th className="pb-3 pr-3 font-medium">Open</th>
                    <th className="pb-3 pr-3 font-medium">Resolved</th>
                    <th className="pb-3 font-medium">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {data.staffWorkload.map((row) => (
                    <tr
                      key={row.user.id}
                      className="border-t border-line-soft transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-3.5 pr-3 font-medium text-fg">{row.user.name}</td>
                      <td className="py-3.5 pr-3 text-muted">{row.user.department || '—'}</td>
                      <td className="py-3.5 pr-3 font-mono text-fg">{row.assigned}</td>
                      <td className="py-3.5 pr-3 font-mono text-amber">{row.open}</td>
                      <td className="py-3.5 pr-3 font-mono text-green">{row.resolved}</td>
                      <td className="w-[160px] py-3.5">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-blue"
                            style={{
                              width: `${(row.resolved / Math.max(1, row.assigned)) * 100}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
