# Ecosphere v2 — UX, User Flows & Dashboards

Frontend stays in the existing React/Vite app (`frontend/src`) with the current styling
system. New pages mount under the existing role-based routing; components follow the
`components/` + `pages/` conventions already in the repo.

---

## 1. Navigation (role-aware)

```
STUDENT                          TEACHER                          ADMIN
├─ Home (XP, streak, daily)      ├─ Dashboard                     ├─ Overview
├─ Assignments                   ├─ Classes                       ├─ Students
├─ Quizzes (AI)                  ├─ Assignments  ▸ review queue   ├─ Teachers
├─ Learn (modules)               ├─ Quizzes       ▸ generate      ├─ Content (modules/quizzes)
├─ Animations Studio             ├─ Modules                       ├─ Sustainability
├─ Community (featured)          ├─ Students                      ├─ Leaderboard
├─ Leaderboard                   ├─ Animations   ▸ review         ├─ AI & Models
└─ Profile / My Impact           ├─ Leaderboard                   └─ Settings
                                 └─ AI Models (analytics)
```

Every entry point keeps an existing icon and sits inside the current sidebar so we preserve
the established IA.

---

## 2. Student Flows

### 2.1 Home (dashboard)
- XP ring, level + title, streak flame, daily goals, next 3 due assignments.
- "Recommended for you" strip = adaptive feed (dismissible cards).
- Sustainability summary card (eco score, impact).

### 2.2 Assignments
- List sorted by due date; status chips `Assigned / In Progress / Submitted / Graded`.
- Detail: description, **materials** (view/download; PDF/DOCX/PPT/image/video/link), due countdown.
- **Submit drawer:** drag-drop files + optional text + optional external link → review → confirm.
- On grade: score bar, teacher + AI feedback tab, XP toast.

### 2.3 AI Quiz Studio (student)
- Opens published quiz → countdown timer → one question per view, auto-save badge.
- Immediate feedback after each answer (correct/incorrect + explanation).
- End screen: score, accuracy by topic, XP earned, `Quiz Master` badge (if criteria met).

### 2.4 Animation Studio
- **Start:** theme/type picker grid → prompt box → "Generate script".
- **Chat + storyboard:** streaming assistant replies; storyboard appears scene-by-scene with
  editable narration, visual prompt, transition, and duration sliders (total ≤ 90s meter).
- **Render:** progress bar → preview player (MP4/GIF tabs) → "Share to Community" / "Submit".
- **Community:** browse featured, like, leave feedback, view others' animation pages.

### 2.5 Learn (modules)
- Module cards (progress %, lock states). Lesson reader: blocks render inline (text, video,
  embedded quiz/assignment/animation, activity CTA). Checkpoints mark progress.

### 2.6 Eco Activities (My Impact)
- Log an activity (kind + unit) with quick-picks (recycle, save water, bike ride, tree plant).
- Impact view: CO₂/water/energy equivalents, monthly trend, badge progress.

---

## 3. Teacher Flows

### 3.1 Assignment manager
- Create/publish wizard: fields → **materials** (upload now or link) → due date → pick
  class(es) → XP reward → publish.
- Grading queue: ungraded-first; per-submission screen with attached files, quick-scroll
  rubric, score slider, **"AI feedback"** button (draft, editable), save → grade notification.
- Analytics tab: avg score, on-time %, submissions by day, per-topic difficulty.

### 3.2 Quiz generation studio
- Input source (upload material / paste text / pick a prior assignment's material).
- Params: count, difficulty, topic, types → **Generate** → poll progress.
- Review grid: each question editable, approve/reject/edit; **Regenerate** produces an
  alternate set for comparison → publish.
- Analytics tab: per-question success, difficulty calibration, class mastery.

### 3.3 Module builder
- Create module → add lessons → drag-drop blocks (text/video/quiz/assignment/animation/
  activity/embed) → publish to classes.

### 3.4 Animation review
- Queue of submissions: preview player, narration panel, rubric comment box, approve/reject
  (+XP) → student notified. Featured toggle for community showcase.

### 3.5 Student & analytics
- Class roster with AT-RISK flags (ML decision tree) + rule triggers; per-student profile:
  grades, mastery radar, activity log, adaptive recommendations used.

---

## 4. Admin Flows

- **Overview:** school-wide sustainability metrics, engagement, top performers, model status.
- **AI & Models:** generation logs (AiGenerationRun audit), retrain button, model cards with
  metrics + importance charts, activate/deactivate versions.
- **Sustainability export:** CSV reports (CO₂, water, energy) per class/school.
- **Settings:** leaderboard scope toggles, event manager (seasonal), badge catalog editor.

---

## 5. Component Inventory (new, under `frontend/src/components`)

```
<XpRing /> <LevelBadge /> <StreakFlame />
<AssignmentCard /> <AssignmentList /> <SubmissionDrawer /> <GradeSlider /> <RubricPanel />
<AiFeedbackSuggestion /> <QuizPlayer /> <QuizTimer /> <QuestionReviewGrid />
<AnimationStudio /> <StoryboardTimeline /> <SceneEditor /> <RenderProgress />
<CommunityGrid /> <ModuleViewer /> <LessonBlockRenderer />
<RecommendationCard /> <AdaptiveFeed />
<LeaderboardTable /> <BadgeGrid /> <EventCard />
<ImpactChart /> <SustainabilitySummary />
<MetricTile /> <RiskFlagBadge /> <FeatureImportanceChart /> <ModelCard />
<AiRunLogTable />
```

---

## 6. Shared UX Patterns

- **XP + notification toast** after every award (reuse existing toast + Socket.IO).
- **Empty states** with clear next action (e.g., "Generate your first quiz").
- **Loading skeletons** for AI/long-running states; **polling banner** for generation runs.
- **Accessibility:** keyboard navigable storyboard/quiz player; contrast-checked status
  colors; aria-labels on icon-only controls.
- **Mobile:** studio + quiz player are mobile-first (responsive, touch drag-drop).

---

## 7. Analytics Dashboard Wireframes (data sources)

| Tile | Metric | Source |
|---|---|---|
| Student: XP/Level | cumulative XP, level, rank | `XpLedger` aggregation |
| Student: Quiz mastery | per-topic success radar | `QuizAttempt` rows |
| Student: Impact | CO₂/water/energy equivalents | `SustainabilityActivity` × multipliers |
| Teacher: Engagement | DAU-lite (active students/day) | ledger/attempt/assignment timestamps |
| Teacher: Quiz analytics | per-question success + difficulty | `QuizAttempt` + question rows |
| Teacher: Assignment analytics | avg score, on-time %, queue size | assignment/submission rows |
| Admin: Usage | signups, active schools, sessions | auth + activity tables |
| Admin: Model status | accuracy/precision/recall/F1 per model | `MlModel` (persisted by ai-service) |

All dashboards are **SQL-level aggregations** over existing tables (no new write path),
keeping the analytics read path cheap and Redis-cacheable where hot.
