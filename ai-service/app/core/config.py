from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

KNOWN_DEVELOPMENT_SERVICE_TOKENS = frozenset(
    {
        "dev-ai-token",
        "change-me",
        "changeme",
        "secret",
        "your-secret-here",
    }
)


def _is_insecure_service_token(token: str) -> bool:
    normalized = token.strip().lower()
    return (
        not normalized
        or normalized in KNOWN_DEVELOPMENT_SERVICE_TOKENS
        or normalized.startswith("change-me")
        or normalized.startswith("your-")
        or "do-not-use" in normalized
    )


def validate_production_secrets(settings: "Settings") -> None:
    """Fail production startup on the known development shared secret.

    Error text names the variable only; the configured value is never included.
    Development keeps using the convenience default.
    """
    if settings.environment != "production":
        return
    if _is_insecure_service_token(settings.service_token):
        raise RuntimeError(
            "Refusing to start in production with the default or a placeholder "
            "AI_SERVICE_TOKEN. Set a unique shared secret."
        )


class Settings(BaseSettings):
    """AI service configuration.

    Env vars are prefixed with AI_ (e.g. AI_MODEL_PATH, AI_CONFIDENCE_THRESHOLD,
    AI_LLM_PROVIDER). LLM keys live ONLY here — never in the backend.
    """

    model_config = SettingsConfigDict(env_file=".env", env_prefix="AI_", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    app_name: str = "ecosphere-ai"
    version: str = "0.1.0"
    model_path: str = "models/yolov8n.pt"
    confidence_threshold: float = 0.5
    max_assets_per_submission: int = 10
    allow_auto_approve: bool = True
    allow_auto_reject: bool = False

    # --- Internal gateway auth (backend -> ai-service shared secret) ---
    service_token: str = "dev-ai-token"

    # --- LLM generation (quiz / feedback / scripts) ---
    llm_provider: str = "groq"  # only "groq" is supported
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "openai/gpt-oss-120b"          # primary model (120b)
    groq_fallback_model: str = "openai/gpt-oss-20b"  # lighter fallback used on 3rd retry
    llm_max_tokens: int = 4096  # gpt-oss is a reasoning model: reasoning tokens count toward this budget
    llm_timeout: int = 120  # seconds; OpenAI client timeout for remote API

    # --- extraction / generation budgets ---
    max_extract_chars: int = 120_000  # cap text sent to the LLM per request
    max_quiz_questions: int = 50

    # --- Groq TPM limits ---
    groq_tpm_limit: int = 8000  # tokens-per-minute limit for the Groq model
    tpm_output_reserve: int = 1500  # reserve for LLM output tokens (quiz JSON is typically 500-1200 tokens)
    tpm_overhead_reserve: int = 600  # reserve for system + user prompt template tokens
    tpm_chars_per_token: float = 3.5  # conservative estimate: English text ~3.5 chars/token
    chunk_delay_seconds: float = 3.0  # delay between chunk LLM calls to avoid 429 rate limiting


settings = Settings()
validate_production_secrets(settings)
