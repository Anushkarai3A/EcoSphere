from fastapi import APIRouter

from app.schemas.verify import VerifyRequest, VerifyResponse
from app.services.verifier import verify_submission

router = APIRouter(prefix="/ai/v1", tags=["verification"])


@router.post("/verify/submission", response_model=VerifyResponse)
async def verify_submission_endpoint(payload: VerifyRequest) -> VerifyResponse:
    return await verify_submission(payload)
