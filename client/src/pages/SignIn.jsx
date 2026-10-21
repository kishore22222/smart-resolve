import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import Banner from '../components/Banner.jsx';
import Button from '../components/ui/Button.jsx';
import { Field, Input, PasswordInput } from '../components/ui/Field.jsx';
import { IconMail } from '../components/ui/icons.jsx';
import { fadeUp } from '../utils/motion.js';

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard tagline="Report a campus issue and follow it to resolution.">
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <div className="mb-6">
          <h2 className="text-h2 text-fg">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted">Sign in to your SmartResolve account.</p>
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              icon={IconMail}
              autoComplete="email"
              placeholder="you@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>

          <Field label="Password" htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-sm text-muted">
          New here?{' '}
          <Link to="/register" className="font-medium">
            Create a reporter account
          </Link>
        </p>
      </motion.div>
    </AuthCard>
  );
}
