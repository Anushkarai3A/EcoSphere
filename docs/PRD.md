# Ecosphere — Product Requirements Document (PRD)

**Version:** 1.0 (Draft)
**Status:** Approved for Architecture Work
**Owner:** Product / Engineering (shared)
**Last Updated:** 2026-08-06

---

## 1. Product Overview

### 1.1 Problem Statement

Traditional environmental education is theoretical, classroom-bound, and fails to translate awareness into action. Students memorize concepts but rarely participate in real environmental work. When practical activities do exist, they are uncoordinated, unverifiable, and impossible to scale or gamify.

### 1.2 Solution

**Ecosphere** is a location-based, gamified environmental education platform inspired by *Pokémon GO*. Teachers create real-world environmental quests (tree plantation, waste collection, park cleaning, recycling drives, biodiversity documentation, awareness campaigns) and pin them to a live map. Students physically travel to the location, complete the activity, and upload **geotagged evidence**. An AI verification pipeline + teacher review confirm authenticity before **XP** is awarded.

### 1.3 Target Users

| Segment | Description |
|---|---|
| **Primary (Students)** | School/college students, age 12+, who complete quests, gain XP, earn badges, climb leaderboards. |
| **Secondary (Teachers)** | Teachers and educators who author quests, review submissions, monitor class progress. |
| **Tertiary (Admins / Institutions)** | Platform administrators and school leadership who onboard schools, moderate content, and view analytics. |

### 1.4 Value Proposition

- **Immersive:** Real-world play space; learning happens outside the classroom.
- **Verifiable:** AI + teacher review ensures evidence authenticity, preventing fraud.
- **Competitive:** XP, levels, badges, and leaderboards drive engagement.
- **Scalable:** One platform, many schools; quests can be shared across institutions.

---

## 2. Goals & Non-Goals

### 2.1 Goals (This Release)

1. Role-based platform (Admin, Teacher, Student) with secure JWT auth.
2. Interactive Mapbox map showing quests near the student, with GPS-based proximity.
3. Teacher quest authoring (main + side quests) with full lifecycle management.
4. Student quest acceptance, evidence upload (geotagged), and submission.
5. AI verification pipeline producing **Approve / Reject / Needs Manual Review** recommendations.
6. Teacher final decision with optional bonus XP.
7. Gamification: XP, levels, badges, streaks, and leaderboards.
8. Dashboards: Admin (platform), Teacher (class), Student (personal).
9. Dark mode, responsive design, WCAG 2.1 AA accessibility.
10. Production-grade architecture: Docker, CI/CD, observability.

### 2.2 Non-Goals (This Release)

- Native mobile apps (responsive PWA-first web app).
- In-app chat between students (replaced by notifications).
- Payments/subscriptions (institutional licensing only).
- Autonomous AI auto-approval without teacher override (AI recommends only).
- Offline-first gameplay (requires connectivity for upload/verification).
- Live multi-player quests (turn-based/concurrent participation only).

---

## 3. Personas

### 3.1 Ananya, Student (15)

Explores quests on the map after school. Wants streaks, badges, and to beat her class leaderboard. Concerned her uploads "count" and don't get wrongly rejected. **Needs:** nearby quests, clear instructions, quick evidence upload, instant feedback, fair review.

### 3.2 Mr. Rao, Teacher (Biology, Grade 9)

Assigns a tree-plantation drive at a nearby park. Wants to verify students actually went there, not just submitted stock photos. Needs to approve 30+ submissions efficiently. **Needs:** simple quest authoring, map pinning, batch review with AI recommendations, class analytics.

### 3.3 Principal Mehta, Admin

Onboards her school, approves teachers, monitors platform health and engagement, moderates bad quests. **Needs:** dashboards, approval queues, user management, analytics.

---

## 4. Functional Scope

### 4.1 Feature Priorities (MoSCoW)

| Must Have (M) | Should Have (S) | Could Have (C) | Won't Have (W) |
|---|---|---|---|
| Role-based auth (JWT + refresh) | Email notifications | Social quests (group submissions) | Native apps |
| Interactive map + GPS proximity | In-app notifications | Quest templates library | Real-time chat |
| Quest authoring (main + side) | Streaks | Import from CSV | Payments |
| Quest lifecycle & expiration | School/class management | Weekly digest emails | Peer review |
| Evidence upload (photo/video) | Search & filters | Data export (admin) | Marketplace |
| AI verification pipeline | Quiz side-quests | Seasonal events | OAuth SSO v1 |
| Teacher review + bonus XP | Badge library admin | Shared quests across schools | |
| XP / levels / leaderboards | Dark mode | | |
| Admin dashboard & moderation | Accessibility pass | | |
| Audit logging | Redis caching | | |

---

## 5. Quest System Specification

### 5.1 Quest Types

#### 5.1.1 Main Quests (Physical Presence Required)

| Attribute | Description |
|---|---|
| Location | Map-pinned `POINT` + radius (e.g. 50 m around pin) |
| Radius check | Student must be within radius at **submission** time; enforced server-side via PostGIS |
| Deadline | `startsAt` / `endsAt`; quest expires and closes to submissions |
| XP reward | Configured by teacher; bounded by admin `XpSetting` limits |
| Difficulty | EASY / MEDIUM / HARD / EXPERT (affects XP band & badge weighting) |
| Required proof | PHOTO, VIDEO, or PHOTO_AND_VIDEO; minimum photo count configurable |
| AI verification | Per-quest policy (which checks run, confidence thresholds) |

**Categories:** TREE_PLANTATION, WASTE_COLLECTION, PARK_CLEANING, RECYCLING, BIODIVERSITY, AWARENESS, OTHER.

#### 5.1.2 Side Quests (Remote)

| Attribute | Description |
|---|---|
| Type | QUIZ, ESSAY, POSTER, PRESENTATION, VIDEO, ANIMATION, RESEARCH |
| Content | JSON payload (quiz questions, prompt text, resources) |
| Due date | Optional |
| XP reward | Configured; typically lower than main quests |
| Verification | Manual teacher review (no GPS requirement) |

### 5.2 Quest Lifecycle

```
DRAFT ──(publish)──▶ PUBLISHED ──(startsAt)──▶ ACTIVE ──(endsAt)──▶ EXPIRED
   │                      │                                            │
   │                      ├──(cancel)─────────▶ CANCELLED              │
   │                      └──(maxParticipants hit)─▶ ACTIVE (locked)   │
   └──(delete)──▶ ARCHIVED
```

- **DRAFT:** teacher editing, invisible to students.
- **PUBLISHED:** scheduled, visible on map, not yet accepting submissions.
- **ACTIVE:** accepting acceptances and submissions.
- **EXPIRED:** no new acceptances; submissions in-flight still processable until a grace window.
- **CANCELLED:** teacher or admin cancelled.
- **ARCHIVED:** soft-deleted.

### 5.3 Quest Acceptance & Submission Flow

```
Student taps quest ──▶ Check: quest ACTIVE (accept is allowed from anywhere; proximity enforced at submission)
   │
   ├─▶ Accept quest ──▶ Acceptance status = ACCEPTED
   │
   ├─▶ (in real world) Complete activity ──▶ Submit evidence
   │       Evidence = photo(s)/video with device GPS captured at upload time
   │       Server enforces: deviceGPS within quest radius, timestamp within active window
   │
   ├─▶ AI Verification (async) ──▶ Recommendation: APPROVE / REJECT / NEEDS_MANUAL_REVIEW
   │
   ├─▶ Teacher review ──▶ APPROVED (XP + possible bonus) or REJECTED (reason, optional re-submission)
   │
   └─▶ Student notified; XP transaction recorded; badge checks evaluated
```

**Design decision:** *Acceptance is allowed from anywhere*; **proximity is enforced at submission**, not acceptance. Rationale: students may browse and plan quests at home, but physical presence is required to earn XP. This is the fraud-critical control point and is enforced server-side (never trusted from client).

---

## 6. AI Verification Pipeline (Product Spec)

### 6.1 Objective

Produce a **recommendation** (`APPROVE` / `REJECT` / `NEEDS_MANUAL_REVIEW`) with a confidence score, so teachers review faster and fraud is caught. The teacher retains **final authority** — the AI never auto-rejects without review by default (configurable per-quest policy).

### 6.2 Evidence Checks

| Check | Purpose | Data Source |
|---|---|---|
| **GPS proximity** | Student location matches quest location | Device GPS at upload + PostGIS `ST_Distance` |
| **Timestamp freshness** | Evidence time within active window / submission window | Server time + EXIF + device timestamp |
| **EXIF metadata** | Validate camera metadata integrity | EXIF (images); stripped → flagged |
| **EXIF GPS consistency** | EXIF GPS vs submitted GPS | EXIF ↔ device GPS diff |
| **Image similarity** | Reuse of same image across submissions | Perceptual hash + embedding cosine similarity |
| **Object detection** | Expected objects present (e.g. sapling, waste bags) | YOLOv8 detections |
| **Scene classification** | Evidence scene matches quest category (park/street/classroom) | Scene classifier |
| **Duplicate detection** | Same image re-uploaded by same/different user | Perceptual hash index |
| **Image quality** | Blur / darkness / resolution floors | OpenCV metrics (Laplacian variance, Luma) |
| **Device spoofing (basic)** | Unusual GPS accuracy / mock location hints | Client + server heuristics |

### 6.3 Recommendation Rules

| Risk Signal | Recommendation |
|---|---|
| All critical checks PASS, confidence ≥ threshold | `APPROVE` |
| Definitive fraud (duplicate hash match, GPS far outside radius, stock-photo scene) | `REJECT` (high confidence) |
| Mixed / borderline signals | `NEEDS_MANUAL_REVIEW` |

A per-quest **policy** (`AiVerificationPolicy`) controls: enabled checks, pass/fail thresholds, and whether `APPROVE`/`REJECT` can auto-resolve or must route to review.

### 6.4 Outcome Integration

- Verification runs **async** (queued) so submission API stays fast.
- Submission state machine: `PENDING_VERIFICATION → (AUTO_APPROVED | AUTO_REJECTED | PENDING_MANUAL_REVIEW) → APPROVED | REJECTED`. An AI recommendation of `NEEDS_MANUAL_REVIEW` transitions the submission to `PENDING_MANUAL_REVIEW` (submission status) — the two names denote recommendation vs. submission state.
- Teacher sees per-check breakdown (PASS/FAIL/WARN + score) before deciding.
- All decisions and AI outputs are **audit-logged**.

---

## 7. Gamification Specification

### 7.1 XP

- Earned on: quest completion (main), side quest completion, quizzes, teacher bonus, badges, streak milestones.
- **Immutable XP ledger** (`XpTransaction`) for full auditability; totals are derived, never stored as a single counter (avoids drift and tampering).

### 7.2 Levels

- Derived from cumulative XP via a configurable curve (admin-managed).
- Level-up triggers notification + optional badge.

### 7.3 Badges

| Badge Type | Criteria Examples |
|---|---|
| XP-based | Reach 500/1000/5000 XP |
| Quest-count | Complete 5 / 25 / 50 main quests |
| Category | 3 different categories; 10 tree-plantations |
| Streak | 3 / 7 / 30 day activity streaks |
| Consistency | Activity on N distinct weeks |
| Special | Manual / seasonal / admin-issued |

- Badge definitions stored in DB (admin CRUD), awarded by an event-driven **badge engine**.

### 7.4 Leaderboards

| Scope | Period |
|---|---|
| Class | This week / all-time |
| School | This week / all-time |
| District (future) | Season |

- Computed from XP ledger; cached in Redis with TTL; class leaderboard pushes real-time updates via Socket.IO.

### 7.5 XP Settings (Admin)

`XpSetting` key-value store: base XP bands per difficulty, quiz XP formula, bonus caps, level curve, streak bonuses. All teacher-configured rewards validated against these caps.

---

## 8. Non-Functional Requirements (Summary)

| Area | Requirement |
|---|---|
| **Performance** | API p95 < 300 ms for reads; map load < 2 s on broadband; verification runs async and non-blocking |
| **Availability** | Target 99.5%; graceful degradation when AI service is down (fallback = manual review only) |
| **Security** | HTTPS only; JWT access (15 min) + rotating refresh tokens (httpOnly cookie); bcrypt/argon2; rate limiting; input validation; server-side geo checks; audit log |
| **Privacy** | Student data protected; geolocation stored only as needed; parental/consent handling per institution policy; right to delete |
| **Accessibility** | WCAG 2.1 AA; keyboard navigable map controls; contrast-safe dark mode |
| **Observability** | Structured logs, metrics, error tracking (Sentry), health endpoints, tracing |
| **Scalability** | Stateless API (horizontal scale), Redis cache, async job queue, PostGIS spatial indexes |
| **Responsiveness** | Mobile-first PWA; works down to 360 px width |

---

## 9. UX Principles

- **Game, not LMS:** playful copy, delightful micro-interactions (Framer Motion), confetti on level-up/badge.
- **Minimal cognitive load:** quest cards show what, where, how long, reward — at a glance.
- **Clear feedback loops:** instant response to uploads; visible verification status (Pending / AI result / Teacher decision).
- **Design language:** Mapbox dark styling inspired by Pokémon GO/Duolingo; primary palette = greens + earth tones, high-contrast accents.
- **Trust through transparency:** students can see *why* a submission was rejected (check breakdown).

---

## 10. Success Metrics

| Metric | Target (6 months post-launch) |
|---|---|
| Active schools | 25 |
| Monthly active students | 5,000 |
| Quest completion rate (accepted → approved) | ≥ 60% |
| AI-assisted reviews (% teacher decisions informed by AI) | ≥ 70% |
| Fraud rate (submissions auto/teacher-rejected for fraud) | < 5% |
| Avg. teacher review time per submission | < 2 min |
| Crash-free sessions (web) | ≥ 99% |

---

## 11. Milestones / Roadmap

| Phase | Scope | Exit Criteria |
|---|---|---|
| **M1 Foundations** | PRD, SRS, data model, monorepo scaffold, CI | Docs + compiling skeleton |
| **M2 Auth + Core** | JWT auth, roles, profile, admin user mgmt | Login flows e2e |
| **M3 Map + Quests** | Mapbox map, quest CRUD, lifecycle, proximity | Teacher publishes, student sees on map |
| **M4 Submission + AI** | Evidence upload, verification pipeline, review UX | e2e verify + teacher approval |
| **M5 Gamification** | XP ledger, badges, levels, leaderboards, notifications | Streak/badge e2e |
| **M6 Dashboards + Ops** | Analytics, moderation, audit, observability | Dashboards + monitoring live |
| **M7 Hardening** | Accessibility, performance, security review, beta pilot | Production deploy |

---

## 12. Risks & Open Questions

| # | Risk / Question | Mitigation |
|---|---|---|
| 1 | **Cheating:** GPS spoofing, stock photos | Server-side radius, EXIF cross-checks, perceptual-hash duplicate detection, ASO heuristics; teacher override |
| 2 | **AI accuracy** harms student trust | Confidence thresholds conservative; always show per-check breakdown; teacher final |
| 3 | **Cost:** Mapbox / Cloudinary / GPU AI | Mapbox raster fallback (Leaflet) documented; Cloudinary signed uploads + size limits; YOLO on CPU-vendor tier initially |
| 4 | **Location privacy / minors** | Consent at onboarding, minimal retention, admin delete, institution policy |
| 5 | **Scale of photo index** for duplicate detection | Perceptual hash indexed in Postgres; embeddings in pgvector (optional) |
| 6 | **Institution onboarding flow** | Manual admin-created schools + join codes (v1); self-serve later |
| 7 | **Legal:** children's data (COPPA/GDPR-K) | Legal review before pilot; regional config flags |
| 8 | **Leaderboard fairness** across class sizes | Per-class leaderboards; XP/participation normalization considered |

---

## 13. Assumptions

- Mapbox GL JS with a valid access token (client-side); raster fallback supported.
- Evidence uploads go to Cloudinary (signed, size/format-limited).
- AI service runs as a separately deployable Python service.
- A teacher-approved quest is the primary quality gate; platform moderation is secondary.
- Schools provide consent for students under their care to share location while on quests.
