import { motion } from 'motion/react';
import { EASE } from '../../utils/motion.js';

const W = 640;
const H = 240;
const PAD = { top: 24, right: 20, bottom: 38, left: 34 };

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en', { month: 'short' });
}

// Two-series area/line chart for the six-month created vs resolved trend.
export default function TrendChart({ data = [] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.created, d.resolved]));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = Math.max(1, data.length - 1);

  const x = (i) => PAD.left + (i / n) * innerW;
  const y = (v) => PAD.top + (1 - v / max) * innerH;

  const line = (key) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const area =
    `${line('created')} L ${x(data.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`;

  const gridLines = [0, 0.5, 1].map((t) => PAD.top + t * innerH);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-5 text-xs text-muted">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue" /> Created
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-teal" /> Resolved
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Six-month issue trend">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#318bff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#318bff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridLines.map((gy, i) => (
          <line
            key={i}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={gy}
            y2={gy}
            stroke="rgba(150,170,230,0.10)"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
        ))}

        <motion.path
          d={area}
          fill="url(#trendFill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
        />

        <motion.path
          d={line('created')}
          fill="none"
          stroke="#318bff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        />
        <motion.path
          d={line('resolved')}
          fill="none"
          stroke="#14d9c5"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
        />

        {data.map((d, i) => (
          <g key={d.key}>
            <circle cx={x(i)} cy={y(d.created)} r="3" fill="#318bff" />
            <circle cx={x(i)} cy={y(d.resolved)} r="3" fill="#14d9c5" />
            <text
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              className="fill-[var(--color-dim)] font-mono"
              fontSize="12"
            >
              {monthLabel(d.key)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
