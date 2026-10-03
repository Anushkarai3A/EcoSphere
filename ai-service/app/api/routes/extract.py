"""POST /ai/v1/extract — document (PDF/DOCX/PPTX/TXT) -> normalized text."""

import base64

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_service_token
from app.schemas.extract import ExtractRequest, ExtractResponse
from app.services.extractor import ExtractionError, extract_text

router = APIRouter(prefix="/ai/v1", tags=["extract"], dependencies=[Depends(require_service_token)])


@router.post("/extract", response_model=ExtractResponse)
async def extract_endpoint(payload: ExtractRequest) -> ExtractResponse:
    try:
        content = base64.b64decode(payload.content_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="content_base64 is not valid base64") from exc

    try:
        result = extract_text(payload.filename, content, payload.mime_type)
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return ExtractResponse(
        filename=result.filename,
        kind=result.kind,
        text=result.text,
        token_count=result.token_count,
    )
