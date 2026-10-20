import { Worker, type Job } from "bullmq";
import { env } from "../config/env.js";
import { VERIFICATION_QUEUE, type VerificationJobPayload } from "../lib/jobs.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { runVerification } from "../services/verification.service.js";

/**
 * Job queue for AI evidence verification. Submissions are enqueued by the API on
 * upload; this worker polls Redis, runs the verification pipeline against the
 * FastAPI service, and persists results. Keeping it in the same package lets us
 * share the Prisma client and app-layer types.
 */
const connection = { url: env.REDIS_URL };

async function processVerificationJob(
  job: Job<VerificationJobPayload>,
): Promise<{ status: string }> {
  logger.info(
    { jobId: job.id, submissionId: job.data.submissionId, attempt: job.attemptsMade },
    "verification job received",
  );
  return runVerification(job.data.submissionId);
}

export async function startWorker(): Promise<void> {
  const worker = new Worker<VerificationJobPayload>(
    VERIFICATION_QUEUE,
    processVerificationJob,
    { connection },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, err }, "verification job failed");
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= attempts) {
      // Exhausted retries: fall back to manual review so the teacher can decide
      // even when the AI service is down (FR-V6). Only reopen submissions that
      // are still awaiting verification; never overwrite a terminal outcome.
      void prisma.questSubmission
        .updateMany({
          where: {
            id: job.data.submissionId,
            status: "PENDING_VERIFICATION",
          },
          data: { status: "PENDING_MANUAL_REVIEW" },
        })
        .catch((updateErr) => logger.error({ err: updateErr }, "failed to fallback submission"));
    }
  });
  worker.on("error", (err) => {
    logger.error({ err }, "worker connection error");
  });

  await worker.waitUntilReady();
  logger.info("verification worker started");

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "worker shutting down");
    await worker.close();
    logger.info("worker shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

startWorker().catch((err) => {
  logger.fatal({ err }, "failed to start worker");
  process.exit(1);
});
