"""Provider-agnostic LLM client.

Adapter over the OpenAI-compatible chat-completions API. Env vars (AI_GROQ_*)
in `app.core.config` select the provider/model; keys stay inside this service.

Reference: docs/v2/03_ai_and_ml_design.md §2.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from openai import OpenAI, APIStatusError, APITimeoutError, APIConnectionError

from app.core.config import settings

log = logging.getLogger("ai.llm")


class LLMError(RuntimeError):
    """Raised when the LLM call fails or returns unparseable output."""


_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.groq_api_key or None,
            base_url=settings.groq_base_url,
            timeout=settings.llm_timeout,
        )
    return _client


TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "autumn"


def synthesize_speech(text: str, *, voice: str | None = None) -> bytes:
    """Convert narration text to MP3 bytes via the Groq Orpheus TTS voice.

    Raises LLMError with an actionable message. NOTE: the Groq org must accept
    the model's terms in the console or every call fails with a terms error —
    callers must surface that distinctly (voiceover unavailable, not fatal).
    """
    clean = text.strip()
    if not clean:
        raise LLMError("Nothing to narrate")
    if len(clean) > 600:
        clean = clean[:600]
    t0 = time.monotonic()
    log.info("TTS request started model=%s chars=%d", TTS_MODEL, len(clean))
    try:
        audio = _get_client().audio.speech.create(
            model=TTS_MODEL,
            voice=voice or TTS_VOICE,
            input=clean,
            response_format="mp3",
        )
        data = audio.read()
    except Exception as exc:
        elapsed = time.monotonic() - t0
        msg = _safe_error_message(exc)
        # Surface the terms-gate distinctly so products can degrade gracefully
        raw = str(exc)
        if "model_terms_required" in raw or "terms acceptance" in raw:
            msg = (
                "Groq TTS terms not accepted — the org admin must accept them at "
                "https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english"
            )
        log.error("TTS request failed after %.1fs: %s", elapsed, msg)
        raise LLMError(msg) from exc
    elapsed = time.monotonic() - t0
    log.info("TTS audio received in %.1fs bytes=%d", elapsed, len(data))
    if not data:
        raise LLMError("TTS returned empty audio")
    return data


def _safe_error_message(exc: Exception) -> str:
    """Extract a diagnostic message without leaking secrets."""
    if isinstance(exc, APIStatusError):
        status = exc.status_code
        if status == 401:
            return "Groq authentication failed (invalid or missing API key)"
        if status == 403:
            return "Groq access denied (API key lacks permission)"
        if status == 429:
            return "Groq rate limit exceeded — retry later"
        if status == 400:
            return f"Groq rejected the request (bad parameters): {exc.message}"
        if status >= 500:
            return f"Groq server error ({status})"
        return f"Groq API error ({status}): {exc.message}"
    if isinstance(exc, APITimeoutError):
        return "Groq request timed out"
    if isinstance(exc, APIConnectionError):
        return "Could not connect to Groq API"
    # Generic fallback — never include the raw exception which may contain the key
    return f"LLM request failed: {type(exc).__name__}"


def generate_json(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """Ask the LLM for a single JSON object.

    Raises LLMError on transport/API failure or invalid JSON. Schema validation
    is the caller's responsibility (Pydantic in the service, Zod in the backend).
    """
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    active_model = model or settings.groq_model
    active_max_tokens = max_tokens or settings.llm_max_tokens
    t0 = time.monotonic()
    log.info("LLM request started model=%s provider=%s max_tokens=%d", active_model, settings.llm_provider, active_max_tokens)

    try:
        response = _get_client().chat.completions.create(
            model=active_model,
            messages=messages,
            temperature=temperature,
            max_tokens=active_max_tokens,
            response_format={"type": "json_object"},
        )
    except Exception as exc:
        elapsed = time.monotonic() - t0
        log.error("LLM request failed after %.1fs: %s", elapsed, _safe_error_message(exc))
        raise LLMError(_safe_error_message(exc)) from exc

    elapsed = time.monotonic() - t0
    log.info("LLM response received in %.1fs", elapsed)

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise LLMError("LLM returned an empty response")

    # Check for truncation
    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        log.warning("LLM response truncated (finish_reason=length); max_tokens=%d", active_max_tokens)
        raise LLMError(
            f"LLM response was truncated — the content exceeded the token limit "
            f"({active_max_tokens} tokens). Try a shorter request."
        )

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        log.error("LLM returned invalid JSON: %s | first 200 chars: %s", exc, content[:200])
        raise LLMError(f"LLM returned invalid JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise LLMError("LLM response was not a JSON object")

    log.info("JSON parsed successfully")
    return parsed
