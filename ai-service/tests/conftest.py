"""Test-only configuration.

Pytest imports this before any test module, so these values are set before
``app.core.config.Settings`` is instantiated. Environment variables take
precedence over ``ai-service/.env`` in pydantic-settings, which keeps the suite
independent of developer-local configuration and real provider credentials.
"""

import os

# Shared secret the API tests authenticate with (must match
# test_ai_gateway_api.TOKEN and the X-AI-Service-Token headers in test_health).
os.environ["AI_SERVICE_TOKEN"] = "test-service-token"

# Fixed model/provider so the health response is deterministic.
os.environ["AI_LLM_PROVIDER"] = "groq"
os.environ["AI_GROQ_MODEL"] = "test/configured-model"

# Ensure tests never reach a real provider; every LLM call is mocked.
os.environ["AI_GROQ_API_KEY"] = ""
