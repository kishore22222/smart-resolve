import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import LedgerRow from '../components/LedgerRow.jsx';
import Banner from '../components/Banner.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import { buttonClass } from '../components/ui/Button.jsx';
import { Field, Input, Select } from '../components/ui/Field.jsx';
import { IconPlusCircle, IconSearch } from '../components/ui/icons.jsx';
import { staggerContainer, staggerItem } from '../utils/motion.js';
import {
  DEPARTMENTS,
  STATUS_ORDER,
  STATUS_LABELS,
  PRIORITY_ORDER,
  PRIORITY_LABELS,
} from '../utils/labels.js';

const HEADINGS = {
  reporter: { title: 'My issues', sub: 'Everything you have reported, most recent first.' },
  staff: { title: 'Department queue', sub: 'Issues routed to your department.' },
  admin: { title: 'All issues', sub: 'Every issue across the campus.' },
};

export default function IssueList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState({ items: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = {
    status: searchParams.get('status') || '',
    department: searchParams.get('department') || '',
    priority: searchParams.get('priority') || '',
    q: searchParams.get('q') || '',
    page: searchParams.get('page') || '1',
  };

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  const hasFilters = Boolean(filters.status || filters.department || filters.priority || filters.q);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.listIssues({
        status: filters.status,
        department: filters.department,
        priority: filters.priority,
        q: filters.q,
        page: filters.page,
        limit: 20,
      });
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  const heading = HEADINGS[user.role];
  const signature = `${filters.status}|${filters.department}|${filters.priority}|${filters.page}`;

  return (
    <div>
      <PageHead
        eyebrow="Queue"
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

      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="glass mb-5 rounded-[16px] p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="q">
            <Input
              id="q"
              type="search"
              icon={IconSearch}
              placeholder="Title, description, or ID"
              value={filters.q}
              onChange={(e) => setFilter('q', e.target.value)}
            />
          </Field>

          <Field label="Status" htmlFor="f-status">
            <Select id="f-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
              <option value="">Any status</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Department" htmlFor="f-dept">
            <Select
              id="f-dept"
              value={filters.department}
              onChange={(e) => setFilter('department', e.target.value)}
            >
              <option value="">Any department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority" htmlFor="f-priority">
            <Select
              id="f-priority"
              value={filters.priority}
              onChange={(e) => setFilter('priority', e.target.value)}
            >
              <option value="">Any priority</option>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-dim">
              {data.pagination.total} result{data.pagination.total === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setSearchParams(new URLSearchParams())}
              className="text-xs font-medium text-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </form>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {loading ? (
        <div className="flex flex-col gap-2.5" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-[14px]" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState title="No matching issues" action={hasFilters ? (
          <button type="button" onClick={() => setSearchParams(new URLSearchParams())} className={buttonClass({ variant: 'ghost' })}>
            Clear filters
          </button>
        ) : null}>
          Try adjusting the filters, or report a new issue.
        </EmptyState>
      ) : (
        <>
          <motion.div
            key={signature}
            variants={staggerContainer(0.04)}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2.5"
          >
            {data.items.map((issue) => (
              <motion.div key={issue._id} variants={staggerItem}>
                <LedgerRow issue={issue} showReporter={user.role !== 'reporter'} />
              </motion.div>
            ))}
          </motion.div>
          <Pagination
            page={data.pagination.page}
            pages={data.pagination.pages}
            total={data.pagination.total}
            onChange={(page) => setFilter('page', String(page))}
          />
        </>
      )}
    </div>
  );
}
