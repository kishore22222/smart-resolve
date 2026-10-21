import { motion } from 'motion/react';
import { EASE } from '../../utils/motion.js';

// Lightweight SVG donut — no charting dependency. Each segment is a stroked
// arc whose dash pattern animates in on mount.
export default function Donut({
  segments = [],
  size = 184,
  thickness = 18,
  centerValue,
  centerLabel,
}) {
  const total = segments.reduce((sum, s) => sum + (s.value || 0), 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(150,170,230,0.08)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((seg) => {
              const fraction = (seg.value || 0) / total;
              const length = fraction * circumference;
              const dash = `${length} ${circumference - length}`;
              const el = (
                <motion.circle
                  key={seg.label}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: seg.value ? 1 : 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                />
              );
              offset += length;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <div className="font-mono text-3xl font-medium text-fg">{centerValue ?? total}</div>
          {centerLabel ? (
            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-dim">
              {centerLabel}
            </div>
          ) : null}
        </div>
      </div>

      <ul className="flex min-w-[140px] flex-1 flex-col gap-2.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: seg.color }}
              />
              {seg.label}
            </span>
            <span className="font-mono text-fg">{seg.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
