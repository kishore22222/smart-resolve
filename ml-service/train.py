"""Train and evaluate the SmartResolve issue classifier.

Usage:
    python train.py

Selects the best candidate model on a validation split, calibrates it, tunes the
review-confidence threshold on the same split, and reports the final numbers on
an untouched test split. Artifacts are written to ml-service/artifacts/.
"""

import argparse
import json

from ml_service.config import METRICS_PATH
from ml_service.model import train


def print_report(metrics):
    dataset = metrics["dataset"]
    splits = metrics["splits"]
    test = metrics["test"]

    print("SmartResolve AI - issue classifier")
    print("=" * 56)
    print(f"Model version: {metrics['model_version']}")
    print(
        f"Examples: {dataset['n_total']} (raw {dataset['n_total_raw']}, "
        f"duplicates removed {dataset['n_duplicates_removed']})"
    )
    print(f"Class distribution: {dataset['class_distribution']}")
    print(
        f"Splits: train {splits['n_train']}  "
        f"validation {splits['n_validation']}  test {splits['n_test']}"
    )
    print(f"Threshold (review if below): {metrics['threshold']}")
    print()

    print("Candidate selection (validation macro-F1):")
    for name, scores in metrics["selection"].items():
        marker = "  <- selected" if name == metrics["selected_candidate"] else ""
        print(
            f"  {name:<22} macro_f1={scores['val_macro_f1']:.4f} "
            f"weighted_f1={scores['val_weighted_f1']:.4f}{marker}"
        )
    print()

    print(f"Test results (held-out, n={test['n']})")
    print(f"  accuracy={test['accuracy']:.4f}  macro_f1={test['macro_f1']:.4f}  "
          f"weighted_f1={test['weighted_f1']:.4f}")
    print()
    print("Confusion matrix (rows = actual, cols = predicted)")
    labels = test["confusion_matrix_labels"]
    header = "            " + "".join(f"{lbl[:12]:>14}" for lbl in labels)
    print(header)
    for label, row in zip(labels, test["confusion_matrix"]):
        print(f"{label[:12]:>12}" + "".join(f"{value:>14}" for value in row))
    print()

    print("Per-class metrics (test):")
    for label in labels:
        m = test["classification_report"][label]
        print(
            f"  {label:<15} precision={m['precision']:.2f} "
            f"recall={m['recall']:.2f} f1={m['f1-score']:.2f}"
        )
    macro = test["classification_report"].get("macro avg", {})
    print(
        f"  {'macro avg':<15} precision={macro.get('precision', 0):.2f} "
        f"recall={macro.get('recall', 0):.2f} f1={macro.get('f1-score', 0):.2f}"
    )
    print()
    print(f"Metrics written to {METRICS_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Train the issue classifier.")
    parser.parse_args()

    metrics = train()
    print_report(metrics)
    print(
        json.dumps(
            {
                "model_version": metrics["model_version"],
                "selected_candidate": metrics["selected_candidate"],
                "accuracy": metrics["test"]["accuracy"],
                "macro_f1": metrics["test"]["macro_f1"],
            }
        )
    )


if __name__ == "__main__":
    main()
