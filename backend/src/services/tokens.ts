import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../lib/http.js";

export type UserRole = "ADMIN" | "TEACHER" | "STUDENT";

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  schoolId: string | null;
  typ: "access";
}

/** Short-lived JWT. `typ` distinguishes access from refresh tokens so one can never be replayed as the other. */
export function signAccessToken(userId: string, role: UserRole, schoolId: string | null = null): string {
  const payload: AccessTokenPayload = { sub: userId, role, schoolId, typ: "access" };
  // env validates JWT_ACCESS_TTL against the ms format at boot; jwt's SignOptions
  // types the field more narrowly, so narrow it here.
  const expiresIn = env.JWT_ACCESS_TTL as SignOptions["expiresIn"];
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
  if (payload.typ !== "access") {
    throw new AppError(401, "INVALID_TOKEN_TYPE", "Token type mismatch");
  }
  return { sub: String(payload.sub), role: payload.role as UserRole, schoolId: payload.schoolId as string | null, typ: "access" };
}

/** Opaque, high-entropy refresh token. Only its SHA-256 hash is ever persisted. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** A refresh rotation shares a familyId so a replayed token can revoke all siblings. */
export function newRefreshFamilyId(): string {
  return randomUUID();
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}
