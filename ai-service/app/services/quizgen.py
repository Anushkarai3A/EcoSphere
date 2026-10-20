"""Structured MCQ generation from extracted study material.

Reference: docs/v2/03_ai_and_ml_design.md §3 (quiz generation workflow,
question types, JSON-schema enforcement).

Every question is grounded ONLY in the provided material — no templated or
topic-agnostic fallbacks. The exact prompt used is echoed back so the backend
can audit it (see requirement: log "prompt sent to AI").
"""
from __future__ import annotations

import logging
import math
import time

from pydantic import ValidationError

from app.core.config import settings
from app.core.llm import LLMError, generate_json
from app.schemas.generate import GenerateQuizRequest, GenerateQuizResponse, QuizQuestion

log = logging.getLogger("ai.quizgen")


class QuizGenError(RuntimeError):
    """Raised when the LLM output cannot be validated as a quiz."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = 502,
        category: str = "generation",
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.category = category


_SYSTEM_PROMPT = (
    "You are an expert assessment designer creating a multiple-choice quiz from "
    "a student's uploaded study material. The quiz checks understanding of that "
    "specific material."
)


def _estimate_tokens(text: str) -> int:
    """Conservative token estimate for English text (no tiktoken dependency)."""
    return max(1, int(math.ceil(len(text) / settings.tpm_chars_per_token)))


def _material_budget() -> int:
    """How many tokens the study material can use while staying under TPM limit."""
    return max(
        200,
        settings.groq_tpm_limit - settings.tpm_output_reserve - settings.tpm_overhead_reserve,
    )


def _build_prompt(
    request: GenerateQuizRequest,
    material_text: str,
    *,
    question_count: int | None = None,
    chunk_hint: str = "",
) -> str:
    count = question_count or request.count
    topic_hint = (
        f"The teacher indicated the topic is '{request.topic}'. Use it only as a "
        "label; still ground every question in the material below.\n"
        if request.topic
        else "Identify the subject of the material yourself.\n"
    )
    chunk_note = f"\n{chunk_hint}\n" if chunk_hint else ""
    return f"""Create a multiple-choice quiz from the study material below.
{chunk_note}
STRICT RULES:
1. Base every question ONLY on the material. Never invent facts, formulas, terms,
   names or figures that are not present in it.
2. Generate exactly {count} multiple-choice questions.
3. Each question has EXACTLY 4 answer options and exactly one correct option.
4. The correct option must be unambiguously supported by the material.
5. Provide a short explanation for each answer that references the relevant idea
   from the material.
6. Difficulty target: {request.difficulty}.
7. {topic_hint}detected_topic must be a short subject label (2-6 words) describing
   what the material is about, e.g. "Big Data Analytics", "Database Management
   Systems", "Cloud Computing" or "Python Programming".

Return ONLY JSON with this shape:
{{
  "detected_topic": "<subject label>",
  "questions": [
    {{
      "prompt": "<question text>",
      "options": ["<option A>", "<option B>", "<option C>", "<option D>"],
      "correct_index": <0-3>,
      "explanation": "<why this option is correct, citing the material>"
    }}
  ]
}}

--- STUDY MATERIAL ---
{material_text}
--- END OF STUDY MATERIAL ---"""


def _validate_questions(raw_questions: list) -> list[QuizQuestion]:
    """Parse and validate a list of raw question dicts into QuizQuestion models."""
    questions: list[QuizQuestion] = []
    for index, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            continue
        try:
            question = QuizQuestion(**raw)
        except ValidationError as exc:
            raise QuizGenError(
                f"AI returned an invalid question (#{index + 1}): "
                f"{'; '.join(e['msg'] for e in exc.errors())}",
                category="response_parse",
            ) from exc
        questions.append(question)
    return questions


def _split_material_into_chunks(text: str, max_tokens: int) -> list[str]:
    """Split text into chunks that each fit within the token budget.

    Splits on paragraph boundaries (\n\n) first, then sentence boundaries,
    to preserve semantic coherence.
    """
    estimated = _estimate_tokens(text)
    if estimated <= max_tokens:
        return [text]

    char_limit = int(max_tokens * settings.tpm_chars_per_token)

    # Split on double-newlines (paragraphs)
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        candidate = f"{current}\n\n{para}" if current else para
        if _estimate_tokens(candidate) <= max_tokens:
            current = candidate
        else:
            if current:
                chunks.append(current)
            # If a single paragraph exceeds the limit, split on sentences
            if _estimate_tokens(para) > max_tokens:
                sentences = para.replace(". ", ".\n").split("\n")
                current = ""
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    candidate = f"{current} {sent}" if current else sent
                    if _estimate_tokens(candidate) <= max_tokens:
                        current = candidate
                    else:
                        if current:
                            chunks.append(current)
                        current = sent
            else:
                current = para

    if current:
        chunks.append(current)

    return chunks if chunks else [text[:char_limit]]


def _parse_quiz_data(data: dict, source_label: str) -> tuple[str, list[QuizQuestion]]:
    """Extract detected_topic and validated questions from LLM JSON response."""
    detected_topic = str(data.get("detected_topic") or "").strip()
    raw_questions = data.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise QuizGenError(f"{source_label}: AI returned no questions")
    return detected_topic, _validate_questions(raw_questions)


def generate_quiz(request: GenerateQuizRequest) -> GenerateQuizResponse:
    """Detect the material's subject and generate grounded MCQs.

    Automatically chunks large materials to stay within the Groq TPM limit.
    If the material requires multiple chunks, generates questions from each
    chunk and combines them.
    """
    t0 = time.monotonic()
    text_tokens = _estimate_tokens(request.text)
    budget = _material_budget()
    prompt_overhead = _estimate_tokens(
        _build_prompt(request, "", question_count=request.count)
    )

    log.info(
        "AI quiz generation started provider=%s model=%s run_id=%s "
        "count=%d textChars=%d estimatedTextTokens=%d materialBudget=%d "
        "promptOverhead=%d tpmLimit=%d",
        settings.llm_provider,
        settings.groq_model,
        request.run_id,
        request.count,
        len(request.text),
        text_tokens,
        budget,
        prompt_overhead,
        settings.groq_tpm_limit,
    )

    # How many tokens can the material actually use in a single call
    usable_budget = max(200, budget - prompt_overhead)

    # Single chunk: material fits comfortably
    if text_tokens <= usable_budget:
        return _generate_single_chunk(request, t0, text_tokens, budget)

    # Multi-chunk: material is too large
    return _generate_multi_chunk(request, t0, text_tokens, budget, usable_budget)


def _generate_single_chunk(
    request: GenerateQuizRequest,
    t0: float,
    text_tokens: int,
    budget: int,
) -> GenerateQuizResponse:
    """Generate quiz from material that fits in a single LLM call."""
    prompt = _build_prompt(request, request.text)

    log.info(
        "LLM call (single chunk) tokens=%d budget=%d questions=%d",
        text_tokens,
        budget,
        request.count,
    )

    try:
        data = generate_json(prompt, system=_SYSTEM_PROMPT)
    except LLMError as exc:
        log.error(
            "LLM call failed category=%s status=%s error=%s",
            exc.category, exc.status_code, exc,
        )
        raise QuizGenError(
            str(exc),
            status_code=exc.status_code,
            category=exc.category,
        ) from exc

    detected_topic, questions = _parse_quiz_data(data, "single chunk")
    if not detected_topic:
        raise QuizGenError("AI did not return a detected topic")
    if not questions:
        raise QuizGenError("AI returned no valid questions")

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    log.info(
        "AI quiz generation completed provider=%s model=%s run_id=%s "
        "chunks=1 questions=%d topic='%s' elapsed_ms=%d",
        settings.llm_provider,
        settings.groq_model,
        request.run_id,
        len(questions),
        detected_topic,
        elapsed_ms,
    )

    return GenerateQuizResponse(
        run_id=request.run_id,
        detected_topic=detected_topic[:120],
        prompt=prompt,
        questions=questions,
    )


def _generate_multi_chunk(
    request: GenerateQuizRequest,
    t0: float,
    text_tokens: int,
    budget: int,
    usable_budget: int,
) -> GenerateQuizResponse:
    """Generate quiz from material that requires multiple LLM calls."""
    chunks = _split_material_into_chunks(request.text, usable_budget)
    num_chunks = len(chunks)

    # Distribute questions across chunks proportionally
    questions_per_chunk = max(1, request.count // num_chunks)
    remainder = request.count - (questions_per_chunk * num_chunks)

    log.info(
        "Multi-chunk generation: textTokens=%d usableBudget=%d chunks=%d "
        "questionsPerChunk=%d remainder=%d totalRequested=%d",
        text_tokens,
        usable_budget,
        num_chunks,
        questions_per_chunk,
        remainder,
        request.count,
    )

    all_questions: list[QuizQuestion] = []
    detected_topic = ""
    all_prompts: list[str] = []
    chunk_num = 0

    for i, chunk in enumerate(chunks):
        # Delay between chunk calls to avoid Groq 429 rate limiting
        if i > 0 and settings.chunk_delay_seconds > 0:
            log.info("Chunk delay: waiting %.1fs to avoid rate limiting", settings.chunk_delay_seconds)
            time.sleep(settings.chunk_delay_seconds)

        # Give extra questions to early chunks (they tend to have introduction material)
        chunk_count = questions_per_chunk + (1 if i < remainder else 0)
        chunk_num = i + 1

        chunk_hint = (
            f"This is chunk {chunk_num} of {num_chunks} from a larger document. "
            f"Generate exactly {chunk_count} questions from THIS chunk only. "
            "Base every question strictly on the material in this chunk."
        )

        prompt = _build_prompt(
            request,
            chunk,
            question_count=chunk_count,
            chunk_hint=chunk_hint,
        )
        all_prompts.append(prompt)

        chunk_tokens = _estimate_tokens(chunk)
        log.info(
            "LLM call chunk=%d/%d tokens=%d questions=%d",
            chunk_num,
            num_chunks,
            chunk_tokens,
            chunk_count,
        )

        try:
            data = generate_json(prompt, system=_SYSTEM_PROMPT)
        except LLMError as exc:
            log.error(
                "LLM call failed on chunk %d/%d category=%s status=%s error=%s",
                chunk_num, num_chunks, exc.category, exc.status_code, exc,
            )
            raise QuizGenError(
                str(exc),
                status_code=exc.status_code,
                category=exc.category,
            ) from exc

        chunk_topic, chunk_questions = _parse_quiz_data(
            data, f"chunk {chunk_num}/{num_chunks}"
        )

        if chunk_topic and not detected_topic:
            detected_topic = chunk_topic

        all_questions.extend(chunk_questions)

        log.info(
            "Chunk %d/%d completed: topic='%s' questionsGenerated=%d questionsTotal=%d",
            chunk_num,
            num_chunks,
            chunk_topic,
            len(chunk_questions),
            len(all_questions),
        )

    if not detected_topic:
        raise QuizGenError("AI did not return a detected topic")
    if not all_questions:
        raise QuizGenError("AI returned no valid questions from any chunk")

    # Trim or pad to the requested count
    if len(all_questions) > request.count:
        all_questions = all_questions[: request.count]

    combined_prompt = "\n\n---\n\n".join(all_prompts)

    elapsed_ms = int((time.monotonic() - t0) * 1000)
    log.info(
        "AI quiz generation completed provider=%s model=%s run_id=%s "
        "chunks=%d questions=%d topic='%s' elapsed_ms=%d",
        settings.llm_provider,
        settings.groq_model,
        request.run_id,
        num_chunks,
        len(all_questions),
        detected_topic,
        elapsed_ms,
    )

    return GenerateQuizResponse(
        run_id=request.run_id,
        detected_topic=detected_topic[:120],
        prompt=combined_prompt,
        questions=all_questions,
    )
