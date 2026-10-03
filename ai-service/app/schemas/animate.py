from pydantic import BaseModel, Field
from typing import Optional

class AnimateRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=1000)
    topic: Optional[str] = Field(None, max_length=100)
    duration_seconds: int = Field(default=45, ge=15, le=90)
    style: str = Field(default="CARTOON_2D")

class StoryboardElement(BaseModel):
    type: str          # cloud, tree, water, fish, plastic, sun, bird, smoke, factory, character, rain, ocean, recycling_bin, animal, solar_panel, wind_turbine, car, leaf
    x: float           # 0-100 percent of canvas width
    y: float           # 0-100 percent of canvas height
    scale: float = 1.0
    color: Optional[str] = None
    motion: str = "none"   # none, float, drift_right, drift_left, rise, fall, sway, spin, swim
    label: Optional[str] = None

class StoryboardScene(BaseModel):
    scene_number: int
    duration: int               # seconds
    background_top: str         # hex color for sky/top gradient
    background_bottom: str      # hex color for ground/bottom gradient
    narration: str              # subtitle text shown during scene
    elements: list[StoryboardElement]
    educational_point: str
    camera: str = "wide"        # wide | follow | closeup | medium | up
    transition: str = "dissolve"  # dissolve | cut | pan

class AnimateResponse(BaseModel):
    topic: str
    title: str
    total_duration: int
    scenes: list[StoryboardScene]
