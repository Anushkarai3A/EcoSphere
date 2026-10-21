"""POST /ai/v1/generate/narration-audio — narration text -> WAV voiceover bytes."""
import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from typing import Optional
from app.core.security import require_service_token
from app.core.llm import LLMError, synthesize_speech

log = logging.getLogger("ai.routes.tts")

router = APIRouter(
    prefix="/ai/v1",
    tags=["tts"],
    dependencies=[Depends(require_service_token)],
)


class NarrationAudioRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=600)
    voice: Optional[str] = Field(None, max_length=40)


@router.post("/generate/narration-audio")
async def narration_audio_endpoint(payload: NarrationAudioRequest) -> Response:
    try:
        wav = synthesize_speech(payload.text, voice=payload.voice)
    except LLMError as exc:
        log.error("/generate/narration-audio failed: %s", exc)
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return Response(content=wav, media_type="audio/wav")
