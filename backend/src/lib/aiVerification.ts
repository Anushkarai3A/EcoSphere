// HTTP client for the ai-service verification endpoint.
//
// Kept separate from verification.service so it can be tested without pulling in
// BullMQ/Prisma. The shared secret is read from configuration; there is no
// unauthenticated fallback.

import { env } from "../config/env.js";

export interface AiVerificationRequestOptions {
  baseUrl?: string;
  serviceToken?: string;
  timeoutMs?: number;
}

/** Configured AI timeout (AI_TIMEOUT_MS); an explicit override exists for tests. */
export function resolveAiTimeout(overrideMs?: number): number {
  return overrideMs ?? env.AI_TIMEOUT_MS;
}

export async function postVerificationPayload<T>(
  payload: unknown,
  options: AiVerificationRequestOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? env.AI_SERVICE_URL;
  const serviceToken = options.serviceToken ?? env.AI_SERVICE_TOKEN;
  const timeoutMs = resolveAiTimeout(options.timeoutMs);

  if (!serviceToken) {
    throw new Error(
      "AI_SERVICE_TOKEN is not configured; refusing to call the AI service unauthenticated",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/ai/v1/verify/submission`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-AI-Service-Token": serviceToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`AI service responded ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}
