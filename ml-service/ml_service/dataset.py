"""Dataset loading, validation, de-duplication, and stratified splitting.

Uses the standard-library csv module (no pandas dependency) so the service runs
with a minimal, reliable dependency set.

The dataset is a CSV with these documented columns:

    id      stable row identifier (e.g. IT-0042)
    text    the issue text (title, description, or both)
    label   canonical department label, one of config.LABELS
    source  provenance marker; "synthetic" for authored examples, "reviewed"
            for examples later promoted from real, human-verified corrections
    notes   optional free text, e.g. why an example is ambiguous

Every row is surfaced as a dict so downstream code reads by name, not position.
"""

import csv
import hashlib
import re
from collections import Counter

from .config import (
    DATA_PATH,
    LABELS,
    MIN_EXAMPLES_PER_CLASS,
    MIN_TOTAL_EXAMPLES,
    NEAR_DUPLICATE_JACCARD,
    RANDOM_STATE,
    TEST_SIZE,
    VALIDATION_SIZE,
)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize_text(text):
    """Lowercase and keep only alphanumeric tokens, space-joined."""
    return " ".join(_TOKEN_RE.findall((text or "").lower()))


def _token_set(text):
    return set(_TOKEN_RE.findall((text or "").lower()))


def _jaccard(a, b):
    if not a or not b:
        return 0.0
    intersection = len(a & b)
    union = len(a | b)
    return intersection / union if union else 0.0


def load_dataset(path=DATA_PATH):
    """Load the labeled issue dataset as a list of row dicts.

    Raises FileNotFoundError / ValueError with explicit messages when the file
    is missing, malformed, or fails the guardrails in validate_dataset.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {path}. Expected a CSV with 'text' and 'label' columns."
        )

    rows = []
    with open(path, "r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames or []
        if "text" not in fields or "label" not in fields:
            raise ValueError("Dataset must have 'text' and 'label' columns.")

        for i, row in enumerate(reader, start=2):
            text = (row.get("text") or "").strip()
            label = (row.get("label") or "").strip()
            if not text or not label:
                raise ValueError(f"Row {i} is missing text or label.")
            if label not in LABELS:
                raise ValueError(f"Row {i} has unknown label '{label}'. Expected one of {LABELS}.")
            rows.append(
                {
                    "id": (row.get("id") or f"row-{i}").strip(),
                    "text": text,
                    "label": label,
                    "source": (row.get("source") or "").strip(),
                    "notes": (row.get("notes") or "").strip(),
                }
            )

    validate_dataset(rows)
    return rows


def validate_dataset(rows):
    """Enforce label validity and minimum size/balance guardrails.

    Returns the per-class counts. Raises ValueError on any violation.
    """
    if not rows:
        raise ValueError("Dataset is empty.")

    counts = Counter(row["label"] for row in rows)
    for label in LABELS:
        if counts[label] < MIN_EXAMPLES_PER_CLASS:
            raise ValueError(
                f"Class '{label}' has {counts[label]} examples; "
                f"at least {MIN_EXAMPLES_PER_CLASS} are required."
            )
    if len(rows) < MIN_TOTAL_EXAMPLES:
        raise ValueError(
            f"Dataset has {len(rows)} examples; at least {MIN_TOTAL_EXAMPLES} are required."
        )

    empty = [row["id"] for row in rows if not normalize_text(row["text"])]
    if empty:
        raise ValueError(f"Rows with no usable text tokens: {empty}")

    return dict(counts)


def deduplicate(rows, threshold=NEAR_DUPLICATE_JACCARD):
    """Collapse exact and near-duplicate examples.

    Keeps the first occurrence in file order. Two rows are duplicates when their
    normalized text is identical, or when their token sets overlap at or above
    `threshold` (Jaccard). Running this BEFORE the train/test split guarantees a
    near-duplicate can never appear in both splits.

    Returns (deduped_rows, removed_rows).
    """
    kept = []
    seen_normalized = set()
    kept_token_sets = []
    removed = []

    for row in rows:
        normalized = normalize_text(row["text"])
        if not normalized or normalized in seen_normalized:
            removed.append(row)
            continue

        tokens = _token_set(row["text"])
        duplicate_of = None
        for other_id, other_tokens in kept_token_sets:
            if _jaccard(tokens, other_tokens) >= threshold:
                duplicate_of = other_id
                break
        if duplicate_of is not None:
            removed.append(row)
            continue

        seen_normalized.add(normalized)
        kept_token_sets.append((row["id"], tokens))
        kept.append(row)

    return kept, removed


def class_distribution(rows):
    return dict(Counter(row["label"] for row in rows))


def dataset_fingerprint(path=DATA_PATH):
    """Short stable hash of the raw dataset file, used in the model version."""
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest()[:12]


def split_dataset(
    rows,
    validation_size=VALIDATION_SIZE,
    test_size=TEST_SIZE,
    random_state=RANDOM_STATE,
):
    """Stratified train/validation/test split.

    The test split is held out until model selection is complete. Stratification
    keeps the per-class proportions identical across splits.
    """
    from sklearn.model_selection import train_test_split

    if not rows:
        raise ValueError("Cannot split an empty dataset.")

    labels = [row["label"] for row in rows]
    train_val, test = train_test_split(
        rows, test_size=test_size, random_state=random_state, stratify=labels
    )

    # Validation is expresssed as a fraction of the remaining train_val pool.
    val_fraction = validation_size / (1.0 - test_size)
    train, validation = train_test_split(
        train_val,
        test_size=val_fraction,
        random_state=random_state,
        stratify=[row["label"] for row in train_val],
    )
    return train, validation, test


def to_xy(rows):
    """Split rows into parallel (texts, labels) lists for scikit-learn."""
    return [row["text"] for row in rows], [row["label"] for row in rows]
