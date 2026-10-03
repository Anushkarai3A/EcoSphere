"""POST /ai/v1/generate/film — prompt -> story-film package (film + narrations)."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import require_service_token
from app.schemas.film import FilmRequest, FilmResponse
from app.services.filmgen import direct_film
from app.core.llm import LLMError

log = logging.getLogger("ai.routes.film")

router = APIRouter(
    prefix="/ai/v1",
    tags=["film"],
    dependencies=[Depends(require_service_token)],
)


@router.post("/generate/film", response_model=FilmResponse)
async def generate_film_endpoint(payload: FilmRequest) -> FilmResponse:
    try:
        return direct_film(payload)
    except LLMError as exc:
        log.error("/generate/film failed: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
