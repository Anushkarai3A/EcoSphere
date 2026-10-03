# Ecosphere v2 — Architecture & Implementation Blueprint

**Version:** 2.0 (Design) · **Status:** Draft for approval
**Reference:** `docs/SRS.md` · `docs/DATA_MODEL.md` · `docs/PRD.md`

This document is the engineering contract for the next major version of Ecosphere:
AI-powered learning, assessment, analytics, and content generation built on top of the
existing location-based quest platform. Every proposal is grounded in the current codebase
(Express 5 + Prisma + PostGIS + BullMQ + Redis backend, React + Vite + React Query + MapLibre
frontend, FastAPI `ai-service`).

---

## 1. Executive Summary

### 1.1 What already exists (reuse, don't rebuild)

| Capability | Where it lives today | v2 action |
|---|---|---|
| Auth + RBAC + approvals | `User`/`TeacherProfile`/`StudentProfile`, JWT rotation | reuse |
| Schools, classes, enrollments | `School`, `ClassGroup`, `Enrollment` | reuse (assignment targeting) |
| Location quests + evidence + AI verification | `Quest`, `QuestAcceptance`, `QuestSubmission`, `VerificationRun`, BullMQ worker | reuse |
| Side quests + quiz Q&A + attempts | `SideQuest`, `QuizQuestion`, `QuizAttempt` | extend: AI generation + review |
| XP ledger + badges | `XpTransaction`, `Badge`, `UserBadge` | extend: levels/titles, new badges |
| Notifications + audit | `Notification`, `AuditLog` | reuse |
| AI service shell | FastAPI `ai-service` (health + verify routers) | extend into AI orchestration gateway |
| Uploads | Multer → `UPLOAD_DIR`, Cloudinary fields | extend for materials |

### 1.2 What v2 adds

1. Assignment management (materials, submissions, grading, AI feedback)
2. AI quiz generation from uploaded study material (5–50 questions, 5 types)
3. AI Animation Studio (chat → storyboard → render → showcase)
4. Structured learning modules
5. Gamification v2: levels 1–100 + titles, leaderboards, seasonal events
6. Role dashboards + reporting APIs
7. Rule-based adaptive recommendation engine
8. Logistic Regression + Decision Tree (training, evaluation, feature importance)
9. Sustainability tracking (activities ledger, eco score, impact reports)
10. Dark-green responsive theme upgrade

### 1.3 Guiding principles

- **Composable aggregates over monolith models.** Assignments, modules, animations are
  separate aggregates that reference shared identity/gamification tables.
- **XP/levels/badges stay derived from the immutable ledger.** New gamification is computed
  from `XpTransaction`, never stored separately.
- **AI is an internal service, not a client dependency.** All LLM/ML calls go through the
  FastAPI gateway; the backend stores only results + provenance.
- **Every AI output is reviewable.** Generated questions, feedback, and animations carry a
  generation-run id (provenance) and a review state.
- **Everything is schedulable.** Long-running AI work (parsing a PDF, generating 40
  questions, rendering an MP4) is a BullMQ job + worker, matching the existing verification
  pattern.

---

## 2. System Architecture

### 2.1 Component view

```
                        ┌────────────────────────────────────────────┐
                        │         Clients (Web/PWA, responsive)       │
                        │  React · Vite · Tailwind v4 · React Query   │
                        │  MapLibre GL · shadcn/ui · Socket.IO client │
                        └──────────────┬──────────────────────────────┘
                                       │ REST / WSS
        ┌──────────────────────────────┼─────────────────────────────────┐
        │                          Express API (/api/v1)                 │
        │  routes: auth admin teacher student quests review              │
        │          assignments modules quizzes animations gamification   │
        │          adaptive sustainability analytics ml                  │
        │  middlewares: auth, role, upload (multer), rate-limit          │
        │  services: aggregate domain logic · XP ledger · notifications  │
        └──────┬─────────────────┬─────────────────┬─────────────────────┘
               │                 │                 │
     ┌─────────▼──────┐  ┌───────▼───────┐  ┌──────▼───────────────┐
     │ PostgreSQL     │  │ Redis         │  │ BullMQ worker (Node)  │
     │ + PostGIS      │  │ (cache,queue) │  │ verify evidence,      │
     │ Prisma + raw   │  └───────────────┘  │ parse docs, generate  │
     │ spatial SQL    │                     │ quizzes, render       │
     └────────────────┘                     │ animations, ML train  │
                                            └──────┬────────────────┘
                                                   │ internal HTTP (auth token)
                                    ┌──────────────▼──────────────────┐
                                    │  FastAPI ai-service              │
                                    │  /verify (existing)              │
                                    │  /generate (quiz/feedback/script)│
                                    │  /extract (pdf/docx/ppt)         │
                                    │  /ml (train/predict/evaluate)    │
                                    │  adapters: OpenAI/Gemini         │
                                    └──────────────────────────────────┘
```

### 2.2 Key decisions

- **File handling.** Study material and assignment attachments reuse the multer → local
  `UPLOAD_DIR` pipeline and gain a material/asset row. Cloudinary fields already exist for
  media; document parsing happens in the FastAPI gateway.
- **Job queue.** Add queues `document-parse`, `quiz-generate`, `animation-render`,
  `ml-train`, `feedback-generate` alongside the existing `verification` queue
  (`backend/src/lib/jobs.ts`).
- **Realtime.** The existing Socket.IO gateway is extended with topic push for
  `assignment.graded`, `quiz.generated`, `animation.renderDone`, `leaderboard.update`.
- **Config.** `backend/src/config/env.ts` gains `ANIMATION_MAX_SECONDS=90`, `QUIZ_MIN=5`,
  `QUIZ_MAX=50`. LLM provider keys live only in the `ai-service` (never the backend).

### 2.3 Security & privacy notes

- Assignment/feedback/sustainability endpoints are role-scoped and ownership-checked exactly
  like the existing quest flows (`assertQuestOwner` pattern → `assertAssignmentOwner`).
- Student submission files are served from the same unguessable-UUID upload pipeline; URLs are
  treated as private (never listed, only returned to owner/teacher).
- AI run `prompt` is persisted for audit; PII is stripped from material text before it leaves
  the extraction layer.

---

## 3. Database Schema Changes

All additions are additive migrations. Naming follows the existing `snake_case` + `@@map`
convention. Enums are closed sets.

### 3.1 New enums

```prisma
enum AssignmentType        { INDIVIDUAL PROJECT }
enum AssignmentStatus      { DRAFT PUBLISHED CLOSED ARCHIVED }
enum MaterialKind          { PDF DOCX PPT IMAGE VIDEO_LINK TEXT NOTE LINK }
enum SubmissionContentType { DOCUMENT IMAGE TEXT LINK VIDEO }
enum GradeStatus           { UNGRADED GRADED RETURNED }
enum AnimationStatus       { DRAFT STORYBOARDED RENDER_QUEUED RENDERED APPROVED FEATURED REJECTED }
enum AnimationType         { EXPLAINER STORYTELLING SUSTAINABILITY CLIMATE RECYCLING BIODIVERSITY }
enum SceneKind             { TITLE NARRATION DIALOGUE TRANSITION ACTION }
enum ModuleStatus          { DRAFT PUBLISHED ARCHIVED }
enum LessonBlockKind       { TEXT VIDEO QUIZ ASSIGNMENT ANIMATION ACTIVITY EMBED }
enum EcoActivityKind       { QUEST RECYCLING TREE_PLANTATION ENERGY_SAVE WATER_SAVE COMMUNITY OTHER }
enum SeasonalEventKind     { EARTH_DAY ENVIRONMENT_WEEK PLASTIC_FREE TREE_PLANTATION_DRIVE CUSTOM }
enum EventParticipationStatus { REGISTERED STARTED COMPLETED }
enum RecommendationType    { LESSON QUIZ ASSIGNMENT CHALLENGE ANIMATION ACTIVITY MODULE }
enum RecommendationReason  { LOW_SCORE SLOW_SPEED TOPIC_GAP STREAK_ALERT EXCELLENCE_MOMENTUM }
enum AiGenerationKind      { QUIZ_QUESTIONS QUIZ_EXPLANATIONS FEEDBACK_STUDENT FEEDBACK_CLASS
                             ANIMATION_SCRIPT STORYBOARD SCENE_IMAGES RECOMMENDATION SUSTAINABILITY_REPORT }
enum AiGenerationStatus    { PENDING RUNNING SUCCEEDED FAILED CANCELLED }
enum MlModelKind           { LOGISTIC_REGRESSION DECISION_TREE }
enum MlTaskKind            { QUIZ_SUCCESS ASSIGNMENT_COMPLETION ENGAGEMENT PERFORMANCE_CLASS }
```

### 3.2 Assignment domain

```prisma
model Assignment {
  id            String           @id @default(uuid())
  teacherId     String           @map("teacher_id")
  classGroupId  String?          @map("class_group_id")   // NULL = school-wide
  moduleId      String?          @map("module_id")        // optional module linkage
  title         String
  description   String
  type          AssignmentType   @default(INDIVIDUAL)
  topic         QuestCategory    // maps to the eco taxonomy
  difficulty    QuestDifficulty  @default(MEDIUM)
  xpReward      BigInt           @map("xp_reward")
  dueAt         DateTime         @map("due_at")
  status        AssignmentStatus @default(DRAFT)
  publishedAt   DateTime?        @map("published_at")
  createdAt     DateTime         @default(now()) @map("created_at")
  updatedAt     DateTime         @updatedAt @map("updated_at")
  archivedAt    DateTime?        @map("archived_at")

  teacher     User                     @relation("AssignmentAuthor", fields: [teacherId], references: [id])
  classGroup  ClassGroup?              @relation(fields: [classGroupId], references: [id])
  module      LearningModule?          @relation(fields: [moduleId], references: [id])
  materials   AssignmentMaterial[]
  submissions AssignmentSubmission[]
  aiRuns      AiGenerationRun[]

  @@index([teacherId, status], map: "ix_assignments_teacher")
  @@index([classGroupId, status], map: "ix_assignments_class")
  @@map("assignments")
}

model AssignmentMaterial {
  id             String       @id @default(uuid())
  assignmentId   String       @map("assignment_id")
  kind           MaterialKind
  title          String
  url            String?      // served /api/v1/uploads/* or external video link
  mimeType       String?      @map("mime_type")
  sizeBytes      BigInt?      @map("size_bytes")
  externalUrl    String?      @map("external_url")   // video links, citations
  notes          String?
  uploadedAt     DateTime     @default(now()) @map("uploaded_at")

  assignment Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  @@map("assignment_materials")
}

model AssignmentSubmission {
  id            String               @id @default(uuid())
  assignmentId  String               @map("assignment_id")
  studentId     String               @map("student_id")
  contentKind   SubmissionContentType
  title         String?
  text          String?              // text responses / essay body
  externalUrl   String?              // link submissions
  submittedAt   DateTime             @default(now()) @map("submitted_at")
  gradeStatus   GradeStatus          @default(UNGRADED)
  score         Int?                 // 0-100 or rubric points
  gradeNotes    String?              @map("grade_notes")
  aiFeedback    String?              @map("ai_feedback")     // AI-assisted suggestion text
  aiRunId       String?              @map("ai_run_id")
  gradedBy      String?              @map("graded_by")
  gradedAt      DateTime?            @map("graded_at")
  resubmissionOf String?             @map("resubmission_of")

  assignment Assignment              @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  student    User                    @relation("AssignmentStudent", fields: [studentId], references: [id], onDelete: Cascade)
  grader     User?                   @relation("AssignmentGrader", fields: [gradedBy], references: [id])
  assets     AssignmentAsset[]
  aiRun      AiGenerationRun?        @relation(fields: [aiRunId], references: [id])

  @@unique([assignmentId, studentId], map: "ux_assignment_submissions_one_per_student")
  @@index([studentId, gradeStatus], map: "ix_assignment_submissions_student")
  @@map("assignment_submissions")
}

model AssignmentAsset {
  id             String    @id @default(uuid())
  submissionId   String    @map("submission_id")
  kind           MaterialKind
  url            String
  mimeType       String?   @map("mime_type")
  sizeBytes      BigInt?   @map("size_bytes")
  uploadedAt     DateTime  @default(now()) @map("uploaded_at")

  submission AssignmentSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  @@map("assignment_assets")
}
```

### 3.3 AI generation provenance

```prisma
model AiGenerationRun {
  id          String             @id @default(uuid())
  kind        AiGenerationKind
  status      AiGenerationStatus @default(PENDING)
  inputRef    String?            @map("input_ref")   // "assignment:<id>" | "material:<id>" | "animation:<id>"
  params      Json?                                 // count, difficulty, topic, model
  prompt      String?                               // audited prompt sent to the LLM
  result      Json?                                 // typed output per kind
  modelUsed   String?            @map("model_used")
  error       String?
  startedAt   DateTime?          @map("started_at")
  completedAt DateTime?          @map("completed_at")
  requestedBy String             @map("requested_by")
  createdAt   DateTime           @default(now()) @map("created_at")

  quizQuestions QuizQuestion[]
  submissions   AssignmentSubmission[]
  animation     AnimationProject?
  requester     User              @relation("AiRunRequester", fields: [requestedBy], references: [id])

  @@index([kind, status], map: "ix_ai_runs_kind_status")
  @@index([inputRef], map: "ix_ai_runs_input")
  @@map("ai_generation_runs")
}
```

### 3.4 Quiz generation additions

`QuizQuestion` (existing) gains provenance columns and a review state so a teacher can
approve/reject/edit AI output before it goes live:

```prisma
model QuizQuestion {
  // ...existing columns...
  qType            String?          // question-type key ("MCQ" | "TRUE_FALSE" | "MATCH" | "SCENARIO" | "CASE_STUDY")
  difficultyScore  Decimal?         // 0..1 AI-assessed difficulty
  sourceRunId      String?          @map("source_run_id")
  aiGenerated      Boolean          @default(false) @map("ai_generated")
  reviewState      String?          @map("review_state")  // "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EDITED"
  editHistory      Json?            @map("edit_history")   // diff trail for teacher edits
  generationIndex  Int?             @map("generation_index") // alternate generated set (regeneration)
}
```

### 3.5 Animation Studio domain

```prisma
model AnimationProject {
  id           String          @id @default(uuid())
  studentId    String          @map("student_id")
  title        String
  type         AnimationType
  status       AnimationStatus @default(DRAFT)
  description  String?
  prompt       String          // original student prompt
  theme        String?         // template key
  storyboard   Json?           // ordered scenes (denormalized for the player)
  narration    String?         // full voiceover text
  durationSec  Int?            @map("duration_sec")       // ≤ 90
  thumbnailUrl String?         @map("thumbnail_url")
  renderUrl    String?         @map("render_url")         // MP4
  gifUrl       String?         @map("gif_url")
  xpAwarded    BigInt          @default(0) @map("xp_awarded")
  featured     Boolean         @default(false)
  approvedBy   String?         @map("approved_by")
  approvedAt   DateTime?       @map("approved_at")
  createdAt    DateTime        @default(now()) @map("created_at")
  updatedAt    DateTime        @updatedAt @map("updated_at")

  student  User                  @relation("AnimationAuthor", fields: [studentId], references: [id])
  scenes   AnimationScene[]
  chats    AnimationChatMessage[]
  likes    AnimationLike[]
  feedback AnimationFeedback[]
  aiRuns   AiGenerationRun[]

  @@index([studentId, status], map: "ix_animations_student")
  @@map("animation_projects")
}

model AnimationScene {
  id           String      @id @default(uuid())
  projectId    String      @map("project_id")
  index        Int
  kind         SceneKind
  title        String?
  narration    String?     // caption/voiceover for this scene
  visualPrompt String?     @map("visual_prompt") // used by image/render backends
  durationSec  Int?        @map("duration_sec")
  transition   String?     // "fade" | "cut" | "wipe" | "zoom"
  imageUrl     String?     @map("image_url")     // generated scene still
  notes        String?

  project AnimationProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@unique([projectId, index], map: "ux_animation_scenes_index")
  @@map("animation_scenes")
}

model AnimationChatMessage {
  id         String   @id @default(uuid())
  projectId  String   @map("project_id")
  role       String   // "user" | "assistant" | "system"
  content    String
  toolCalls  Json?    @map("tool_calls")
  createdAt  DateTime @default(now()) @map("created_at")

  project AnimationProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  @@index([projectId, createdAt], map: "ix_animation_chat_project")
  @@map("animation_chat_messages")
}

model AnimationLike {
  id         String   @id @default(uuid())
  projectId  String   @map("project_id")
  studentId  String   @map("student_id")
  createdAt  DateTime @default(now()) @map("created_at")

  project AnimationProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  student User             @relation("AnimationLiker", fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([projectId, studentId], map: "ux_animation_likes")
  @@map("animation_likes")
}

model AnimationFeedback {
  id         String   @id @default(uuid())
  projectId  String   @map("project_id")
  studentId  String   @map("student_id")
  rating     Int?     // 1..5
  comment    String?
  createdAt  DateTime @default(now()) @map("created_at")

  project AnimationProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  student User             @relation("AnimationReviewer", fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([projectId, studentId], map: "ux_animation_feedback")
  @@map("animation_feedback")
}
```

### 3.6 Learning modules

```prisma
model LearningModule {
  id          String        @id @default(uuid())
  teacherId   String        @map("teacher_id")
  schoolId    String?       @map("school_id")
  title       String
  description String
  topic       QuestCategory
  status      ModuleStatus  @default(DRAFT)
  coverUrl    String?       @map("cover_url")
  publishedAt DateTime?     @map("published_at")
  createdAt   DateTime      @default(now()) @map("created_at")
  updatedAt   DateTime      @updatedAt @map("updated_at")

  teacher  User            @relation("ModuleAuthor", fields: [teacherId], references: [id])
  lessons  Lesson[]
  assignments Assignment[]

  @@index([teacherId, status], map: "ix_modules_teacher")
  @@map("learning_modules")
}

model Lesson {
  id            String            @id @default(uuid())
  moduleId      String            @map("module_id")
  index         Int
  title         String
  summary       String?
  contentType   LessonBlockKind[]
  content       Json              // ordered blocks [{kind,text/videoUrl/quizId/...}]
  estimatedMins Int?              @map("estimated_mins")
  createdAt     DateTime          @default(now()) @map("created_at")
  updatedAt     DateTime          @updatedAt @map("updated_at")

  module LearningModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  @@unique([moduleId, index], map: "ux_lessons_index")
  @@map("lessons")
}

model LessonProgress {
  id        String   @id @default(uuid())
  lessonId  String   @map("lesson_id")
  studentId String   @map("student_id")
  status    String   @default("NOT_STARTED") // NOT_STARTED | IN_PROGRESS | COMPLETED
  progress  Int      @default(0)             // 0-100
  lastAt    DateTime @default(now()) @map("last_at")

  lesson  Lesson @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  student User   @relation("LessonStudent", fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([lessonId, studentId], map: "ux_lesson_progress")
  @@map("lesson_progress")
}
```

### 3.7 Gamification v2

No new XP/level storage — levels and titles derive from the ledger. New tables only for the
composable pieces:

```prisma
model SeasonalEvent {
  id               String                 @id @default(uuid())
  kind             SeasonalEventKind
  schoolId         String?                @map("school_id")   // NULL = global
  title            String
  description      String?
  startsAt         DateTime               @map("starts_at")
  endsAt           DateTime               @map("ends_at")
  xpBonusMultiplier Decimal               @default(1) @map("xp_bonus_multiplier")
  isActive         Boolean                @default(false) @map("is_active")
  createdAt        DateTime               @default(now()) @map("created_at")

  participants EventParticipation[]
  @@index([startsAt, endsAt], map: "ix_seasonal_events_dates")
  @@map("seasonal_events")
}

model EventParticipation {
  id         String                   @id @default(uuid())
  eventId    String                   @map("event_id")
  studentId  String                   @map("student_id")
  status     EventParticipationStatus @default(REGISTERED)
  progress   Int                      @default(0)   // 0-100
  joinedAt   DateTime                 @default(now()) @map("joined_at")
  completedAt DateTime?               @map("completed_at")

  event   SeasonalEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  student User          @relation("EventStudent", fields: [studentId], references: [id], onDelete: Cascade)
  @@unique([eventId, studentId], map: "ux_event_participation")
  @@map("event_participations")
}
```

Leaderboards are **computed queries** over `XpTransaction` (per school / class / department /
global), cached in Redis under `leaderboard:<scope>:<id>` with a TTL, and pushed over
Socket.IO on change. A `LeaderboardSnapshot` table is deferred to v2.1 for historical
rankings.

### 3.8 Sustainability tracking

```prisma
model EcoActivity {
  id          String         @id @default(uuid())
  studentId   String         @map("student_id")
  kind        EcoActivityKind
  title       String
  metricValue Decimal?       @map("metric_value") // kg recycled, trees planted, kWh saved
  metricUnit  String?        @map("metric_unit")
  sourceRef   String?        @map("source_ref")   // "quest:<id>" | "submission:<id>" | "manual"
  impactJson  Json?          @map("impact_json")  // CO2 saved, water saved, etc.
  happenedAt  DateTime       @default(now()) @map("happened_at")

  student User @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@index([studentId, happenedAt], map: "ix_eco_activities_student")
  @@index([kind], map: "ix_eco_activities_kind")
  @@map("eco_activities")
}
```

The **sustainability score** is a deterministic computed value (0–100) from recent activity
volume + impact multipliers + streak, implemented as a pure function (unit-testable) and
cached per student like leaderboards.

### 3.9 Adaptive recommendation ledger

```prisma
model Recommendation {
  id           String               @id @default(uuid())
  studentId    String               @map("student_id")
  recType      RecommendationType
  reason       RecommendationReason
  targetRef    String               @map("target_ref")  // "module:<id>" | "quiz:<id>" | ...
  title        String
  context      Json?                // matched rule, scores that triggered it
  priority     Int                  @default(3)
  isDismissed  Boolean              @default(false) @map("is_dismissed")
  clickedAt    DateTime?            @map("clicked_at")
  createdAt    DateTime             @default(now()) @map("created_at")

  student User @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@index([studentId, createdAt(sort: Desc)], map: "ix_recommendations_student")
  @@map("recommendations")
}

model StudentFeatureSnapshot {
  id         String   @id @default(uuid())
  studentId  String   @map("student_id")
  capturedAt DateTime @default(now()) @map("captured_at")
  features   Json     // {quizSuccessRate, assignmentRate, activityCount, avgResponseMs, masteryByTopic}
  bucket     String   // "hourly" | "daily" — used by adaptive + ML pipelines

  student User @relation(fields: [studentId], references: [id], onDelete: Cascade)
  @@index([studentId, capturedAt], map: "ix_feature_snapshots_student")
  @@map("student_feature_snapshots")
}
```

`StudentFeatureSnapshot` is the shared input to both the rule-based recommender and the ML
training/inference pipeline — one feature schema, two consumers.

### 3.10 ML model metadata (backend side)

```prisma
model MlModel {
  id          String     @id @default(uuid())
  modelKind   MlModelKind
  taskKind    MlTaskKind
  name        String
  metrics     Json       // {accuracy, precision, recall, f1}
  features    Json       // feature names used
  artifactUrl String?    @map("artifact_url")  // path in ai-service storage / object store
  version     Int        @default(1)
  isActive    Boolean    @default(false) @map("is_active")
  trainedBy   String?    @map("trained_by")
  trainedAt   DateTime   @default(now()) @map("trained_at")

  @@unique([modelKind, taskKind, version], map: "ux_ml_models_version")
  @@map("ml_models")
}
```

### 3.11 Relation wiring on `User`

Add to `User`:

```prisma
  assignments            Assignment[]            @relation("AssignmentAuthor")
  assignmentSubmissions  AssignmentSubmission[]  @relation("AssignmentStudent")
  assignmentsGraded      AssignmentSubmission[]  @relation("AssignmentGrader")
  animations             AnimationProject[]      @relation("AnimationAuthor")
  animationLikes         AnimationLike[]
  animationFeedback      AnimationFeedback[]
  modules                LearningModule[]        @relation("ModuleAuthor")
  lessonProgress         LessonProgress[]        @relation("LessonStudent")
  ecoActivities          EcoActivity[]
  recommendations        Recommendation[]
  featureSnapshots       StudentFeatureSnapshot[]
  aiRuns                 AiGenerationRun[]       @relation("AiRunRequester")
  eventParticipations    EventParticipation[]    @relation("EventStudent")
```
