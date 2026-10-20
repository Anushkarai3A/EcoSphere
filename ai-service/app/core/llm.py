"""Provider-agnostic LLM client.

Adapter over the OpenAI-compatible chat-completions API. Env vars (AI_GROQ_*)
in `app.core.config` select the provider/model; keys stay inside this service.

Reference: docs/v2/03_ai_and_ml_design.md §2.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
    OpenAIError,
)

from app.core.config import settings

# Retry / backoff constants
_MAX_RETRIES = 3          # total attempts (1 primary + 2 retries, 3rd switches model)
_BACKOFF_BASE = 2.0       # seconds; doubles each retry (2 → 4 → 8)
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
_SUPPORTED_PROVIDERS = frozenset({"groq"})

log = logging.getLogger("ai.llm")


class LLMError(RuntimeError):
    """Raised when the LLM call fails or returns unparseable output."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        category: str = "provider_error",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.category = category


class LLMConfigurationError(LLMError):
    """Raised when provider configuration is missing or unsupported."""

    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=503, category="configuration")


@dataclass(frozen=True)
class ProviderConfig:
    provider: str
    api_key: str
    base_url: str
    primary_model: str
    fallback_model: str


_client: OpenAI | None = None
_client_signature: tuple[str, str, str, int] | None = None


def _provider_config() -> ProviderConfig:
    """Resolve and validate the configured provider without exposing its key."""
    provider = (settings.llm_provider or "").strip().lower()
    if provider not in _SUPPORTED_PROVIDERS:
        configured = provider or "<empty>"
        raise LLMConfigurationError(
            f"Unsupported AI_LLM_PROVIDER {configured!r}. "
            "The supported provider is 'groq'."
        )
    if not settings.groq_api_key.strip():
        raise LLMConfigurationError(
            "Groq API key is not configured. Set AI_GROQ_API_KEY for the AI service."
        )
    if not settings.groq_model.strip():
        raise LLMConfigurationError(
            "Groq model is not configured. Set AI_GROQ_MODEL for the AI service."
        )
    return ProviderConfig(
        provider=provider,
        api_key=settings.groq_api_key.strip(),
        base_url=settings.groq_base_url,
        primary_model=settings.groq_model.strip(),
        fallback_model=settings.groq_fallback_model.strip(),
    )


def _get_client() -> OpenAI:
    global _client, _client_signature
    config = _provider_config()
    signature = (config.provider, config.api_key, config.base_url, settings.llm_timeout)
    if _client is None or _client_signature != signature:
        _client = OpenAI(
            api_key=config.api_key,
            base_url=config.base_url,
            timeout=settings.llm_timeout,
        )
        _client_signature = signature
    return _client


def reset_client() -> None:
    """Drop the cached client (used by tests after changing settings)."""
    global _client, _client_signature
    _client = None
    _client_signature = None


TTS_MODEL = "canopylabs/orpheus-v1-english"
TTS_VOICE = "autumn"


def _classify_exception(exc: Exception, model: str) -> LLMError:
    """Map provider/SDK failures to a safe category, status and message."""
    if isinstance(exc, LLMError):
        return exc

    if isinstance(exc, APIStatusError):
        status = exc.status_code
        if status == 401:
            return LLMError(
                "Groq authentication failed. Verify AI_GROQ_API_KEY.",
                status_code=502,
                category="authentication",
            )
        if status == 403:
            return LLMError(
                "Groq access denied. The API key lacks permission for this operation.",
                status_code=502,
                category="authorization",
            )
        if status == 404:
            return LLMError(
                f"Configured Groq model {model!r} was not found or is unavailable.",
                status_code=502,
                category="model_not_found",
            )
        if status == 429:
            return LLMError(
                "Groq rate limit exceeded. Wait for the limit to reset and try again.",
                status_code=429,
                category="rate_limit",
            )
        if status == 408:
            return LLMError(
                "Groq request timed out.",
                status_code=504,
                category="timeout",
            )
        if status in (400, 422):
            return LLMError(
                "Groq rejected the request parameters. Check AI_GROQ_MODEL and the generation settings.",
                status_code=502,
                category="invalid_request",
            )
        if status == 413:
            return LLMError(
                "The study material is too large for the configured Groq model.",
                status_code=502,
                category="request_too_large",
            )
        if status >= 500:
            return LLMError(
                f"Groq server error ({status}). Try again shortly.",
                status_code=502,
                category="provider_error",
            )
        return LLMError(
            f"Groq API error ({status}).",
            status_code=502,
            category="provider_error",
        )

    if isinstance(exc, APITimeoutError):
        return LLMError(
            "Groq request timed out. Try again or use a smaller document.",
            status_code=504,
            category="timeout",
        )

    if isinstance(exc, APIConnectionError):
        return LLMError(
            "Could not connect to the Groq API. Check network access and try again.",
            status_code=502,
            category="network",
        )

    raw = str(exc).lower()
    if isinstance(exc, OpenAIError) and "api_key" in raw:
        return LLMConfigurationError(
            "Groq API key is not configured. Set AI_GROQ_API_KEY for the AI service."
        )

    return LLMError(
        "LLM request failed due to an unexpected provider error.",
        status_code=502,
        category="provider_error",
    )


def _log_failure(
    operation: str,
    exc: Exception,
    *,
    model: str,
    attempt: int | None = None,
) -> None:
    """Log diagnostic fields only; never log credentials or request headers."""
    classified = _classify_exception(exc, model)
    log.error(
        "LLM request failed operation=%s provider=%s model=%s attempt=%s "
        "category=%s status=%s error_type=%s message=%s",
        operation,
        settings.llm_provider,
        model,
        attempt or "-",
        classified.category,
        classified.status_code,
        type(exc).__name__,
        classified,
    )


def synthesize_speech(text: str, *, voice: str | None = None) -> bytes:
    """Convert narration text to MP3 bytes via the Groq Orpheus TTS voice.

    Raises LLMError with an actionable message. NOTE: the Groq org must accept
    the model's terms in the console or every call fails with a terms error —
    callers must surface that distinctly (voiceover unavailable, not fatal).
    """
    clean = text.strip()
    if not clean:
        raise LLMError("Nothing to narrate", status_code=400, category="invalid_request")
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
        classified = _classify_exception(exc, TTS_MODEL)
        message = str(classified)
        status_code = classified.status_code
        category = classified.category
        # Surface the terms-gate distinctly so products can degrade gracefully
        raw = str(exc)
        if "model_terms_required" in raw or "terms acceptance" in raw:
            message = (
                "Groq TTS terms not accepted — the org admin must accept them at "
                "https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english"
            )
            category = "terms_not_accepted"
        log.error(
            "TTS request failed after %.1fs operation=%s provider=%s model=%s "
            "category=%s status=%s error_type=%s message=%s",
            elapsed,
            "audio.speech.create",
            settings.llm_provider,
            TTS_MODEL,
            category,
            status_code,
            type(exc).__name__,
            message,
        )
        raise LLMError(message, status_code=status_code, category=category) from exc
    elapsed = time.monotonic() - t0
    log.info("TTS audio received in %.1fs bytes=%d", elapsed, len(data))
    if not data:
        raise LLMError(
            "TTS returned empty audio",
            status_code=502,
            category="response_parse",
        )
    return data


def _call_with_retry(
    messages: list[dict[str, str]],
    *,
    model: str,
    temperature: float,
    max_tokens: int,
) -> Any:  # returns raw openai Response
    """Call the LLM with exponential backoff and an explicit fallback model.

    Retry schedule:
      Attempt 1 → primary model
      Attempt 2 → primary model, wait 2 s
      Attempt 3 → configured fallback model, wait 4 s

    Raises LLMError with a safe, actionable message after all retries are
    exhausted. Original provider exceptions are preserved as ``__cause__``.
    """
    config = _provider_config()
    primary_model = model or config.primary_model
    fallback_model = config.fallback_model
    if fallback_model == primary_model:
        fallback_model = ""

    last_exc: Exception | None = None
    last_error: LLMError | None = None

    for attempt in range(1, _MAX_RETRIES + 1):
        use_fallback = bool(fallback_model) and attempt == _MAX_RETRIES
        active_model = fallback_model if use_fallback else primary_model
        if use_fallback:
            log.warning(
                "Retry %d/%d: switching to fallback model %s",
                attempt, _MAX_RETRIES, active_model,
            )
        log.info(
            "LLM attempt %d/%d provider=%s model=%s operation=chat.completions.create",
            attempt, _MAX_RETRIES, config.provider, active_model,
        )

        try:
            response = _get_client().chat.completions.create(
                model=active_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            return response
        except (APITimeoutError, APIConnectionError) as exc:
            last_exc = exc
            last_error = _classify_exception(exc, active_model)
            _log_failure("chat.completions.create", exc, model=active_model, attempt=attempt)
        except APIStatusError as exc:
            last_exc = exc
            last_error = _classify_exception(exc, active_model)
            _log_failure("chat.completions.create", exc, model=active_model, attempt=attempt)
            if exc.status_code not in _RETRYABLE_STATUSES:
                raise last_error from exc
        except Exception as exc:
            _log_failure("chat.completions.create", exc, model=active_model, attempt=attempt)
            raise _classify_exception(exc, active_model) from exc

        if attempt < _MAX_RETRIES:
            time.sleep(_BACKOFF_BASE ** (attempt - 1))

    if last_error is None:
        last_error = LLMError(
            "The AI service is currently unavailable. Please try again shortly."
        )
    final_message = f"{last_error} (after {_MAX_RETRIES} attempts)"
    raise LLMError(
        final_message,
        status_code=last_error.status_code,
        category=last_error.category,
    ) from last_exc


def generate_json(
    prompt: str,
    *,
    system: str | None = None,
    model: str | None = None,
    temperature: float = 0.4,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """Ask the configured LLM for a single JSON object.

    Uses AI_GROQ_MODEL with up to 3 attempts and exponential backoff, switching
    to AI_GROQ_FALLBACK_MODEL on the final attempt when configured. Raises
    LLMError with a safe, actionable message on failure.

    Schema validation is the caller's responsibility (Pydantic in the service,
    Zod in the backend).
    """
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    active_model = model or settings.groq_model
    active_max_tokens = max_tokens or settings.llm_max_tokens
    t0 = time.monotonic()
    log.info(
        "LLM request started provider=%s model=%s operation=chat.completions.create max_tokens=%d",
        settings.llm_provider, active_model, active_max_tokens,
    )

    response = _call_with_retry(
        messages,
        model=active_model,
        temperature=temperature,
        max_tokens=active_max_tokens,
    )

    elapsed = time.monotonic() - t0
    log.info("LLM response received in %.1fs model=%s", elapsed, active_model)

    content = response.choices[0].message.content if response.choices else None
    if not content:
        raise LLMError(
            "AI provider returned an empty response.",
            status_code=502,
            category="response_parse",
        )

    finish_reason = response.choices[0].finish_reason if response.choices else None
    if finish_reason == "length":
        log.warning("LLM response truncated (finish_reason=length); max_tokens=%d", active_max_tokens)
        raise LLMError(
            f"AI provider response was truncated at the token limit "
            f"({active_max_tokens} tokens). Try a shorter request.",
            status_code=502,
            category="response_parse",
        )

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        log.error(
            "LLM returned invalid JSON operation=chat.completions.create provider=%s "
            "model=%s category=response_parse content_length=%d",
            settings.llm_provider, active_model, len(content),
        )
        raise LLMError(
            "AI provider returned malformed JSON.",
            status_code=502,
            category="response_parse",
        ) from exc

    if not isinstance(parsed, dict):
        raise LLMError(
            "AI provider response was not a JSON object.",
            status_code=502,
            category="response_parse",
        )

    log.info("JSON parsed successfully model=%s", active_model)
    return parsed
