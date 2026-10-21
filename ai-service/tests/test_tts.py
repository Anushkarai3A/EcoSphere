"""Voiceover/TTS tests with mocked Groq speech responses.

No real provider credentials are used. Tests cover the Groq Orpheus contract:
WAV output, the 200-character request cap, chunk merging and safe failures.
"""

from __future__ import annotations

import io
import wave
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APITimeoutError, APIStatusError

import app.api.routes.tts as tts_route
import app.core.llm as llm
from app.core.config import settings
from app.main import app

client = TestClient(app)
AUTH = {"X-AI-Service-Token": "test-service-token"}


def _wav(seconds: float = 0.1, rate: int = 24_000, channels: int = 1) -> bytes:
    frames = int(rate * seconds)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(b"\x00\x00" * frames * channels)
    return buffer.getvalue()


def _request() -> httpx.Request:
    return httpx.Request("POST", "https://api.groq.com/openai/v1/audio/speech")


def _status_error(
    status: int,
    message: str = "provider failure",
    *,
    body: dict | None = None,
) -> APIStatusError:
    response = httpx.Response(status, request=_request())
    return APIStatusError(message, response=response, body=body)


class _Audio:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data


class _Speech:
    def __init__(self, result) -> None:
        self.result = result
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if isinstance(self.result, Exception):
            raise self.result
        if callable(self.result):
            return _Audio(self.result(**kwargs))
        return _Audio(self.result)


class _FakeTTSClient:
    def __init__(self, result) -> None:
        self.speech = _Speech(result)
        self.audio = SimpleNamespace(speech=self.speech)


def _configure(monkeypatch) -> None:
    monkeypatch.setattr(settings, "llm_provider", "groq")
    monkeypatch.setattr(settings, "tts_provider", "groq")
    monkeypatch.setattr(settings, "groq_api_key", "test-groq-key-not-real")
    monkeypatch.setattr(settings, "groq_base_url", "https://api.groq.com/openai/v1")
    monkeypatch.setattr(settings, "groq_model", "test/text-model")
    monkeypatch.setattr(settings, "groq_fallback_model", "test/fallback-model")
    monkeypatch.setattr(settings, "tts_model", "canopylabs/orpheus-v1-english")
    monkeypatch.setattr(settings, "tts_voice", "autumn")
    monkeypatch.setattr(settings, "tts_format", "wav")
    monkeypatch.setattr(settings, "llm_timeout", 5)
    llm.reset_client()


def test_tts_uses_independent_wav_model_and_voice(monkeypatch) -> None:
    _configure(monkeypatch)
    fake = _FakeTTSClient(_wav())
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    audio = llm.synthesize_speech("Water is precious. We can save it every day.")

    assert audio.startswith(b"RIFF")
    call = fake.speech.calls[0]
    assert call["model"] == "canopylabs/orpheus-v1-english"
    assert call["voice"] == "autumn"
    assert call["response_format"] == "wav"
    assert call["input"] == "Water is precious. We can save it every day."


def test_tts_does_not_require_the_text_model(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "groq_model", "")
    fake = _FakeTTSClient(_wav())
    monkeypatch.setattr(llm, "_client_for", lambda *args: fake)

    assert llm.synthesize_speech("Short narration.").startswith(b"RIFF")
    assert len(fake.speech.calls) == 1


def test_invalid_tts_model_fails_before_provider_call(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "tts_model", " ")
    fake = _FakeTTSClient(_wav())
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMConfigurationError, match="AI_TTS_MODEL"):
        llm.synthesize_speech("Narration.")

    assert fake.speech.calls == []


def test_unsupported_tts_format_fails_before_provider_call(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "tts_format", "mp3")
    fake = _FakeTTSClient(_wav())
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMConfigurationError, match="AI_TTS_FORMAT"):
        llm.synthesize_speech("Narration.")

    assert fake.speech.calls == []


def test_unsupported_tts_provider_fails_clearly(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "tts_provider", "openai")

    with pytest.raises(llm.LLMConfigurationError, match="AI_TTS_PROVIDER"):
        llm.synthesize_speech("Narration.")


def test_missing_tts_credentials_fail_clearly(monkeypatch) -> None:
    _configure(monkeypatch)
    monkeypatch.setattr(settings, "groq_api_key", "")

    with pytest.raises(llm.LLMConfigurationError, match="AI_GROQ_API_KEY"):
        llm.synthesize_speech("Narration.")


def test_empty_narration_is_rejected(monkeypatch) -> None:
    _configure(monkeypatch)
    fake = _FakeTTSClient(_wav())
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMError) as raised:
        llm.synthesize_speech("   ")

    assert raised.value.status_code == 400
    assert fake.speech.calls == []


def test_long_narration_is_chunked_within_provider_limit(monkeypatch) -> None:
    _configure(monkeypatch)
    fake = _FakeTTSClient(_wav(seconds=0.2))
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    text = " ".join(["Save water at home and at school."] * 14)
    audio = llm.synthesize_speech(text)

    assert len(fake.speech.calls) >= 3
    assert all(len(call["input"]) <= llm.TTS_MAX_INPUT_CHARS for call in fake.speech.calls)
    assert all(call["response_format"] == "wav" for call in fake.speech.calls)
    assert " ".join(call["input"] for call in fake.speech.calls) == text

    with wave.open(io.BytesIO(audio), "rb") as merged:
        assert merged.getnframes() == int(24_000 * 0.2) * len(fake.speech.calls)


@pytest.mark.parametrize(
    ("error", "status", "category"),
    [
        (_status_error(401, "bad key"), 502, "authentication"),
        (_status_error(429, "slow down"), 429, "rate_limit"),
        (APITimeoutError(request=_request()), 504, "timeout"),
    ],
)
def test_provider_failures_are_classified(monkeypatch, error, status, category) -> None:
    _configure(monkeypatch)
    fake = _FakeTTSClient(error)
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMError) as raised:
        llm.synthesize_speech("Narration.")

    assert raised.value.status_code == status
    assert raised.value.category == category
    assert "test-groq-key-not-real" not in str(raised.value)


def test_invalid_request_detail_is_safe_and_actionable(monkeypatch, caplog) -> None:
    _configure(monkeypatch)
    error = _status_error(
        400,
        "bad request",
        body={
            "message": "response_format must be one of [wav]",
            "type": "invalid_request_error",
            "code": "invalid_response_format",
        },
    )
    fake = _FakeTTSClient(error)
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMError) as raised:
        llm.synthesize_speech("Narration.")

    message = str(raised.value)
    assert raised.value.category == "invalid_request"
    assert "response_format must be one of [wav]" in message
    assert "AI_TTS_FORMAT" in message
    assert "test-groq-key-not-real" not in message
    assert "test-groq-key-not-real" not in caplog.text


@pytest.mark.parametrize("audio", [b"", b"not a wav file"])
def test_invalid_provider_audio_is_rejected(monkeypatch, audio) -> None:
    _configure(monkeypatch)
    fake = _FakeTTSClient(audio)
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    with pytest.raises(llm.LLMError) as raised:
        llm.synthesize_speech("Narration.")

    assert raised.value.status_code == 502
    assert raised.value.category == "response_parse"


def test_incompatible_chunk_formats_are_rejected(monkeypatch) -> None:
    _configure(monkeypatch)
    parts = iter([_wav(rate=24_000), _wav(rate=16_000), _wav(rate=16_000)])
    fake = _FakeTTSClient(lambda **_: next(parts))
    monkeypatch.setattr(llm, "_get_tts_client", lambda: fake)

    text = " ".join(["Save water at home and at school."] * 14)
    with pytest.raises(llm.LLMError, match="incompatible WAV formats"):
        llm.synthesize_speech(text)


def test_narration_route_returns_wav(monkeypatch) -> None:
    monkeypatch.setattr(tts_route, "synthesize_speech", lambda text, voice=None: _wav())
    response = client.post("/ai/v1/generate/narration-audio", json={"text": "Hello."}, headers=AUTH)

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    assert response.content.startswith(b"RIFF")


def test_narration_route_preserves_configuration_status(monkeypatch) -> None:
    def boom(text, voice=None):
        raise llm.LLMConfigurationError("TTS model is not configured. Set AI_TTS_MODEL for the AI service.")

    monkeypatch.setattr(tts_route, "synthesize_speech", boom)
    response = client.post("/ai/v1/generate/narration-audio", json={"text": "Hello."}, headers=AUTH)

    assert response.status_code == 503
    assert "AI_TTS_MODEL" in response.json()["detail"]
