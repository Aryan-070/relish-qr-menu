"""Local pytest config for the realtime app.

Enables ``asyncio_mode = auto`` for this package only so the async consumer
tests run without per-test ``@pytest.mark.asyncio`` decorators, without
touching the root ``pyproject.toml``.
"""
from __future__ import annotations


def pytest_configure(config) -> None:  # noqa: ANN001
    config.option.asyncio_mode = "auto"
