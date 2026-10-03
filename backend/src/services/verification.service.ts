import { Queue } from "bullmq";
import { Prisma, type CheckStatus, type VerificationCheckType } from "@prisma/client";
import { env } from "../config/env.js";
import { VERIFICATION_QUEUE, type VerificationJobPayload } from "../lib/jobs.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { questLocation, submissionLocation } from "../lib/postgis.js";

const connection = { url: env.REDIS_URL };
const queue = new Queue<VerificationJobPayload>(VERIFICATION_QUEUE, { connection });

/** Create/mark the run as pending and hand the submission to the worker. */
export async function enqueueVerification(submissionId: string): Promise<void> {
  await prisma.verificationRun.upsert({
    where: { submissionId },
    create: { submissionId, status: "PENDING" },
    update: { status: "PENDING", errorMessage: null, attemptCount: { increment: 1 } },
  });
  await queue.add(
    "verify",
    { submissionId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    },
  );
}

export interface AiCheckResult {
  check_type: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  score?: number;
  confidence?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface AiVerifyResponse {
  submission_id: string;
  overall_recommendation: "APPROVE" | "REJECT" | "NEEDS_MANUAL_REVIEW";
  overall_confidence: number;
  fraud_risk: "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  checks: AiCheckResult[];
}

/** Worker entrypoint: run the AI pipeline and reconcile the submission. */
export async function runVerification(submissionId: string): Promise<{ status: string }> {
  await prisma.verificationRun.updateMany({
    where: { submissionId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await callAiService(submissionId);
    await recordVerificationRun(submissionId, result);
    await reconcileSubmission(submissionId, result);
    return { status: "completed" };
  } catch (err) {
    await prisma.verificationRun.updateMany({
      where: { submissionId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : "unknown error",
      },
    });
    throw err; // propagate so BullMQ schedules the configured retry
  }
}

async function callAiService(submissionId: string): Promise<AiVerifyResponse> {
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: { acceptance: { include: { quest: true } }, assets: true },
  });
  if (!submission?.acceptance.quest) {
    throw new Error(`submission ${submissionId} or its quest not found`);
  }
  const quest = submission.acceptance.quest;

  const [device, qLocation] = await Promise.all([
    submissionLocation(submissionId),
    questLocation(quest.id),
  ]);
  if (!device) {
    throw new Error(`submission ${submissionId} has no recorded location`);
  }

  const payload = {
    submission_id: submission.id,
    quest: {
      category: quest.category,
      required_proof_type: quest.requiredProofType,
      lat: qLocation?.lat ?? null,
      lng: qLocation?.lng ?? null,
      radius_meters: quest.radiusMeters,
    },
    device: {
      latitude: device.lat,
      longitude: device.lng,
      accuracy_meters: submission.locationAccuracyM ?? null,
    },
    submitted_at: (submission.deviceTimestamp ?? submission.submittedAt).toISOString(),
    policy: { checks: [], thresholds: {} },
    assets: submission.assets.map((a) => ({
      public_id: a.cloudinaryPublicId,
      url: a.secureUrl,
      type: a.assetType,
    })),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${env.AI_SERVICE_URL}/ai/v1/verify/submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`AI service responded ${res.status}`);
    }
    return (await res.json()) as AiVerifyResponse;
  } finally {
    clearTimeout(timeout);
  }
}

async function recordVerificationRun(submissionId: string, result: AiVerifyResponse): Promise<void> {
  const run = await prisma.verificationRun.findUnique({ where: { submissionId } });
  if (!run) {
    throw new Error(`verification run for ${submissionId} not found`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.verificationRun.update({
      where: { submissionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        overallRecommendation: result.overall_recommendation,
        overallConfidence: result.overall_confidence,
        fraudRisk: result.fraud_risk,
        summary: result.summary,
        aiServiceVersion: "stub-0.1",
      },
    });
    for (const check of result.checks) {
      await tx.verificationCheck.upsert({
        where: { runId_checkType: { runId: run.id, checkType: check.check_type as VerificationCheckType } },
        create: {
          runId: run.id,
          checkType: check.check_type as VerificationCheckType,
          status: check.status as CheckStatus,
          score: check.score,
          confidence: check.confidence,
          message: check.message,
          details: check.details as Prisma.InputJsonValue | undefined,
        },
        update: {},
      });
    }
  });
}

/**
 * Apply the AI recommendation (FR-V5): auto-resolve only when the quest's policy
 * allows it and confidence clears the threshold; otherwise route to review.
 * XP is awarded via the XpTransaction ledger in the same transaction (FR-G1).
 */
async function reconcileSubmission(submissionId: string, result: AiVerifyResponse): Promise<void> {
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: { acceptance: { include: { quest: true } } },
  });
  if (!submission?.acceptance.quest) return;

  const quest = submission.acceptance.quest;
  const policy = quest.policyId
    ? await prisma.aiVerificationPolicy.findUnique({ where: { id: quest.policyId } })
    : await prisma.aiVerificationPolicy.findFirst({ where: { isDefault: true } });
  const autoApprove = policy?.autoApproveEnabled ?? true;
  const autoApproveMin = policy ? Number(policy.autoApproveMinConfidence) : 0.95;
  const autoReject = policy?.autoRejectEnabled ?? false;
  const autoRejectMin = policy ? Number(policy.autoRejectMinConfidence) : 0.99;

  const now = new Date();
  const studentId = submission.acceptance.studentId;
  const questTitle = quest.title;
  const recommendation = result.overall_recommendation;
  const confidence = result.overall_confidence;

  const approveAuto =
    recommendation === "APPROVE" && autoApprove && confidence >= autoApproveMin;
  const rejectAuto =
    recommendation === "REJECT" && autoReject && confidence >= autoRejectMin;

  if (approveAuto) {
    const xp = Number(quest.xpReward);
    await prisma.$transaction(async (tx) => {
      await tx.questSubmission.update({
        where: { id: submissionId },
        data: { status: "AUTO_APPROVED", reviewedAt: now },
      });
      await tx.questAcceptance.update({
        where: { id: submission.acceptanceId },
        data: { status: "APPROVED", completedAt: now, xpAwarded: xp },
      });
      const last = await tx.xpTransaction.findFirst({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
      });
      const balanceAfter = Number(last?.balanceAfter ?? 0) + xp;
      await tx.xpTransaction.create({
        data: {
          userId: studentId,
          sourceType: "QUEST_COMPLETION",
          sourceId: submissionId,
          amount: xp,
          balanceAfter,
          note: questTitle,
        },
      });
    });
    logger.info({ submissionId, xp }, "submission auto-approved, XP awarded");
  } else if (rejectAuto) {
    await prisma.questSubmission.update({
      where: { id: submissionId },
      data: {
        status: "AUTO_REJECTED",
        reviewedAt: now,
        reviewNote: result.summary || "Rejected by automated checks",
      },
    });
  } else {
    await prisma.questSubmission.update({
      where: { id: submissionId },
      data: { status: "PENDING_MANUAL_REVIEW" },
    });
  }
}
