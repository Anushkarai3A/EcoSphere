from pydantic import BaseModel, Field
from typing import Optional


class FilmRequest(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=1000)
    topic: Optional[str] = Field(None, max_length=100)
    duration_seconds: int = Field(default=45, ge=15, le=90)
    style: str = Field(default="CARTOON_2D")


class FilmResponse(BaseModel):
    film: str = "general"       # forest | ocean | water | solar | wildlife | air | general
    topic: str = "Environment"
    title: str = "Eco Animation"
    total_duration: int = 45
    narrations: list[str] = []  # one spoken line per story beat, in order
