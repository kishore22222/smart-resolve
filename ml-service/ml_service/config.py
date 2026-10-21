"""Paths, labels, and thresholds shared across the ML service.

Labels in the dataset are canonical, machine-friendly codes. The Express API
speaks the human-readable department names, so a single mapping (defined here)
translates between the two. Keeping the mapping in one place means the model,
the API, and the tests can never drift apart.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "issues_dataset.csv"
ARTIFACTS_DIR = BASE_DIR / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "issue_classifier.joblib"
METRICS_PATH = ARTIFACTS_DIR / "metrics.json"

# Canonical labels used by the dataset and the trained classifier. These are
# stable enum-style codes, not display strings.
LABELS = ["IT_SUPPORT", "FACILITIES", "ADMINISTRATION"]

# Canonical label -> department name spoken by the Express API. The values here
# MUST match server/src/config/constants.js DEPARTMENT_VALUES exactly.
LABEL_TO_DEPARTMENT = {
    "IT_SUPPORT": "IT Support",
    "FACILITIES": "Facilities",
    "ADMINISTRATION": "Administration",
}
DEPARTMENT_TO_LABEL = {name: code for code, name in LABEL_TO_DEPARTMENT.items()}
DEPARTMENT_VALUES = [LABEL_TO_DEPARTMENT[code] for code in LABELS]

# Reproducibility. A single random state drives the stratified splits so runs
# are deterministic.
RANDOM_STATE = 42
# Split fractions of the de-duplicated dataset. Model selection happens on
# `validation`; the `test` split is untouched until the final model is chosen.
VALIDATION_SIZE = 0.15
TEST_SIZE = 0.15

# Dataset guardrails enforced by ml_service.dataset.validate_dataset.
MIN_EXAMPLES_PER_CLASS = 30
MIN_TOTAL_EXAMPLES = 90

# Near-duplicate detection: two rows whose lowercased token sets overlap at or
# above this Jaccard ratio are treated as duplicates and collapsed. This runs
# BEFORE splitting so near-identical text can never straddle train/test.
NEAR_DUPLICATE_JACCARD = 0.9

# Fallback confidence threshold if a model does not persist its own tuned value.
DEFAULT_CONFIDENCE_THRESHOLD = 0.45
# Duplicate-detection default. Callers (the Express API) may override per request.
SIMILARITY_THRESHOLD = 0.6

# Human-readable model family version. Combined with a dataset fingerprint at
# training time to form the effective `model_version` stored with the artifact.
MODEL_VERSION = "2.0.0"
