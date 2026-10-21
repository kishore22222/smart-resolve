import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { buttonClass } from '../components/ui/Button.jsx';
import { IconShield } from '../components/ui/icons.jsx';
import { fadeUp } from '../utils/motion.js';

export default function Forbidden() {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      className="mx-auto flex max-w-[520px] flex-col items-center px-4 py-20 text-center"
    >
      <span className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-line bg-white/[0.04] text-magenta">
        <IconShield size={30} />
      </span>
      <h1 className="text-h1 text-fg">
        You don’t have access <span className="gradient-text">to this area</span>
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted">
        Your role doesn’t include this section. If that seems wrong, contact an administrator.
      </p>
      <Link className={buttonClass({ className: 'mt-7' })} to="/">
        Back to your dashboard
      </Link>
    </motion.div>
  );
}
