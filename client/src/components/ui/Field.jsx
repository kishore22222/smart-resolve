import { useState } from 'react';
import { cn } from '../../utils/cn.js';
import { IconEye, IconEyeOff } from './icons.jsx';

const CONTROL =
  'w-full rounded-[10px] border border-line bg-canvas-2/70 px-3.5 py-2.5 text-sm text-fg placeholder:text-dim outline-none transition-colors focus:border-blue/70 focus:bg-canvas-2 focus:ring-4 focus:ring-blue/10';

const INVALID = 'border-danger/60 focus:border-danger focus:ring-danger/10';

export function Field({ label, htmlFor, hint, error, className, children }) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-xs font-semibold tracking-wide text-muted">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, invalid = false, icon: Icon, ...props }) {
  if (Icon) {
    return (
      <span className="relative block">
        <Icon
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim"
        />
        <input
          className={cn(CONTROL, 'pl-9', invalid && INVALID, className)}
          {...props}
        />
      </span>
    );
  }
  return <input className={cn(CONTROL, invalid && INVALID, className)} {...props} />;
}

export function Select({ className, invalid = false, children, ...props }) {
  return (
    <select className={cn(CONTROL, 'cursor-pointer pr-9', invalid && INVALID, className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, invalid = false, ...props }) {
  return (
    <textarea
      className={cn(CONTROL, 'min-h-[140px] resize-y leading-relaxed', invalid && INVALID, className)}
      {...props}
    />
  );
}

// Password field with a show/hide affordance. The visible value is only ever
// the user's own input — no generated secrets are displayed.
export function PasswordInput({ className, invalid = false, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(CONTROL, 'pr-11', invalid && INVALID, className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-dim transition-colors hover:text-fg"
      >
        {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </button>
    </span>
  );
}
