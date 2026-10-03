import type { Response } from "express";

/**
 * JSON.stringify does not serialize bigint (Prisma BigInt columns). Convert
 * bigints to decimal strings globally so XP values survive res.json().
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/** Patch res.json to be bigint-safe. Call once after creating the app. */
export function installBigIntSafeJson(app: { response: { json: unknown } }): void {
  const originalJson = app.response.json as (body: unknown) => Response;
  app.response.json = function json(this: Response, body: unknown): Response {
    const sanitized = JSON.parse(JSON.stringify(body, bigIntReplacer));
    return originalJson.call(this, sanitized);
  };
}
