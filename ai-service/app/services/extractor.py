"""Document extraction: PDF / DOCX / PPTX / TXT -> normalized text.

Reference: docs/v2/03_ai_and_ml_design.md §1 (`services/extractor.py`,
pypdf / python-docx / python-pptx -> normalized text).
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass

import docx  # python-docx
import pptx  # python-pptx
from pypdf import PdfReader

from app.core.config import settings


class ExtractionError(RuntimeError):
    """Raised when the file cannot be parsed or yields no usable text."""


@dataclass
class ExtractionResult:
    filename: str
    kind: str
    text: str
    token_count: int


# MIME type -> extraction kind. Plain text and office documents only; images
# (diagrams) are out of scope for question generation.
MIME_KINDS: dict[str, str] = {
    "application/pdf": "PDF",
    "application/msword": "DOCX",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/vnd.ms-powerpoint": "PPTX",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "text/plain": "TXT",
}

EXT_KINDS: dict[str, str] = {
    ".pdf": "PDF",
    ".doc": "DOCX",
    ".docx": "DOCX",
    ".ppt": "PPTX",
    ".pptx": "PPTX",
    ".txt": "TXT",
}

_PDF_HEADER = b"%PDF-"
_DOCX_SIG = b"PK\x03\x04"


def detect_kind(filename: str, mime_type: str) -> str:
    """Pick the extraction kind from MIME type first, then the extension."""
    if mime_type:
        kind = MIME_KINDS.get(mime_type.lower())
        if kind:
            return kind
    ext = "." + (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")
    kind = EXT_KINDS.get(ext)
    if kind:
        return kind
    # Sniff byte-level: PDF magic bytes, otherwise zip-based office formats.
    if mime_type == "application/octet-stream":
        raise ExtractionError(
            f"Unsupported file type for {filename!r}: {mime_type}. "
            "Upload PDF, DOCX, PPTX or TXT."
        )
    raise ExtractionError(
        f"Unsupported file type for {filename!r} (mime={mime_type}). "
        "Upload PDF, DOCX, PPTX or TXT."
    )


def _normalize(raw: str) -> str:
    """Collapse whitespace and drop empty lines for a compact LLM prompt."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in raw.splitlines()]
    lines = [line for line in lines if line]
    text = "\n".join(lines)
    return text[: settings.max_extract_chars]


def _extract_pdf(content: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:
        raise ExtractionError(f"PDF could not be parsed: {exc}") from exc
    return "\n".join(pages)


def _extract_docx(content: bytes) -> str:
    try:
        document = docx.Document(io.BytesIO(content))
    except Exception as exc:
        raise ExtractionError(f"DOCX could not be parsed: {exc}") from exc

    parts: list[str] = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            parts.append(" | ".join(cell for cell in cells if cell))
    return "\n".join(parts)


def _extract_pptx(content: bytes) -> str:
    try:
        presentation = pptx.Presentation(io.BytesIO(content))
    except Exception as exc:
        raise ExtractionError(f"PPTX could not be parsed: {exc}") from exc

    parts: list[str] = []
    for index, slide in enumerate(presentation.slides, start=1):
        slide_parts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text:
                    slide_parts.append(text)
            if getattr(shape, "has_table", False):
                for row in shape.table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    slide_parts.append(" | ".join(cell for cell in cells if cell))
        if slide_parts:
            parts.append(f"[Slide {index}]")
            parts.extend(slide_parts)
    return "\n".join(parts)


def _extract_txt(content: bytes) -> str:
    for encoding in ("utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def extract_text(filename: str, content: bytes, mime_type: str) -> ExtractionResult:
    """Extract and normalize text from an uploaded study material.

    Raises ExtractionError if the format is unsupported or no text is found.
    """
    kind = detect_kind(filename, mime_type)
    if kind == "PDF":
        raw = _extract_pdf(content)
    elif kind == "DOCX":
        raw = _extract_docx(content)
    elif kind == "PPTX":
        raw = _extract_pptx(content)
    elif kind == "TXT":
        raw = _extract_txt(content)
    else:  # pragma: no cover - detect_kind already rejects unknown kinds
        raise ExtractionError(f"Unsupported kind: {kind}")

    text = _normalize(raw)
    if len(text) < 40:
        raise ExtractionError(
            f"No readable text found in {filename!r}. The file may be empty, "
            "password-protected or image-based (no embedded text)."
        )
    return ExtractionResult(
        filename=filename,
        kind=kind,
        text=text,
        token_count=max(1, len(text) // 4),  # rough heuristic; no tiktoken dependency
    )
