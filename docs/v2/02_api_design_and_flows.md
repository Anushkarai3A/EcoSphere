# Ecosphere v2 — API Design & User Flows

Versioned under `/api/v1`, same auth/role middleware as today. Response envelope follows the
existing `{ data }` + `{ error }` style. All list endpoints paginate (`page`, `pageSize`).
Role guards: `STUDENT` / `TEACHER` / `ADMIN` as in the current route files.

---

## 1. Assignments

### 1.1 Teacher — `/api/v1/assignments`

| Method | Path | Purpose |
|---|---|---|
| POST | `/assignments` | Create (draft or publish via `{publish?:bool}`) — same pattern as quests |
| GET | `/assignments?status=&topic=&page=` | Teacher's assignment list (materials included) |
| GET | `/assignments/:id` | Detail + materials + submission summary |
| PATCH | `/assignments/:id` | Update fields / materials |
| POST | `/assignments/:id/publish` | Publish (requires `dueAt` in the future) |
| POST | `/assignments/:id/unpublish` | Back to draft |
| DELETE | `/assignments/:id` | Archive |
| POST | `/assignments/:id/materials` | Upload material (multipart) |
| DELETE | `/assignments/:id/materials/:mid` | Remove material |
| GET | `/assignments/:id/submissions?status=&student=` | Grading queue |
| GET | `/assignments/:id/analytics` | Class performance (avg score, on-time rate, per-topic) |
| POST | `/assignments/submissions/:sid/grade` | `{score, gradeNotes}` → awards XP |
| POST | `/assignments/submissions/:sid/ai-feedback` | Generate AI feedback suggestion |

Create/update input (`AssignmentUpsertInput`):

```ts
{
  title, description, type, topic, difficulty, xpReward,
  dueAt: string /* ISO */, classGroupId?: string | null,
  materials?: Array<{ kind, title, url?, externalUrl?, notes? }>,
  publish?: boolean
}
```

Grading input: `{ score: number /* 0-100 */, gradeNotes?: string }`. On grade, the XP ledger
credits `xpReward * (score/100)` (integer, ledger-consistent) via a new `XpSource` value
`ASSIGNMENT_GRADE`.

### 1.2 Student — `/api/v1/student/assignments`

| Method | Path | Purpose |
|---|---|---|
| GET | `/assignments` | Assigned (school/class), sorted by due date, with `mySubmission` embedded |
| GET | `/assignments/:id` | Detail + materials (download) |
| POST | `/assignments/:id/submit` | Submit: multipart docs/images **and/or** `{text, externalUrl}` |
| GET | `/assignments/:id/my` | My submission + grade + AI feedback |

### 1.3 User flow (student)

```
Dashboard → "Assignments" → list (due first, status chips)
  → open assignment → study materials (download/view) → Submit
      → attach files / type text / paste link
  → status "Submitted" → teacher grades → grade + feedback revealed
  → XP + notification on grade
```

---

## 2. AI Quiz Generation — `/api/v1/ai/quizzes`

| Method | Path | Purpose |
|---|---|---|
| POST | `/ai/quizzes/generate` | `{materialRef \| text, count(5..50), difficulty, topic, types[]}` → returns `runId` |
| GET | `/ai/quizzes/generate/:runId` | Poll status (PENDING/RUNNING/SUCCEEDED/FAILED) + preview |
| POST | `/ai/quizzes/:sideQuestId/questions/:qid/review` | `{action: APPROVE\|REJECT\|EDITED, edits?}` |
| POST | `/ai/quizzes/:sideQuestId/regenerate` | `{params override}` → new `AiGenerationRun` (new `generationIndex`) |
| POST | `/ai/quizzes/:sideQuestId/publish` | Activate for students (status ACTIVE) |
| GET | `/ai/quizzes/analytics?quizId=` | Per-question difficulty, success rate, topic mastery, class stats |

Generate input:

```ts
{
  materialRef?: string,   // "assignment_material:<id>" | "file_url"
  text?: string,          // pasted study notes (mutually exclusive with materialRef)
  count: number,          // 5..50
  difficulty: "EASY"|"MEDIUM"|"HARD"|"EXPERT",
  topic?: QuestCategory,
  types: Array<"MCQ"|"TRUE_FALSE"|"MATCH"|"SCENARIO"|"CASE_STUDY">
}
```

### 2.1 Question output contract (validated by Zod on backend)

```ts
interface GeneratedQuestion {
  qType: "MCQ" | "TRUE_FALSE" | "MATCH" | "SCENARIO" | "CASE_STUDY";
  prompt: string;
  options: Array<{ text: string }>;       // 4 options (MCQ), 2 (TRUE_FALSE), pairs (MATCH), etc.
  correctIndex: number;                    // not serialized to students
  explanation: string;
  difficultyScore: number;                 // 0..1
  topic: QuestCategory;
}
```

### 2.2 Quiz-taking flow (student, reuses SideQuest + QuizAttempt)

- Timer (per-quiz configured minutes), **auto-save** answers to a draft row every N seconds.
- On submit: score, per-question correct/incorrect, explanations revealed.
- XP + badge (`Quiz Master`) awarded; attempt recorded for analytics/adaptive/ML.

---

## 3. Animation Studio — `/api/v1/animations`

| Method | Path | Purpose |
|---|---|---|
| POST | `/animations` | Create project `{prompt, type, theme}` → starts chat thread |
| POST | `/animations/:id/chat` | Send message → assistant reply (script/storyboard) |
| GET | `/animations/:id/storyboard` | Scenes + narration + captions + transitions |
| PATCH | `/animations/:id/scenes/:index` | Scene editor (narration / visual prompt / transition / duration) |
| POST | `/animations/:id/render` | Enqueue MP4/GIF render (BullMQ → ai-service) |
| GET | `/animations/:id/export` | `{mp4Url, gifUrl, presentationHtmlUrl}` |
| POST | `/animations/:id/submit` | Submit for teacher review (awards XP on approval) |
| GET | `/animations/community` | Browse approved/featured, with like + feedback counts |
| POST | `/animations/:id/like` | Toggle like |
| POST | `/animations/:id/feedback` | Peer feedback `{rating, comment}` |
| POST | `/animations/:id/feature` | (TEACHER) mark featured |
| GET | `/teacher/animations?status=` | (TEACHER) review queue |

Animation type/theme catalog is seeded and exposed via `GET /animations/themes` for the picker.

### 3.1 Chat contract

```
Student: "Create a 1-minute animation explaining water conservation."
AI (tool call): [script-gen]  → {title, narration, scenes[]} persisted to AiGenerationRun
AI (message):  "Here's your storyboard — 4 scenes over 60s. Edit any scene, then hit Render."
```

Messages are streamed via SSE (`/animations/:id/chat/stream`) and persisted; scene edits are
plain PATCH calls. Duration is clamped server-side to `ANIMATION_MAX_SECONDS` (90).

---

## 4. Learning Modules

| Method | Path | Purpose |
|---|---|---|
| POST | `/modules` | (TEACHER) create module |
| GET | `/modules/:id` | Module + lessons; blocks resolve linked quiz/assignment/animation ids |
| PATCH | `/modules/:id` | Update |
| POST | `/modules/:id/publish` | Publish |
| POST | `/modules/:id/lessons` | Add/reorder lesson |
| PATCH | `/modules/:id/lessons/:lid` | Edit blocks |
| GET | `/student/modules` | Published modules for the student's school/classes |
| GET | `/student/modules/:id` | Module with per-student lesson progress |
| POST | `/student/modules/:id/lessons/:lid/progress` | `{status, progress}` |

Lesson block schema:

```ts
type LessonBlock =
  | { kind: "TEXT"; body: string }
  | { kind: "VIDEO"; url: string; title?: string }
  | { kind: "QUIZ"; sideQuestId: string }
  | { kind: "ASSIGNMENT"; assignmentId: string }
  | { kind: "ANIMATION"; animationId: string }   // sample student work / template
  | { kind: "ACTIVITY"; questId: string }        // real-world eco challenge
  | { kind: "EMBED"; url: string; title?: string };
```

---

## 5. Gamification v2

| Method | Path | Purpose |
|---|---|---|
| GET | `/leaderboards?scope=global\|school\|class\|department&id=` | Top 100 by XP (Redis-cached) |
| GET | `/me/level` | Current level (1–100) + title + progress to next |
| GET | `/events` | Active/upcoming seasonal events |
| POST | `/events/:id/register` | Join an event |
| GET | `/events/:id/leaderboard` | Event-specific standings |
| GET | `/badges` | Catalog (existing) |
| GET | `/me/badges` | Earned badges (existing pattern) |

### 5.1 Level + title table (derived, configurable via `XpSetting`)

```ts
// levels.ts — pure function, unit-tested, no DB dependency
levelFor(xp) { n = floor((1 + sqrt(1 + 8*xp/100)) / 2); return clamp(n, 1, 100); }
titleFor(level) {
  lvl<5  "Eco Beginner"     lvl<15 "Green Explorer"    lvl<30 "Nature Guardian"
  lvl<50 "Climate Champion" lvl<70 "Sustainability Hero"
  lvl<90 "Planet Protector" else   "Eco Master"
}
```

New badge seeds (criteria reuse existing `BadgeCriteria`): `quiz_master`, `assignment_champion`,
`animation_creator`, `community_leader`, `tree_saver`, `recycling_hero`, `climate_advocate`.

---

## 6. Adaptive Learning

| Method | Path | Purpose |
|---|---|---|
| POST | `/adaptive/recommendations` | (STUDENT) recompute my recommendation feed |
| GET | `/adaptive/recommendations` | My current feed (non-dismissed, by priority) |
| POST | `/adaptive/recommendations/:id/dismiss` | Dismiss |
| POST | `/adaptive/recommendations/:id/click` | Track engagement (improves future rules) |

The engine is a pure TypeScript service (`backend/src/services/adaptive.service.ts`). Example
rules (declarative, seeded via `XpSetting`):

```ts
[
  { when: { quizTopicMastery: "< 0.5", topic: "RECYCLING" },
    then: { recType: "QUIZ", reason: "TOPIC_GAP", target: "quiz:<recycling-easy-id>", priority: 4 } },
  { when: { assignmentCompletionRate: "< 0.6" },
    then: { recType: "MODULE", reason: "LOW_SCORE", target: "module:<study-skills-id>", priority: 3 } },
  { when: { streakDays: ">= 7" },
    then: { recType: "CHALLENGE", reason: "EXCELLENCE_MOMENTUM", target: "quest:<hard-id>", priority: 2 } },
]
```

Inputs come from `StudentFeatureSnapshot` (aggregated by a nightly + hourly job) plus live
signals (latest quiz result, latest assignment grade).

---

## 7. Sustainability & Analytics

| Method | Path | Purpose |
|---|---|---|
| GET | `/student/sustainability` | Eco score + breakdown + impact report (CO₂/water/energy) |
| POST | `/student/eco-activities` | Manual activity log (validated kinds + units) |
| GET | `/student/analytics/overview` | XP, level, rank, quizzes, assignments, animations, activities, recommendations |
| GET | `/teacher/analytics/overview` | Engagement, quiz/assignment/animation/activity metrics |
| GET | `/teacher/analytics/students/:id` | Per-student profile (grades, mastery, activities) |
| GET | `/admin/analytics/overview` | School-wide sustainability, usage, top performers, impact |
| GET | `/admin/analytics/export?scope=` | CSV export for reporting |

Impact multipliers (CO₂ equivalent per kg recycled, per tree, per kWh saved) live in
`ai-service/services/sustainability.py` and are mirrored to a read-only config table so
reports are consistent.

---

## 8. General conventions

- **Ownership checks.** Every teacher-scoped route verifies `teacherId === req.user.id`
  (`assertAssignmentOwner`, `assertModuleOwner`, `assertAnimationReviewable`).
- **Uploads.** Multer with per-file/per-request limits (reuse `UPLOAD_MAX_*` env). MIME
  allow-list per `MaterialKind`.
- **XP integrity.** All XP changes go through the existing ledger helper so `balanceAfter` is
  always consistent; no direct `XpTransaction` writes outside `gamification` service.
- **Notifications.** Reuse `Notification` rows for `assignment.published`,
  `assignment.graded`, `quiz.generated`, `animation.approved`, `badge.earned`.
- **Rate limiting.** Generation and AI endpoints get stricter limits (per-IP/per-user) to
  prevent LLM-cost abuse.
