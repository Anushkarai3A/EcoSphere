from fastapi import APIRouter, Depends

from app.core.security import require_service_token
from app.schemas.verify import VerifyRequest, VerifyResponse
from app.services.verifier import verify_submission

router = APIRouter(
    prefix="/ai/v1",
    tags=["verification"],
    dependencies=[Depends(require_service_token)],
)


@router.post("/verify/submission", response_model=VerifyResponse)
async def verify_submission_endpoint(payload: VerifyRequest) -> VerifyResponse:
    return await verify_submission(payload)
