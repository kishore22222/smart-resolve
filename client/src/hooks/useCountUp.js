import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

// Animated number for KPI tiles. Counts from 0 to `value` once on mount and on
// change. Respects prefers-reduced-motion by jumping straight to the value.
export function useCountUp(value, { duration = 900 } = {}) {
  const reduce = useReducedMotion();
  const target = Number(value) || 0;
  const [display, setDisplay] = useState(reduce ? target : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (reduce || import.meta.env.MODE === 'test') {
      setDisplay(target);
      return undefined;
    }
    const start = performance.now();
    const from = 0;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, reduce]);

  return display;
}
