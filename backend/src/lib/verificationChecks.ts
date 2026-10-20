import { Prisma, type CheckStatus, type VerificationCheckType } from "@prisma/client";

export interface VerificationCheckInput {
  check_type: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  score?: number;
  confidence?: number;
  message?: string;
  details?: Record<string, unknown>;
}

type CheckStore = Pick<Prisma.TransactionClient, "verificationCheck">;

/**
 * Reconciles persisted checks with the checks from the latest AI response.
 *
 * Existing (runId, checkType) rows are updated in place so their identity is
 * stable. Types the AI no longer returns are deleted, and every mutable field is
 * written explicitly so a re-run cannot inherit stale values.
 */
export async function syncVerificationChecks(
  tx: CheckStore,
  runId: string,
  checks: VerificationCheckInput[],
): Promise<void> {
  const checkTypes = [
    ...new Set(checks.map((check) => check.check_type as VerificationCheckType)),
  ];

  await tx.verificationCheck.deleteMany({
    where: {
      runId,
      ...(checkTypes.length > 0 ? { checkType: { notIn: checkTypes } } : {}),
    },
  });

  for (const check of checks) {
    const checkType = check.check_type as VerificationCheckType;
    const values = {
      status: check.status as CheckStatus,
      score: check.score ?? null,
      confidence: check.confidence ?? null,
      message: check.message ?? null,
      details:
        check.details === undefined
          ? Prisma.DbNull
          : (check.details as Prisma.InputJsonValue),
    };

    await tx.verificationCheck.upsert({
      where: { runId_checkType: { runId, checkType } },
      create: { runId, checkType, ...values },
      update: values,
    });
  }
}
