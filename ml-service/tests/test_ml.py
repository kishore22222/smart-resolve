from collections import Counter

import pytest

from ml_service.config import LABELS
from ml_service.dataset import load_dataset
from ml_service.model import build_pipeline, classify, similarity


def test_dataset_meets_requirements():
    rows = load_dataset()
    assert len(rows) >= 90
    counts = Counter(label for _, label in rows)
    for label in LABELS:
        assert counts[label] >= 30, f"{label} has only {counts[label]} examples"


def test_training_metrics_are_produced(trained_model):
    from ml_service.config import METRICS_PATH
    import json

    metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    assert 0.0 <= metrics["accuracy"] <= 1.0
    assert len(metrics["confusion_matrix"]) == len(metrics["confusion_matrix_labels"])
    # Per-class metrics exist for every class in the split.
    for label in metrics["confusion_matrix_labels"]:
        assert label in metrics["classification_report"]


def test_classification_returns_a_valid_label(trained_model):
    result = classify(trained_model, "The Wi-Fi keeps disconnecting in the library")
    assert result["department"] in LABELS
    assert 0.0 <= result["confidence"] <= 1.0
    assert set(result["all_scores"]).issubset(set(LABELS))


def test_classification_routes_facilities_text(trained_model):
    result = classify(trained_model, "Water is leaking from the broken pipe under the sink")
    assert result["department"] == "Facilities"


def test_classification_rejects_empty_text(trained_model):
    with pytest.raises(ValueError):
        classify(trained_model, "   ")


def test_similarity_ranks_near_duplicates_above_unrelated(trained_model):
    text = "The elevator in the science building is stuck between floors"
    candidates = [
        {"id": "dup", "text": "The elevator in the science building is stuck"},
        {"id": "other", "text": "I cannot register for classes due to a tuition hold"},
    ]
    matches = similarity(trained_model, text, candidates, threshold=0.3)
    ids = [m["id"] for m in matches]
    assert "dup" in ids
    dup_score = next(m["score"] for m in matches if m["id"] == "dup")
    # A near-duplicate must outscore the unrelated candidate.
    other = next((m["score"] for m in matches if m["id"] == "other"), 0.0)
    assert dup_score > other


def test_similarity_threshold_filters_results(trained_model):
    matches = similarity(
        trained_model,
        "The printer in the lab is broken",
        [{"id": "x", "text": "Completely unrelated cafeteria meal plan question"}],
        threshold=0.99,
    )
    assert matches == []


def test_similarity_handles_empty_candidates_and_text(trained_model):
    assert similarity(trained_model, "Something", [], 0.5) == []
    with pytest.raises(ValueError):
        similarity(trained_model, "", [{"id": "a", "text": "x"}], 0.5)
