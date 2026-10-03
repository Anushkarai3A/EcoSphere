# Ecosphere — Software Requirements Specification (SRS)

**Version:** 1.0 (Draft)
**Status:** Approved for Architecture Work
**Reference:** PRD v1.0 · Data Model: `docs/DATA_MODEL.md`

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the **Ecosphere** platform: a location-based, gamified environmental education web application. It is the engineering contract that governs design and implementation of the frontend, backend, database, and AI services.

### 1.2 Scope

- Multi-tenant web application (React + TypeScript frontend; Node/Express + Prisma backend; PostgreSQL + PostGIS database; Python/FastAPI AI service).
- Three user roles: **Admin**, **Teacher**, **Student**.
- Core subsystems: Auth, Map & Quests, Submissions & Verification, Gamification, Dashboards, Notifications, Moderation, Audit.

### 1.3 Definitions / Acronyms

| Term | Meaning |
|---|---|
| Quest | Location-based (main) or remote (side) activity |
| Acceptance | A student's record of taking on a quest |
| Submission | Evidence uploaded for a quest, subject to verification |
| Verification | AI + human process that validates evidence |
| XP | Experience points (immutable ledger) |
| PostGIS | PostgreSQL geospatial extension |
| PWA | Progressive Web App |

---

## 2. System Context & Architecture

### 2.1 Logical Architecture

```
                        ┌───────────────────────────────┐
                        │        Clients (Web/PWA)      │
                        │  React · Vite · Tailwind/shadcn │
                        │  Mapbox GL JS · Framer Motion  │
                        └───────────────┬───────────────┘
                                        │ HTTPS / WSS
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
        ┌───────▼────────┐   ┌──────────▼─────────┐   ┌────────▼────────┐
        │   Express API   │   │   Socket.IO GW     │   │  CDN / Storage  │
        │  (REST, JWT)    │   │  (notifications,   │   │   Cloudinary    │
        └───────┬────────┘   │   leaderboard)      │   │  (signed upload)│
                │            └──────────┬─────────┘   └──────────────────┘
                │                       │
        ┌───────▼───────────────────────▼────────────────────────────┐
        │            PostgreSQL (Prisma ORM) + PostGIS               │
        │            spatial index, XP ledger, audit log             │
        └───────────────┬──────────────────────────┬─────────────────┘
                        │                          │
              ┌─────────▼────────┐        ┌────────▼─────────┐
              │   Redis (cache,  │        │   Job Queue      │
              │   queue, sockets)│        │  (BullMQ / Bull) │
              └──────────────────┘        └────────┬─────────┘
                                                   │
                                        ┌──────────▼─────────┐
                                        │   AI Service        │
                                        │  FastAPI · YOLOv8  │
                                        │  OpenCV · Vision    │
                                        └─────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Tech | Responsibility |
|---|---|---|
| **Frontend** | React, TS, Vite, Tailwind, shadcn/ui, Framer Motion | All UI; map interaction; PWA; token handling; optimistic UX |
| **API Gateway / Backend** | Node, Express, TS, Prisma | REST API, auth, RBAC, business logic, validation, geospatial queries, XP ledger, moderation |
| **Realtime** | Socket.IO | Notifications, live class leaderboard, submission status pushes |
| **Database** | PostgreSQL 15+ / PostGIS | Relational + spatial data; migration via Prisma |
| **Cache/Queue** | Redis | Rate limiting, leaderboard cache, session/refresh-token store (optional), job queue broker |
| **Worker (Queue consumer)** | Node (BullMQ) | Processes verification jobs: fetches assets, calls AI service, writes results, applies auto-decisions |
| **AI Service** | Python, FastAPI, YOLOv8, OpenCV | Evidence analysis → `VerificationRun` results (per-check + recommendation) |
| **Object Storage** | Cloudinary | Signed uploads for photos/videos; transforms; CDN delivery |

### 2.3 Deployment Topology (Target)

- Frontend → **Vercel** (static + PWA + edge rewrites to API).
- API + Worker → **Render** (or AWS ECS) containers.
- AI Service → container (CPU initially; GPU worker option).
- PostgreSQL + PostGIS → managed (Neon/Supabase/RDS) or Docker Compose for dev.
- Redis → managed or Docker Compose.
- Docker Compose for local dev: `postgres+postgis`, `redis`, `api`, `worker`, `ai-service`, `frontend`.

---

## 3. Functional Requirements

Each module is expressed as FRs with priority (M=must, S=should, C=could). Acceptance criteria noted where material.

### 3.1 Authentication & Authorization

| ID | Requirement | Priority |
|---|---|---|
| FR-A1 | Register student with email/password; teacher/admin accounts are provisioned by admin (no public self-register for privileged roles) | M |
| FR-A2 | Login issues short-lived access JWT (15 min) and rotating refresh token (httpOnly, secure cookie, 7–30 days) | M |
| FR-A3 | Logout revokes refresh token server-side (Redis deny-list) | M |
| FR-A4 | Role-based access control enforced middleware-level on every route (ADMIN/TEACHER/STUDENT) | M |
| FR-A5 | Password hashing with bcrypt (cost 12) or argon2id | M |
| FR-A6 | Rate-limit auth endpoints (login ≤ 10/min/IP); account lockout after N failures | M |
| FR-A7 | Password reset via time-limited signed token + email (S) | S |
| FR-A8 | Refresh rotation: reuse of an already-rotated token invalidates the session family | M |
| FR-A9 | Teacher registration request → pending; admin approves → teacher account active | M |
| FR-A10 | Profile management: avatar, name, school, grade/class for students | M |

**Acceptance (FR-A2/A8):** no password/session in localStorage; refresh token never readable by JS.

### 3.2 Users, Schools, Classes (Administration)

| ID | Requirement | Priority |
|---|---|---|
| FR-U1 | Admin CRUD for schools; teacher approval queue | M |
| FR-U2 | Teacher creates class groups with a 6-char join code; students join by code | M |
| FR-U3 | Admin can suspend/ban users; suspension blocks all auth immediately | M |
| FR-U4 | Teacher can view students in their class; transfer class ownership | S |
| FR-U5 | Admin manages badge library and XP settings (caps, curves) | M |

### 3.3 Quest Management (Teacher)

| ID | Requirement | Priority |
|---|---|---|
| FR-Q1 | Create/edit/delete main quest: title, description, category, difficulty, XP, location (map pin + drag), radius (m), dates, proof type, min photo count | M |
| FR-Q2 | Create/edit/delete side quest: type, content (quiz/prompt), XP, due date | M |
| FR-Q3 | Publish/unpublish; draft until published | M |
| FR-Q4 | Per-quest AI verification policy (enabled checks, thresholds, auto-resolution) | M |
| FR-Q5 | Scope quest to class(es) or make it public/global | S |
| FR-Q6 | Clone quest (reuse template) | C |
| FR-Q7 | Expired quests automatically close to new acceptances; grace window for in-flight submissions | M |

### 3.4 Map & Discovery (Student)

| ID | Requirement | Priority |
|---|---|---|
| FR-M1 | Mapbox map renders quests near student location; clustering at low zoom | M |
| FR-M2 | GPS permission flow; location permission required to *submit* (not to *browse*) | M |
| FR-M3 | Quest popup/card: distance, XP, difficulty, deadline, proof required | M |
| FR-M4 | Filters: category, difficulty, reward range, deadline, my quests | S |
| FR-M5 | Search by title/teacher/school | S |
| FR-M6 | Map works without accurate GPS (manual "choose on map" fallback) | S |

### 3.5 Acceptance & Submission (Student)

| ID | Requirement | Priority |
|---|---|---|
| FR-S1 | Student accepts an ACTIVE quest (one acceptance per student per quest) | M |
| FR-S2 | Upload evidence (photos/video) with device GPS and timestamp captured at upload time | M |
| FR-S3 | Server validates: quest ACTIVE, within grace window, GPS within radius (PostGIS), min proof count, file type/size | M |
| FR-S4 | Submission transitions through verification states (see 3.6) | M |
| FR-S5 | Student sees submission status live and per-check AI breakdown after review | M |
| FR-S6 | Rejected submission: teacher reason visible; optional re-submission within window | M |
| FR-S7 | Quiz side-quests answered in-app; auto-graded; XP on pass threshold | M |
| FR-S8 | Submission limit + cooldown to prevent spam | M |

### 3.6 AI Verification

| ID | Requirement | Priority |
|---|---|---|
| FR-V1 | On submission, enqueue async verification job (fire-and-forget from API; status = PENDING_VERIFICATION) | M |
| FR-V2 | Worker pulls job → downloads assets from Cloudinary → calls AI service | M |
| FR-V3 | AI returns per-check results (see PRD §6.2) + overall recommendation + confidence | M |
| FR-V4 | Results persisted as `VerificationRun` + `VerificationCheck` rows | M |
| FR-V5 | If auto-resolution enabled and confidence ≥ threshold → auto-approve/auto-reject; else NEEDS_MANUAL_REVIEW → teacher queue | M |
| FR-V6 | AI service outage → graceful fallback: submission stays PENDING_MANUAL_REVIEW; teacher alerted | M |
| FR-V7 | Retry with exponential backoff for transient AI failures (≤ 3 attempts) | M |
| FR-V8 | Idempotent job processing (no duplicate VerificationRuns) | M |
| FR-V9 | Perceptual-hash duplicate detection against existing approved assets | M |

### 3.7 Teacher Review

| ID | Requirement | Priority |
|---|---|---|
| FR-R1 | Review queue with AI recommendation summary + per-check breakdown | M |
| FR-R2 | Approve (award XP) / Reject (reason + optional re-submission grant) | M |
| FR-R3 | Award bonus XP (bounded by admin caps), with note | M |
| FR-R4 | Batch review (approve multiple clean submissions) | S |
| FR-R5 | Review SLA: pending submissions older than N days flagged to teacher | S |

### 3.8 Gamification

| ID | Requirement | Priority |
|---|---|---|
| FR-G1 | XP awarded exclusively via `XpTransaction` insert inside the same DB transaction that approves the submission (atomic, no double-award) | M |
| FR-G2 | Level derived from cumulative XP (configurable curve) | M |
| FR-G3 | Badge engine evaluates rules on XP/quest/streak events; awards atomically; duplicates prevented | M |
| FR-G4 | Streak tracking: ≥1 activity/day keeps streak; resets on miss (configurable grace) | M |
| FR-G5 | Leaderboards (class/school; week/all-time) computed from XP ledger, cached in Redis (TTL 60 s), realtime push on top-10 change | M |
| FR-G6 | Level-up / badge / XP notifications delivered in-app + socket | M |
| FR-G7 | Admin adjusts XP manually with mandatory note (audited) | S |

### 3.9 Notifications

| ID | Requirement | Priority |
|---|---|---|
| FR-N1 | In-app notification feed per user | M |
| FR-N2 | Socket.IO push for: review result, badge/level-up, XP, quest near expiry, new quest in class | M |
| FR-N3 | Notification dedup and pagination | M |
| FR-N4 | Email for critical events (approval needed, review overdue, password reset) | S |

### 3.10 Dashboards & Analytics

| ID | Requirement | Priority |
|---|---|---|
| FR-D1 | Admin dashboard: platform KPIs (users, quests, submissions, approval rates, fraud rate), time-series charts | M |
| FR-D2 | Teacher dashboard: per-class completion, acceptance→approval funnel, verification wait time, top students | M |
| FR-D3 | Student dashboard: XP, level progress, badges, streak, quest history, leaderboard rank | M |
| FR-D4 | All metrics read from XP ledger + submissions (no separate counter duplication) | M |
| FR-D5 | CSV export (admin) | C |

### 3.11 Moderation & Audit

| ID | Requirement | Priority |
|---|---|---|
| FR-AUD1 | Immutable audit log: auth events, admin actions, review decisions, XP adjustments, quest mutations | M |
| FR-AUD2 | Admin can report/flag quests; flag → auto-hide + notification to teacher | M |
| FR-AUD3 | Audit entries append-only; cannot be edited/deleted by users | M |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-P1 | Read APIs p95 ≤ 300 ms (excluding external calls) |
| NFR-P2 | Map initial load ≤ 2 s on broadband; quest markers ≤ 2,500 near viewport (server-clustered/region-limited) |
| NFR-P3 | Submission API acknowledges in < 1 s (verification is async) |
| NFR-P4 | Leaderboard reads served from Redis; DB hit only on cache miss |
| NFR-P5 | Image uploads ≤ 15 MB (photo), video ≤ 100 MB / ≤ 2 min; server-side validation |

### 4.2 Scalability

| ID | Requirement |
|---|---|
| NFR-S1 | API horizontally scalable (stateless; sessions/queues externalized to Redis) |
| NFR-S2 | PostGIS GIST index on quest `location`; index on `endsAt`, `status`, `(classGroupId, status)` |
| NFR-S3 | Verification jobs decoupled via queue → worker fleet can scale independently |
| NFR-S4 | Perceptual-hash lookup via indexed `hamming` bit operations (pgvector option later) |
| NFR-S5 | Support 10k concurrent online students at pilot scale (architecture-ready for more) |

### 4.3 Security

| ID | Requirement |
|---|---|
| NFR-SEC1 | HTTPS everywhere; HSTS; secure cookies |
| NFR-SEC2 | JWT access + rotating refresh; refresh in httpOnly Secure SameSite=Lax cookie; family invalidation on reuse |
| NFR-SEC3 | bcrypt/argon2 password hashing; no plaintext storage |
| NFR-SEC4 | Zod validation on every request body/query/params; centralized error mapper |
| NFR-SEC5 | RBAC middleware; never trust client role claims — read from DB token payload issued at login |
| NFR-SEC6 | Server-side geospatial enforcement (client GPS never trusted alone) |
| NFR-SEC7 | Rate limiting (Redis sliding window) on all endpoints, stricter on auth/upload |
| NFR-SEC8 | Cloudinary signed uploads with expiring signature; content-type & size allowlists; no direct anonymous upload |
| NFR-SEC9 | Secrets in env / secret manager; never in repo; `.env.example` committed only |
| NFR-SEC10 | SQL injection prevented via Prisma parameterized queries; XSS via CSP + React escaping; CSRF mitigated (SameSite + double-submit for cookies) |
| NFR-SEC11 | Dependency scanning + secret scanning in CI; audit log tamper-evident (append-only, hashed chain optional) |

### 4.4 Privacy

| ID | Requirement |
|---|---|
| NFR-PRI1 | Location data collected only when required for quests; stored geospatially; no continuous background tracking |
| NFR-PRI2 | Parental/institutional consent flag per student; platform config flag for region (GDPR-K/COPPA) |
| NFR-PRI3 | Right to delete: admin/user can erase account + PII (soft-delete audit trail retained, anonymized) |
| NFR-PRI4 | Data minimization: EXIF retained only as verification signal; policy to strip after verification window (configurable) |

### 4.5 Accessibility (WCAG 2.1 AA)

| ID | Requirement |
|---|---|
| NFR-ACC1 | Full keyboard operability including map controls (focus traps, arrow-key pan) |
| NFR-ACC2 | Color contrast ≥ 4.5:1 in both themes; not color-only semantics |
| NFR-ACC3 | ARIA labels for map, quest cards, toasts, modals; `prefers-reduced-motion` respected (Framer Motion guard) |
| NFR-ACC4 | Focus management for dialogs/toasts; screen-reader announcements for XP/badge events |

### 4.6 Reliability & Observability

| ID | Requirement |
|---|---|
| NFR-OBS1 | Structured JSON logs (pino) with request IDs; trace correlation with AI service |
| NFR-OBS2 | Health endpoints: `/health` (API), `/healthz` (readiness), AI `/health` |
| NFR-OBS3 | Error tracking (Sentry) on frontend + backend + worker |
| NFR-OBS4 | Metrics: request rate/latency/errors, queue depth, AI p95, XP transaction rate |
| NFR-OBS5 | Graceful degradation matrix (see §8) |

---

## 5. Data Model (Reference)

Detailed schema, PostGIS types, indexes, and constraints: **`docs/DATA_MODEL.md`**.

High-level entities:

```
User ─┬─ TeacherProfile ── School
      ├─ StudentProfile ── School, ClassGroup, Enrollment
      ├─ XpTransaction ── UserBadge ── Badge
      ├─ Notification
      └─ AuditLog

Quest ── AiVerificationPolicy
QuestAcceptance ── Quest | SideQuest ── (QuizAttempt)
   └─ QuestSubmission ── EvidenceAsset
        └─ VerificationRun ── VerificationCheck

XpSetting (admin config) · LevelCurve (config)
```

Consistency rules:
- `XpTransaction.balanceAfter` = running total; recomputed column never trusted for rewards (rewards compute from delta).
- `(studentId, questId)` and `(studentId, sideQuestId)` unique — single acceptance.
- XP award and submission approval share a DB transaction.

---

## 6. API Contract (Inventory)

Base path: `/api/v1`. Auth: `Authorization: Bearer <accessJWT>` unless noted. Full OpenAPI spec generated at implementation time.

### 6.1 Auth
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public | Student registration |
| POST | `/auth/register/teacher` | public | Teacher registration request |
| POST | `/auth/login` | public | Login → access + refresh cookie |
| POST | `/auth/refresh` | public (cookie) | Rotate refresh token |
| POST | `/auth/logout` | any | Revoke refresh token |
| POST | `/auth/forgot-password` | public | Send reset link |
| POST | `/auth/reset-password` | public | Reset w/ token |

### 6.2 Users & Admin
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/users/me` | any | Own profile |
| PATCH | `/users/me` | any | Update profile/avatar |
| GET | `/admin/users` | ADMIN | List users (filters/pagination) |
| POST | `/admin/users/:id/approve` | ADMIN | Approve teacher |
| POST | `/admin/users/:id/suspend` | ADMIN | Suspend/ban user |
| POST | `/admin/users/:id/xp` | ADMIN | Manual XP adjustment (note required) |
| GET | `/admin/audit` | ADMIN | Audit log |
| GET | `/admin/xp-settings` | ADMIN | Read XP config |
| PATCH | `/admin/xp-settings` | ADMIN | Update XP config |
| GET/POST/PATCH/DELETE | `/admin/badges` | ADMIN | Badge CRUD |
| GET/POST/PATCH/DELETE | `/admin/schools` | ADMIN | School CRUD |

### 6.3 Schools / Classes
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/classes` | TEACHER | Create class + join code |
| GET | `/classes/mine` | TEACHER | My classes |
| POST | `/classes/:id/join` | STUDENT | Join by code |
| GET | `/classes/:id` | TEACHER/STUDENT(member) | Class detail |
| DELETE | `/classes/:id` | TEACHER | Archive class |

### 6.4 Quests
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/quests` | STUDENT | Map quests near point (bbox/radius + filters) |
| GET | `/quests/:id` | STUDENT | Quest detail |
| POST | `/quests` | TEACHER | Create main quest |
| GET | `/quests/mine` | TEACHER | Teacher's quests |
| PATCH | `/quests/:id` | TEACHER | Update draft quest |
| DELETE | `/quests/:id` | TEACHER | Archive |
| POST | `/quests/:id/publish` | TEACHER | Publish |
| POST | `/quests/:id/cancel` | TEACHER/ADMIN | Cancel |
| POST | `/side-quests` | TEACHER | Create side quest |
| PATCH/DELETE | `/side-quests/:id` | TEACHER | Update/delete |
| POST | `/quests/:id/clone` | TEACHER | Clone (C) |

### 6.5 Acceptance / Submission / Review
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/quests/:id/accept` | STUDENT | Accept quest |
| GET | `/quests/accepted` | STUDENT | My acceptances |
| POST | `/acceptances/:id/submit` | STUDENT | Upload evidence + GPS |
| GET | `/submissions/:id` | STUDENT(owner)/TEACHER | Submission + verification detail |
| GET | `/review/queue` | TEACHER | Submissions pending review |
| POST | `/submissions/:id/review` | TEACHER | Approve/reject + bonus |
| POST | `/side-quests/:id/attempts` | STUDENT | Submit quiz/artifact |

### 6.6 Gamification
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/me/xp` | STUDENT | XP balance, history, level curve |
| GET | `/me/badges` | STUDENT | Earned badges |
| GET | `/leaderboards` | STUDENT | Class/school/week/all-time |
| GET | `/me/streak` | STUDENT | Streak info |

### 6.7 Notifications
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/notifications` | any | Feed (paged) |
| PATCH | `/notifications/:id/read` | any | Mark read |
| PATCH | `/notifications/read-all` | any | Mark all read |

### 6.8 Analytics
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/admin/analytics` | ADMIN | Platform KPIs + series |
| GET | `/classes/:id/analytics` | TEACHER | Class analytics |
| GET | `/me/stats` | STUDENT | Personal stats |

### 6.9 Uploads
| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/uploads/sign` | STUDENT | Signed Cloudinary upload URL (scoped to a pending submission) |

---

## 7. Verification Pipeline Contract

AI Service endpoints (internal, between worker and AI service):

| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/v1/verify/submission` | Analyze evidence bundle → `VerificationRun` result |
| GET | `/ai/v1/health` | Liveness |

Request (worker → AI):
```json
{
  "submissionId": "uuid",
  "quest": { "category": "TREE_PLANTATION", "requiredProofType": "PHOTO" },
  "device": { "latitude": 12.9716, "longitude": 77.5946, "accuracyMeters": 8 },
  "submittedAt": "2026-08-06T10:00:00Z",
  "policy": { "checks": ["GPS_PROXIMITY","TIMESTAMP","EXIF","DUPLICATE","OBJECT_DETECTION","SCENE"], "thresholds": {} },
  "assets": [ { "publicId": "...", "url": "https://...", "type": "IMAGE" } ]
}
```

Response:
```json
{
  "overallRecommendation": "APPROVE | REJECT | NEEDS_MANUAL_REVIEW",
  "overallConfidence": 0.94,
  "fraudRisk": "LOW",
  "summary": "Objects detected: tree_sapling(0.91). GPS within radius.",
  "checks": [
    { "checkType": "GPS_PROXIMITY", "status": "PASS", "score": 12.3, "confidence": 0.99, "message": "distance=11m, radius=50m", "details": { "distanceMeters": 11 } },
    { "checkType": "OBJECT_DETECTION", "status": "PASS", "score": 0.91, "confidence": 0.95, "message": "tree_sapling 0.91, shovel 0.62", "details": { "detections": [] } }
  ]
}
```

### 7.1 Auto-resolution policy
| Policy config | Behavior |
|---|---|
| `autoApproveEnabled` + confidence ≥ threshold | AUTO_APPROVED |
| `autoRejectEnabled` + definitive fraud (dup hash match, far GPS) + high confidence | AUTO_REJECTED (with audit + notification) |
| Otherwise | NEEDS_MANUAL_REVIEW |

All outcomes visible to teacher; teacher decision overrides AI.

---

## 8. Graceful Degradation Matrix

| Failure | Degraded Behavior |
|---|---|
| AI service down | Submissions go to manual review queue; teacher notified; no blocking of student upload |
| Cloudinary down | Upload API returns 503 w/ retry hint; submission retained as draft |
| Redis down | Rate limiting off (warn), leaderboard from DB direct, refresh-token deny-list degraded (shorten access TTL) |
| PostGIS query heavy | Bounded radius queries + indexes; region-limited clustering |
| Socket.IO down | Poll fallback for notification badge counts |

---

## 9. Error Handling Conventions

- Centralized error middleware: `AppError(statusCode, code, message, details)`.
- Validation errors: `422 VALIDATION_ERROR` with field map (Zod).
- Auth: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 CONFLICT` (duplicate acceptance).
- Geo errors: `409 GPS_OUT_OF_RADIUS`, `409 QUEST_NOT_ACTIVE`, `409 SUBMISSION_WINDOW_CLOSED`.
- `429 RATE_LIMITED` with `Retry-After`.
- Error envelope: `{ "error": { "code": "...", "message": "...", "details": {...} } }`.
- Every error logged with request ID; no stack traces to clients.

---

## 10. Testing Strategy

| Layer | Approach | Tools |
|---|---|---|
| Unit | Service/repository logic, XP math, badge rules, geo helpers | Vitest |
| Integration | API against test Postgres (testcontainers or compose) + Redis | Vitest + Supertest |
| AI service | Golden dataset of synthetic evidence (PASS/FAIL/MIXED) | pytest |
| E2E | Critical journeys: register→quest→submit→verify→review→XP | Playwright |
| Perf | Load test auth + map + leaderboard | k6 |
| Security | Auth bypass, GPS spoof simulation, duplicate upload | manual + CI SAST |

CI (GitHub Actions): typecheck → lint → unit → integration → build images → (staging deploy on main).

---

## 11. Milestone Mapping

M2 Auth+Core → §3.1–3.2 · M3 Map+Quests → §3.3–3.4 · M4 Submission+AI → §3.5–3.7 · M5 Gamification → §3.8–3.9 · M6 Dashboards+Ops → §3.10–3.11, §4.6.
