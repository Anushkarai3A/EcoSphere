"""Contracts for POST /extract (document -> text)."""

from pydantic import BaseModel, Field


class ExtractRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(default="application/octet-stream")
    content_base64: str = Field(min_length=1)


class ExtractResponse(BaseModel):
    filename: str
    kind: str
    text: str
    token_count: int
