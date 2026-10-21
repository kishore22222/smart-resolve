import { useReducedMotion } from 'motion/react';

// Shared motion vocabulary. Keeping variants here means the whole product moves
// with one rhythm instead of every component improvising its own timing.

export const EASE = [0.22, 1, 0.36, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE } },
};

export const staggerContainer = (stagger = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

// Route-level transition used by the app shell.
export const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease: EASE } },
};

// Returns motion props that collapse to a no-op when the user prefers reduced
// motion, so animation is a progressive enhancement rather than a barrier.
export function useReveal() {
  const reduce = useReducedMotion();
  if (reduce) {
    return { initial: false, animate: 'show', hidden: undefined, variants: undefined };
  }
  return null;
}

export function useMotionEnabled() {
  const reduce = useReducedMotion();
  return !reduce;
}
