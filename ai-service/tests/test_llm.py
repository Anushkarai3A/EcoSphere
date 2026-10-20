"""LLM gateway tests: provider selection, safe diagnostics and retries.

All provider calls are mocked. No real Groq key is required.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, APITimeoutError

import app.core.llm as llm
from app.core.config import settings


def _request() -> httpx.Request:
    return httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")


def _status_error(status: int, message: str = "provider failure") -> APIStatusError:
    request = _request()
    response = httpx.Response(status, request=request)
    return APIStatusError(message, response=response, body=None)


def _response(content: str, finish_reason: str = "stop") -> SimpleNamespace:
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=content),
                finish_reason=finish_reason,
            )
        ]
    )


class _FakeCompletions:
    def __init__(self, result):
        self.result = result
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        if callable(self.result):
            return self.result(**kwargs)
        return self.result


class _FakeClient:
    def __init__(self, result):
        self.chat = SimpleNamespace(completions=_FakeCompletions(result))


def _configure(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "test-groq-key-not-real")
    monkeypatch.setattr(settings, "groq_model", "test/primary-model")
    monkeypatch.setattr(settings, "groq_fallback_model", "test/fallback-model")
    monkeypatch.setattr(settings, "groq_base_url", "https://api.groq.com/openai/v1")
    monkeypatch.setattr(settings, "llm_timeout", 5)
    monkeypatch.setattr(llm, "time", SimpleNamespace(monotonic=llm.time.monotonic, sleep=lambda _: None))
    llm.reset_client()


def test_groq_provider_is_selected_from_configuration(monkeypatch) -> None:
    _configure(monkeypatch)

    config = llm._provider_config()

    assert config.provider == "groq"
    assert config.primary_model == "test/primary-model"
    assert config.fallback_model == "test/fallback-model"


def test_missing_groq_key_raises_configuration_error(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "groq_api_key", "")

    with pytest.raises(llm.LLMConfigurationError) as raised:
        llm._get_client()

    assert raised.value.status_code == 503
    assert raised.value.category == "configuration"
    assert "AI_GROQ_API_KEY" in str(raised.value)


def test_unsupported_provider_fails_explicitly(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "llm_provider", "openai")

    with pytest.raises(llm.LLMConfigurationError, match="AI_LLM_PROVIDER"):
        llm._provider_config()


def test_successful_groq_response_uses_configured_model(monkeypatch) -> None:
    _configure(monkeypatch)
    client = _FakeClient(_response(json.dumps({"questions": [], "detected_topic": "T"})))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    result = llm.generate_json("Generate a quiz")

    assert result == {"questions": [], "detected_topic": "T"}
    assert client.chat.completions.calls[0]["model"] == "test/primary-model"
    assert client.chat.completions.calls[0]["response_format"] == {"type": "json_object"}


def test_invalid_credentials_are_safe_and_actionable(monkeypatch, caplog) -> None:
    _configure(monkeypatch)
    client = _FakeClient(_status_error(401, "invalid key test-groq-key-not-real"))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 502
    assert raised.value.category == "authentication"
    assert "AI_GROQ_API_KEY" in str(raised.value)
    assert raised.value.__cause__ is not None
    assert "test-groq-key-not-real" not in caplog.text
    assert "test-groq-key-not-real" not in str(raised.value)
    assert len(client.chat.completions.calls) == 1


def test_rate_limit_is_retried_then_surfaces_429(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(llm, "_MAX_RETRIES", 2)
    client = _FakeClient(_status_error(429))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 429
    assert raised.value.category == "rate_limit"
    assert len(client.chat.completions.calls) == 2


def test_provider_timeout_returns_504(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(llm, "_MAX_RETRIES", 2)
    client = _FakeClient(APITimeoutError(request=_request()))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 504
    assert raised.value.category == "timeout"
    assert len(client.chat.completions.calls) == 2


def test_connection_failure_is_classified(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(llm, "_MAX_RETRIES", 1)
    client = _FakeClient(APIConnectionError(request=_request()))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 502
    assert raised.value.category == "network"


def test_unknown_model_fails_fast(monkeypatch) -> None:
    _configure(monkeypatch)
    client = _FakeClient(_status_error(404, "model not found"))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 502
    assert raised.value.category == "model_not_found"
    assert "test/primary-model" in str(raised.value)
    assert len(client.chat.completions.calls) == 1


def test_malformed_llm_json_is_safe(monkeypatch) -> None:
    _configure(monkeypatch)
    client = _FakeClient(_response("this is not json"))
    monkeypatch.setattr(llm, "_get_client", lambda: client)

    with pytest.raises(llm.LLMError) as raised:
        llm.generate_json("Generate a quiz")

    assert raised.value.status_code == 502
    assert raised.value.category == "response_parse"
    assert "malformed JSON" in str(raised.value)
    assert raised.value.__cause__ is not None
