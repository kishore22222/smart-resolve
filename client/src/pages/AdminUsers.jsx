import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { api } from '../api/client.js';
import Banner from '../components/Banner.jsx';
import Spinner from '../components/Spinner.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Panel, { PanelTitle } from '../components/ui/Panel.jsx';
import Button from '../components/ui/Button.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import Avatar from '../components/ui/Avatar.jsx';
import Tag from '../components/ui/Tag.jsx';
import { Field, Input, PasswordInput, Select } from '../components/ui/Field.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { DEPARTMENTS, ROLE_LABELS } from '../utils/labels.js';
import { IconUserPlus, IconUsers } from '../components/ui/icons.jsx';
import { staggerContainer, staggerItem } from '../utils/motion.js';

const EMPTY = { name: '', email: '', password: '', role: 'staff', department: DEPARTMENTS[0] };

const ROLE_TONE = { admin: 'violet', staff: 'blue', reporter: 'teal' };

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers(roleFilter ? { role: roleFilter } : {});
      setUsers(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = () => {
    setOpen(false);
    setForm(EMPTY);
  };

  const createStaff = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.createStaff({
        ...form,
        department: form.role === 'staff' ? form.department : undefined,
      });
      toast.success(`${form.name} created`);
      closeDialog();
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user) => {
    try {
      await api.updateUser(user._id, { isActive: !user.isActive });
      toast.success(`${user.name} ${user.isActive ? 'deactivated' : 'reactivated'}`);
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow="Administration"
        title="People"
        subtitle="Manage accounts, roles, and department assignments."
        action={
          <Button onClick={() => setOpen(true)}>
            <IconUserPlus size={16} /> Add account
          </Button>
        }
      />

      {error ? <Banner tone="error">{error}</Banner> : null}

      <Panel>
        <PanelTitle
          icon={IconUsers}
          eyebrow="Directory"
          action={
            <Field label="Filter by role" htmlFor="role-filter" className="min-w-[190px]">
              <Select id="role-filter" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All roles</option>
                <option value="reporter">Reporter</option>
                <option value="staff">Department staff</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
          }
        >
          Accounts
        </PanelTitle>

        {loading ? (
          <Spinner label="Loading accounts" />
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No accounts match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-dim">
                  <th className="pb-3 pr-3 font-medium">Name</th>
                  <th className="pb-3 pr-3 font-medium">Role</th>
                  <th className="pb-3 pr-3 font-medium">Department</th>
                  <th className="pb-3 pr-3 font-medium">Status</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <motion.tbody
                key={roleFilter}
                variants={staggerContainer(0.03)}
                initial="hidden"
                animate="show"
              >
                {users.map((u) => (
                  <motion.tr
                    key={u._id}
                    variants={staggerItem}
                    className="border-t border-line-soft transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="py-3.5 pr-3 align-middle">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} role={u.role} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-fg">{u.name}</div>
                          <div className="truncate text-xs text-dim">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-3 align-middle">
                      <Tag tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</Tag>
                    </td>
                    <td className="py-3.5 pr-3 align-middle text-muted">{u.department || '—'}</td>
                    <td className="py-3.5 pr-3 align-middle">
                      <span
                        className={
                          u.isActive
                            ? 'inline-flex items-center gap-1.5 text-xs font-medium text-green'
                            : 'inline-flex items-center gap-1.5 text-xs font-medium text-dim'
                        }
                      >
                        <span
                          aria-hidden="true"
                          className={`h-1.5 w-1.5 rounded-full ${u.isActive ? 'bg-green' : 'bg-dim'}`}
                        />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right align-middle">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive(u)}>
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={open} onClose={closeDialog} title="Add a staff or admin account">
        <p className="mb-5 text-sm text-muted">
          Public sign-up can only create reporters. Use this form to provision privileged accounts.
        </p>
        <form onSubmit={createStaff} noValidate className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="s-name">
            <Input
              id="s-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Email" htmlFor="s-email">
            <Input
              id="s-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>
          <Field label="Temporary password" htmlFor="s-password" hint="They should change this after first sign-in.">
            <PasswordInput
              id="s-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role" htmlFor="s-role">
              <Select
                id="s-role"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="staff">Department staff</option>
                <option value="admin">Administrator</option>
              </Select>
            </Field>
            {form.role === 'staff' ? (
              <Field label="Department" htmlFor="s-dept">
                <Select
                  id="s-dept"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
