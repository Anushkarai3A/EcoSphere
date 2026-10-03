"""Quiz generation tests with a mocked LLM.

The mock captures the prompt and returns deterministic JSON, so we can assert:
  - the material text reaches the prompt (different material => different prompt,
    which is what makes different uploads produce different quizzes)
  - topic auto-detection
  - strict 4-option MCQ validation
  - error behaviour when the LLM output is malformed
"""

import pytest

import app.services.quizgen as quizgen
from app.schemas.generate import GenerateQuizRequest

VALID_LLM_JSON = {
    "detected_topic": "Database Management Systems",
    "questions": [
        {
            "prompt": "What does a foreign key reference?",
            "options": [
                "A primary key of another table",
                "A random column",
                "An index",
                "A stored procedure",
            ],
            "correct_index": 0,
            "explanation": "A foreign key references a primary key in another table.",
        },
        {
            "prompt": "Which normal form removes partial dependencies?",
            "options": ["1NF", "2NF", "3NF", "BCNF"],
            "correct_index": 1,
            "explanation": "2NF removes partial dependencies.",
        },
    ],
}


def _request(text: str = "DBMS notes on normalization.") -> GenerateQuizRequest:
    return GenerateQuizRequest(
        run_id="run-123",
        text=text,
        count=5,
        difficulty="MEDIUM",
        types=["MCQ"],
    )


def test_generate_quiz_returns_validated_questions(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_generate_json(prompt, *, system=None, model=None, temperature=0.4):
        captured["prompt"] = prompt
        captured["system"] = system or ""
        return VALID_LLM_JSON

    monkeypatch.setattr(quizgen, "generate_json", fake_generate_json)

    response = quizgen.generate_quiz(_request())

    assert response.run_id == "run-123"
    assert response.detected_topic == "Database Management Systems"
    assert len(response.questions) == 2
    for question in response.questions:
        assert len(question.options) == 4
        assert 0 <= question.correct_index <= 3
        assert question.explanation
    assert "DBMS notes on normalization." in captured["prompt"]


def test_material_text_reaches_prompt(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_generate_json(prompt, **kwargs):
        captured["prompt"] = prompt
        return VALID_LLM_JSON

    monkeypatch.setattr(quizgen, "generate_json", fake_generate_json)

    material = "BDA notes: Hadoop and MapReduce for large datasets."
    quizgen.generate_quiz(_request(text=material))
    assert material in captured["prompt"]


def test_different_materials_produce_different_prompts(monkeypatch) -> None:
    prompts: list[str] = []

    def fake_generate_json(prompt, **kwargs):
        prompts.append(prompt)
        return VALID_LLM_JSON

    monkeypatch.setattr(quizgen, "generate_json", fake_generate_json)

    quizgen.generate_quiz(_request(text="BDA notes: Hadoop and MapReduce."))
    quizgen.generate_quiz(_request(text="Python notes: functions and loops."))
    assert len(prompts) == 2
    assert prompts[0] != prompts[1]
    assert "Hadoop" in prompts[0]
    assert "Python" in prompts[1]


def test_missing_detected_topic_raises(monkeypatch) -> None:
    monkeypatch.setattr(quizgen, "generate_json", lambda prompt, **kwargs: {"questions": []})
    with pytest.raises(quizgen.QuizGenError, match="no questions"):
        quizgen.generate_quiz(_request())


def test_wrong_option_count_raises(monkeypatch) -> None:
    bad = {
        "detected_topic": "Cloud Computing",
        "questions": [
            {
                "prompt": "What is IaaS?",
                "options": ["A", "B", "C"],  # only 3 options
                "correct_index": 0,
                "explanation": "x",
            }
        ],
    }
    monkeypatch.setattr(quizgen, "generate_json", lambda prompt, **kwargs: bad)
    with pytest.raises(quizgen.QuizGenError, match="4 options"):
        quizgen.generate_quiz(_request())


def test_no_questions_raises(monkeypatch) -> None:
    monkeypatch.setattr(
        quizgen,
        "generate_json",
        lambda prompt, **kwargs: {"detected_topic": "T", "questions": []},
    )
    with pytest.raises(quizgen.QuizGenError, match="no questions"):
        quizgen.generate_quiz(_request())
