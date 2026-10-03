# Ecosphere v2 — Roadmap & Production Plan

Everything below builds on the existing monorepo conventions (`pnpm` workspaces, Turborepo,
shared `packages`, backend Fastify routes/validators, React/Vite frontend, ai-service
FastAPI). Migration is **incremental** — nothing is rewritten wholesale; each feature lands
behind its route files and feature flags.

---

## 1. Execution Order (each phase shippable + demoable)

### Phase 0 — Foundations (1 sprint)
- Prisma schema: `Assignment`, `AssignmentSubmission`, `AssignmentMaterial`,
  `AiGenerationRun`, `AnimationProject`, `AnimationScene`, `Recommendation`,
  `SustainabilityActivity`, `MlModel`, `Event` (+ status/enum updates; backfill/migration).
- AI gateway skeleton in ai-service (`/generate/*`, `/extract`) with shared-secret auth.
- LLM provider abstraction (`core/llm.py`), BullMQ job wiring (`quiz-generate`,
  `animation-render`, `ml-train`).
- **Exit criteria:** `/health`, `/verify` still green; migration applies clean; gateway
  auth tested.

### Phase 1 — Assignments (2 sprints)
- Teacher CRUD + publish/unpublish + materials (upload service) + grading queue.
- Student view/submit + grade reveal + XP integration (`XpSource.ASSIGNMENT_GRADE`).
- Notifications (`assignment.published/graded`).
- **Exit criteria:** teacher can assign, student submits, grade awards XP, badges fire.

### Phase 2 — AI Quiz Generation (2–3 sprints)
- Extraction (`/extract`), structured quiz gen (`/generate/quiz`), Zod validation, review
  grid (approve/reject/edit), publish, regenerate.
- Student quiz player (timer + auto-save) + per-question analytics.
- **Exit criteria:** end-to-end generate→review→publish→attempt→analytics on real material.

### Phase 3 — Animation Studio (2–3 sprints)
- Script chat (SSE streaming), storyboard + scene editor, duration guard (≤90s).
- Render job (ai-service ffmpeg), MP4/GIF/HTML export, preview player.
- Community (like/feedback/feature) + teacher review + XP on approval.
- **Exit criteria:** student generates + renders an animation; teacher approves; XP awarded.

### Phase 4 — Learning Modules (1–2 sprints)
- Module builder (TEACHER), lesson blocks incl. linked quiz/assignment/animation/activity.
- Student reader + progress tracking.
- **Exit criteria:** a module composed of existing features runs as a lesson path.

### Phase 5 — Gamification v2 (1–2 sprints)
- Level + title derivation, leaderboards (Redis-cached, scope filters), events manager.
- New badges + sustainability score + activity logging + impact report.
- **Exit criteria:** leaderboards update live; seasonal event joinable; impact report valid.

### Phase 6 — Adaptive + ML (2–3 sprints)
- `StudentFeatureSnapshot` aggregation jobs (nightly/hourly).
- Declarative rule engine (`adaptive.service.ts`) + feed UI (dismiss/click tracking).
- `ml.py` training/eval/importance/predict; model metadata in `MlModel`; teacher risk flags.
- **Exit criteria:** models train, metrics + importance charts render, risk flags surfaced.

### Phase 7 — Dashboards & Hardening (1–2 sprints)
- Student/Teacher/Admin analytics overviews + CSV export.
- Performance (query tuning, caching), rate limits, cost guardrails, a11y, mobile QA.
- **Exit criteria:** all dashboards render from real data; load test passes.

---

## 2. Testing Strategy

| Layer | Approach |
|---|---|
| Backend | Vitest + Supertest on route/validator contracts; Prisma test DB |
| ai-service | Pytest (FastAPI TestClient) with mocked LLM provider; schema validation tests |
| Rules engine | Unit tests over synthetic feature vectors (deterministic) |
| ML | train on small fixture set; assert metric shapes + importance keys; parity check with live data |
| e2e | Playwright: assignment flow, quiz generate→attempt, animation render→preview, module progress |
| Seed data | `pnpm seed` includes demo assignment/quiz/animation/module so dashboards are populated |

CI runs backend, frontend, ai-service test suites + `pnpm typecheck` in parallel. The ML
retrain is a scheduled job with a **smoke test** (train on 200-row fixture in CI).

---

## 3. Data & State Notes

- **AiGenerationRun** is the audit trail: kind, input snapshot, output JSON, status,
  `requestedBy`, timestamps, optional `editHistory` (teacher diffs).
- **MlModel** stores version, modelKind, taskKind, metrics JSON, artifact path, `isActive`.
- **XP integrity:** only the gamification service writes `XpTransaction`; everything else
  calls it. Level/title are derived — no stored counter to drift.
- **Queues:** BullMQ (Redis) with named jobs and DLQ handling; AI calls are idempotent by
  `runId`.

---

## 4. Deployment / Production

- **Backend & worker:** existing container; add the BullMQ worker process
  (`pnpm worker`) so API pods stay responsive.
- **ai-service:** new Dockerfile (adds ffmpeg + scikit-learn). GPU/API-key envs via secrets.
- **Env additions:** `AI_SERVICE_TOKEN`, `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL_*`,
  `ANIMATION_MAX_SECONDS=90`, `ANIMATION_IMAGE_GEN=off|on`, `RENDER_*` limits.
- **Storage:** existing object storage for materials/exports; artifact bucket for models
  + renders (expiry for gif/mp4).
- **Migration:** `prisma migrate deploy` before rollout; backfill script for enum additions
  (`XpSource.ASSIGNMENT_GRADE`, etc.).
- **Observability:** log `AiGenerationRun` errors + LLM latency/cost metrics; alert on
  queue depth (BullMQ), render failures, and ML drift (accuracy < threshold).

---

## 5. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| LLM latency/cost | async BullMQ jobs, streaming UI, per-user rate limits, cheap-model tiering |
| Hallucinated quiz content | teacher review gate (no auto-publish), Zod validation, moderation pass |
| Render cost on image gen | feature-flag off by default; animated-card fallback; per-user quota |
| ML overfit / stale | versioned models, retrain schedule, only active-model serving, drift alerts |
| XP economy inflation | ledger-audited awarding, reward caps, unit tests on level curve |
| Migration complexity | additive schema changes only; fixtures + CI migrations; staged rollout |
