import { PRIORITIES, PRIORITY_WEIGHT } from '../config/constants.js';

// Deterministic, explainable priority rules. No ML output is consulted here:
// priority must be reproducible and auditable for every issue.
const RULES = [
  {
    priority: PRIORITIES.CRITICAL,
    label: 'immediate safety or security hazard',
    keywords: [
      'fire', 'smoke', 'gas leak', 'gas smell', 'explosion', 'flood', 'flooding',
      'electrocution', 'exposed wire', 'exposed wiring', 'sparking', 'live wire',
      'collapse', 'structural', 'ceiling collapse', 'lockdown', 'weapon', 'assault',
      'emergency', 'hazard', 'chemical spill',
    ],
  },
  {
    priority: PRIORITIES.HIGH,
    label: 'service outage or unsafe-but-contained condition',
    keywords: [
      'outage', 'no power', 'power outage', 'no electricity', 'no water', 'water leak',
      'leak', 'elevator stuck', 'caught in elevator', 'trapped', 'broken', 'shattered',
      'not working', 'down', 'offline', 'security', 'theft', 'broken lock', 'no heat',
      'no heating', 'no air conditioning', 'sewage', 'overflowing',
    ],
  },
  {
    priority: PRIORITIES.LOW,
    label: 'cosmetic or non-blocking issue',
    keywords: [
      'cosmetic', 'aesthetic', 'minor', 'typo', 'paint chip', 'scuff', 'dirty',
      'dust', 'cleaning', 'landscaping', 'signage', 'poster', 'slow', 'suggestion',
    ],
  },
];

function matchKeyword(text, keyword) {
  // Word-boundary-aware match for single words; substring for phrases.
  if (keyword.includes(' ')) return text.includes(keyword);
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);
}

/**
 * Compute a priority from an issue's text.
 * @returns {{ priority: string, reasons: string[] }}
 */
export function computePriority({ title = '', description = '' }) {
  const text = `${title} ${description}`.toLowerCase();
  const reasons = [];

  // Highest-priority match wins.
  for (const rule of RULES) {
    const hits = rule.keywords.filter((kw) => matchKeyword(text, kw));
    if (hits.length) {
      reasons.push(`Matched ${rule.label}: ${hits.join(', ')}.`);
      return { priority: rule.priority, reasons };
    }
  }

  reasons.push('No critical, high, or low rule matched; defaulting to medium.');
  return { priority: PRIORITIES.MEDIUM, reasons };
}

export function priorityWeight(priority) {
  return PRIORITY_WEIGHT[priority] || PRIORITY_WEIGHT.medium;
}
