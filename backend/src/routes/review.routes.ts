import { Router } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher, getSchoolId } from "../middlewares/institution.middleware.js";
import * as reviewService from "../services/review.service.js";
import { idParamSchema, reviewDecisionSchema } from "../validators/review.validators.js";

const router = Router();

function teacherId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
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
  const result = await reviewService.reviewQueue(teacherId(res), getSchoolId(res));
  res.json(result);
});

/** Approve (award XP + optional bonus) or reject with a reason (institution-scoped & VERIFIED teachers only). */
router.post("/submissions/:id/review", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = reviewDecisionSchema.parse(req.body);
  const submission = await reviewService.reviewSubmission(teacherId(res), getSchoolId(res), paramId(req), input);
  res.json({ submission });
});

export default router;

