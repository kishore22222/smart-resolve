import pytest

from ml_service.model import load_model, train


@pytest.fixture(scope="session")
def trained_model():
    # Train once per session so tests exercise the real, reproducible pipeline.
    train()
    return load_model()
