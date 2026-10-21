import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client.js';
import Banner from '../components/Banner.jsx';
import PageHead from '../components/ui/PageHead.jsx';
import Panel, { PanelTitle } from '../components/ui/Panel.jsx';
import Button, { buttonClass } from '../components/ui/Button.jsx';
import { Field, Input, Textarea } from '../components/ui/Field.jsx';
import { IconSparkles } from '../components/ui/icons.jsx';
import { fadeUp } from '../utils/motion.js';

export default function NewIssue() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (form.title.trim().length < 5) next.title = 'Give the issue a clear title (5+ characters).';
    if (form.description.trim().length < 20)
      next.description = 'Describe the issue in at least 20 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { issue } = await api.createIssue({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
      });
      navigate(`/issues/${issue._id}`, { state: { justCreated: true } });
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHead
        eyebrow="New report"
        title="Report an issue"
        subtitle="Describe the problem. We route it to the right department and show you a status you can follow."
        action={
          <Link className={buttonClass({ variant: 'ghost' })} to="/issues">
            Cancel
          </Link>
        }
      />

      {formError ? <Banner tone="error">{formError}</Banner> : null}

      <motion.div variants={fadeUp} initial="hidden" animate="show" className="max-w-[760px]">
        <Panel as="form" onSubmit={onSubmit} noValidate>
          <PanelTitle icon={IconSparkles} eyebrow="Details">
            What happened?
          </PanelTitle>

          <div className="flex flex-col gap-5">
            <Field label="Title" htmlFor="title" error={errors.title}>
              <Input
                id="title"
                invalid={Boolean(errors.title)}
                value={form.title}
                onChange={update('title')}
                maxLength={120}
                placeholder="e.g. Projector in North Hall 204 will not power on"
              />
            </Field>

            <Field
              label="Description"
              htmlFor="description"
              error={errors.description}
              hint="Include what you saw, where, and when it started."
            >
              <Textarea
                id="description"
                invalid={Boolean(errors.description)}
                value={form.description}
                onChange={update('description')}
                maxLength={4000}
                placeholder="Describe the problem in enough detail for staff to act on it."
              />
            </Field>

            <Field label="Location (optional)" htmlFor="location">
              <Input
                id="location"
                value={form.location}
                onChange={update('location')}
                maxLength={120}
                placeholder="e.g. North Library, 2nd floor"
              />
            </Field>

            <div className="flex items-start gap-3 rounded-[12px] border border-blue/25 bg-blue/[0.07] px-4 py-3 text-xs text-muted">
              <IconSparkles size={16} className="mt-0.5 flex-none text-blue" />
              <p>
                The department is determined automatically: our classifier reads your description
                and routes the issue to the right team. Priority is set the same way. If the
                classifier is not confident, an administrator reviews and assigns the department
                manually. You will see the result on the next screen.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Link className={buttonClass({ variant: 'ghost' })} to="/issues">
                Cancel
              </Link>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit issue'}
              </Button>
            </div>
          </div>
        </Panel>
      </motion.div>
    </div>
  );
}
