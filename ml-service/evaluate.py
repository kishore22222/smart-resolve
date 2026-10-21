"""Re-evaluate the persisted classifier on the reproducible held-out test split.

Because the split is deterministic (fixed random state over the de-duplicated
dataset), this reproduces the exact test set used in training. Useful as a
sanity check that a saved artifact still scores as reported.

Usage:
    python evaluate.py
"""

from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from ml_service.config import LABELS
from ml_service.dataset import deduplicate, load_dataset, split_dataset
from ml_service.model import load_model


def main():
    rows = load_dataset()
    rows, _ = deduplicate(rows)
    _, _, test_rows = split_dataset(rows)

    texts = [row["text"] for row in test_rows]
    y_true = [row["label"] for row in test_rows]

    bundle = load_model()
    pipeline = bundle["pipeline"]
    y_pred = pipeline.predict(texts)

    print("Evaluation on held-out test split")
    print("=" * 40)
    print(f"Model version: {bundle.get('model_version')}")
    print(f"Selected candidate: {bundle.get('selected_candidate')}")
    print(f"Review threshold: {bundle.get('threshold')}")
    print(f"Test examples: {len(texts)}")
    print(f"Accuracy: {accuracy_score(y_true, y_pred):.4f}")
    print()
    print("Confusion matrix (rows = actual, cols = predicted)")
    print(confusion_matrix(y_true, y_pred, labels=LABELS))
    print()
    print(classification_report(y_true, y_pred, labels=LABELS, zero_division=0))


if __name__ == "__main__":
    main()
