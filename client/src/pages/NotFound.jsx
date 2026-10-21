import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { buttonClass } from '../components/ui/Button.jsx';
import { IconSearch } from '../components/ui/icons.jsx';
import { fadeUp } from '../utils/motion.js';

export default function NotFound() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-[520px] flex-col items-center px-4 py-20 text-center"
    >
      <span className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/[0.04] text-blue">
        <IconSearch size={30} />
      </span>
      <div className="mb-2 font-mono text-5xl font-medium gradient-text">404</div>
      <h1 className="text-h1 text-fg">Page not found</h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        The page you were looking for doesn’t exist or has moved.
      </p>
      <Link className={buttonClass({ className: 'mt-7' })} to="/">
        Go to the dashboard
      </Link>
    </motion.div>
  );
}
