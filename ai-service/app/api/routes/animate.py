"""POST /ai/v1/generate/animation — prompt -> animation storyboard JSON."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_service_token
from app.schemas.animate import AnimateRequest, AnimateResponse
from app.services.animgen import generate_animation
from app.core.llm import LLMError

log = logging.getLogger("ai.routes.animate")

router = APIRouter(
    prefix="/ai/v1",
    tags=["animate"],
    dependencies=[Depends(require_service_token)],
)


@router.post("/generate/animation", response_model=AnimateResponse)
async def generate_animation_endpoint(payload: AnimateRequest) -> AnimateResponse:
    try:
        return generate_animation(payload)
    except LLMError as exc:
        log.error("/generate/animation failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
