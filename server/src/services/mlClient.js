import env from '../config/env.js';

// Server-to-server client for the Python ML service. Every call is bounded by a
// timeout and degrades to `{ available: false }` so the core workflow never
// depends on the ML service being up.

async function postJson(path, body, timeoutMs = env.mlTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.mlServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { available: false, error: `ml_status_${res.status}` };
    }
    return await res.json();
  } catch (err) {
    return {
      available: false,
      error: err.name === 'AbortError' ? 'ml_timeout' : 'ml_unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

// Returns the advisory department classification for a block of issue text.
export async function classify(text) {
  if (!text || !text.trim()) return { available: false, error: 'empty_input' };
  const data = await postJson('/classify', { text });
  if (data.available === false) return data;
  return {
    available: true,
    department: data.department,
    confidence: data.confidence,
    allScores: data.all_scores,
  };
}

// Returns cosine-similarity candidate matches for duplicate review.
export async function similarity({ text, candidates, threshold }) {
  if (!text || !text.trim()) return { available: false, error: 'empty_input' };
  const data = await postJson('/similarity', {
    text,
    candidates: candidates || [],
    threshold: typeof threshold === 'number' ? threshold : env.duplicateThreshold,
  });
  if (data.available === false) return data;
  return { available: true, matches: data.matches || [], threshold: data.threshold };
}
