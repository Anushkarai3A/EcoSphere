"""Generate animation storyboard JSON from a student's environmental prompt using Groq LLM."""
from __future__ import annotations
import json
import logging
from app.core.llm import LLMError, generate_json
from app.schemas.animate import AnimateRequest, AnimateResponse, StoryboardScene, StoryboardElement

log = logging.getLogger("ai.animgen")

_SYSTEM_PROMPT = (
    "You are an expert educational animation director creating storyboards for "
    "environmental education videos aimed at school and college students. "
    "You produce vivid, visual, cartoon-style scenes with specific animated elements. "
    "Respond ONLY with valid JSON matching the exact schema requested."
)

_ELEMENT_TYPES = (
    "cloud, tree, water, fish, plastic, sun, bird, smoke, factory, character, "
    "rain, ocean, recycling_bin, animal, solar_panel, wind_turbine, car, leaf, "
    "river, algae, mountain, building, flower, butterfly, bee, whale, turtle, "
    "stump, sapling, watering_can"
)

_MOTION_TYPES = "none, float, drift_right, drift_left, rise, fall, sway, spin, swim, flap, bounce"


def _build_prompt(req: AnimateRequest, scene_count: int) -> str:
    return f"""Create a {req.duration_seconds}-second educational animation storyboard about: "{req.prompt}"
Topic category hint: {req.topic or "environmental education"}
Style: {req.style}
Number of scenes: {scene_count}

Return a JSON object with this EXACT structure:
{{
  "topic": "short topic name (max 60 chars)",
  "title": "engaging animation title (max 80 chars)",
  "total_duration": {req.duration_seconds},
  "scenes": [
    {{
      "scene_number": 1,
      "duration": <seconds for this scene, all scenes must sum to {req.duration_seconds}>,
      "background_top": "<hex color for sky e.g. #87CEEB>",
      "background_bottom": "<hex color for ground e.g. #228B22>",
      "narration": "<1-2 sentence educational subtitle shown during scene>",
      "camera": "<wide for establishing shots | follow to track the character | closeup for detail/explanations | medium for character actions | up for rising time-lapse shots>",
      "transition": "<dissolve (default) | cut | pan>",
      "elements": [
        {{
          "type": "<one of: {_ELEMENT_TYPES}>",
          "x": <0-100 position left-to-right percent>,
          "y": <0-100 position top-to-bottom percent>,
          "scale": <0.5-2.0 size multiplier>,
          "color": "<hex color or null>",
          "motion": "<one of: {_MOTION_TYPES}>",
          "label": "<optional short text label or null>"
        }}
      ],
      "educational_point": "<key learning from this scene>"
    }}
  ]
}}

Rules:
- Include 4-6 elements per scene with varied positions and motions
- Tell ONE coherent story across scenes: PROBLEM -> CAUSE -> EXPLANATION -> ACTION -> RESULT
- Keep the SAME student character (type "character") in every scene where a person appears
- Prefer story props that fit the arc: "stump" for deforestation, "sapling" for growth time-lapses, "watering_can" for planting
- Vary the camera per scene (wide establishing shot first, closeup for explanations, up for time-lapses)
- Show environmental PROBLEM in early scenes, SOLUTION/HOPE in later scenes
- Use vivid specific colors that match the scene mood
- All scene durations must sum to exactly {req.duration_seconds}
- Make it visually engaging with movement (use non-none motions for most elements)
- Only cover environmental/ecology topics
"""


def generate_animation(req: AnimateRequest) -> AnimateResponse:
    scene_count = max(3, min(6, req.duration_seconds // 15))
    prompt = _build_prompt(req, scene_count)

    log.info("animgen: calling LLM for prompt=%r scenes=%d", req.prompt[:60], scene_count)
    try:
        # Storyboards are large JSON payloads — allow headroom above the quiz default.
        raw = generate_json(prompt, system=_SYSTEM_PROMPT, temperature=0.7, max_tokens=4096)
    except LLMError as exc:
        log.error("animgen: LLM error: %s", exc)
        raise

    # Validate and coerce
    try:
        scenes_raw = raw.get("scenes", [])
        scenes = []
        total = req.duration_seconds
        used = 0
        for i, s in enumerate(scenes_raw):
            dur = int(s.get("duration", total // len(scenes_raw)))
            # Fix last scene to ensure durations sum correctly
            if i == len(scenes_raw) - 1:
                dur = max(5, total - used)
            used += dur
            elements = []
            for el in s.get("elements", []):
                elements.append(StoryboardElement(
                    type=str(el.get("type", "cloud")),
                    x=float(el.get("x", 50)),
                    y=float(el.get("y", 50)),
                    scale=float(el.get("scale", 1.0)),
                    color=el.get("color") or None,
                    motion=str(el.get("motion", "none")),
                    label=el.get("label") or None,
                ))
            scenes.append(StoryboardScene(
                scene_number=i + 1,
                duration=dur,
                background_top=str(s.get("background_top", "#87CEEB")),
                background_bottom=str(s.get("background_bottom", "#228B22")),
                narration=str(s.get("narration", "")),
                elements=elements,
                educational_point=str(s.get("educational_point", "")),
                camera=str(s.get("camera", "wide")),
                transition=str(s.get("transition", "dissolve")),
            ))

        return AnimateResponse(
            topic=str(raw.get("topic", req.topic or "Environment")),
            title=str(raw.get("title", "Eco Animation")),
            total_duration=req.duration_seconds,
            scenes=scenes,
        )
    except Exception as exc:
        log.error("animgen: storyboard parse error: %s | raw keys: %s", exc, list(raw.keys()))
        raise LLMError(f"Failed to parse animation storyboard: {exc}") from exc
