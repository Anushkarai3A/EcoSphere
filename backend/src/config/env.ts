import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";
import { findInsecureProductionSecrets, insecureProductionSecretsMessage } from "./secrets.js";

// dotenv resolves paths relative to process.cwd(), which varies by how the app
// is launched. Anchor to this module's real location instead: backend/.env for
// workspace-local overrides, then the repo-root .env as a shared fallback.
const backendEnv = fileURLToPath(new URL("../../.env", import.meta.url));
const repoRootEnv = fileURLToPath(new URL("../../../.env", import.meta.url));
dotenv.config({ path: backendEnv });
dotenv.config({ path: repoRootEnv, override: false });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-do-not-use"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-do-not-use"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Force refresh-cookie Secure flag off for local http stacks (defaults to
  // following NODE_ENV: Secure only in production).
  COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Number of trusted reverse-proxy hops. 0 (default) = no proxy, request IP is
  // the socket IP. Set to 1 when behind Render/Vercel/etc. Never `true` — that
  // lets clients spoof X-Forwarded-For and bypass IP rate limiting.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  // Shared secret between backend and the ai-service (must match ai-service AI_SERVICE_TOKEN).
  AI_SERVICE_TOKEN: z.string().min(1).default("dev-ai-token"),
  // Upper bound for a standard AI call (extraction / verification).
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  // Quiz generation may make several sequential chunk calls; allow more time.
  AI_QUIZ_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  LOG_LEVEL: z.string().default("info"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  // Local disk storage for evidence uploads (swap for object storage later).
  UPLOAD_DIR: z.string().default("uploads"),
  // Per-file / per-request evidence upload limits.
  UPLOAD_MAX_FILE_MB: z.coerce.number().int().positive().default(15),
  UPLOAD_MAX_TOTAL_MB: z.coerce.number().int().positive().default(40),
  // Upper bound for teacher-awarded bonus XP (FR-R3).
  BONUS_XP_CAP: z.coerce.number().int().min(0).default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable diff instead of cryptic runtime failures.
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:");
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const insecureSecrets = findInsecureProductionSecrets(parsed.data);
if (insecureSecrets.length > 0) {
  // Names only: never echo the configured values.
  // eslint-disable-next-line no-console
  console.error(insecureProductionSecretsMessage(insecureSecrets));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
