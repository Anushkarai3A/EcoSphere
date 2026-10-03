import type { CookieOptions } from "express";
import { env } from "../config/env.js";

export const REFRESH_COOKIE = "ecosphere_refresh";

/**
 * The refresh token lives in an httpOnly cookie scoped to /api/v1/auth so it is
 * never readable by JS and is only ever transmitted to auth endpoints. secure is
 * forced on in production; sameSite=Lax keeps it working across same-site navigations
 * while blocking cross-site CSRF sends.
 */
/**
 * Whether the refresh cookie must be flagged Secure. Overridable via COOKIE_SECURE
 * for local stacks served over plain http (e.g. the docker-compose web on
 * localhost:8080), where a Secure cookie would be silently dropped by the browser.
 */
export function isSecureCookie(): boolean {
  if (env.COOKIE_SECURE !== undefined) {
    return env.COOKIE_SECURE === "true";
  }
  return env.NODE_ENV === "production";
}

export function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/api/v1/auth",
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

/** Must mirror refreshCookieOptions except no maxAge (the browser clears immediately). */
export function clearRefreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: "lax",
    path: "/api/v1/auth",
  };
}
