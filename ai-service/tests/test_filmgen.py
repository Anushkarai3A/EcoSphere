"""Film direction tests with a mocked LLM."""

from app.schemas.film import FilmRequest
import app.services.filmgen as filmgen


def _request() -> FilmRequest:
    return FilmRequest(
        prompt="How we save water at home and school",
        topic="Saving water",
        duration_seconds=90,
        style="CARTOON_2D",
    )


def test_film_director_returns_per_beat_narrations(monkeypatch) -> None:
    captured: dict[str, str] = {}

    def fake_generate_json(prompt, **kwargs):
        captured["prompt"] = prompt
        return {
            "film": "water",
            "topic": "Saving Water",
            "title": "How We Save Water at Home and School",
            "narrations": [
                "A tap left running wastes water every day.",
                "Turn it off while brushing.",
                "Fix leaks quickly.",
                "Collect rainwater for plants.",
                "Small habits save a river.",
            ],
        }

    monkeypatch.setattr(filmgen, "generate_json", fake_generate_json)

    result = filmgen.direct_film(_request())

    assert result.film == "water"
    assert result.title == "How We Save Water at Home and School"
    assert len(result.narrations) == 5
    assert all(line.strip() for line in result.narrations)
    assert "How we save water at home and school" in captured["prompt"]
