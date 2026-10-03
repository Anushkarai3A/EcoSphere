import { env } from "../config/env.js";
import { AppError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

const queueInclude = {
  acceptance: {
    include: {
      quest: {
        select: {
          id: true,
          title: true,
          category: true,
          xpReward: true,
          addressText: true,
          radiusMeters: true,
          requiredProofType: true,
          minPhotoCount: true,
        },
      },
      student: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  },
  assets: true,
  verification: { include: { checks: { orderBy: { checkType: "asc" } } } },
} as const;

/** Teacher's pending-review queue (FR-R1): oldest first, with AI breakdown, institution-scoped. */
export async function reviewQueue(teacherId: string, teacherSchoolId: string) {
  const items = await prisma.questSubmission.findMany({
    where: {
      status: "PENDING_MANUAL_REVIEW",
      acceptance: { quest: { teacherId, teacher: { schoolId: teacherSchoolId } } },
    },
    include: queueInclude,
    orderBy: { submittedAt: "asc" },
  });

  return {
    items: items.map((s) => ({
      id: s.id,
      status: s.status,
      submittedAt: s.submittedAt,
      notes: s.notes,
      reSubmissionOf: s.reSubmissionOf,
      reviewNote: s.reviewNote,
      assets: s.assets,
      verification: s.verification,
      student: s.acceptance.student,
      quest: s.acceptance.quest,
    })),
    count: items.length,
  };
}

export interface ReviewDecisionInput {
  decision: "APPROVE" | "REJECT";
  bonusXp?: number;
  note?: string;
}

/** Teacher approves (awards XP + optional bonus) or rejects a submission (FR-R2/R3), institution-scoped. */
export async function reviewSubmission(
  teacherId: string,
  teacherSchoolId: string,
  submissionId: string,
  input: ReviewDecisionInput,
) {
  const submission = await prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: {
      acceptance: { include: { quest: { include: { teacher: { select: { schoolId: true } } } } } },
      verification: { include: { checks: true } },
    },
  });

  if (!submission?.acceptance.quest) {
    throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
  }
  const quest = submission.acceptance.quest;
  if (quest.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You can only review your own quests' submissions");
  }
  // INSTITUTION ISOLATION: verify teacher belongs to same school
  if (quest.teacher.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only review submissions from your institution");
  }
  if (submission.status !== "PENDING_MANUAL_REVIEW") {
    throw new AppError(409, "NOT_PENDING_REVIEW", "Only pending submissions can be reviewed");
  }

  const now = new Date();
  const studentId = submission.acceptance.studentId;

  if (input.decision === "APPROVE") {
    const bonus = Math.min(Math.max(input.bonusXp ?? 0, 0), env.BONUS_XP_CAP);
    const xp = Number(submission.acceptance.quest.xpReward) + bonus;

    await prisma.$transaction(async (tx) => {
      await tx.questSubmission.update({
        where: { id: submissionId },
        data: {
          status: "APPROVED",
          reviewedBy: teacherId,
          reviewedAt: now,
          reviewNote: input.note ?? null,
          bonusXp: bonus,
        },
      });
      await tx.questAcceptance.update({
        where: { id: submission.acceptanceId },
        data: {
          status: "APPROVED",
          completedAt: now,
          xpAwarded: xp,
          bonusXp: bonus,
        },
      });
      const last = await tx.xpTransaction.findFirst({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
      });
      await tx.xpTransaction.create({
        data: {
          userId: studentId,
          sourceType: "QUEST_COMPLETION",
          sourceId: submissionId,
          amount: xp,
          balanceAfter: Number(last?.balanceAfter ?? 0) + xp,
          note: quest.title,
        },
      });
    });

    logger.info(
      { submissionId, xp, bonus, teacherId },
      "submission approved by teacher, XP awarded",
    );
  } else {
    if (!input.note?.trim()) {
      throw new AppError(400, "REVIEW_NOTE_REQUIRED", "A reason is required when rejecting");
    }
    await prisma.questSubmission.update({
      where: { id: submissionId },
      data: {
        status: "REJECTED",
        reviewedBy: teacherId,
        reviewedAt: now,
        reviewNote: input.note.trim(),
      },
    });
    logger.info({ submissionId, teacherId }, "submission rejected by teacher");
  }

  return prisma.questSubmission.findUnique({
    where: { id: submissionId },
    include: {
      acceptance: { include: { quest: true } },
      verification: { include: { checks: { orderBy: { checkType: "asc" } } } },
    },
  });
}
