import { Router, type Request, type Response } from "express";
import { AppError } from "../lib/http.js";
import { clearRefreshCookieOptions, REFRESH_COOKIE, refreshCookieOptions } from "../lib/cookies.js";
import type { AuditContext } from "../lib/audit.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { authLimiter, strictAuthLimiter } from "../middlewares/ratelimit.middleware.js";
import * as authService from "../services/auth.service.js";
import { loginSchema, registerStudentSchema, registerTeacherSchema } from "../validators/auth.validators.js";

const router = Router();

function requestContext(req: Request): AuditContext {
  return { ipAddress: req.ip ?? null, userAgent: req.headers["user-agent"] ?? null };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
}

function authenticatedUserId(res: Response): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

/** Students self-register as PENDING_TEACHER_APPROVAL; no session until a teacher approves. */
router.post("/register/student", authLimiter, async (req, res) => {
  const input = registerStudentSchema.parse(req.body);
  const user = await authService.registerStudent(input, requestContext(req));
  res.status(201).json({ user });
});

/** Teachers self-register and are auto-approved; they can sign in immediately. */
router.post("/register/teacher", authLimiter, async (req, res) => {
  const input = registerTeacherSchema.parse(req.body);
  const user = await authService.registerTeacher(input, requestContext(req));
  res.status(201).json({ user });
});

router.post("/login", strictAuthLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password, requestContext(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  res.json({ user: result.user, accessToken: result.tokens.accessToken });
});

/** Rotating refresh: exchanges the cookie for a new access token + rotated refresh cookie. */
router.post("/refresh", strictAuthLimiter, async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const result = await authService.refreshSession(raw, requestContext(req));
  setRefreshCookie(res, result.tokens.refreshToken);
  res.json({ user: result.user, accessToken: result.tokens.accessToken });
});

router.post("/logout", async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await authService.logout(raw, requestContext(req));
  res.clearCookie(REFRESH_COOKIE, clearRefreshCookieOptions());
  res.status(204).end();
});

router.get("/me", requireAuth, async (_req, res) => {
  const user = await authService.getMe(authenticatedUserId(res));
  res.json({ user });
});

/** List active institutions for registration dropdown. */
router.get("/institutions", async (_req, res) => {
  const { prisma } = await import("../lib/prisma.js");
  const schools = await prisma.school.findMany({
    where: { status: "ACTIVE", archivedAt: null },
    select: { id: true, name: true, city: true, country: true },
    orderBy: { name: "asc" },
  });
  res.json({ institutions: schools });
});

export default router;
