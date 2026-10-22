import type { GradeStatus, Prisma, PrismaClient, SubmissionStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";

/**
 * Narrow Prisma surface used by this service. It is an optional parameter so
 * tests can inject a fake without a live database (same pattern as
 * verificationAward taking an injectable transaction). Production callers use
 * the default client.
 */
export type ReviewDb = Pick<
  PrismaClient,
  | "questSubmission"
  | "questAcceptance"
  | "xpTransaction"
  | "assignmentSubmission"
  | "quizAttempt"
  | "verificationRun"
  | "$transaction"
>;

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
export async function reviewQueue(teacherId: string, teacherSchoolId: string, db: ReviewDb = prisma) {
  const items = await db.questSubmission.findMany({
    where: {
      status: "PENDING_MANUAL_REVIEW",
      // Institution scope reads the author's TeacherProfile.schoolId — the same
      // source requireVerifiedTeacher validates for the viewer. Quest.teacher.schoolId
      // (User.schoolId) is NULL for accounts predating the institution isolation
      // migration, which silently excluded their submissions from this queue.
      acceptance: { quest: { teacherId, teacher: { teacherProfile: { schoolId: teacherSchoolId } } } },
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
  db: ReviewDb = prisma,
) {
  const submission = await db.questSubmission.findUnique({
    where: { id: submissionId },
    include: {
      acceptance: {
        include: {
          quest: {
            include: {
              teacher: { select: { schoolId: true, teacherProfile: { select: { schoolId: true } } } },
            },
          },
        },
      },
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
  // INSTITUTION ISOLATION: profile school is authoritative (matches the
  // viewer's scope from requireVerifiedTeacher); User.schoolId is a legacy
  // fallback for rows created before the institution isolation migration.
  const questSchoolId = quest.teacher.teacherProfile?.schoolId ?? quest.teacher.schoolId;
  if (questSchoolId !== teacherSchoolId) {
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

    await db.$transaction(async (tx) => {
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
    await db.questSubmission.update({
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

  return db.questSubmission.findUnique({
    where: { id: submissionId },
    include: {
      acceptance: { include: { quest: true } },
      verification: { include: { checks: { orderBy: { checkType: "asc" } } } },
    },
  });
}

// ---------------------------------------------------------------------------
// Review dashboard lists (assignments / quiz attempts / evidence) + summary
// ---------------------------------------------------------------------------

export interface ReviewListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  result?: "passed" | "failed";
  from?: Date;
  to?: Date;
}

const ASSIGNMENT_STATUS_FILTERS: ReadonlySet<string> = new Set(["UNGRADED", "GRADED", "RETURNED"]);
const EVIDENCE_STATUS_FILTERS: ReadonlySet<string> = new Set([
  "PENDING_VERIFICATION",
  "PENDING_MANUAL_REVIEW",
  "AUTO_APPROVED",
  "AUTO_REJECTED",
  "APPROVED",
  "REJECTED",
]);

function assertFilter(value: string | undefined, allowed: ReadonlySet<string>, label: string): void {
  if (value && !allowed.has(value)) {
    throw new AppError(400, "INVALID_FILTER", `Invalid ${label}: ${value}`);
  }
}

/**
 * Ownership scope for assignment submissions. Deliberately NOT filtered on
 * Assignment.schoolId: schema.prisma declares that column but no migration
 * creates it (it exists only on long-lived databases), so referencing it
 * breaks every migrate-deployed environment with P2022. Ownership is the real
 * boundary — `assignment.teacherId = viewer` can never cross institutions,
 * and the route chain (requireAuth + requireRole(TEACHER) +
 * requireVerifiedTeacher) already validated the viewer's profile school.
 */
export function assignmentScopeWhere(teacherId: string): Prisma.AssignmentSubmissionWhereInput {
  return { assignment: { teacherId } };
}

/** Attempts belong to the viewing teacher via their standalone quiz OR their side quest. */
export function attemptScopeWhere(teacherId: string): Prisma.QuizAttemptWhereInput {
  return { OR: [{ quiz: { teacherId } }, { sideQuest: { teacherId } }] };
}

/** Evidence scope mirrors reviewQueue: author + profile-school (legacy User.schoolId fallback). */
export function evidenceScopeWhere(
  teacherId: string,
  teacherSchoolId: string,
): Prisma.QuestSubmissionWhereInput {
  return {
    acceptance: { quest: { teacherId, teacher: { teacherProfile: { schoolId: teacherSchoolId } } } },
  };
}

function studentMatch(search: string) {
  return { contains: search, mode: "insensitive" as const };
}

function assignmentSearchWhere(search: string): Prisma.AssignmentSubmissionWhereInput {
  const match = studentMatch(search);
  return {
    OR: [
      { student: { firstName: match } },
      { student: { lastName: match } },
      { student: { email: match } },
      { student: { studentProfile: { usn: match } } },
      { assignment: { title: match } },
    ],
  };
}

function attemptSearchWhere(search: string): Prisma.QuizAttemptWhereInput {
  const match = studentMatch(search);
  return {
    OR: [
      { student: { firstName: match } },
      { student: { lastName: match } },
      { student: { email: match } },
      { student: { studentProfile: { usn: match } } },
      { quiz: { title: match } },
      { sideQuest: { title: match } },
    ],
  };
}

function evidenceSearchWhere(search: string): Prisma.QuestSubmissionWhereInput {
  const match = studentMatch(search);
  return {
    OR: [
      { acceptance: { student: { firstName: match } } },
      { acceptance: { student: { lastName: match } } },
      { acceptance: { student: { email: match } } },
      { acceptance: { quest: { title: match } } },
      { acceptance: { sideQuest: { title: match } } },
    ],
  };
}

function submittedAtRange(from?: Date, to?: Date) {
  return {
    ...(from && { gte: from }),
    ...(to && { lte: to }),
  };
}

const assignmentListInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      studentProfile: { select: { usn: true } },
    },
  },
  grader: { select: { id: true, firstName: true, lastName: true } },
  assets: true,
  assignment: {
    select: {
      id: true,
      title: true,
      description: true,
      subject: true,
      type: true,
      dueAt: true,
      maxMarks: true,
      passMarks: true,
      gradingType: true,
      submissionType: true,
      status: true,
      xpReward: true,
      allowResubmission: true,
      teacherFeedbackEnabled: true,
    },
  },
} as const;

/** Every submission to the teacher's own assignments, paginated. */
export async function listReviewAssignments(
  teacherId: string,
  _teacherSchoolId: string,
  query: ReviewListQuery,
  db: ReviewDb = prisma,
) {
  assertFilter(query.status, ASSIGNMENT_STATUS_FILTERS, "grade status");
  const and: Prisma.AssignmentSubmissionWhereInput[] = [assignmentScopeWhere(teacherId)];
  if (query.status) and.push({ gradeStatus: query.status as GradeStatus });
  if (query.search) and.push(assignmentSearchWhere(query.search));
  if (query.from || query.to) and.push({ submittedAt: submittedAtRange(query.from, query.to) });
  const where: Prisma.AssignmentSubmissionWhereInput = { AND: and };

  const [total, items] = await Promise.all([
    db.assignmentSubmission.count({ where }),
    db.assignmentSubmission.findMany({
      where,
      include: assignmentListInclude,
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

const attemptListInclude = {
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      studentProfile: { select: { usn: true } },
    },
  },
  quiz: { select: { id: true, title: true, passThreshold: true, questionCount: true, status: true } },
  sideQuest: { select: { id: true, title: true, passThreshold: true, description: true } },
} as const;

/** All attempts on the teacher's quizzes AND side quests, paginated. */
export async function listReviewAttempts(
  teacherId: string,
  query: ReviewListQuery,
  db: ReviewDb = prisma,
) {
  const and: Prisma.QuizAttemptWhereInput[] = [attemptScopeWhere(teacherId)];
  if (query.result) and.push({ passed: query.result === "passed" });
  if (query.search) and.push(attemptSearchWhere(query.search));
  if (query.from || query.to) and.push({ submittedAt: submittedAtRange(query.from, query.to) });
  const where: Prisma.QuizAttemptWhereInput = { AND: and };

  const [total, items] = await Promise.all([
    db.quizAttempt.count({ where }),
    db.quizAttempt.findMany({
      where,
      include: attemptListInclude,
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

type AttemptAnswerEntry = { questionId?: unknown; selectedIndex?: unknown };

function parseAttemptAnswers(raw: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (Array.isArray(raw)) {
    for (const entry of raw as AttemptAnswerEntry[]) {
      if (entry && typeof entry.questionId === "string" && typeof entry.selectedIndex === "number") {
        map.set(entry.questionId, entry.selectedIndex);
      }
    }
  }
  return map;
}

/**
 * One attempt with its questions — TEACHER view: `correctIndex` and
 * `explanation` are included here (routes enforce the TEACHER role; the
 * student-facing quiz endpoint strips them).
 */
export async function getReviewAttemptDetail(
  teacherId: string,
  attemptId: string,
  db: ReviewDb = prisma,
) {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(teacherId) },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentProfile: { select: { usn: true } },
        },
      },
      quiz: {
        select: {
          id: true,
          title: true,
          description: true,
          questionCount: true,
          passThreshold: true,
          status: true,
          questions: { orderBy: { position: "asc" as const } },
        },
      },
      sideQuest: {
        select: {
          id: true,
          title: true,
          description: true,
          passThreshold: true,
          questions: { orderBy: { position: "asc" as const } },
        },
      },
    },
  });

  if (!attempt) {
    throw new AppError(404, "ATTEMPT_NOT_FOUND", "Quiz attempt not found");
  }

  const container = attempt.quiz ?? attempt.sideQuest;
  const answerMap = parseAttemptAnswers(attempt.answers);
  const questions = (container?.questions ?? []).map((q) => {
    const selectedIndex = answerMap.has(q.id) ? answerMap.get(q.id)! : -1;
    return {
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: q.options as { text: string }[],
      qType: q.qType,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      selectedIndex,
      correct: selectedIndex === q.correctIndex,
      unanswered: selectedIndex === -1,
    };
  });

  return {
    attempt: {
      id: attempt.id,
      score: attempt.score,
      maxScore: attempt.maxScore,
      passed: attempt.passed,
      submittedAt: attempt.submittedAt,
    },
    student: attempt.student,
    quiz: attempt.quiz ?? null,
    sideQuest: attempt.sideQuest ?? null,
    questions,
  };
}

const evidenceListInclude = {
  acceptance: {
    include: {
      quest: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          xpReward: true,
          addressText: true,
          radiusMeters: true,
          requiredProofType: true,
          minPhotoCount: true,
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          studentProfile: { select: { usn: true } },
        },
      },
    },
  },
  assets: true,
  verification: { include: { checks: { orderBy: { checkType: "asc" as const } } } },
} as const;

/** All quest evidence submissions for the teacher's quests (institution-scoped), paginated. */
export async function listReviewEvidence(
  teacherId: string,
  teacherSchoolId: string,
  query: ReviewListQuery,
  db: ReviewDb = prisma,
) {
  assertFilter(query.status, EVIDENCE_STATUS_FILTERS, "submission status");
  const and: Prisma.QuestSubmissionWhereInput[] = [evidenceScopeWhere(teacherId, teacherSchoolId)];
  if (query.status) and.push({ status: query.status as SubmissionStatus });
  if (query.search) and.push(evidenceSearchWhere(query.search));
  if (query.from || query.to) and.push({ submittedAt: submittedAtRange(query.from, query.to) });
  const where: Prisma.QuestSubmissionWhereInput = { AND: and };

  const [total, rows] = await Promise.all([
    db.questSubmission.count({ where }),
    db.questSubmission.findMany({
      where,
      include: evidenceListInclude,
      orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  const items = rows.map((s) => ({
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
  }));

  return { items, total, page: query.page, pageSize: query.pageSize };
}

/**
 * Headline + per-category counts for the dashboard tiles. Every number is a
 * real enum bucket — no derived/fabricated statuses. Tiles intentionally
 * overlap where the spec buckets do (an item with an exhausted-retry AI run
 * and PENDING_MANUAL_REVIEW counts both in "pending review" and "AI failed /
 * needs manual"); tabs filter to exact statuses for actionable work.
 */
export async function reviewSummary(
  teacherId: string,
  teacherSchoolId: string,
  db: ReviewDb = prisma,
) {
  const [assignmentCounts, attemptCounts, evidenceCounts, runCounts] = await Promise.all([
    db.assignmentSubmission.groupBy({
      by: ["gradeStatus"],
      where: assignmentScopeWhere(teacherId),
      _count: { _all: true },
    }),
    db.quizAttempt.groupBy({
      by: ["passed"],
      where: attemptScopeWhere(teacherId),
      _count: { _all: true },
    }),
    db.questSubmission.groupBy({
      by: ["status"],
      where: evidenceScopeWhere(teacherId, teacherSchoolId),
      _count: { _all: true },
    }),
    db.verificationRun.groupBy({
      by: ["status"],
      where: { submission: evidenceScopeWhere(teacherId, teacherSchoolId) },
      _count: { _all: true },
    }),
  ]);

  const grade: Record<GradeStatus, number> = { UNGRADED: 0, GRADED: 0, RETURNED: 0 };
  for (const row of assignmentCounts) grade[row.gradeStatus] = row._count._all;

  const quizzes = { attempts: 0, passed: 0, failed: 0 };
  for (const row of attemptCounts) {
    quizzes.attempts += row._count._all;
    if (row.passed) quizzes.passed += row._count._all;
    else quizzes.failed += row._count._all;
  }

  const byStatus = {
    PENDING_VERIFICATION: 0,
    PENDING_MANUAL_REVIEW: 0,
    AUTO_APPROVED: 0,
    AUTO_REJECTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
  for (const row of evidenceCounts) byStatus[row.status] = row._count._all;

  const runs = { PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 };
  for (const row of runCounts) runs[row.status] = row._count._all;

  return {
    headline: {
      pendingReview: grade.UNGRADED + byStatus.PENDING_MANUAL_REVIEW,
      awaitingAi: byStatus.PENDING_VERIFICATION,
      aiCompleted: runs.COMPLETED,
      aiFailedOrManual: runs.FAILED + byStatus.PENDING_MANUAL_REVIEW,
    },
    assignments: {
      ungraded: grade.UNGRADED,
      graded: grade.GRADED,
      returned: grade.RETURNED,
      total: grade.UNGRADED + grade.GRADED + grade.RETURNED,
    },
    quizzes,
    evidence: { byStatus, runs },
  };
}

/**
 * Re-queue AI verification for a submission still awaiting verification.
 * Guards: teacher owns the quest, quest school matches the viewer's
 * institution (profile authoritative), status is PENDING_VERIFICATION, and no
 * run is currently RUNNING (a queue add must not double-fire an active run).
 */
export async function requestEvidenceVerification(
  teacherId: string,
  teacherSchoolId: string,
  submissionId: string,
  db: ReviewDb = prisma,
) {
  const submission = await db.questSubmission.findUnique({
    where: { id: submissionId },
    include: {
      acceptance: {
        include: {
          quest: {
            include: {
              teacher: { select: { schoolId: true, teacherProfile: { select: { schoolId: true } } } },
            },
          },
        },
      },
    },
  });

  if (!submission?.acceptance.quest) {
    throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
  }
  const quest = submission.acceptance.quest;
  if (quest.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You can only verify submissions for your own quests");
  }
  const questSchoolId = quest.teacher.teacherProfile?.schoolId ?? quest.teacher.schoolId;
  if (questSchoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only verify submissions from your institution");
  }
  if (submission.status !== "PENDING_VERIFICATION") {
    throw new AppError(409, "NOT_PENDING_VERIFICATION", "Only submissions awaiting AI verification can be re-queued");
  }
  const run = await db.verificationRun.findUnique({ where: { submissionId } });
  if (run?.status === "RUNNING") {
    throw new AppError(409, "VERIFICATION_IN_PROGRESS", "Verification is already running for this submission");
  }

  // Dynamic import so unit tests of the guards never construct the BullMQ
  // queue (same separation as lib/aiVerification.ts).
  const { enqueueVerification } = await import("./verification.service.js");
  await enqueueVerification(submissionId);

  logger.info({ submissionId, teacherId }, "teacher re-queued AI evidence verification");
  return { id: submissionId, status: "PENDING_VERIFICATION" as const, queued: true };
}
