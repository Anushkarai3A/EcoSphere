# Ecosphere

Location-based, gamified environmental education platform — a *Pokémon GO*-style
experience where students travel to real-world quests (tree plantation, waste
collection, park cleaning, biodiversity documentation) created by teachers, upload
geotagged evidence, and earn XP/badges after an AI + teacher verification pass.

**Docs:** [PRD](docs/PRD.md) · [SRS](docs/SRS.md) · [Data Model](docs/DATA_MODEL.md) · [Master Prompt](AI_Master_Prompt.md)

---

## Monorepo layout

```
├── frontend/          # React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui
├── backend/           # Express 5 + TypeScript + Prisma (API + BullMQ worker)
├── ai-service/        # FastAPI verification pipeline (YOLOv8/OpenCV, stubbed)
├── database/          # Prisma schema + migrations + PostGIS init SQL
├── docs/              # PRD, SRS, data model, future API specs
├── docker-compose.yml # Full local stack: postgis, redis, api, worker, ai, web
└── tsconfig.base.json # Shared TypeScript strictness
```

`npm` workspaces manage `frontend` and `backend`; the Python service uses its own venv.

## Prerequisites

- Node.js ≥ 20 (developed on 24)
- Docker Desktop (for the PostGIS/Redis/local stack)
- Python 3.10+ (for the AI service)

## Quick start (local dev, no Docker)

```bash
cp .env.example .env            # backend needs DATABASE_URL etc. in repo-root .env
npm install
npm run dev                     # API :4000 + worker + web :5173 (concurrently)
```

For the AI service:

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows; `source .venv/bin/activate` on macOS/Linux
uvicorn app.main:app --reload --port 8000
```

You still need a Postgres+PostGIS instance. The easiest path is:

```bash
docker compose up db redis    # then: npm run prisma:migrate
```

### First-time database setup

```bash
npm run prisma:migrate        # creates + migrates the schema (needs a running PostGIS DB)
npm run prisma:generate       # regenerate the client after schema changes
npm run prisma:studio         # inspect data
```

**Important:** after generating the initial migration, edit the migration SQL to add
`CREATE EXTENSION IF NOT EXISTS postgis;` at the top, add `NOT NULL` to the geometry
columns, and add the GIST spatial indexes (see `database/prisma/schema.prisma` header
and `docs/DATA_MODEL.md` §4).

## Full stack with Docker Compose

```bash
docker compose up --build     # web :8080, api :4000, ai :8000, db :5433, redis :6379
```

The database is published on host port `5433` so it does not collide with a
locally installed PostgreSQL service; containers still use `db:5432` internally.
Compose applies migrations automatically (`migrate deploy`) before the API boots.
Override dev secrets via a `.env` next to `docker-compose.yml`.

## Environment variables

See `.env.example`. Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres + PostGIS connection string |
| `REDIS_URL` | Job queue + cache + sockets adapter |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing keys (min 16 chars; generate 64-hex) |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `AI_SERVICE_URL` | Internal endpoint of the FastAPI service |
| `CLOUDINARY_*` | Evidence uploads (M4) |

The map runs on MapLibre GL JS with a free OpenStreetMap-based style (OpenFreeMap liberty), free Mapzen 3D terrain, and OpenStreetMap Nominatim search — no API key or billing required, and no `VITE_MAPBOX_TOKEN`.

## Workspace scripts

| Command | Description |
|---|---|
| `npm run dev` | API + worker + web concurrently |
| `npm run build` | TypeScript + Vite production builds |
| `npm run typecheck` | Strict typecheck for both TS workspaces |
| `npm run prisma:*` | Generate / migrate / deploy / studio |
| `ai:install` / `ai:dev` | Python service helpers |

## Testing

- Backend/Frontend: Vitest + Playwright (added per milestone; see `docs/SRS.md` §10)
- AI service: `cd ai-service && .venv\Scripts\python -m pytest -q`

## Roadmap

| Phase | Scope |
|---|---|
| M1 (done) | Docs, monorepo, DB schema, tooling, CI-ready skeleton |
| M2 | Auth (JWT + refresh rotation), roles, profile, admin user mgmt |
| M3 | MapLibre map, quest CRUD + lifecycle, GPS proximity |
| M4 | Evidence upload, AI verification pipeline, teacher review |
| M5 | XP ledger, badges, levels, leaderboards, notifications |
| M6 | Dashboards, analytics, moderation, observability |
| M7 | Accessibility, hardening, beta pilot |
