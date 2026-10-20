import { Prisma } from "@prisma/client";

type AwardTransaction = Pick<
  Prisma.TransactionClient,
  "questSubmission" | "questAcceptance" | "xpTransaction"
>;

export interface AutoApprovalInput {
  submissionId: string;
  acceptanceId: string;
  studentId: string;
  questTitle: string;
  xp: number;
  now: Date;
}

export type AutoApprovalOutcome = "awarded" | "already-processed";

/**
 * Awards quest-completion XP at most once per submission.
 *
 * The conditional update is a compare-and-set on the submission row: concurrent
 * workers block on the same row, and only the transaction that observes
 * PENDING_VERIFICATION flips it to AUTO_APPROVED. This is stronger than a
 * read-then-check guard and needs no schema change. The ledger lookup is a
 * second line of defence for data created by older/other code paths.
 */
export async function awardAutoApproval(
  tx: AwardTransaction,
  input: AutoApprovalInput,
): Promise<AutoApprovalOutcome> {
  const existing = await tx.xpTransaction.findFirst({
    where: {
      sourceType: "QUEST_COMPLETION",
      sourceId: input.submissionId,
    },
    select: { id: true },
  });
  if (existing) {
    return "already-processed";
  }

  const claim = await tx.questSubmission.updateMany({
    where: { id: input.submissionId, status: "PENDING_VERIFICATION" },
    data: { status: "AUTO_APPROVED", reviewedAt: input.now },
  });
  if (claim.count !== 1) {
    return "already-processed";
  }

  await tx.questAcceptance.update({
    where: { id: input.acceptanceId },
    data: {
      status: "APPROVED",
      completedAt: input.now,
      xpAwarded: input.xp,
    },
  });

  const last = await tx.xpTransaction.findFirst({
    where: { userId: input.studentId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfter: true },
  });
  const balanceAfter = Number(last?.balanceAfter ?? 0) + input.xp;

  await tx.xpTransaction.create({
    data: {
      userId: input.studentId,
      sourceType: "QUEST_COMPLETION",
      sourceId: input.submissionId,
      amount: input.xp,
      balanceAfter,
      note: input.questTitle,
    },
  });

  return "awarded";
}
