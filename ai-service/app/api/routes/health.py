from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ecosphere-ai",
        "llm_provider": settings.llm_provider,
        "llm_model": settings.groq_model,
    }
