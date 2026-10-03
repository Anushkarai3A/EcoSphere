import { Router } from "express";
import { AppError } from "../lib/http.js";
import { documentUpload } from "../lib/upload.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher, requireInstitution, getSchoolId } from "../middlewares/institution.middleware.js";
import * as quizService from "../services/quiz.service.js";
import {
  generateQuizSchema,
  listQuizzesQuerySchema,
  quizAttemptSchema,
} from "../validators/quiz.validators.js";

const router = Router();

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

function paramId(req: { params: { id?: string | string[] } }): string {
  const raw = req.params.id;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError(400, "INVALID_ID", "Invalid id");
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Teacher — /quizzes (AI Quiz Studio, institution-scoped & VERIFIED teachers)
// ---------------------------------------------------------------------------

router.get("/quizzes", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listQuizzesQuerySchema.parse(req.query);
  res.json(await quizService.listQuizzes(authenticatedUserId(res), getSchoolId(res), query));
});

/** Upload a standalone study material for the quiz studio (multipart "files"). */
router.post(
  "/quizzes/materials",
  requireAuth,
  requireRole("TEACHER"),
  requireVerifiedTeacher,
  documentUpload.array("files"),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new AppError(400, "NO_FILE", "Attach a PDF, DOCX, PPT, TXT or image to upload");
    }
    const material = await quizService.uploadMaterial(authenticatedUserId(res), files);
    res.status(201).json({ material });
  },
);

router.post("/quizzes/generate", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = generateQuizSchema.parse(req.body);
  const quiz = await quizService.generateQuiz(authenticatedUserId(res), getSchoolId(res), input);
  res.status(201).json({ quiz });
});

router.get("/quizzes/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const quiz = await quizService.getQuiz(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quiz });
});

router.post("/quizzes/:id/publish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const quiz = await quizService.publishQuiz(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quiz });
});

router.post("/quizzes/:id/unpublish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const quiz = await quizService.unpublishQuiz(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quiz });
});

router.delete("/quizzes/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  await quizService.archiveQuiz(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Student — /student/quizzes (institution-scoped)
// ---------------------------------------------------------------------------

router.get("/student/quizzes", requireAuth, requireRole("STUDENT"), requireInstitution, async (_req, res) => {
  res.json(await quizService.studentListQuizzes(authenticatedUserId(res), getSchoolId(res)));
});

router.get("/student/quizzes/:id", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const quiz = await quizService.studentGetQuiz(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quiz });
});

router.post("/student/quizzes/:id/attempt", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const input = quizAttemptSchema.parse(req.body);
  const result = await quizService.submitQuizAttempt(authenticatedUserId(res), getSchoolId(res), paramId(req), input);
  res.status(201).json(result);
});

export default router;
