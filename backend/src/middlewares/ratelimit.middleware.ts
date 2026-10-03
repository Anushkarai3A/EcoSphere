import type { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

function jsonRateLimitHandler(_req: Request, res: Response): void {
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
  });
}

/** Auth endpoints are brute-force targets: 20 tries / 15 min per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});

/** Stricter for login/refresh where a single credential can be hammered. */
export const strictAuthLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitHandler,
});
