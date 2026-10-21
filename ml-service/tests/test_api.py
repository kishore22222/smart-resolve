"""HTTP contract tests for the Flask ML service."""

import pytest

from app import create_app


@pytest.fixture()
def client(trained_model):
    app = create_app()
    app.config.update(TESTING=True)
    with app.test_client() as test_client:
        yield test_client


def test_health_reports_model_loaded(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.get_json()["model_loaded"] is True


def test_classify_returns_contract_shape(client):
    res = client.post("/classify", json={"text": "Projector in lecture hall shows no signal"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["available"] is True
    assert body["department"] in {"IT Support", "Facilities", "Administration"}
    assert "all_scores" in body


def test_classify_rejects_empty_input(client):
    res = client.post("/classify", json={"text": ""})
    assert res.status_code == 400


def test_similarity_returns_candidate_matches(client):
    res = client.post(
        "/similarity",
        json={
            "text": "Water leak under the restroom sink",
            "candidates": [
                {"id": "1", "text": "Water is leaking under the sink in the restroom"},
                {"id": "2", "text": "Request for an official transcript"},
            ],
            "threshold": 0.2,
        },
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["available"] is True
    assert any(m["id"] == "1" for m in body["matches"])


def test_similarity_rejects_malformed_threshold(client):
    res = client.post("/similarity", json={"text": "hello world", "threshold": "not-a-number"})
    assert res.status_code == 400
