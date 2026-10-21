import assert from "node:assert/strict";
import http, { type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.AI_SERVICE_TOKEN = "test-service-token";
process.env.AI_SERVICE_URL = "http://127.0.0.1:1";

const { env } = await import("../config/env.js");
const { AppError } = await import("./http.js");
const { generateQuizFromText, synthesizeNarrationAudio } = await import("./aiGateway.js");

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

async function startBinaryServer(status: number, body: Buffer, contentType: string, delayMs = 0) {
  let captured: CapturedRequest | undefined;
  const server = http.createServer((req, res) => {
    let requestBody = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      requestBody += chunk;
    });
    req.on("end", () => {
      captured = { url: req.url, headers: req.headers, body: requestBody };
      const timer = setTimeout(() => {
        res.writeHead(status, { "content-type": contentType });
        res.end(body);
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

const input = {
  runId: "run-test",
  text: "Photosynthesis occurs in chloroplasts.",
  count: 5,
  difficulty: "MEDIUM",
};

test("sends the service token and maps a successful quiz response", async () => {
  const server = await startServer(200, {
    run_id: "run-test",
    detected_topic: "Photosynthesis",
    prompt: "Generate questions",
    questions: [
      {
        prompt: "Where does photosynthesis occur?",
        options: ["Chloroplasts", "Nucleus", "Mitochondria", "Ribosomes"],
        correct_index: 0,
        explanation: "Chlorophyll in chloroplasts captures light.",
        q_type: "MCQ",
        difficulty_score: 0.5,
      },
    ],
  });

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    const result = await generateQuizFromText(input);
    const captured = server.captured();

    assert.equal(captured?.headers["x-ai-service-token"], "test-service-token");
    assert.equal(captured?.url, "/ai/v1/generate/quiz");
    assert.equal(result.detectedTopic, "Photosynthesis");
    assert.equal(result.questions[0]?.correctIndex, 0);
    assert.equal(result.questions[0]?.options.length, 4);
  } finally {
    await server.close();
  }
});

test("preserves an AI configuration error as 503", async () => {
  const server = await startServer(503, {
    detail: "Groq API key is not configured. Set AI_GROQ_API_KEY for the AI service.",
  });

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    await assert.rejects(
      () => generateQuizFromText(input),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 503 &&
        err.code === "AI_NOT_CONFIGURED" &&
        err.message.includes("AI_GROQ_API_KEY"),
    );
  } finally {
    await server.close();
  }
});

test("maps a provider failure to 502 and does not leak the service token", async () => {
  const server = await startServer(502, { detail: "LLM request failed" });

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    await assert.rejects(
      () => generateQuizFromText(input),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === "AI_PROVIDER_ERROR" &&
        !err.message.includes("test-service-token"),
    );
  } finally {
    await server.close();
  }
});

test("aborts a slow quiz request with 504", async () => {
  const server = await startServer(200, { ok: true }, 400);
  const previousTimeout = env.AI_QUIZ_TIMEOUT_MS;

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    env.AI_QUIZ_TIMEOUT_MS = 25;
    await assert.rejects(
      () => generateQuizFromText(input),
      (err: unknown) =>
        err instanceof AppError && err.statusCode === 504 && err.code === "AI_TIMEOUT",
    );
  } finally {
    env.AI_QUIZ_TIMEOUT_MS = previousTimeout;
    await server.close();
  }
});

test("reports a refused connection as a safe 502", async () => {
  const server = await startServer(200, { ok: true });
  const closedUrl = server.baseUrl;
  await server.close();

  env.AI_SERVICE_URL = closedUrl;
  await assert.rejects(
    () => generateQuizFromText(input),
    (err: unknown) =>
      err instanceof AppError &&
      err.statusCode === 502 &&
      err.code === "AI_SERVICE_ERROR" &&
      err.message.includes("unreachable") &&
      !err.message.includes("test-service-token") &&
      !err.message.includes(closedUrl),
  );
});

test("proxies narration WAV bytes with the service token", async () => {
  const wav = Buffer.from("RIFFtest-wav-bytes");
  const server = await startBinaryServer(200, wav, "audio/wav");

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    const result = await synthesizeNarrationAudio("Save water at home.");
    const captured = server.captured();

    assert.equal(captured?.headers["x-ai-service-token"], "test-service-token");
    assert.equal(captured?.url, "/ai/v1/generate/narration-audio");
    assert.deepEqual(result.bytes, new Uint8Array(wav));
    assert.equal(result.contentType, "audio/wav");
    assert.equal(JSON.parse(captured?.body ?? "{}").text, "Save water at home.");
  } finally {
    await server.close();
  }
});

test("maps an unconfigured TTS provider to 503", async () => {
  const server = await startServer(503, {
    detail: "TTS model is not configured. Set AI_TTS_MODEL for the AI service.",
  });

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    await assert.rejects(
      () => synthesizeNarrationAudio("Save water."),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 503 &&
        err.code === "TTS_NOT_CONFIGURED" &&
        err.message.includes("AI_TTS_MODEL"),
    );
  } finally {
    await server.close();
  }
});

test("maps a TTS provider rejection to 502 with safe detail", async () => {
  const server = await startServer(502, {
    detail: "Groq rejected the TTS request parameters. Check AI_TTS_FORMAT.",
  });

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    await assert.rejects(
      () => synthesizeNarrationAudio("Save water."),
      (err: unknown) =>
        err instanceof AppError &&
        err.statusCode === 502 &&
        err.code === "TTS_SERVICE_ERROR" &&
        err.message.includes("AI_TTS_FORMAT") &&
        !err.message.includes(server.baseUrl) &&
        !err.message.includes("test-service-token"),
    );
  } finally {
    await server.close();
  }
});

test("aborts a slow TTS request with 504", async () => {
  const server = await startBinaryServer(200, Buffer.from("RIFF"), "audio/wav", 400);
  const previousTimeout = env.AI_TIMEOUT_MS;

  try {
    env.AI_SERVICE_URL = server.baseUrl;
    env.AI_TIMEOUT_MS = 25;
    await assert.rejects(
      () => synthesizeNarrationAudio("Save water."),
      (err: unknown) =>
        err instanceof AppError && err.statusCode === 504 && err.code === "TTS_TIMEOUT",
    );
  } finally {
    env.AI_TIMEOUT_MS = previousTimeout;
    await server.close();
  }
});
