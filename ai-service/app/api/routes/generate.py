"""POST /ai/v1/generate/quiz — extracted text -> topic detection + MCQs."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_service_token
from app.schemas.generate import GenerateQuizRequest, GenerateQuizResponse
from app.services.quizgen import QuizGenError, generate_quiz

log = logging.getLogger("ai.routes.generate")

router = APIRouter(prefix="/ai/v1", tags=["generate"], dependencies=[Depends(require_service_token)])


@router.post("/generate/quiz", response_model=GenerateQuizResponse)
async def generate_quiz_endpoint(payload: GenerateQuizRequest) -> GenerateQuizResponse:
    try:
        return generate_quiz(payload)
    except QuizGenError as exc:
        status_code = getattr(exc, "status_code", 502)
        category = getattr(exc, "category", "generation")
        log.error(
            "/generate/quiz failed run_id=%s category=%s status=%s error=%s",
            payload.run_id, category, status_code, exc,
        )
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc
