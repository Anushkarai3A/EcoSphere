"""Internal gateway auth: backend -> ai-service shared-secret header.

Reference: docs/v2/03_ai_and_ml_design.md §2.1 ("Backend authenticates to the
gateway with a shared secret sent as a header; the service refuses unknown
callers.").
"""
from __future__ import annotations

from fastapi import Header, HTTPException

from app.core.config import settings


async def require_service_token(
    x_ai_service_token: str | None = Header(default=None),
) -> None:
    if not x_ai_service_token or x_ai_service_token != settings.service_token:
        raise HTTPException(status_code=403, detail="invalid service token")
