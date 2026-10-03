import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../lib/http.js";
import { logger } from "../lib/logger.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
  });
}

/**
 * Centralized error middleware. Every thrown/rejected error lands here:
 * ZodError -> 422 with field errors; AppError -> its status/code; body-parse
 * failures -> 400; anything else -> 500 with a logged stack (never leaked).
 * Uses the global logger (never req.log) so errors raised before request
 * logging middleware ran are still recorded.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.flatten().fieldErrors,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // multer signals oversized files / too many fields with typed errors.
  const multerError = err as { name?: string; code?: string };
  if (multerError.name === "MulterError") {
    const isTooBig = multerError.code === "LIMIT_FILE_SIZE";
    res.status(isTooBig ? 413 : 400).json({
      error: {
        code: isTooBig ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: isTooBig ? "One or more files exceed the upload size limit" : "Upload failed",
      },
    });
    return;
  }

  // express.json() / body-parser signals malformed JSON with err.type.
  const parseError = err as { type?: string };
  if (parseError.type === "entity.parse.failed") {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
    return;
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, "unhandled error");
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
}
