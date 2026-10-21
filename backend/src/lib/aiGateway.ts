// HTTP gateway to the ai-service (Python FastAPI) for document extraction and
// LLM quiz generation. The ai-service owns all LLM credentials; the backend
// authenticates with the shared X-AI-Service-Token secret.

import { env } from "../config/env.js";
import { AppError } from "./http.js";
import { logger } from "./logger.js";

export interface ExtractedDocument {
  filename: string;
  kind: string;
  text: string;
  tokenCount: number;
}

export interface GeneratedQuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  qType: string;
  difficultyScore: number;
}

export interface GeneratedQuiz {
  runId: string;
  detectedTopic: string;
  /** Exact prompt sent to the LLM — echoed for audit logging. */
  prompt: string;
  questions: GeneratedQuizQuestion[];
}

async function errorDetail(res: Response): Promise<string> {
  const raw = await res.text().catch(() => "");
  if (!raw) return "";
  try {
    const body = JSON.parse(raw) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Fall back to the bounded raw body below.
  }
  return raw.slice(0, 500);
}

async function post<T>(path: string, body: unknown, timeoutMs = env.AI_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Service-Token": env.AI_SERVICE_TOKEN,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await errorDetail(res);
      const status = res.status;
      // Classify provider/config failures without leaking internal details.
      if (status === 401 || status === 403) {
        throw new AppError(502, "AI_AUTH_ERROR", `AI service authentication failed (${status})`);
      }
      if (status === 429) {
        throw new AppError(429, "AI_RATE_LIMITED", detail || "AI service is rate-limited — please retry shortly");
      }
      if (status === 503) {
        throw new AppError(503, "AI_NOT_CONFIGURED", detail || "AI service is not configured");
      }
      if (status === 504) {
        throw new AppError(504, "AI_TIMEOUT", detail || "AI provider request timed out");
      }
      if (status === 400 || status === 422) {
        throw new AppError(422, "AI_INPUT_INVALID", detail || "The AI service rejected the study material");
      }
      if (status === 502) {
        throw new AppError(502, "AI_PROVIDER_ERROR", detail || "AI provider request failed");
      }
      throw new AppError(502, "AI_SERVICE_ERROR", `AI service error (${status})`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.warn(
          { path, statusCode: err.statusCode, code: err.code },
          "AI service request failed",
        );
      }
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn({ path, timeoutMs }, "AI service request timed out");
      throw new AppError(504, "AI_TIMEOUT", "AI service request timed out");
    }
    logger.error({ err, path, timeoutMs }, "AI service request failed before receiving a response");
    throw new AppError(
      502,
      "AI_SERVICE_ERROR",
      "AI service is unreachable. Check that the AI service is running, then retry.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Extract readable text from an uploaded document (PDF/DOCX/PPTX/TXT). */
export async function extractStudyMaterial(input: {
  filename: string;
  mimeType: string;
  contentBase64: string;
}): Promise<ExtractedDocument> {
  const res = await post<{ filename: string; kind: string; text: string; token_count: number }>(
    "/ai/v1/extract",
    {
      filename: input.filename,
      mime_type: input.mimeType,
      content_base64: input.contentBase64,
    },
  );
  return {
    filename: res.filename,
    kind: res.kind,
    text: res.text,
    tokenCount: res.token_count,
  };
}

/** Generate MCQs strictly from extracted study material text. */
export async function generateQuizFromText(input: {
  runId: string;
  text: string;
  count: number;
  difficulty: string;
  topic?: string;
}): Promise<GeneratedQuiz> {
  const res = await post<{
    run_id: string;
    detected_topic: string;
    prompt: string;
    questions: {
      prompt: string;
      options: string[];
      correct_index: number;
      explanation: string;
      q_type: string;
      difficulty_score: number;
    }[];
  }>(
    "/ai/v1/generate/quiz",
    {
      run_id: input.runId,
      text: input.text,
      count: input.count,
      difficulty: input.difficulty,
      topic: input.topic ?? null,
    },
    env.AI_QUIZ_TIMEOUT_MS,
  );
  return {
    runId: res.run_id,
    detectedTopic: res.detected_topic,
    prompt: res.prompt,
    questions: res.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correct_index,
      explanation: q.explanation,
      qType: q.q_type,
      difficultyScore: q.difficulty_score,
    })),
  };
}

export interface StoryboardElement {
  type: string;
  x: number;
  y: number;
  scale?: number;
  color?: string | null;
  motion?: string;
  label?: string | null;
}

export interface StoryboardScene {
  scene_number: number;
  duration: number;
  background_top: string;
  background_bottom: string;
  narration: string;
  elements: StoryboardElement[];
  educational_point: string;
  camera?: string;
  transition?: string;
}

export interface GeneratedAnimationStoryboard {
  topic: string;
  title: string;
  total_duration: number;
  scenes: StoryboardScene[];
}

/** Request AI service to build an educational storyboard using Groq LLM */
export async function generateAnimationStoryboard(input: {
  prompt: string;
  topic?: string;
  durationSeconds: number;
  style: string;
}): Promise<GeneratedAnimationStoryboard> {
  return post<GeneratedAnimationStoryboard>("/ai/v1/generate/animation", {
    prompt: input.prompt,
    topic: input.topic ?? null,
    duration_seconds: input.durationSeconds,
    style: input.style,
  });
}

export interface GeneratedFilmDirection {
  film: string;
  topic: string;
  title: string;
  total_duration: number;
  narrations: string[];
}

/** Ask the Groq film director to pick a story film + write per-beat narration. */
export async function generateFilmDirection(input: {
  prompt: string;
  topic?: string;
  durationSeconds: number;
  style: string;
}): Promise<GeneratedFilmDirection> {
  return post<GeneratedFilmDirection>("/ai/v1/generate/film", {
    prompt: input.prompt,
    topic: input.topic ?? null,
    duration_seconds: input.durationSeconds,
    style: input.style,
  });
}

/**
 * Proxy narration text to the ai-service TTS voice and return raw WAV bytes.
 * Preserves provider/config error categories without exposing internals.
 */
export async function synthesizeNarrationAudio(text: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/ai/v1/generate/narration-audio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Service-Token": env.AI_SERVICE_TOKEN,
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const body = (await res.json()) as { detail?: string };
        if (typeof body.detail === "string") detail = body.detail;
      } catch {
        detail = await res.text().catch(() => "");
      }
      const status = res.status;
      if (status === 401 || status === 403) {
        throw new AppError(502, "TTS_AUTH_ERROR", "Voice service authentication failed");
      }
      if (status === 429) {
        throw new AppError(429, "TTS_RATE_LIMITED", detail || "Voice service is rate-limited — retry shortly");
      }
      if (status === 503) {
        throw new AppError(503, "TTS_NOT_CONFIGURED", detail || "Voice service is not configured");
      }
      if (status === 504) {
        throw new AppError(504, "TTS_TIMEOUT", detail || "Voice service timed out");
      }
      if (status === 400 || status === 422) {
        throw new AppError(422, "TTS_INPUT_INVALID", detail || "Voice service rejected the narration text");
      }
      throw new AppError(502, "TTS_SERVICE_ERROR", detail || `Voice service responded ${status}`);
    }
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new AppError(502, "TTS_SERVICE_ERROR", "Voice service returned empty audio");
    }
    return { bytes: new Uint8Array(buffer), contentType: res.headers.get("content-type") || "audio/wav" };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError(504, "TTS_TIMEOUT", "Voice service timed out. Please retry.");
    }
    throw new AppError(
      502,
      "TTS_SERVICE_ERROR",
      "Voice service is unreachable. Check that the AI service is running, then retry.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

