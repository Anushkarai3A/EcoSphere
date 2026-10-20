import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { postVerificationPayload } from "../lib/aiVerification.js";
import { VERIFICATION_QUEUE, type VerificationJobPayload } from "../lib/jobs.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { questLocation, submissionLocation } from "../lib/postgis.js";
import { syncVerificationChecks } from "../lib/verificationChecks.js";
import { awardAutoApproval } from "../lib/verificationAward.js";

const connection = { url: env.REDIS_URL };
const queue = new Queue<VerificationJobPayload>(VERIFICATION_QUEUE, { connection });

/** Release the queue's Redis connection during shutdown/tests. */
export async function closeVerificationQueue(): Promise<void> {
  await queue.close();
}

/** Result fields cleared whenever a fresh attempt is queued or started. */
const clearedRunResult = {
  startedAt: null,
  completedAt: null,
  overallRecommendation: null,
  overallConfidence: null,
  fraudRisk: null,
  summary: null,
  aiServiceVersion: null,
  errorMessage: null,
} as const;

/** Create/mark the run as pending and hand the submission to the worker. */
export async function enqueueVerification(submissionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const run = await tx.verificationRun.upsert({
      where: { submissionId },
      create: { submissionId, status: "PENDING" },
      update: {
        ...clearedRunResult,
        status: "PENDING",
        attemptCount: { increment: 1 },
      },
    });
    // A queued run must not display results from the previous run.
    await tx.verificationCheck.deleteMany({ where: { runId: run.id } });
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

/** Reset the run before an attempt so failed/replayed jobs cannot show old results. */
async function beginVerificationAttempt(submissionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const run = await tx.verificationRun.findUnique({
      where: { submissionId },
      select: { id: true },
    });
    await tx.verificationRun.updateMany({
      where: { submissionId },
      data: {
        ...clearedRunResult,
        status: "RUNNING",
        startedAt: new Date(),
      },
    });
    if (run) {
      await tx.verificationCheck.deleteMany({ where: { runId: run.id } });
    }
  });
}

/** Worker entrypoint: run the AI pipeline and reconcile the submission. */
export async function runVerification(submissionId: string): Promise<{ status: string }> {
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    select: { status: true },
  });
  if (!submission) {
    throw new Error(`submission ${submissionId} or its quest not found`);
  }
  // A redelivered job for an already-resolved submission is a no-op: retries only
  // apply while verification is still pending. The award itself is also guarded
  // by the compare-and-set in awardAutoApproval.
  if (submission.status !== "PENDING_VERIFICATION") {
    logger.info(
      { submissionId, status: submission.status },
      "verification skipped, submission is not pending",
    );
    return { status: "skipped" };
  }

  await beginVerificationAttempt(submissionId);

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

  return postVerificationPayload<AiVerifyResponse>(payload, {
    timeoutMs: env.AI_TIMEOUT_MS,
  });
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
        errorMessage: null,
      },
    });
    await syncVerificationChecks(tx, run.id, result.checks);
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
    const outcome = await prisma.$transaction((tx) =>
      awardAutoApproval(tx, {
        submissionId,
        acceptanceId: submission.acceptanceId,
        studentId,
        questTitle,
        xp,
        now,
      }),
    );
    if (outcome === "awarded") {
      logger.info({ submissionId, xp }, "submission auto-approved, XP awarded");
    } else {
      logger.info({ submissionId }, "duplicate verification delivery skipped, XP unchanged");
    }
  } else if (rejectAuto) {
    const updated = await prisma.questSubmission.updateMany({
      where: { id: submissionId, status: "PENDING_VERIFICATION" },
      data: {
        status: "AUTO_REJECTED",
        reviewedAt: now,
        reviewNote: result.summary || "Rejected by automated checks",
      },
    });
    if (updated.count === 0) {
      logger.info({ submissionId }, "duplicate verification delivery skipped, status unchanged");
    }
  } else {
    const updated = await prisma.questSubmission.updateMany({
      where: { id: submissionId, status: "PENDING_VERIFICATION" },
      data: { status: "PENDING_MANUAL_REVIEW" },
    });
    if (updated.count === 0) {
      logger.info({ submissionId }, "duplicate verification delivery skipped, status unchanged");
    }
  }
}
