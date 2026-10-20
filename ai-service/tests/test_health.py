from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

# Matches AI_SERVICE_TOKEN set in tests/conftest.py, so the suite does not depend
# on whatever a developer has in ai-service/.env.
AUTH = {"X-AI-Service-Token": "test-service-token"}

QUEST_BASE = {
    "submission_id": "00000000-0000-0000-0000-000000000001",
    "quest": {"category": "TREE_PLANTATION", "required_proof_type": "PHOTO"},
    "device": {"latitude": 12.9716, "longitude": 77.5946, "accuracy_meters": 8},
    "submitted_at": datetime.now(timezone.utc).isoformat(),
    "assets": [
        {
            "public_id": "sample/photo_001",
            "url": "https://res.cloudinary.com/sample/photo_001.jpg",
            "type": "IMAGE",
        }
    ],
}


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ecosphere-ai"
    # Health must report whatever configuration is active, not a hard-coded model.
    assert body["llm_provider"] == settings.llm_provider
    assert body["llm_model"] == settings.groq_model


def test_verify_rejects_missing_token() -> None:
    response = client.post("/ai/v1/verify/submission", json=QUEST_BASE)
    assert response.status_code == 403


def test_verify_rejects_invalid_token() -> None:
    response = client.post(
        "/ai/v1/verify/submission",
        json=QUEST_BASE,
        headers={"X-AI-Service-Token": "not-the-service-token"},
    )
    assert response.status_code == 403


def test_verify_approves_when_fresh_and_at_quest() -> None:
    payload = {
        **QUEST_BASE,
        "quest": {
            **QUEST_BASE["quest"],
            "lat": 12.9716,
            "lng": 77.5946,
            "radius_meters": 150,
        },
    }
    response = client.post("/ai/v1/verify/submission", json=payload, headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["overall_recommendation"] == "APPROVE"
    assert body["fraud_risk"] == "LOW"
    assert len(body["checks"]) == 2
    assert {c["status"] for c in body["checks"]} == {"PASS"}


def test_verify_rejects_when_out_of_radius() -> None:
    payload = {
        **QUEST_BASE,
        "quest": {
            **QUEST_BASE["quest"],
            "lat": 28.6139,
            "lng": 77.2090,
            "radius_meters": 150,
        },
    }
    response = client.post("/ai/v1/verify/submission", json=payload, headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["overall_recommendation"] == "REJECT"
    assert body["fraud_risk"] == "HIGH"
    gps = next(c for c in body["checks"] if c["check_type"] == "GPS_PROXIMITY")
    assert gps["status"] == "FAIL"


def test_verify_needs_manual_review_without_quest_location() -> None:
    response = client.post("/ai/v1/verify/submission", json=QUEST_BASE, headers=AUTH)
    assert response.status_code == 200
    body = response.json()
    assert body["overall_recommendation"] == "NEEDS_MANUAL_REVIEW"
