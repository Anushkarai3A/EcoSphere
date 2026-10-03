# Ecosphere v2 — AI Service & Machine Learning Design

The current `ai-service` (FastAPI) exposes `/health` and `/verify` (evidence verification).
v2 extends it into an **AI orchestration gateway** without breaking the verification
contract: document extraction, LLM generation (quizzes, feedback, animation scripts),
animation scene assets, and the ML training/inference pipeline.

---

## 1. AI Service Layout

```
ai-service/app/
  main.py           (existing; register new routers)
  api/routes/
    health.py       (existing)
    verify.py       (existing)
    generate.py     quiz / feedback / script / storyboard
    extract.py      document parsing (PDF/DOCX/PPT → text)
    ml.py           train / predict / evaluate / importance
    animate.py      scene image gen + render job orchestration
  core/
    config.py       (extend: LLM provider, keys, model names, animation limits)
    llm.py          provider-agnostic client (OpenAI-compatible + Gemini adapters)
    security.py     internal shared-secret auth for backend→ai-service calls
  schemas/          pydantic request/response contracts (mirrored by backend Zod validators)
  services/
    verifier.py     (existing)
    extractor.py    pypdf / python-docx / python-pptx → normalized text
    quizgen.py      structured question generation, JSON-schema enforced
    feedbackgen.py  rubric-aware student/class feedback suggestions
    animator.py     script → storyboard → scene prompts → narration
    ml_pipeline.py  scikit-learn Logistic Regression + Decision Tree
    sustainability.py  impact multiplier tables (CO₂/water/energy)
```

New dependencies: `openai` (or `google-genai`), `pypdf`, `python-docx`, `python-pptx`,
`scikit-learn`, `pandas`, `numpy`, `joblib`. All in `requirements.txt`.

---

## 2. LLM Strategy (`core/llm.py`)

- **Abstraction:** `generate_json(prompt, schema, model)` and `generate_text(...)`.
  Provider selected by env (`LLM_PROVIDER=openai|gemini`); default an OpenAI-compatible
  endpoint so we can swap between hosted and local models.
- **Structured output:** every generation is validated against a Pydantic schema in the
  service **and** a Zod validator in the backend before persistence. A malformed LLM
  response never reaches the DB.
- **Retries & idempotency:** backend enqueues a BullMQ job carrying a `runId`; the service
  receives the `runId` and returns `{runId, ...}`. Worker retries upsert the run — never
  duplicates.
- **Content safety:** a moderation pass (toxic/unsafe-content check) runs on all
  student-facing AI text; flagged output is quarantined for teacher review.
- **Cost control:** per-request rate limits (backend), max token budgets per generation kind,
  and a model tier map (`easy=cheap model, hard=smart model`).

### 2.1 Endpoint contract (internal)

```
POST /generate/quiz       {runId, text, count, difficulty, topic, types}
POST /generate/feedback   {runId, kind: student|class, rubric, submissionText}
POST /generate/script     {runId, prompt, type, theme, maxSeconds}
POST /extract             {fileUrl | content}   → {text, sections[], tokenCount}
POST /ml/train            {modelKind, taskKind}
POST /ml/predict          {modelId, features}
GET  /ml/models
GET  /ml/models/:id/evaluate
GET  /ml/models/:id/importance
```

Backend authenticates to the gateway with a shared secret (`AI_SERVICE_TOKEN`) sent as a
header; the service refuses unknown callers.

---

## 3. Quiz Generation Workflow

```
Teacher uploads study material / pastes text
        │
        ▼
POST /ai/quizzes/generate {materialRef|text, count, difficulty, topic, types}
        │
        ▼
[backend] create AiGenerationRun(QUIZ_QUESTIONS, PENDING) + prompt + requestedBy (audit)
        │  enqueue bullmq job "quiz-generate"
        ▼
[worker]  → ai-service /extract (if file) → /generate/quiz (structured)
        │
        ▼
[backend] validate output with Zod → persist draft QuizQuestion rows (reviewState=PENDING_REVIEW)
        │  mark run SUCCEEDED · notify teacher
        ▼
Teacher reviews: approve all / per-question approve-reject / edit (diff recorded) / regenerate
        │
        ▼
POST /ai/quizzes/:id/publish → status ACTIVE → students see it (SideQuest + QuizAttempt reuse)
```

**Question types:** MCQ, TRUE_FALSE, MATCH (pairs), SCENARIO, CASE_STUDY. Each generated
question carries `difficultyScore` (0..1), explanation, and topic. Analytics per question:
attempts, success rate, average time, topic mastery — fed to adaptive + ML.

---

## 4. Animation Studio Pipeline

```
Student: POST /animations {prompt, type, theme}
        │
        ▼
chat loop (SSE): [script-gen] tool → {title, narration, scenes[{index,title,narration,visualPrompt,durationSec,transition}]}
        │  persisted as AiGenerationRun(ANIMATION_SCRIPT) + AnimationScene rows
        ▼
Scene editor: PATCH narration / visual prompt / transition / duration (duration total ≤ 90s)
        │
        ▼
POST /animations/:id/render → enqueue "animation-render" → ai-service:
    scene stills (image model per visualPrompt, optional) → encode (ffmpeg in ai-service container)
    → MP4 + GIF + presentation HTML → upload → renderUrl/gifUrl stored
        │
        ▼
Student preview → submit for teacher review → approve → XP + (optional) featured showcase
```

- **Max duration** enforced at three layers: UI clamp, backend validator, ai-service clamp.
- **Scene image generation** is optional behind a feature flag (`ANIMATION_IMAGE_GEN`): if
  disabled, scenes render as animated cards (background gradient + captions + transitions),
  which still produce valid MP4/GIF output.
- **Rendering** runs in the ai-service (ffmpeg image sequence → H.264 MP4, GIF via palette).
  Long jobs return a job id; the backend polls / receives a webhook and pushes
  `animation.renderDone` over Socket.IO.

---

## 5. Machine Learning Integration

### 5.1 Models

| Model | Kind | Tasks | Output |
|---|---|---|---|
| Logistic Regression | `LOGISTIC_REGRESSION` | quiz success probability, assignment completion likelihood, engagement | probability 0..1 → threshold 0.5 |
| Decision Tree | `DECISION_TREE` | performance class, engagement class, learning behavior | `HIGH_PERFORMER` \| `MODERATE_PERFORMER` \| `AT_RISK` |

### 5.2 Feature engineering (shared schema = `StudentFeatureSnapshot`)

```
quizSuccessRate, quizAvgScore, quizAttempts, quizAvgTimeSec,
assignmentCompletionRate, assignmentAvgScore, assignmentOnTimeRate,
activityCount, activityStreak, lessonProgressRate,
lastLoginDaysAgo, activeDaysLast30, responseLatencyMs (slow → learning-speed signal),
masteryByTopic {topic: 0..1}
```

Labels come from outcomes: quiz passed (`>= passThreshold`), assignment submitted+graded,
engagement bucket (active days last 30d).

### 5.3 Training pipeline

```
POST /ml/train {modelKind, taskKind}
        │
        ▼
[ai-service] pull features (backend POST /ml/features/export → snapshot rows)
  → split 80/20 stratified → train → persist joblib artifact + metrics
  → store MlModel row (backend) with {accuracy, precision, recall, f1}
        │
        ▼
GET /ml/models → evaluation dashboard (accuracy/precision/recall/F1, confusion matrix)
GET /ml/models/:id/importance → feature importance bar chart
        │
        ▼
POST /ml/predict {modelId, features} → live per-student predictions
  (used by teacher dashboard risk flags and adaptive re-ranking)
```

- **Metrics:** accuracy, precision (macro), recall (macro), F1 (macro), plus per-class report.
  Computed with `sklearn.metrics`.
- **Feature importance:** `coef_` for logistic regression; `feature_importances_` for the
  tree — exposed as `{feature, weight}` for a bar chart.
- **Versioning:** each training run bumps `MlModel.version`; only `isActive` models serve
  predictions. Training is a BullMQ job (`ml-train`) so it never blocks the API.
- **Retraining trigger:** nightly job recomputes snapshots; a scheduled retrain (weekly or
  on data-volume threshold) keeps models fresh.

### 5.4 Teacher risk dashboard

Student list gets an `AT_RISK` flag from the active decision-tree model (probability > 0.7),
combined with rule-based triggers (low quiz mastery + low assignment completion + 3+ day
streak gap). The dashboard shows the flag, the driving features, and recommended actions
(from the adaptive engine).

---

## 6. AI Feedback (assignment grading support)

`POST /assignments/submissions/:sid/ai-feedback` → `AiGenerationRun(FEEDBACK_STUDENT)` →
ai-service generates a rubric-aware suggestion:

```
Strengths: <2-3 bullets grounded in the rubric>
Improvements: <2-3 specific, actionable items>
Suggested score band: <XX–YY/100>
```

Teachers see it as a **draft** (`aiFeedback` column, flagged `aiRunId`) and may accept,
edit, or discard before saving the grade. Class-level summary
(`FEEDBACK_CLASS`) gives common misconceptions per assignment for the analytics dashboard.

---

## 7. Adaptive Recommendation Engine (rule-based)

Pure TypeScript service; runs on demand (`POST /adaptive/recommendations`) and nightly.

```
Inputs: StudentFeatureSnapshot + latest live signals
  → evaluate declarative rules in priority order
  → produce ≤5 Recommendations (reason + context + targetRef)
  → upsert feed (dismiss stale ones, keep clicked/dismissed state)
```

Rules are data (JSON in `XpSetting`) so no deploys are needed to tune them. The engine is
unit-tested with synthetic feature vectors. ML predictions (section 5) can optionally
re-rank the feed by predicted success probability per recommendation target.

---

## 8. Security & Governance

- Internal gateway auth (shared secret) — never exposes the ai-service publicly.
- All prompts + outputs stored (`AiGenerationRun`) for audit; teacher edits recorded as
  diffs (`editHistory`).
- Student PII is excluded from material text before it reaches the LLM.
- Rate limits per user on generation endpoints (cost protection).
- Model artifacts are versioned; prediction endpoints only use `isActive` models.
