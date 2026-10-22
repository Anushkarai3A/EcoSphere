import { Router, type Response } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher } from "../middlewares/institution.middleware.js";
import * as reviewService from "../services/review.service.js";
import { idParamSchema, listReviewQuerySchema, reviewDecisionSchema } from "../validators/review.validators.js";

const router = Router();

function teacherId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

/**
 * Institution scope comes from the teacher profile that requireVerifiedTeacher
 * just validated — NOT from the JWT schoolId claim. The access token carries
 * User.schoolId, which is null for accounts created before the institution
 * isolation migration, so reading it here locked those teachers out of their
 * own queue with 403 NO_INSTITUTION. The profile is the source of truth used
 * by both registration and requireVerifiedTeacher.
 */
function teacherSchoolId(res: Response): string {
  const profile = res.locals.teacherProfile as { schoolId: string | null } | undefined;
  const schoolId = profile?.schoolId;
  if (!schoolId) {
    throw new AppError(403, "NO_INSTITUTION", "You must belong to an institution to access this resource");
  }
  return schoolId;
}

function paramId(req: { params: { id?: string | string[] } }): string {
  const parsed = idParamSchema.safeParse({ id: typeof req.params.id === "string" ? req.params.id : "" });
  if (!parsed.success) {
    throw new AppError(400, "INVALID_ID", "Invalid id");
  }
  return parsed.data.id;
}

/** Pending manual-review submissions for the teacher's own quests (institution-scoped & VERIFIED teachers only). */
router.get("/review/queue", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (_req, res) => {
  const result = await reviewService.reviewQueue(teacherId(res), teacherSchoolId(res));
  res.json(result);
});

/** Headline + per-category counts for the review dashboard tiles. */
router.get("/review/summary", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (_req, res) => {
  const result = await reviewService.reviewSummary(teacherId(res), teacherSchoolId(res));
  res.json(result);
});

/** All submissions to the teacher's own assignments (paginated + filterable). */
router.get("/review/assignments", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listReviewQuerySchema.parse(req.query);
  const result = await reviewService.listReviewAssignments(teacherId(res), teacherSchoolId(res), query);
  res.json(result);
});

/** All attempts on the teacher's quizzes and side quests (paginated + filterable). */
router.get("/review/quizzes/attempts", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listReviewQuerySchema.parse(req.query);
  const result = await reviewService.listReviewAttempts(teacherId(res), query);
  res.json(result);
});

/** One attempt with its questions — TEACHER view includes correct answers & explanations. */
router.get("/review/quizzes/attempts/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const result = await reviewService.getReviewAttemptDetail(teacherId(res), paramId(req));
  res.json(result);
});

/** All quest evidence for the teacher's quests — every verification status, paginated. */
router.get("/review/evidence", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listReviewQuerySchema.parse(req.query);
  const result = await reviewService.listReviewEvidence(teacherId(res), teacherSchoolId(res), query);
  res.json(result);
});

/** Re-queue AI verification for a PENDING_VERIFICATION submission (guards inside the service). */
router.post("/review/evidence/:id/verify", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const result = await reviewService.requestEvidenceVerification(
    teacherId(res),
    teacherSchoolId(res),
    paramId(req),
  );
  res.json(result);
});

/** Approve (award XP + optional bonus) or reject with a reason (institution-scoped & VERIFIED teachers only). */
router.post("/submissions/:id/review", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = reviewDecisionSchema.parse(req.body);
  const submission = await reviewService.reviewSubmission(teacherId(res), teacherSchoolId(res), paramId(req), input);
  res.json({ submission });
});

export default router;

