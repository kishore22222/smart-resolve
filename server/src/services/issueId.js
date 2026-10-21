import Counter from '../models/Counter.js';

// Produces human-readable identifiers like SR-2026-0042, one sequence per year.
export async function nextPublicId(date = new Date()) {
  const year = date.getFullYear();
  const seq = await Counter.next(`issue-${year}`);
  return `SR-${year}-${String(seq).padStart(4, '0')}`;
}
