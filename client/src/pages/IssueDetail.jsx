import { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatusStamp from '../components/StatusStamp.jsx';
import PriorityBadge from '../components/PriorityBadge.jsx';
import Banner from '../components/Banner.jsx';
import Panel, { PanelTitle } from '../components/ui/Panel.jsx';
import Button, { buttonClass } from '../components/ui/Button.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';
import Skeleton from '../components/ui/Skeleton.jsx';
import {
  IconBuilding,
  IconChevronLeft,
  IconClock,
  IconLayers,
  IconMapPin,
  IconSparkles,
  IconTrash,
  IconUser,
} from '../components/ui/icons.jsx';
import { statusLabel, formatDate, formatRelative, DEPARTMENTS } from '../utils/labels.js';
import { fadeUp, staggerContainer, staggerItem } from '../utils/motion.js';

const ACTION_TONE = {
  submitted: 'bg-blue',
  triaged: 'bg-amber',
  assigned: 'bg-blue',
  status_changed: 'bg-teal',
  commented: 'bg-violet',
  follow_up: 'bg-violet',
  duplicate: 'bg-magenta',
};

export default function IssueDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [issue, setIssue] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [statusDraft, setStatusDraft] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [assignDraft, setAssignDraft] = useState('');
  const [deptDraft, setDeptDraft] = useState('');
  const [followUp, setFollowUp] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getIssue(id);
      setIssue(data.issue);
      setPermissions(data.permissions);
      setStatusDraft(data.permissions.allowedTransitions[0] || '');
      setDeptDraft(data.issue.department || DEPARTMENTS[0]);
      try {
        const dupes = await api.getDuplicates(id);
        setDuplicates(dupes.candidates || []);
      } catch {
        setDuplicates([]);
      }
      // Only fetch assignable staff once the issue has a department; an unrouted
      // issue must be reviewed first.
      if (data.permissions.canAssign && data.issue.department) {
        const list = await api.listUsers({ department: data.issue.department, role: 'staff' });
        setStaff(list.items || []);
      } else {
        setStaff([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, successMessage) => {
    setBusy(true);
    try {
      await fn();
      await load();
      toast.success(successMessage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitFollowUp = async () => {
    await run(() => api.addFollowUp(issue._id, followUp.trim()), 'Follow-up added');
    setFollowUp('');
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.deleteIssue(issue._id);
      setConfirmDelete(false);
      toast.success(`Issue ${issue.publicId} deleted`);
      // Returning to the list remounts it (and the dashboard when navigated to),
      // so the deleted issue disappears immediately from those views.
      navigate('/issues');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-[280px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Banner tone="error">{error}</Banner>
        <Link className={buttonClass({ variant: 'ghost' })} to="/issues">
          Back to issues
        </Link>
      </div>
    );
  }
  if (!issue) return null;

  const justCreated = location.state?.justCreated;

  return (
    <div>
      <Link
        to="/issues"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted no-underline transition-colors hover:text-fg"
      >
        <IconChevronLeft size={16} /> Back to issues
      </Link>

      {justCreated ? (
        <Banner tone="success">
          {issue.department
            ? `Issue ${issue.publicId} submitted and routed to ${issue.department}.`
            : `Issue ${issue.publicId} submitted. It will be reviewed and routed to the right department.`}
        </Banner>
      ) : null}

      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 font-mono text-sm text-dim">{issue.publicId}</div>
            <h1 className="text-h1 text-fg">{issue.title}</h1>
          </div>
          <StatusStamp status={issue.status} flash={Boolean(justCreated)} />
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          <Fact
            icon={IconBuilding}
            label="Department"
            value={issue.department || 'Awaiting review'}
          />
          <Fact icon={IconLayers} label="Priority" value={<PriorityBadge priority={issue.priority} />} />
          <Fact icon={IconMapPin} label="Location" value={issue.location || '—'} />
          <Fact icon={IconUser} label="Reported by" value={issue.reporter?.name || '—'} />
          <Fact
            icon={IconUser}
            label="Assigned to"
            value={issue.assignedTo?.name || 'Unassigned'}
          />
          <Fact icon={IconClock} label="Reported" value={formatDate(issue.createdAt)} />
        </div>

        {issue.needsReview ? (
          <Banner tone="info">
            This issue was routed with low confidence and is flagged for human review.
          </Banner>
        ) : null}

        <Panel>
          <PanelTitle eyebrow="Report">Description</PanelTitle>
          <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-relaxed text-muted">
            {issue.description}
          </p>
        </Panel>

        {duplicates.length > 0 ? (
          <Panel className="mt-5">
            <PanelTitle icon={IconSparkles} eyebrow="Similarity">
              Possible duplicates
            </PanelTitle>
            <p className="mb-3 text-sm text-muted">
              These are similarity suggestions for staff review, not proof that the issues are the
              same.
            </p>
            <ul className="flex flex-col gap-2">
              {duplicates.map((cand) => (
                <li
                  key={cand.issue?._id || cand.issue}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-line-soft bg-white/[0.02] px-3 py-2.5"
                >
                  <Link to={`/issues/${cand.issue?._id || cand.issue}`} className="font-medium">
                    {cand.publicId || cand.issue?.publicId}
                  </Link>
                  <span className="text-xs text-dim">
                    similarity {Math.round((cand.score || 0) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {permissions && (permissions.canUpdateStatus || permissions.canAssign) ? (
          <Panel className="mt-5">
            <PanelTitle eyebrow="Staff">Actions</PanelTitle>

            {permissions.canUpdateStatus && permissions.allowedTransitions.length > 0 ? (
              <div className="mb-5 flex flex-wrap items-end gap-3">
                <Field label="Move to" htmlFor="status" className="min-w-[170px]">
                  <Select id="status" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                    {permissions.allowedTransitions.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Note (optional)" htmlFor="status-note" className="min-w-[220px] flex-1">
                  <Input
                    id="status-note"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </Field>
                <Button
                  disabled={busy || !statusDraft}
                  onClick={() =>
                    run(
                      () => api.updateStatus(issue._id, statusDraft, statusNote || undefined),
                      `Status updated to ${statusLabel(statusDraft)}`
                    )
                  }
                >
                  Update status
                </Button>
              </div>
            ) : null}

            {permissions.canAssign ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Assign to" htmlFor="assignee" className="min-w-[240px]">
                  <Select id="assignee" value={assignDraft} onChange={(e) => setAssignDraft(e.target.value)}>
                    <option value="">Select staff…</option>
                    {staff.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="ghost"
                  disabled={busy || !assignDraft}
                  onClick={() => run(() => api.assignIssue(issue._id, assignDraft), 'Issue assigned')}
                >
                  Assign
                </Button>
                {duplicates.length > 0 ? (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () =>
                          api.markDuplicate(
                            issue._id,
                            duplicates[0].issue?._id || duplicates[0].issue
                          ),
                        'Marked as a duplicate'
                      )
                    }
                  >
                    Mark as duplicate of {duplicates[0].publicId}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {user?.role === 'admin' ? (
          <Panel className="mt-5">
            <PanelTitle icon={IconSparkles} eyebrow="Classification">
              Department &amp; review
            </PanelTitle>
            <p className="mb-4 text-sm text-muted">
              {issue.ml?.available
                ? `The classifier suggested ${issue.ml.suggestedDepartment}${
                    typeof issue.ml.confidence === 'number'
                      ? ` with ${Math.round(issue.ml.confidence * 100)}% confidence`
                      : ''
                  }.`
                : 'The classifier was unavailable or could not produce a reliable prediction.'}{' '}
              {issue.needsReview
                ? 'This issue is flagged for manual review.'
                : 'You can still override the department if it was misclassified.'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Assign department" htmlFor="dept" className="min-w-[220px]">
                <Select id="dept" value={deptDraft} onChange={(e) => setDeptDraft(e.target.value)}>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={busy || !deptDraft || deptDraft === issue.department}
                onClick={() =>
                  run(() => api.updateDepartment(issue._id, deptDraft), 'Department updated')
                }
              >
                {issue.needsReview ? 'Confirm department' : 'Update department'}
              </Button>
            </div>
          </Panel>
        ) : null}

        <Panel className="mt-5">
          <PanelTitle eyebrow="Update">Add a follow-up</PanelTitle>
          <Field label="Note" htmlFor="followup">
            <Textarea
              id="followup"
              className="min-h-[90px]"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Share progress, blockers, or a resolution note."
            />
          </Field>
          <Button disabled={busy || followUp.trim().length < 2} onClick={submitFollowUp}>
            Add note
          </Button>
        </Panel>

        {user?.role === 'reporter' && permissions?.canDelete ? (
          <Panel className="mt-5">
            <PanelTitle icon={IconTrash} eyebrow="Danger zone">
              Delete this issue
            </PanelTitle>
            <p className="mb-4 text-sm text-muted">
              You can delete this issue while it is still awaiting triage. Once it is assigned or
              being worked on, it can no longer be removed here.
            </p>
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              <IconTrash size={16} /> Delete issue
            </Button>
          </Panel>
        ) : null}

        <Panel className="mt-5">
          <PanelTitle eyebrow="Audit">History</PanelTitle>
          <motion.ul
            key={issue.history.length}
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
            className="relative flex flex-col gap-4 border-l border-line-soft pl-5"
          >
            {issue.history.map((entry, index) => (
              <motion.li key={index} variants={staggerItem} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-canvas ${
                    ACTION_TONE[entry.action] ?? 'bg-muted'
                  }`}
                />
                <div className="text-sm font-semibold capitalize text-fg">
                  {String(entry.action).replace(/_/g, ' ')}
                  {entry.to ? (
                    <span className="text-muted"> → {statusLabel(entry.to)}</span>
                  ) : null}
                </div>
                <div className="mt-0.5 text-xs text-dim">
                  {entry.by?.name ? `${entry.by.name} · ` : ''}
                  <span>{formatDate(entry.at)}</span>{' '}
                  <span>({formatRelative(entry.at)})</span>
                </div>
                {entry.note ? (
                  <div className="mt-1.5 rounded-[10px] border border-line-soft bg-white/[0.02] px-3 py-2 text-sm text-muted">
                    {entry.note}
                  </div>
                ) : null}
              </motion.li>
            ))}
          </motion.ul>
        </Panel>

        <Dialog
          open={confirmDelete}
          onClose={() => {
            if (!busy) setConfirmDelete(false);
          }}
          title="Delete this issue?"
        >
          <p className="text-sm text-muted">You are about to delete the following issue:</p>
          <div className="my-3 rounded-[10px] border border-line-soft bg-white/[0.02] px-3.5 py-3">
            <div className="font-mono text-xs text-dim">{issue.publicId}</div>
            <div className="mt-1 font-semibold text-fg">{issue.title}</div>
          </div>
          <p className="mb-5 text-sm text-muted">
            This removes the issue from your dashboard and issue list — it will no longer appear in
            normal views. The deletion is recorded and can be recovered by an administrator.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={handleDelete}>
              {busy ? 'Deleting…' : 'Delete issue'}
            </Button>
          </div>
        </Dialog>
      </motion.div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div className="glass rounded-[14px] p-3.5">
      <div className="mb-2 flex items-center gap-2 text-dim">
        <Icon size={14} />
        <span className="text-[11px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <div className="text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}
