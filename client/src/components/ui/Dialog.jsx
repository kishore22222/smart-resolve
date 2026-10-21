import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../utils/cn.js';
import { EASE } from '../../utils/motion.js';
import { IconClose } from './icons.jsx';

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])';

// Accessible modal: closes on Escape and backdrop click, traps focus inside the
// panel, moves focus in on open and back on close, and exposes dialog semantics.
export default function Dialog({ open, onClose, title, children, className }) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreRef.current = document.activeElement;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll(FOCUSABLE)).filter(
          (el) => !el.hasAttribute('disabled')
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    const target = panelRef.current?.querySelector(FOCUSABLE);
    target?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-canvas/70 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={cn(
              'panel relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[18px] p-6',
              className
            )}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-violet/20 blur-3xl"
            />
            <div className="relative mb-5 flex items-start justify-between gap-4">
              <h2 id="dialog-title" className="text-h3 text-fg">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-dim transition-colors hover:bg-white/[0.06] hover:text-fg"
              >
                <IconClose size={18} />
              </button>
            </div>
            <div className="relative">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
