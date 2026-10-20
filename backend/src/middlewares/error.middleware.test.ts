import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/http.js";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
const { errorHandler } = await import("./error.middleware.js");

interface Captured {
  statusCode: number;
  body: unknown;
}

function invoke(err: unknown): Captured {
  const captured: Captured = { statusCode: 0, body: undefined };
  const req = { method: "POST", originalUrl: "/api/v1/auth/login" } as Request;
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  } as unknown as Response;
  errorHandler(err, req, res, (() => undefined) as NextFunction);
  return captured;
}

test("database connectivity failures return a generic 503", () => {
  const err = Object.create(Prisma.PrismaClientInitializationError.prototype) as Error;
  err.message = "Can't reach database server at localhost:5433 (secret connection details)";

  const result = invoke(err);

  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.body, {
    error: { code: "DATABASE_UNAVAILABLE", message: "Service temporarily unavailable" },
  });
});

test("unexpected errors stay 500 and never leak their message", () => {
  const result = invoke(new Error("password=super-secret internal failure"));

  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
  });
});

test("known AppErrors keep their status and safe message", () => {
  const result = invoke(new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password"));

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, {
    error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password", details: undefined },
  });
});
