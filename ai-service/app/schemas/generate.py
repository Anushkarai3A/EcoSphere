"""Contracts for POST /generate/quiz (extracted text -> MCQs)."""

from pydantic import BaseModel, Field, field_validator


class QuizQuestion(BaseModel):
    """One generated multiple-choice question.

    - prompt:      question text, grounded strictly in the study material
    - options:     exactly 4 answer choices
    - correct_index: index into options (0-3)
    - explanation: why the correct option is right, referencing the material
    """

    prompt: str
    options: list[str]
    correct_index: int
    explanation: str
    q_type: str = "MCQ"
    difficulty_score: float = Field(default=0.5, ge=0.0, le=1.0)

    @field_validator("options")
    @classmethod
    def options_must_be_four(cls, options: list[str]) -> list[str]:
        if len(options) != 4:
            raise ValueError("each question must have exactly 4 options")
        if len(set(options)) != len(options):
            raise ValueError("options must be unique")
        return options

    @field_validator("correct_index")
    @classmethod
    def correct_index_in_range(cls, value: int) -> int:
        if value < 0 or value > 3:
            raise ValueError("correct_index must be 0-3")
        return value


class GenerateQuizRequest(BaseModel):
    run_id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1)
    count: int = Field(default=10, ge=5, le=50)
    difficulty: str = Field(default="MEDIUM")
    topic: str | None = None  # teacher hint; auto-detected when absent
    types: list[str] = Field(default_factory=lambda: ["MCQ"])


class GenerateQuizResponse(BaseModel):
    run_id: str
    detected_topic: str
    prompt: str  # exact prompt used; echoed for backend audit logging
    questions: list[QuizQuestion]
