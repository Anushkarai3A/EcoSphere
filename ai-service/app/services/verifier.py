"""AI verification pipeline entrypoint.

Reference: PRD §6, SRS §7.

The pipeline runs a set of independent checks over a submission's evidence and
produces a single recommendation (APPROVE / REJECT / NEEDS_MANUAL_REVIEW) plus a
confidence score and per-check breakdown. The teacher always retains final
authority; the recommendation only surfaces in their review queue.

Implemented checks (M4):
  - GPS_PROXIMITY: haversine distance from the device location to the quest
    location must fit inside the quest radius.
  - TIMESTAMP_FRESHNESS: the submission must have been recorded recently
    (< 6h old passes, < 24h warns, older fails).

Still stubs / manual-review route in later milestones:
  EXIF_METADATA, EXIF_GPS_CONSISTENCY, DUPLICATE_DETECTION, IMAGE_SIMILARITY,
  OBJECT_DETECTION, SCENE_CLASSIFICATION, IMAGE_QUALITY, DEVICE_SPOOFING.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from app.schemas.verify import (
    CheckResult,
    CheckStatus,
    FraudRisk,
    Recommendation,
    VerifyRequest,
    VerifyResponse,
)


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_m = 6_371_000.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return earth_radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def verify_submission(request: VerifyRequest) -> VerifyResponse:
    checks: list[CheckResult] = []

    # --- GPS_PROXIMITY -------------------------------------------------------
    gps = CheckResult(
        check_type="GPS_PROXIMITY",
        status=CheckStatus.SKIP,
        message="Quest location unavailable; cannot verify proximity",
    )
    quest = request.quest
    if quest.lat is not None and quest.lng is not None and quest.radius_meters is not None:
        distance_m = _haversine_meters(
            quest.lat, quest.lng, request.device.latitude, request.device.longitude
        )
        inside = distance_m <= quest.radius_meters
        gps = CheckResult(
            check_type="GPS_PROXIMITY",
            status=CheckStatus.PASS if inside else CheckStatus.FAIL,
            score=round(distance_m, 1),
            confidence=0.95 if inside else 0.95,
            message=f"{distance_m:.0f}m from quest (limit {quest.radius_meters}m)",
            details={"distance_m": round(distance_m, 1), "radius_m": quest.radius_meters},
        )
    checks.append(gps)

    # --- TIMESTAMP_FRESHNESS -------------------------------------------------
    age_seconds = (datetime.now(timezone.utc) - request.submitted_at).total_seconds()
    if age_seconds <= 6 * 3600:
        freshness = CheckStatus.PASS
        age_label = "recent"
    elif age_seconds <= 24 * 3600:
        freshness = CheckStatus.WARN
        age_label = "old"
    else:
        freshness = CheckStatus.FAIL
        age_label = "stale"
    checks.append(
        CheckResult(
            check_type="TIMESTAMP_FRESHNESS",
            status=freshness,
            score=round(max(age_seconds, 0) / 3600, 2),
            confidence=0.9,
            message=f"Submission is {age_label} ({max(age_seconds, 0) / 3600:.1f}h old)",
            details={"age_seconds": int(max(age_seconds, 0))},
        )
    )

    # --- Aggregate ------------------------------------------------------------
    fails = [c for c in checks if c.status == CheckStatus.FAIL]
    warns = [c for c in checks if c.status == CheckStatus.WARN]
    passes = [c for c in checks if c.status == CheckStatus.PASS]

    if fails:
        recommendation = Recommendation.REJECT
        fraud_risk = FraudRisk.HIGH
        confidence = 0.9
        summary = "Automated checks failed; submission rejected."
    elif len(passes) == len(checks):
        recommendation = Recommendation.APPROVE
        fraud_risk = FraudRisk.LOW
        confidence = 0.95
        summary = "All automated checks passed."
    else:
        recommendation = Recommendation.NEEDS_MANUAL_REVIEW
        fraud_risk = FraudRisk.LOW
        confidence = 0.6
        summary = "Some checks could not pass automatically; teacher review required."

    return VerifyResponse(
        submission_id=request.submission_id,
        overall_recommendation=recommendation,
        overall_confidence=confidence,
        fraud_risk=fraud_risk,
        summary=summary,
        checks=checks,
    )
