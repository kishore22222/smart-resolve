"""Issue classification model: selection, calibration, tuning, inference, persistence.

The training workflow is deliberately split so the reported numbers are honest:

1.  Load, validate, and de-duplicate the dataset (dedup happens BEFORE splitting,
    so a near-duplicate can never straddle train and test).
2.  Stratified train / validation / test split.
3.  Fit each candidate on **train**, score on **validation** (macro-F1) and pick a
    winner. The test split is never touched during selection.
4.  Calibrate the winner's probabilities (`CalibratedClassifierCV`), then tune the
    review-confidence threshold on **validation**.
5.  Score the final calibrated model once on the untouched **test** split and
    write the metrics + a versioned artifact bundle.

The persisted artifact is a dict *bundle* rather than a bare pipeline so the
service can report the model version, the tuned threshold, and the label
mappings without re-deriving them at request time.
"""

import json
from datetime import datetime, timezone

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

from .config import (
    ARTIFACTS_DIR,
    DEFAULT_CONFIDENCE_THRESHOLD,
    LABELS,
    LABEL_TO_DEPARTMENT,
    METRICS_PATH,
    MODEL_PATH,
    MODEL_VERSION,
    RANDOM_STATE,
    TEST_SIZE,
    VALIDATION_SIZE,
)
from .dataset import (
    class_distribution,
    dataset_fingerprint,
    deduplicate,
    load_dataset,
    split_dataset,
)

# Threshold sweep used to choose when a prediction is confident enough to act on.
_THRESHOLD_CANDIDATES = [round(x / 100.0, 2) for x in range(40, 96, 5)]
# Never drop below this fraction of predictions when picking a threshold.
_COVERAGE_FLOOR = 0.5


def _word_tfidf():
    return TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=1,
    )


def _char_tfidf():
    return TfidfVectorizer(
        lowercase=True,
        analyzer="char_wb",
        ngram_range=(2, 5),
        sublinear_tf=True,
        min_df=1,
    )


def build_candidates():
    """Return an ordered {name: uncalibrated_pipeline} of models to consider.

    Every candidate shares the same `tfidf`/feature step and a classifier that
    exposes `predict`. Calibration is applied only to the winner afterwards.
    """
    return {
        "word-ngram-mnb": Pipeline(
            steps=[("tfidf", _word_tfidf()), ("clf", MultinomialNB(alpha=0.3))]
        ),
        "word-ngram-lr": Pipeline(
            steps=[
                ("tfidf", _word_tfidf()),
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        ),
        "word-ngram-svc": Pipeline(
            steps=[("tfidf", _word_tfidf()), ("clf", LinearSVC())]
        ),
        "char-wb-ngram-lr": Pipeline(
            steps=[
                ("tfidf", _char_tfidf()),
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        ),
        "word-char-union-lr": Pipeline(
            steps=[
                (
                    "tfidf",
                    FeatureUnion(
                        transformer_list=[
                            ("word", _word_tfidf()),
                            ("char", _char_tfidf()),
                        ]
                    ),
                ),
                ("clf", LogisticRegression(max_iter=1000)),
            ]
        ),
    }


def build_pipeline():
    """Baseline candidate (word TF-IDF + Multinomial Naive Bayes).

    Kept as a small, explicit entry point for callers that only want the
    default features rather than the full selection menu.
    """
    return build_candidates()["word-ngram-mnb"]


def _calibrate(base_pipeline):
    """Wrap a fitted base pipeline with probability calibration."""
    return CalibratedClassifierCV(estimator=base_pipeline, method="sigmoid", cv=3)


def _select_threshold(max_probs, y_true, y_pred):
    """Pick a confidence threshold from a validation-set accuracy/coverage sweep.

    Returns (threshold, tuning_details). Ties favour the lower threshold, which
    keeps more predictions routed automatically.
    """
    max_probs = np.asarray(max_probs)
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    sweep = []
    for threshold in sorted(set(_THRESHOLD_CANDIDATES + [DEFAULT_CONFIDENCE_THRESHOLD])):
        covered = max_probs >= threshold
        coverage = float(covered.mean()) if covered.size else 0.0
        if coverage == 0.0:
            acc = 0.0
        else:
            acc = float(accuracy_score(y_true[covered], y_pred[covered]))
        sweep.append(
            {
                "threshold": threshold,
                "coverage": round(coverage, 4),
                "accuracy_when_covered": round(acc, 4),
            }
        )

    eligible = [row for row in sweep if row["coverage"] >= _COVERAGE_FLOOR]
    if eligible:
        best = max(eligible, key=lambda row: (row["accuracy_when_covered"], -row["threshold"]))
        chosen = best["threshold"]
        fallback = False
    else:
        chosen = DEFAULT_CONFIDENCE_THRESHOLD
        fallback = True

    return chosen, {
        "candidates": _THRESHOLD_CANDIDATES,
        "coverage_floor": _COVERAGE_FLOOR,
        "sweep": sweep,
        "chosen": chosen,
        "fell_back_to_default": fallback,
    }


def _evaluate(estimator, rows, threshold):
    """Score a calibrated estimator on a held-out split."""
    texts, y_true = [row["text"] for row in rows], [row["label"] for row in rows]
    y_pred = estimator.predict(texts)
    probabilities = estimator.predict_proba(texts)

    labels_present = [label for label in LABELS if label in set(y_true)]
    report = classification_report(
        y_true, y_pred, labels=labels_present, output_dict=True, zero_division=0
    )

    misclassified = []
    for row, actual, predicted, proba in zip(rows, y_true, y_pred, probabilities):
        if actual != predicted:
            best = int(np.argmax(proba))
            misclassified.append(
                {
                    "id": row["id"],
                    "text": row["text"],
                    "actual": actual,
                    "predicted": predicted,
                    "confidence": round(float(proba[best]), 4),
                }
            )

    covered = np.max(probabilities, axis=1) >= threshold
    return {
        "n": len(rows),
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "weighted_f1": round(
            float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4
        ),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels_present).tolist(),
        "confusion_matrix_labels": labels_present,
        "classification_report": report,
        "misclassified": misclassified,
        "coverage_at_threshold": round(float(covered.mean()), 4) if covered.size else 0.0,
    }


def train(path=None):
    """Run the full training workflow and persist artifacts.

    Returns the metrics dict (also written to `METRICS_PATH`).
    """
    rows = load_dataset(path) if path else load_dataset()
    before = len(rows)
    rows, removed = deduplicate(rows)
    counts = class_distribution(rows)

    train_rows, val_rows, test_rows = split_dataset(rows)

    X_train, y_train = [r["text"] for r in train_rows], [r["label"] for r in train_rows]
    X_val, y_val = [r["text"] for r in val_rows], [r["label"] for r in val_rows]

    # --- Model selection on the validation split (test stays untouched) ---
    selection = {}
    best_name, best_score = None, (-1.0, -1.0)
    for name, pipeline in build_candidates().items():
        pipeline.fit(X_train, y_train)
        pred = pipeline.predict(X_val)
        macro = float(f1_score(y_val, pred, average="macro", zero_division=0))
        weighted = float(f1_score(y_val, pred, average="weighted", zero_division=0))
        selection[name] = {
            "val_macro_f1": round(macro, 4),
            "val_weighted_f1": round(weighted, 4),
        }
        # Tie-break: macro-F1, then weighted-F1, then prefer earlier candidates.
        score = (round(macro, 4), round(weighted, 4))
        if score > best_score:
            best_score, best_name = score, name

    # --- Calibration + threshold tuning on the validation split ---
    base = build_candidates()[best_name]
    base.fit(X_train, y_train)
    calibrated = _calibrate(base)
    calibrated.fit(X_train, y_train)

    val_probabilities = calibrated.predict_proba(X_val)
    val_pred = calibrated.predict(X_val)
    val_max = np.max(val_probabilities, axis=1)
    threshold, threshold_tuning = _select_threshold(val_max, y_val, val_pred)

    # --- Final, untouched test evaluation ---
    test_metrics = _evaluate(calibrated, test_rows, threshold)
    val_metrics = _evaluate(calibrated, val_rows, threshold)

    fingerprint = dataset_fingerprint(path) if path else dataset_fingerprint()
    model_version = f"{MODEL_VERSION}+{fingerprint}"
    trained_at = datetime.now(timezone.utc).isoformat()

    metrics = {
        "model_version": model_version,
        "model_family": MODEL_VERSION,
        "dataset_fingerprint": fingerprint,
        "trained_at": trained_at,
        "labels": LABELS,
        "label_to_department": LABEL_TO_DEPARTMENT,
        "threshold": threshold,
        "calibration": {"method": "sigmoid", "cv": 3},
        "random_state": RANDOM_STATE,
        "validation_size": VALIDATION_SIZE,
        "test_size": TEST_SIZE,
        "dataset": {
            "n_total_raw": before,
            "n_total": len(rows),
            "n_duplicates_removed": len(removed),
            "class_distribution": counts,
        },
        "splits": {
            "n_train": len(train_rows),
            "n_validation": len(val_rows),
            "n_test": len(test_rows),
        },
        "selection": selection,
        "selected_candidate": best_name,
        "threshold_tuning": threshold_tuning,
        "validation": val_metrics,
        "test": test_metrics,
    }

    bundle = {
        "pipeline": calibrated,
        "similarity_vectorizer": _word_tfidf().fit(X_train),
        "labels": LABELS,
        "label_to_department": LABEL_TO_DEPARTMENT,
        "department_values": [LABEL_TO_DEPARTMENT[label] for label in LABELS],
        "model_version": model_version,
        "threshold": threshold,
        "trained_at": trained_at,
        "selected_candidate": best_name,
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, MODEL_PATH)
    with open(METRICS_PATH, "w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)

    return metrics


def _as_bundle(obj):
    """Normalise a loaded artifact into the bundle shape.

    Older artifacts stored a bare Pipeline; wrap those so the service still
    starts, while new artifacts carry the full metadata bundle.
    """
    if isinstance(obj, dict) and "pipeline" in obj:
        return obj
    # Legacy bare-pipeline artifact.
    return {
        "pipeline": obj,
        "similarity_vectorizer": obj.named_steps.get("tfidf"),
        "labels": LABELS,
        "label_to_department": LABEL_TO_DEPARTMENT,
        "department_values": [LABEL_TO_DEPARTMENT[label] for label in LABELS],
        "model_version": "legacy",
        "threshold": DEFAULT_CONFIDENCE_THRESHOLD,
        "trained_at": None,
        "selected_candidate": "legacy",
    }


def load_model():
    """Load the persisted artifact bundle. Raises FileNotFoundError if missing."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model artifact not found at {MODEL_PATH}. Run `python train.py` first."
        )
    return _as_bundle(joblib.load(MODEL_PATH))


def classify(bundle, text):
    """Classify a block of text into a department.

    Returns both the canonical code and the human-readable department name that
    the Express API validates against, plus a calibrated confidence, the tuned
    threshold, and an explicit review recommendation.
    """
    if not text or not text.strip():
        raise ValueError("text must be a non-empty string.")

    pipeline = bundle["pipeline"]
    probabilities = pipeline.predict_proba([text])[0]
    classes = list(pipeline.classes_)
    best_index = int(probabilities.argmax())
    best_label = classes[best_index]
    confidence = round(float(probabilities[best_index]), 4)

    threshold = float(bundle.get("threshold", DEFAULT_CONFIDENCE_THRESHOLD))
    review_recommended = confidence < threshold

    return {
        # Department as the Express API expects it (display name).
        "department": bundle["label_to_department"][best_label],
        # Canonical machine code, useful for storage and the admin UI.
        "department_code": best_label,
        "confidence": confidence,
        # Scores are keyed by display name for API compatibility.
        "all_scores": {
            bundle["label_to_department"][cls]: round(float(prob), 4)
            for cls, prob in zip(classes, probabilities)
        },
        "threshold": round(threshold, 4),
        "review_recommended": review_recommended,
        "review_reason": "low_confidence" if review_recommended else None,
        "model_version": bundle.get("model_version"),
    }


def similarity(bundle, text, candidates, threshold):
    """Rank candidate issues by TF-IDF cosine similarity to `text`.

    Similarity is a suggestion signal, never proof of duplication.
    """
    if not text or not text.strip():
        raise ValueError("text must be a non-empty string.")
    if not candidates:
        return []

    vectorizer = bundle.get("similarity_vectorizer")
    if vectorizer is None:  # pragma: no cover - defensive
        raise ValueError("Model artifact has no similarity vectorizer.")

    # Drop candidates with empty text before vectorizing.
    clean = [
        (str(c.get("id")), str(c.get("text") or "").strip())
        for c in candidates
        if str(c.get("text") or "").strip()
    ]
    if not clean:
        return []

    corpus = [text] + [c_text for _, c_text in clean]
    matrix = vectorizer.transform(corpus)

    query = matrix[0]
    matches = []
    for idx, (cand_id, _) in enumerate(clean, start=1):
        candidate_vec = matrix[idx]
        # Both rows are L2-normalised by TfidfVectorizer, so cosine == dot product.
        score = float(query.multiply(candidate_vec).sum())
        if score >= threshold:
            matches.append({"id": cand_id, "score": round(score, 4)})

    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches
