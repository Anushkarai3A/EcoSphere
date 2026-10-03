from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class AssetType(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"


class EvidenceAsset(BaseModel):
    public_id: str
    url: str
    type: AssetType


class QuestContext(BaseModel):
    category: str
    required_proof_type: str
    lat: float | None = None
    lng: float | None = None
    radius_meters: int | None = None


class DeviceContext(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: int | None = None


class PolicyContext(BaseModel):
    checks: list[str] = Field(default_factory=list)
    thresholds: dict[str, float] = Field(default_factory=dict)


class VerifyRequest(BaseModel):
    """Contract between the backend worker and the AI service (SRS §7)."""

    submission_id: str
    quest: QuestContext
    device: DeviceContext
    submitted_at: datetime
    policy: PolicyContext = Field(default_factory=PolicyContext)
    assets: list[EvidenceAsset] = Field(default_factory=list)


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    SKIP = "SKIP"


class CheckResult(BaseModel):
    check_type: str
    status: CheckStatus
    score: float | None = None
    confidence: float | None = None
    message: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class Recommendation(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"


class FraudRisk(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class VerifyResponse(BaseModel):
    submission_id: str
    overall_recommendation: Recommendation
    overall_confidence: float
    fraud_risk: FraudRisk
    summary: str
    checks: list[CheckResult] = Field(default_factory=list)
