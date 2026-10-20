import assert from "node:assert/strict";
import http, { type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

// Configure the environment before importing env.ts. The token is explicit so
// the test does not depend on a developer-local .env file.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AI_SERVICE_TOKEN = "test-service-token";

const { env } = await import("../config/env.js");
const { postVerificationPayload, resolveAiTimeout } = await import("./aiVerification.js");

interface CapturedRequest {
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
}

async function startServer(status: number, responseBody: unknown, delayMs = 0) {
  let captured: CapturedRequest | undefined;
  const server = http.createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      captured = { url: req.url, headers: req.headers, body };
      const timer = setTimeout(() => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(responseBody));
      }, delayMs);
      res.on("close", () => clearTimeout(timer));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    captured: () => captured,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

test("uses AI_TIMEOUT_MS when no override is supplied", () => {
  assert.equal(resolveAiTimeout(), env.AI_TIMEOUT_MS);
  assert.equal(resolveAiTimeout(1_234), 1_234);
});

test("aborts a request after the configured timeout", async () => {
  const server = await startServer(200, { ok: true }, 400);
  try {
    // The AbortError (rather than a 200) proves the timeout fired before the
    // delayed response was written.
    await assert.rejects(
      () => postVerificationPayload({}, { baseUrl: server.baseUrl, timeoutMs: 25 }),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
  } finally {
    await server.close();
  }
});

test("sends the configured service token header", async () => {
  const server = await startServer(200, { ok: true });
  try {
    const payload = { submission_id: "submission-1" };
    const result = await postVerificationPayload<{ ok: boolean }>(payload, {
      baseUrl: server.baseUrl,
    });

    assert.equal(result.ok, true);
    const captured = server.captured();
    assert.ok(captured, "server did not receive a request");
    assert.equal(env.AI_SERVICE_TOKEN, "test-service-token");
    assert.equal(captured.headers["x-ai-service-token"], "test-service-token");
    assert.equal(captured.headers["content-type"], "application/json");
    assert.equal(captured.url, "/ai/v1/verify/submission");
    assert.deepEqual(JSON.parse(captured.body), payload);
  } finally {
    await server.close();
  }
});

test("refuses to call the AI service without a token", async () => {
  await assert.rejects(
    () => postVerificationPayload({}, { serviceToken: "", baseUrl: "http://127.0.0.1:1" }),
    /AI_SERVICE_TOKEN is not configured/,
  );
});

test("does not expose the service token in error messages", async () => {
  const server = await startServer(403, { detail: "invalid service token" });
  try {
    await assert.rejects(
      () => postVerificationPayload({}, { baseUrl: server.baseUrl }),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "AI service responded 403");
        assert.ok(!err.message.includes("test-service-token"));
        return true;
      },
    );
  } finally {
    await server.close();
  }
});
