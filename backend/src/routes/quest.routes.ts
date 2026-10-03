import { Router } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher, getSchoolId } from "../middlewares/institution.middleware.js";
import * as questService from "../services/quest.service.js";
import {
  createQuestSchema,
  listQuestsQuerySchema,
  nearbyQuestsQuerySchema,
  updateQuestSchema,
} from "../validators/quest.validators.js";

const router = Router();

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

function paramId(req: { params: { id?: string | string[] } }): string {
  const raw = req.params.id;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError(400, "INVALID_ID", "Invalid quest id");
  }
  return raw;
}

/** Student map: active quests near a point, ordered by distance. */
router.get("/nearby", requireAuth, async (req, res) => {
  const query = nearbyQuestsQuerySchema.parse(req.query);
  const quests = await questService.nearbyQuests(query);
  res.json({ quests });
});

/** Teachers list their own quests (drafts + live, institution-scoped). */
router.get("/", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listQuestsQuerySchema.parse(req.query);
  const result = await questService.listQuests(authenticatedUserId(res), getSchoolId(res), query);
  res.json(result);
});

router.get("/:id", requireAuth, async (req, res) => {
  const quest = await questService.getQuest(paramId(req), authenticatedUserId(res));
  res.json({ quest });
});

router.post("/", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = createQuestSchema.parse(req.body);
  const quest = await questService.createQuest(authenticatedUserId(res), getSchoolId(res), input);
  res.status(201).json({ quest });
});

router.patch("/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = updateQuestSchema.parse(req.body);
  const quest = await questService.updateQuest(authenticatedUserId(res), getSchoolId(res), paramId(req), input);
  res.json({ quest });
});

router.delete("/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  await questService.archiveQuest(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.status(204).end();
});

router.post("/:id/publish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const quest = await questService.publishQuest(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quest });
});

router.post("/:id/unpublish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const quest = await questService.unpublishQuest(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ quest });
});

export default router;

