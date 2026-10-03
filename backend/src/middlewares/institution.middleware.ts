import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

/**
 * Requires the authenticated user to have a schoolId.
 * Use on routes that should only be accessible to institution members.
 */
export function requireInstitution(_req: Request, res: Response, next: NextFunction): void {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  if (!auth.schoolId) {
    throw new AppError(403, "NO_INSTITUTION", "You must belong to an institution to access this resource");
  }
  next();
}

/**
 * Requires the authenticated user to be a teacher belonging to an institution.
 *
 * NOTE: institution admin approval was removed — teachers are auto-verified on
 * registration. Verification status is informational only (moderation/display)
 * and no longer gates access. Kept under the same name to avoid touching every
 * route import.
 * Must follow requireAuth + requireRole("TEACHER").
 */
export async function requireVerifiedTeacher(_req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");

  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: auth.userId },
    select: { verificationStatus: true, schoolId: true },
  });

  if (!profile) {
    throw new AppError(403, "NO_TEACHER_PROFILE", "No teacher profile found");
  }
  if (!profile.schoolId) {
    throw new AppError(403, "NO_INSTITUTION", "You must belong to an institution to access this resource");
  }
  // Attach verification info for downstream use
  (res.locals as Record<string, unknown>).teacherProfile = profile;
  next();
}

/**
 * Requires the authenticated user to be an institution admin (role=ADMIN with schoolId).
 */
export function requireInstitutionAdmin(_req: Request, res: Response, next: NextFunction): void {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  if (auth.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Institution admin access required");
  }
  if (!auth.schoolId) {
    throw new AppError(403, "NO_INSTITUTION", "You must belong to an institution to act as institution admin");
  }
  next();
}

/**
 * Helper to get the authenticated user's schoolId with type safety.
 */
export function getSchoolId(res: Response): string {
  const auth = res.locals.auth;
  if (!auth?.schoolId) {
    throw new AppError(403, "NO_INSTITUTION", "No institution associated with your account");
  }
  return auth.schoolId;
}
