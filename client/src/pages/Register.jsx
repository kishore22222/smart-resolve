import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import Banner from '../components/Banner.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, PasswordInput } from '../components/ui/Field.jsx';
import { IconMail, IconUser } from '../components/ui/icons.jsx';
import { fadeUp } from '../utils/motion.js';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard tagline="Create a reporter account to submit and track campus issues.">
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="mb-6">
          <h2 className="text-h2 text-fg">Create your account</h2>
          <p className="mt-1.5 text-sm text-muted">
            Reporter accounts can submit and follow issues. Staff and administrator accounts are
            provisioned by an administrator.
          </p>
        </div>

        {formError ? <Banner tone="error">{formError}</Banner> : null}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Full name" htmlFor="name" error={errors.name}>
            <Input
              id="name"
              icon={IconUser}
              invalid={Boolean(errors.name)}
              value={form.name}
              onChange={update('name')}
              autoComplete="name"
              placeholder="Jordan Lee"
            />
          </Field>

          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              type="email"
              icon={IconMail}
              invalid={Boolean(errors.email)}
              value={form.email}
              onChange={update('email')}
              autoComplete="email"
              placeholder="you@campus.edu"
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            hint="At least 8 characters."
          >
            <PasswordInput
              id="password"
              invalid={Boolean(errors.password)}
              value={form.password}
              onChange={update('password')}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
            {submitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium">
            Sign in
          </Link>
        </p>
      </motion.div>
    </AuthCard>
  );
}
