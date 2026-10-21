import { Router } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireInstitution, getSchoolId } from "../middlewares/institution.middleware.js";
import * as studentService from "../services/student.service.js";
import { generateAnimationSchema, updateStudentProfileSchema } from "../validators/student.validators.js";
import { animationVideoUpload } from "../lib/upload.js";

const router = Router();

// Base guards: all routes under /student are STUDENT-only and institution-bound
router.use(requireAuth, requireRole("STUDENT"), requireInstitution);

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

/** Complete student dashboard analytics and overview */
router.get("/dashboard", async (_req, res) => {
  const data = await studentService.getStudentDashboardData(authenticatedUserId(res), getSchoolId(res));
  res.json(data);
});

/** Institution-scoped leaderboard */
router.get("/leaderboard", async (_req, res) => {
  const data = await studentService.getInstitutionLeaderboard(authenticatedUserId(res), getSchoolId(res));
  res.json(data);
});

/** Student profile */
router.get("/profile", async (_req, res) => {
  const profile = await studentService.getStudentProfile(authenticatedUserId(res));
  res.json(profile);
});

/** Update editable student profile fields */
router.put("/profile", async (req, res) => {
  const input = updateStudentProfileSchema.parse(req.body);
  const updated = await studentService.updateStudentProfile(authenticatedUserId(res), input);
  res.json(updated);
});

/** Earned and available badges */
router.get("/badges", async (_req, res) => {
  const badges = await studentService.getStudentBadges(authenticatedUserId(res));
  res.json(badges);
});

/** AI Animation Studio: generate environmental animation storyboard */
router.post("/animations/generate", async (req, res) => {
  const input = generateAnimationSchema.parse(req.body);
  const animation = await studentService.generateStudentAnimation(authenticatedUserId(res), input);
  res.status(201).json({ animation });
});

/** List student's saved animations */
router.get("/animations", async (_req, res) => {
  const animations = await studentService.listStudentAnimations(authenticatedUserId(res));
  res.json({ items: animations });
});

/** Retrieve specific animation details */
router.get("/animations/:id", async (req, res) => {
  const animation = await studentService.getStudentAnimation(authenticatedUserId(res), req.params.id as string);
  res.json({ animation });
});

/** Upload rendered WebM/MP4 animation video (+ optional JPEG thumbnail poster) */
router.post(
  "/animations/:id/video",
  animationVideoUpload.fields([
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res) => {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const video = files.video?.[0];
    if (!video) {
      throw new AppError(400, "MISSING_FILE", "A video file is required");
    }
    const updated = await studentService.attachAnimationVideo(
      authenticatedUserId(res),
      req.params.id as string,
      video.filename,
      files.thumbnail?.[0]?.filename,
    );
    res.json({ animation: updated });
  },
);

/** Mark an animation rendering/upload job as failed with a reason */
router.post("/animations/:id/fail", async (req, res) => {
  const { error } = (req.body ?? {}) as { error?: unknown };
  const message = typeof error === "string" && error.trim().length > 0 ? error : "Animation rendering failed";
  const updated = await studentService.failStudentAnimation(
    authenticatedUserId(res),
    req.params.id as string,
    message,
  );
  res.json({ animation: updated });
});

/** Synthesize narration voiceover (WAV bytes proxied from the TTS provider) */
router.post("/animations/narration", async (req, res) => {
  const { text } = (req.body ?? {}) as { text?: unknown };
  if (typeof text !== "string") {
    throw new AppError(400, "INVALID_NARRATION", "Narration text is required");
  }
  const audio = await studentService.synthesizeAnimationNarration(text);
  res.setHeader("Content-Type", audio.contentType);
  res.send(Buffer.from(audio.bytes));
});

/** Delete student animation */
router.delete("/animations/:id", async (req, res) => {
  const result = await studentService.deleteStudentAnimation(
    authenticatedUserId(res),
    req.params.id as string,
  );
  res.json(result);
});

export default router;
