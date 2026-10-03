"""API-level tests for the /extract and /generate/quiz gateway endpoints."""

import base64

from fastapi.testclient import TestClient

import app.services.quizgen as quizgen
from app.main import app

client = TestClient(app)

TOKEN = "dev-ai-token"
AUTH = {"X-AI-Service-Token": TOKEN}

VALID_LLM_JSON = {
    "detected_topic": "Python Programming",
    "questions": [
        {
            "prompt": "Which keyword defines a function in Python?",
            "options": ["def", "func", "function", "lambda x:"],
            "correct_index": 0,
            "explanation": "Functions are defined with the def keyword.",
        }
    ],
}


def test_extract_endpoint() -> None:
    content = base64.b64encode(b"DBMS notes: normalization and foreign keys.").decode()
    response = client.post(
        "/ai/v1/extract",
        json={
            "filename": "dbms.txt",
            "mime_type": "text/plain",
            "content_base64": content,
        },
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["kind"] == "TXT"
    assert "normalization" in body["text"]
    assert body["token_count"] > 0


def test_extract_rejects_missing_token() -> None:
    response = client.post(
        "/ai/v1/extract",
        json={"filename": "a.txt", "mime_type": "text/plain", "content_base64": "eA=="},
    )
    assert response.status_code == 403


def test_extract_returns_422_on_unreadable_file() -> None:
    content = base64.b64encode(b"only a tiny string").decode()
    response = client.post(
        "/ai/v1/extract",
        json={"filename": "tiny.txt", "mime_type": "text/plain", "content_base64": content},
        headers=AUTH,
    )
    assert response.status_code == 422


def test_generate_quiz_endpoint(monkeypatch) -> None:
    monkeypatch.setattr(quizgen, "generate_json", lambda prompt, **kwargs: VALID_LLM_JSON)
    response = client.post(
        "/ai/v1/generate/quiz",
        json={
            "run_id": "run-api-1",
            "text": "Python notes: def defines functions.",
            "count": 5,
            "difficulty": "MEDIUM",
        },
        headers=AUTH,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["detected_topic"] == "Python Programming"
    assert len(body["questions"]) == 1
    assert len(body["questions"][0]["options"]) == 4
    assert "Python notes" in body["prompt"]


def test_generate_quiz_rejects_missing_token() -> None:
    response = client.post(
        "/ai/v1/generate/quiz",
        json={"run_id": "r", "text": "x", "count": 5},
    )
    assert response.status_code == 403


def test_generate_quiz_returns_502_on_llm_failure(monkeypatch) -> None:
    def boom(prompt, **kwargs):
        raise quizgen.LLMError("provider down")

    monkeypatch.setattr(quizgen, "generate_json", boom)
    response = client.post(
        "/ai/v1/generate/quiz",
        json={"run_id": "run-2", "text": "some material", "count": 5},
        headers=AUTH,
    )
    assert response.status_code == 502
