import express, { type Express, type RequestHandler } from "express";
import fs from "node:fs";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { installBigIntSafeJson } from "./lib/json.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import apiRoutes from "./routes/index.js";
import healthRoutes from "./routes/health.routes.js";

/**
 * CORS allows one-or-more origins (comma-separated in env) and never `*` when
 * credentials are enabled. Requests without an Origin header (curl, healthchecks)
 * are permitted so ops tooling isn't blocked.
 */
function corsMiddleware(): RequestHandler {
  const allowed = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return cors({
    origin(origin, callback) {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });
}

/**
 * Assembles the Express application. Kept separate from server.ts so tests and
 * the worker can import the same wiring without binding a port.
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  // Explicit hop count (never `true`): rate limiting keys on req.ip, which must
  // not be spoofable via X-Forwarded-For from untrusted proxies.
  app.set("trust proxy", env.TRUST_PROXY_HOPS > 0 ? env.TRUST_PROXY_HOPS : false);

  app.use(helmet());
  // Logging must come before body parsing: a malformed-JSON error is routed to the
  // error handler before later middleware runs, and req.log must exist by then.
  app.use(pinoHttp({ logger }));
  app.use(corsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: "10mb" })); // evidence uploads are handled elsewhere; JSON stays small

  // Evidence uploads are stored on local disk (UPLOAD_DIR) and served back under
  // /api/v1/uploads/*. Filenames are unguessable UUIDs; treat access as private.
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  app.use("/api/v1/uploads", express.static(env.UPLOAD_DIR, { immutable: true, maxAge: "7d" }));

  // Prisma BigInt columns must survive res.json() serialization.
  installBigIntSafeJson(app);

  // Liveness/readiness live at the root so load balancers and Docker healthchecks
  // don't depend on the API version prefix.
  app.use(healthRoutes);

  app.use("/api/v1", apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
