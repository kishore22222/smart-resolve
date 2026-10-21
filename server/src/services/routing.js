import { DEPARTMENT_VALUES } from '../config/constants.js';
import env from '../config/env.js';

// The TF-IDF + Multinomial Naive Bayes classifier (reached through the ML
// service) is the sole authority for department routing. This module does not
// classify anything itself: it only normalizes and validates the classifier's
// prediction and decides whether that prediction is confident enough to act on.
//
// When the prediction is missing, unsupported, or below the configured
// confidence threshold, the issue is flagged for human (Admin) review instead of
// being silently routed to an arbitrary department. Priority scoring and
// duplicate detection are deliberately kept as separate, deterministic steps.

function normalizeMl(ml) {
  if (!ml || !ml.available) {
    return {
      suggestedDepartment: ml && ml.department ? ml.department : null,
      confidence: null,
      available: false,
    };
  }
  return {
    suggestedDepartment: ml.department || null,
    confidence: typeof ml.confidence === 'number' ? ml.confidence : null,
    available: true,
  };
}

/**
 * Decide the destination department for an issue from the classifier output.
 *
 * @param {{ ml?: { available?: boolean, department?: string, confidence?: number } | null }} input
 * @returns {{ department: string|null, method: string, reasons: string[], needsReview: boolean, ml: object }}
 */
export function routeIssue({ ml = null } = {}) {
  const threshold = env.mlConfidenceThreshold;
  const reasons = [];

  // Classifier unreachable or returned no usable result: never guess.
  if (!ml || !ml.available) {
    reasons.push('The classifier service returned no prediction; flagged for Admin review.');
    return { department: null, method: 'review', reasons, needsReview: true, ml: normalizeMl(ml) };
  }

  const predicted = ml.department;
  const confidence = typeof ml.confidence === 'number' ? ml.confidence : null;

  // Guard against anything outside the supported department vocabulary.
  if (!DEPARTMENT_VALUES.includes(predicted)) {
    reasons.push(
      `Classifier returned an unsupported department (${predicted ?? 'none'}); flagged for Admin review.`
    );
    return { department: null, method: 'review', reasons, needsReview: true, ml: normalizeMl(ml) };
  }

  // Act only on a confident prediction; otherwise defer to a human.
  if (confidence === null || confidence < threshold) {
    const shown = confidence === null ? 'unknown' : confidence.toFixed(2);
    reasons.push(
      `Classifier confidence ${shown} is below the ${threshold} threshold; flagged for Admin review.`
    );
    return { department: null, method: 'review', reasons, needsReview: true, ml: normalizeMl(ml) };
  }

  reasons.push(`Classified as "${predicted}" with confidence ${confidence.toFixed(2)}.`);
  return { department: predicted, method: 'ml', reasons, needsReview: false, ml: normalizeMl(ml) };
}
