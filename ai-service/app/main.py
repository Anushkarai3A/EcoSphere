import logging

from fastapi import FastAPI

from app.api.routes import extract, generate, health, verify, animate, film, tts
from app.core.config import settings

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

app = FastAPI(title=settings.app_name, version=settings.version)

app.include_router(health.router)
app.include_router(verify.router)
app.include_router(extract.router)
app.include_router(generate.router)
app.include_router(animate.router)
app.include_router(film.router)
app.include_router(tts.router)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "version": settings.version, "docs": "/docs"}
