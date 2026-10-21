import { describe, it, expect } from 'vitest';
import { statusLabel, priorityLabel, formatRelative } from './labels.js';

describe('labels', () => {
  it('maps known statuses and falls back to the raw value', () => {
    expect(statusLabel('IN_PROGRESS')).toBe('In progress');
    expect(statusLabel('SOMETHING_ELSE')).toBe('SOMETHING_ELSE');
  });

  it('maps priorities and falls back', () => {
    expect(priorityLabel('critical')).toBe('Critical');
    expect(priorityLabel('unknown')).toBe('unknown');
  });

  it('formats relative ages in a readable way', () => {
    const justNow = new Date(Date.now() - 5 * 1000).toISOString();
    expect(formatRelative(justNow)).toBe('just now');
    const days = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    expect(formatRelative(days)).toBe('3 days ago');
    expect(formatRelative(null)).toBe('');
  });
});
