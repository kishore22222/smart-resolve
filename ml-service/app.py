"""Flask HTTP service exposing classification and similarity endpoints.

Contract consumed by the Express API (server/src/services/mlClient.js):
    GET  /health -> { status, model_loaded, model_error, model_version }
    POST /classify    { text } -> { available, department, department_code,
                                    confidence, all_scores, threshold,
                                    review_recommended, review_reason,
                                    model_version }
    POST /similarity  { text, candidates: [{ id, text }], threshold }
                      -> { available, matches: [{ id, score }], threshold }

`department` is the human-readable name the Express API validates against
`DEPARTMENT_VALUES`; `department_code` is the canonical label used in the
dataset and the model. `review_recommended` is true when the calibrated
confidence falls below the tuned threshold, and is what triggers the
"flag for admin review" path upstream.

The service is intentionally separate from the Express API and contains no
authentication of its own; it is expected to be reachable only on the internal
network / loopback.
"""

import os

from flask import Flask, jsonify, request

from ml_service.config import SIMILARITY_THRESHOLD
from ml_service.model import classify, load_model, similarity

_MODEL = None
_MODEL_ERROR = None


def _get_model():
    global _MODEL, _MODEL_ERROR
    if _MODEL is None and _MODEL_ERROR is None:
        try:
            _MODEL = load_model()
        except Exception as exc:  # noqa: BLE001 - surfaced to the caller as 503
            _MODEL_ERROR = str(exc)
    return _MODEL


def create_app():
    app = Flask(__name__)

    @app.get("/health")
    def health():
        model = _get_model()
        return jsonify(
            {
                "status": "ok",
                "model_loaded": model is not None,
                "model_error": None if model is not None else _MODEL_ERROR,
                "model_version": None if model is None else model.get("model_version"),
            }
        )

    @app.post("/classify")
    def classify_route():
        model = _get_model()
        if model is None:
            return jsonify({"available": False, "error": "model_unavailable"}), 503

        body = request.get_json(silent=True) or {}
        text = body.get("text")
        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "text is required."}}), 400

        try:
            result = classify(model, text)
        except ValueError as exc:
            return jsonify({"error": {"code": "BAD_REQUEST", "message": str(exc)}}), 400

        return jsonify({"available": True, **result})

    @app.post("/similarity")
    def similarity_route():
        model = _get_model()
        if model is None:
            return jsonify({"available": False, "error": "model_unavailable"}), 503

        body = request.get_json(silent=True) or {}
        text = body.get("text")
        candidates = body.get("candidates")
        threshold = body.get("threshold", SIMILARITY_THRESHOLD)

        if not isinstance(text, str) or not text.strip():
            return jsonify({"error": {"code": "BAD_REQUEST", "message": "text is required."}}), 400
        if candidates is not None and not isinstance(candidates, list):
            return jsonify(
                {"error": {"code": "BAD_REQUEST", "message": "candidates must be a list."}}
            ), 400
        try:
            threshold = float(threshold)
        except (TypeError, ValueError):
            return jsonify(
                {"error": {"code": "BAD_REQUEST", "message": "threshold must be a number."}}
            ), 400

        matches = similarity(model, text, candidates or [], threshold)
        return jsonify({"available": True, "matches": matches, "threshold": threshold})

    @app.errorhandler(500)
    def handle_500(err):  # pragma: no cover - defensive
        return jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Internal error."}}), 500

    return app


app = create_app()


if __name__ == "__main__":
    # Port: explicit ML_PORT, else the platform-assigned PORT (Render, Railway,
    # Heroku all inject PORT), else the local default.
    port = int(os.environ.get("ML_PORT") or os.environ.get("PORT") or "8000")
    # Interface: loopback by default (safe for local development, matching the
    # README's "internal network only" guidance). Deployment platforms that
    # route traffic to this process must set ML_HOST=0.0.0.0.
    host = os.environ.get("ML_HOST", "127.0.0.1")
    # Load the model eagerly so startup logs surface a clear error early.
    if _get_model() is None:
        print(f"[warn] model not loaded: {_MODEL_ERROR}")
    app.run(host=host, port=port)
