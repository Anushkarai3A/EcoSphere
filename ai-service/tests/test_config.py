import pytest

from app.core.config import Settings, validate_production_secrets


def _settings(**overrides: object) -> Settings:
    # Ignore ai-service/.env so the test is independent of developer config.
    return Settings(_env_file=None, **overrides)


def test_development_keeps_default_service_token() -> None:
    validate_production_secrets(
        _settings(environment="development", service_token="dev-ai-token")
    )


def test_test_environment_keeps_default_service_token() -> None:
    validate_production_secrets(
        _settings(environment="test", service_token="dev-ai-token")
    )


def test_production_rejects_default_service_token() -> None:
    with pytest.raises(RuntimeError, match="AI_SERVICE_TOKEN"):
        validate_production_secrets(
            _settings(environment="production", service_token="dev-ai-token")
        )


@pytest.mark.parametrize("token", ["change-me", "change-me-service-token", "your-secret-here"])
def test_production_rejects_placeholder_service_tokens(token: str) -> None:
    with pytest.raises(RuntimeError, match="AI_SERVICE_TOKEN"):
        validate_production_secrets(
            _settings(environment="production", service_token=token)
        )


def test_production_accepts_unique_service_token() -> None:
    validate_production_secrets(
        _settings(
            environment="production",
            service_token="9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b",
        )
    )


def test_error_message_does_not_reveal_the_configured_token() -> None:
    token = "dev-ai-token-do-not-use"
    with pytest.raises(RuntimeError) as raised:
        validate_production_secrets(
            _settings(environment="production", service_token=token)
        )
    assert token not in str(raised.value)
