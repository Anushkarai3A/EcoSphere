"""Direct a student's prompt into a story-film package using Groq LLM.

The renderer owns hand-built story films (fixed beats per film); the LLM's job
is what it is good at: pick the right film and write one spoken narration line
per beat. Small, fast, and reliable compared to full element storyboards.
"""
from __future__ import annotations
import logging
from app.core.llm import LLMError, generate_json
from app.schemas.film import FilmRequest, FilmResponse

log = logging.getLogger("ai.filmgen")

_FILMS = (
    "- forest (6 beats): trees, planting, deforestation, forests\n"
    "- ocean (6 beats): plastic journey to the sea, marine life, cleanup\n"
    "- water (5 beats): saving water at home, taps, rainwater\n"
    "- solar (5 beats): how solar energy powers homes and towns\n"
    "- wildlife (5 beats): protecting birds and animals, habitats\n"
    "- air (5 beats): air pollution, smog, change, blue skies\n"
    "- general (5 beats): mixed everyday eco habits"
)

_SYSTEM_PROMPT = (
    "You are an educational animation director for school and college students. "
    "You turn environmental topics into short narrated cartoon stories. "
    "Respond ONLY with valid JSON matching the exact schema requested."
)


_STYLE_DIRECTION = {
    "CARTOON_2D": "character-led story beats with a consistent student protagonist who acts (walks, points, plants); expressive, cinematic",
    "MOTION_GRAPHICS": "diagram-led beats with NO protagonist: bold icons, big kinetic moments, cause→effect chains, numbers and transformations",
    "ECO_DOODLE": "hand-drawn whiteboard beats: simple sketched moments, arrows between ideas, one clear drawing per beat",
    "PIXEL_ART": "sprite-story beats with a small pixel hero: bold readable poses, clear entrances/exits, chunky set pieces",
    "INFOGRAPHIC": "explainer beats with NO protagonist: numbered steps, labeled processes, before/after comparisons, one key fact per beat",
}

def _build_prompt(req: FilmRequest) -> str:
    style_note = _STYLE_DIRECTION.get(req.style, _STYLE_DIRECTION["CARTOON_2D"])
    return f"""A student wants an educational cartoon about: "{req.prompt}"
Topic hint: {req.topic or "environmental education"}
Style: {req.style} — direct the story accordingly: {style_note}.

Pick exactly one story film by id from this catalogue (with beat counts):
{_FILMS}

Return a JSON object with this EXACT structure:
{{
  "film": "<one film id from the catalogue>",
  "topic": "<short topic name, max 60 chars>",
  "title": "<engaging cartoon title, max 80 chars>",
  "narrations": [
    "<one short SPOKEN narration line per beat, in story order>"
  ]
}}

Rules:
- "narrations" MUST contain exactly the beat count of the chosen film
- Each line: max 140 characters, spoken present-tense style, matched to its beat
- Early lines: PROBLEM and CAUSE. Middle lines: EXPLANATION. Late lines: ACTION and hopeful RESULT
- Only environmental/ecology topics
"""


def direct_film(req: FilmRequest) -> FilmResponse:
    log.info("filmgen: calling LLM for prompt=%r", req.prompt[:60])
    try:
        raw = generate_json(_build_prompt(req), system=_SYSTEM_PROMPT, temperature=0.7, max_tokens=4096)
    except LLMError as exc:
        log.error("filmgen: LLM error: %s", exc)
        raise

    try:
        film = str(raw.get("film", "general")).strip().lower()
        narrations_raw = raw.get("narrations", [])
        narrations = [str(n).strip()[:280] for n in narrations_raw if str(n).strip()]
        return FilmResponse(
            film=film,
            topic=str(raw.get("topic", req.topic or "Environment"))[:60],
            title=str(raw.get("title", "Eco Animation"))[:80],
            total_duration=req.duration_seconds,
            narrations=narrations,
        )
    except Exception as exc:
        log.error("filmgen: parse error: %s | raw keys: %s", exc, list(raw.keys()))
        raise LLMError(f"Failed to parse film direction: {exc}") from exc
