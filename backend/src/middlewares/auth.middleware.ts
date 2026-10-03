import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http.js";
import { verifyAccessToken, type UserRole } from "../services/tokens.js";

export type { UserRole } from "../services/tokens.js";

export interface AuthContext {
  userId: string;
  role: UserRole;
  schoolId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      auth?: AuthContext;
    }
  }
}

/** Validates the Bearer access token and populates res.locals.auth. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  const payload = verifyAccessToken(token);
  res.locals.auth = { userId: payload.sub, role: payload.role, schoolId: payload.schoolId };
  next();
}

/** Route guard factory: allow only the given roles. Must follow requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const auth = res.locals.auth;
    if (!auth || !roles.includes(auth.role)) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
    next();
  };
}
