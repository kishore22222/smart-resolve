# Issue classification dataset

`issues_dataset.csv` is the labeled corpus used to train the SmartResolve AI
issue classifier. It trains a model that maps a free-text issue to one of three
departments:

| Canonical label | Department (API display name) |
| --- | --- |
| `IT_SUPPORT`    | IT Support |
| `FACILITIES`    | Facilities |
| `ADMINISTRATION`| Administration |

The canonical codes are the source of truth in the data and model. The
human-readable names are produced by `config.LABEL_TO_DEPARTMENT` and match the
Express API's `DEPARTMENT_VALUES` exactly.

## Columns

| Column | Required | Description |
| --- | --- | --- |
| `id` | yes | Stable row identifier, e.g. `IT-0042`, `FAC-011`, `AMB-003`. |
| `text` | yes | The issue text a reporter would type (title, description, or both). |
| `label` | yes | One of the canonical labels above. |
| `source` | yes | Provenance of the example (see below). |
| `notes` | no | Free text; used to flag intentionally ambiguous examples. |

## Provenance (`source`)

* `synthetic` — **all rows shipped in this repo are synthetic.** They were
  authored for this project and contain no real student, staff, or personal
  data. They exist to give the classifier enough varied language to learn from.
* `reviewed` — reserved for examples later promoted from real, human-verified
  corrections. No such examples exist yet.

Synthetic examples are marked as such so nobody mistakes this corpus for real,
field-collected ground truth. When real corrections are added later they must be
labeled `reviewed` and only after a human has verified the correct department.

## Authoring rules the corpus follows

* Every example reads like something a real reporter would submit: a natural
  sentence or two, not a keyword list.
* Phrasing is deliberately varied — formal and casual, short and detailed,
  occasional typos, site-specific nouns (buildings, rooms, systems).
* No trivial padding: there are no rows that are "the same sentence with one
  word swapped". Near-identical rows are removed automatically (see below).
* A small `AMB-*` group is intentionally cross-cutting (for example a *portal*
  failure in an *exam* context). These are documented in `notes` and labelled
  by the dominant fault, so the classifier learns that phrasing like
  "the page crashes" points at IT even when the surrounding topic is
  administrative.

## Guardrails enforced at load time

`ml_service.dataset.load_dataset()` fails fast if any of these are violated:

* at least **90** total examples;
* at least **30** examples per class;
* every label is one of the canonical labels;
* every row has usable text.

## Near-duplicate removal

`ml_service.dataset.deduplicate()` collapses exact and near-duplicates **before**
the train/validation/test split. Two rows are duplicates when their lowercased
token sets overlap at or above `config.NEAR_DUPLICATE_JACCARD` (0.9). This
guarantees a near-identical example can never appear in both training and test,
which would otherwise inflate the scores.

## How the data is used

`ml_service/train.py` loads, validates, de-duplicates, and splits the corpus
into stratified **train / validation / test** sets. Candidate models are compared
on the validation split, the winner is calibrated, its confidence threshold is
tuned on validation, and it is scored once on the untouched test split. See the
top-level `README.md` for the full pipeline.
