import { Router } from "express";
import { AppError } from "../lib/http.js";
import { evidenceUpload } from "../lib/upload.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireInstitution } from "../middlewares/institution.middleware.js";
import * as participationService from "../services/participation.service.js";
import { idParamSchema, submitFieldsSchema } from "../validators/participation.validators.js";

const router = Router();

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
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

/** Student commits to an active quest. Mounted before quest/:id so it wins. */
router.post("/quests/:id/accept", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const acceptance = await participationService.acceptQuest(authenticatedUserId(res), paramId(req));
  res.status(201).json({ acceptance });
});

/** The student's own quests with latest submission status. */
router.get("/student/acceptances", requireAuth, requireRole("STUDENT"), requireInstitution, async (_req, res) => {
  const result = await participationService.myAcceptances(authenticatedUserId(res));
  res.json(result);
});

/** Detail view incl. submissions, assets, and verification results. */
router.get("/acceptances/:id", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const acceptance = await participationService.getAcceptance(authenticatedUserId(res), paramId(req));
  res.json({ acceptance });
});

/** Upload evidence + location for an accepted quest (multipart field "evidence"). */
router.post(
  "/acceptances/:id/submit",
  requireAuth,
  requireRole("STUDENT"),
  requireInstitution,
  evidenceUpload.array("evidence"),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      throw new AppError(400, "NO_EVIDENCE", "At least one evidence file is required");
    }
    const input = submitFieldsSchema.parse(req.body);
    const submission = await participationService.submitEvidence(
      authenticatedUserId(res),
      paramId(req),
      input,
      files,
    );
    res.status(201).json({ submission });
  },
);

export default router;
