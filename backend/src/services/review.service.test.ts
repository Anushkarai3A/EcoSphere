import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/http.js";
import {
  getReviewAttemptDetail,
  listReviewAssignments,
  listReviewAttempts,
  listReviewEvidence,
  requestEvidenceVerification,
  reviewQueue,
  reviewSubmission,
  reviewSummary,
  type ReviewDb,
} from "./review.service.js";

const LEGACY = { teacherId: "teacher-legacy", schoolId: "school-9" };

interface SubmissionRow {
  id: string;
  acceptanceId: string;
  status: string;
  submittedAt: Date;
  notes: string | null;
  reSubmissionOf: string | null;
  reviewNote: string | null;
  reviewedBy: string | null;
  bonusXp: bigint;
  acceptance: {
    studentId: string;
    status: string;
    xpAwarded: number | bigint;
    quest: {
      id: string;
      title: string;
      xpReward: bigint;
      teacherId: string;
      teacher: { schoolId: string | null; teacherProfile: { schoolId: string } | null };
    };
    student: { id: string; firstName: string; lastName: string; email: string };
  };
  assets: Array<{ id: string }>;
  verification: unknown;
}

function questRow(teacherId: string, schoolId: string | null, profileSchoolId: string | null) {
  return {
    id: "quest-1",
    title: "Plant a sapling",
    xpReward: 100n,
    teacherId,
    teacher: {
      schoolId,
      teacherProfile: profileSchoolId === null ? null : { schoolId: profileSchoolId },
    },
  };
}

/**
 * Submission whose quest is owned by a legacy teacher: User.schoolId (the
 * column read by the pre-fix code) is NULL while TeacherProfile.schoolId is
 * set — the exact data shape of the teachers created before migration
 * 20260819180043_add_institution_isolation (which shipped without a backfill).
 */
function legacySubmission(status: string): SubmissionRow {
  return {
    id: "sub-1",
    acceptanceId: "acc-1",
    status,
    submittedAt: new Date("2026-01-01T00:00:00.000Z"),
    notes: "planted near the gate",
    reSubmissionOf: null,
    reviewNote: null,
    reviewedBy: null,
    bonusXp: 0n,
    acceptance: {
      studentId: "student-1",
      status: "SUBMITTED",
      xpAwarded: 0,
      quest: questRow(LEGACY.teacherId, null, LEGACY.schoolId),
      student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    },
    assets: [],
    verification: null,
  };
}

class FakeReviewDb {
  where: unknown = null;
  rows: Array<Record<string, unknown>> = [];
  sub: SubmissionRow;
  ledger: Array<Record<string, unknown>> = [];
  submissionUpdates: Array<Record<string, unknown>> = [];

  constructor(submission: SubmissionRow) {
    this.sub = submission;
  }

  questSubmission = {
    findMany: async (args: { where: unknown }) => {
      this.where = args.where;
      return this.rows;
    },
    findUnique: async () => this.sub,
    update: async (args: { data: Record<string, unknown> }) => {
      this.submissionUpdates.push(args);
      Object.assign(this.sub, args.data);
      return this.sub;
    },
  };

  questAcceptance = {
    update: async (args: { data: Record<string, unknown> }) => {
      Object.assign(this.sub.acceptance, args.data);
      return this.sub.acceptance;
    },
  };

  xpTransaction = {
    findFirst: async () => this.ledger.at(-1) ?? null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row = { id: `xp-${this.ledger.length + 1}`, ...args.data };
      this.ledger.push(row);
      return row;
    },
  };

  $transaction = async (fn: (tx: FakeReviewDb) => Promise<unknown>) => fn(this);

  asDb(): ReviewDb {
    return this as unknown as ReviewDb;
  }
}

function expectAppError(err: unknown, statusCode: number, code: string): boolean {
  return err instanceof AppError && err.statusCode === statusCode && err.code === code;
}

test("queue is scoped by TeacherProfile.schoolId so legacy teachers' items are included", async () => {
  const db = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));
  db.rows = [
    {
      id: "sub-1",
      status: "PENDING_MANUAL_REVIEW",
      submittedAt: new Date("2026-01-01T00:00:00.000Z"),
      notes: "planted near the gate",
      reSubmissionOf: null,
      reviewNote: null,
      assets: [{ id: "asset-1" }],
      verification: { overallRecommendation: "NEEDS_MANUAL_REVIEW" },
      acceptance: {
        student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
        quest: {
          id: "quest-1",
          title: "Plant a sapling",
          category: "BIODIVERSITY",
          xpReward: 100n,
          addressText: null,
          radiusMeters: 100,
          requiredProofType: "PHOTO",
          minPhotoCount: 1,
        },
      },
    },
  ];

  const result = await reviewQueue(LEGACY.teacherId, LEGACY.schoolId, db.asDb());

  assert.deepEqual(db.where, {
    status: "PENDING_MANUAL_REVIEW",
    acceptance: {
      quest: {
        teacherId: LEGACY.teacherId,
        teacher: { teacherProfile: { schoolId: LEGACY.schoolId } },
      },
    },
  });
  assert.equal(result.count, 1);
  assert.equal(result.items[0]!.quest!.title, "Plant a sapling");
  assert.equal(result.items[0]!.student.firstName, "Ada");
  assert.equal(result.items[0]!.assets[0]!.id, "asset-1");
});

test("legacy teacher (User.schoolId NULL, profile school set) can approve their own pending submission", async () => {
  const db = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));

  await reviewSubmission(LEGACY.teacherId, LEGACY.schoolId, "sub-1", { decision: "APPROVE" }, db.asDb());

  assert.equal(db.sub.status, "APPROVED");
  assert.equal(db.sub.reviewedBy, "teacher-legacy");
  assert.equal(db.sub.acceptance.status, "APPROVED");
  assert.equal(Number(db.sub.acceptance.xpAwarded), 100);
  assert.equal(db.ledger.length, 1);
  assert.equal(db.ledger[0]!.amount, 100);
  assert.equal(db.ledger[0]!.balanceAfter, 100);
});

test("a teacher from another institution is rejected (profile school mismatch)", async () => {
  const db = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));

  await assert.rejects(
    reviewSubmission(LEGACY.teacherId, "school-other", "sub-1", { decision: "APPROVE" }, db.asDb()),
    (err) => expectAppError(err, 403, "FORBIDDEN"),
  );
  assert.equal(db.submissionUpdates.length, 0);
  assert.equal(db.ledger.length, 0);
});

test("another teacher cannot review someone else's quest submission", async () => {
  const db = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));

  await assert.rejects(
    reviewSubmission("teacher-intruder", LEGACY.schoolId, "sub-1", { decision: "APPROVE" }, db.asDb()),
    (err) => expectAppError(err, 403, "FORBIDDEN"),
  );
  assert.equal(db.submissionUpdates.length, 0);
});

test("an already-decided submission returns 409 before any write", async () => {
  const db = new FakeReviewDb(legacySubmission("APPROVED"));

  await assert.rejects(
    reviewSubmission(LEGACY.teacherId, LEGACY.schoolId, "sub-1", { decision: "APPROVE" }, db.asDb()),
    (err) => expectAppError(err, 409, "NOT_PENDING_REVIEW"),
  );
  assert.equal(db.submissionUpdates.length, 0);
  assert.equal(db.ledger.length, 0);
});

test("rejecting requires a reason and stores it", async () => {
  const missingNote = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));
  await assert.rejects(
    reviewSubmission(
      LEGACY.teacherId,
      LEGACY.schoolId,
      "sub-1",
      { decision: "REJECT", note: "   " },
      missingNote.asDb(),
    ),
    (err) => expectAppError(err, 400, "REVIEW_NOTE_REQUIRED"),
  );
  assert.equal(missingNote.submissionUpdates.length, 0);

  const withNote = new FakeReviewDb(legacySubmission("PENDING_MANUAL_REVIEW"));
  await reviewSubmission(
    LEGACY.teacherId,
    LEGACY.schoolId,
    "sub-1",
    { decision: "REJECT", note: "Evidence does not match the quest location" },
    withNote.asDb(),
  );
  assert.equal(withNote.sub.status, "REJECTED");
  assert.equal(withNote.sub.reviewNote, "Evidence does not match the quest location");
  assert.equal(withNote.ledger.length, 0);
});

test("institution scope falls back to User.schoolId when a profile row is absent", async () => {
  const submission = legacySubmission("APPROVED");
  submission.acceptance.quest.teacher = { schoolId: "school-fallback", teacherProfile: null };
  const db = new FakeReviewDb(submission);

  await assert.rejects(
    reviewSubmission(LEGACY.teacherId, "school-fallback", "sub-1", { decision: "APPROVE" }, db.asDb()),
    (err) => expectAppError(err, 409, "NOT_PENDING_REVIEW"),
  );
});

// ---------------------------------------------------------------------------
// Review dashboard lists, summary and re-verification guards
// ---------------------------------------------------------------------------

interface RecordedQuery {
  model: string;
  method: string;
  args: Record<string, unknown>;
}

class FakeDashboardDb {
  queries: RecordedQuery[] = [];
  countResult = 0;
  assignmentRows: Array<Record<string, unknown>> = [];
  attemptRows: Array<Record<string, unknown>> = [];
  evidenceRows: Array<Record<string, unknown>> = [];
  assignmentGroups: Array<Record<string, unknown>> = [];
  attemptGroups: Array<Record<string, unknown>> = [];
  evidenceGroups: Array<Record<string, unknown>> = [];
  runGroups: Array<Record<string, unknown>> = [];
  attemptDetail: Record<string, unknown> | null = null;
  evidenceSubmission: Record<string, unknown> | null = null;
  run: Record<string, unknown> | null = null;

  private record(model: string, method: string, args: Record<string, unknown>) {
    this.queries.push({ model, method, args });
  }

  assignmentSubmission = {
    count: async (args: Record<string, unknown>) => {
      this.record("assignmentSubmission", "count", args);
      return this.countResult;
    },
    findMany: async (args: Record<string, unknown>) => {
      this.record("assignmentSubmission", "findMany", args);
      return this.assignmentRows;
    },
    groupBy: async (args: Record<string, unknown>) => {
      this.record("assignmentSubmission", "groupBy", args);
      return this.assignmentGroups;
    },
  };

  quizAttempt = {
    count: async (args: Record<string, unknown>) => {
      this.record("quizAttempt", "count", args);
      return this.countResult;
    },
    findMany: async (args: Record<string, unknown>) => {
      this.record("quizAttempt", "findMany", args);
      return this.attemptRows;
    },
    findFirst: async (args: Record<string, unknown>) => {
      this.record("quizAttempt", "findFirst", args);
      return this.attemptDetail;
    },
    groupBy: async (args: Record<string, unknown>) => {
      this.record("quizAttempt", "groupBy", args);
      return this.attemptGroups;
    },
  };

  questSubmission = {
    count: async (args: Record<string, unknown>) => {
      this.record("questSubmission", "count", args);
      return this.countResult;
    },
    findMany: async (args: Record<string, unknown>) => {
      this.record("questSubmission", "findMany", args);
      return this.evidenceRows;
    },
    findUnique: async (args: Record<string, unknown>) => {
      this.record("questSubmission", "findUnique", args);
      return this.evidenceSubmission;
    },
    groupBy: async (args: Record<string, unknown>) => {
      this.record("questSubmission", "groupBy", args);
      return this.evidenceGroups;
    },
  };

  verificationRun = {
    findUnique: async (args: Record<string, unknown>) => {
      this.record("verificationRun", "findUnique", args);
      return this.run;
    },
    groupBy: async (args: Record<string, unknown>) => {
      this.record("verificationRun", "groupBy", args);
      return this.runGroups;
    },
  };

  asDb(): ReviewDb {
    return this as unknown as ReviewDb;
  }
}

const PAGE = { page: 1, pageSize: 20 };

test("assignment list is scoped to the teacher's own assignments (ownership boundary)", async () => {
  const db = new FakeDashboardDb();
  db.countResult = 1;
  db.assignmentRows = [{ id: "s1" }];

  const result = await listReviewAssignments(LEGACY.teacherId, LEGACY.schoolId, PAGE, db.asDb());

  const countQuery = db.queries.find((q) => q.method === "count")!;
  assert.deepEqual(countQuery.args.where, {
    AND: [{ assignment: { teacherId: LEGACY.teacherId } }],
  });
  const listQuery = db.queries.find((q) => q.method === "findMany")!;
  assert.equal(listQuery.args.skip, 0);
  assert.equal(listQuery.args.take, 20);
  assert.equal(result.total, 1);
  assert.equal(result.items[0]!.id, "s1");
});

test("assignment list rejects an unknown grade-status filter before touching the database", async () => {
  const db = new FakeDashboardDb();

  await assert.rejects(
    listReviewAssignments(LEGACY.teacherId, LEGACY.schoolId, { ...PAGE, status: "PENDING_REVIEW" }, db.asDb()),
    (err) => expectAppError(err, 400, "INVALID_FILTER"),
  );
  assert.equal(db.queries.length, 0);
});

test("assignment list search and pagination compose into the AND filter", async () => {
  const db = new FakeDashboardDb();

  await listReviewAssignments(
    LEGACY.teacherId,
    LEGACY.schoolId,
    { page: 3, pageSize: 10, search: "Ada", status: "UNGRADED" },
    db.asDb(),
  );

  const listQuery = db.queries.find((q) => q.method === "findMany")!;
  const where = listQuery.args.where as { AND: Array<Record<string, unknown>> };
  assert.equal(where.AND.length, 3);
  assert.deepEqual(where.AND[1], { gradeStatus: "UNGRADED" });
  assert.deepEqual(where.AND[2], {
    OR: [
      { student: { firstName: { contains: "Ada", mode: "insensitive" } } },
      { student: { lastName: { contains: "Ada", mode: "insensitive" } } },
      { student: { email: { contains: "Ada", mode: "insensitive" } } },
      { student: { studentProfile: { usn: { contains: "Ada", mode: "insensitive" } } } },
      { assignment: { title: { contains: "Ada", mode: "insensitive" } } },
    ],
  });
  assert.equal(listQuery.args.skip, 20);
  assert.equal(listQuery.args.take, 10);
});

test("attempt list scopes to the teacher's quizzes AND side quests, with result filter", async () => {
  const db = new FakeDashboardDb();
  db.countResult = 2;
  db.attemptRows = [{ id: "a1" }, { id: "a2" }];

  const result = await listReviewAttempts(
    LEGACY.teacherId,
    { ...PAGE, result: "failed" },
    db.asDb(),
  );

  const listQuery = db.queries.find((q) => q.method === "findMany")!;
  const where = listQuery.args.where as { AND: Array<Record<string, unknown>> };
  assert.deepEqual(where.AND[0], {
    OR: [{ quiz: { teacherId: LEGACY.teacherId } }, { sideQuest: { teacherId: LEGACY.teacherId } }],
  });
  assert.deepEqual(where.AND[1], { passed: false });
  assert.equal(result.total, 2);
  assert.equal(result.items.length, 2);
});

test("attempt detail answers questions with the teacher-side answer key and flags gaps", async () => {
  const db = new FakeDashboardDb();
  db.attemptDetail = {
    id: "a1",
    score: 1,
    maxScore: 3,
    passed: false,
    submittedAt: new Date("2026-02-01T00:00:00.000Z"),
    answers: [
      { questionId: "q1", selectedIndex: 1 },
      { questionId: "q2", selectedIndex: 0 },
      { questionId: "mystery", selectedIndex: 2 },
    ],
    student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    quiz: {
      id: "quiz-1",
      title: "Biodiversity basics",
      description: "Unit quiz",
      questionCount: 3,
      passThreshold: 60,
      status: "PUBLISHED",
      questions: [
        { id: "q1", position: 1, prompt: "Q1", options: [{ text: "A" }, { text: "B" }], correctIndex: 1, explanation: "B", qType: "MCQ" },
        { id: "q2", position: 2, prompt: "Q2", options: [{ text: "A" }, { text: "B" }], correctIndex: 2, explanation: "C", qType: "MCQ" },
        { id: "q3", position: 3, prompt: "Q3", options: [{ text: "A" }, { text: "B" }], correctIndex: 0, explanation: "A", qType: "MCQ" },
      ],
    },
    sideQuest: null,
  };

  const result = await getReviewAttemptDetail(LEGACY.teacherId, "a1", db.asDb());

  const detailQuery = db.queries.find((q) => q.method === "findFirst")!;
  assert.deepEqual(detailQuery.args.where, {
    id: "a1",
    OR: [{ quiz: { teacherId: LEGACY.teacherId } }, { sideQuest: { teacherId: LEGACY.teacherId } }],
  });
  assert.equal(result.questions.length, 3);
  assert.equal(result.questions[0]!.correct, true);
  assert.equal(result.questions[0]!.correctIndex, 1);
  assert.equal(result.questions[1]!.correct, false);
  assert.equal(result.questions[2]!.selectedIndex, -1);
  assert.equal(result.questions[2]!.unanswered, true);
  assert.equal(result.questions[2]!.correct, false);
});

test("attempt detail 404s for an id outside the teacher's scope", async () => {
  const db = new FakeDashboardDb();
  db.attemptDetail = null;

  await assert.rejects(
    getReviewAttemptDetail(LEGACY.teacherId, "missing", db.asDb()),
    (err) => expectAppError(err, 404, "ATTEMPT_NOT_FOUND"),
  );
});

test("evidence list uses the profile-school scope and rejects unknown status filters", async () => {
  const db = new FakeDashboardDb();
  db.countResult = 1;
  db.evidenceRows = [
    {
      id: "ev1",
      status: "PENDING_MANUAL_REVIEW",
      submittedAt: new Date("2026-03-01T00:00:00.000Z"),
      notes: null,
      reSubmissionOf: null,
      reviewNote: null,
      assets: [],
      verification: null,
      acceptance: {
        student: { id: "student-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
        quest: { id: "quest-1", title: "Plant a sapling", description: "Plant one sapling" },
      },
    },
  ];

  const result = await listReviewEvidence(LEGACY.teacherId, LEGACY.schoolId, PAGE, db.asDb());

  const countQuery = db.queries.find((q) => q.method === "count")!;
  assert.deepEqual(countQuery.args.where, {
    AND: [
      {
        acceptance: {
          quest: {
            teacherId: LEGACY.teacherId,
            teacher: { teacherProfile: { schoolId: LEGACY.schoolId } },
          },
        },
      },
    ],
  });
  assert.equal(result.items[0]!.quest!.description, "Plant one sapling");

  const bad = new FakeDashboardDb();
  await assert.rejects(
    listReviewEvidence(LEGACY.teacherId, LEGACY.schoolId, { ...PAGE, status: "MAYBE" }, bad.asDb()),
    (err) => expectAppError(err, 400, "INVALID_FILTER"),
  );
  assert.equal(bad.queries.length, 0);
});

test("summary tiles are real enum buckets with the documented headline overlap", async () => {
  const db = new FakeDashboardDb();
  db.assignmentGroups = [
    { gradeStatus: "UNGRADED", _count: { _all: 2 } },
    { gradeStatus: "GRADED", _count: { _all: 1 } },
  ];
  db.attemptGroups = [
    { passed: true, _count: { _all: 1 } },
    { passed: false, _count: { _all: 2 } },
  ];
  db.evidenceGroups = [
    { status: "PENDING_VERIFICATION", _count: { _all: 1 } },
    { status: "PENDING_MANUAL_REVIEW", _count: { _all: 1 } },
    { status: "AUTO_APPROVED", _count: { _all: 1 } },
  ];
  db.runGroups = [
    { status: "COMPLETED", _count: { _all: 1 } },
    { status: "FAILED", _count: { _all: 1 } },
    { status: "RUNNING", _count: { _all: 1 } },
  ];

  const result = await reviewSummary(LEGACY.teacherId, LEGACY.schoolId, db.asDb());

  assert.deepEqual(result.headline, {
    pendingReview: 3, // 2 ungraded + 1 pending-manual
    awaitingAi: 1,
    aiCompleted: 1,
    aiFailedOrManual: 2, // 1 failed run + 1 pending-manual
  });
  assert.deepEqual(result.assignments, { ungraded: 2, graded: 1, returned: 0, total: 3 });
  assert.deepEqual(result.quizzes, { attempts: 3, passed: 1, failed: 2 });
  assert.equal(result.evidence.byStatus.PENDING_VERIFICATION, 1);
  assert.equal(result.evidence.byStatus.PENDING_MANUAL_REVIEW, 1);
  assert.equal(result.evidence.runs.RUNNING, 1);
});

test("re-verification guards: 404, ownership, institution, status and in-flight run", async () => {
  const pending = (status: string, run: Record<string, unknown> | null = null) => {
    const db = new FakeDashboardDb();
    db.evidenceSubmission = {
      id: "ev1",
      status,
      acceptance: {
        quest: {
          teacherId: LEGACY.teacherId,
          teacher: { schoolId: null, teacherProfile: { schoolId: LEGACY.schoolId } },
        },
      },
    };
    db.run = run;
    return db;
  };

  const missing = new FakeDashboardDb();
  await assert.rejects(
    requestEvidenceVerification(LEGACY.teacherId, LEGACY.schoolId, "ev1", missing.asDb()),
    (err) => expectAppError(err, 404, "SUBMISSION_NOT_FOUND"),
  );

  const intruder = pending("PENDING_VERIFICATION");
  await assert.rejects(
    requestEvidenceVerification("teacher-intruder", LEGACY.schoolId, "ev1", intruder.asDb()),
    (err) => expectAppError(err, 403, "FORBIDDEN"),
  );

  const wrongSchool = pending("PENDING_VERIFICATION");
  await assert.rejects(
    requestEvidenceVerification(LEGACY.teacherId, "school-other", "ev1", wrongSchool.asDb()),
    (err) => expectAppError(err, 403, "FORBIDDEN"),
  );

  const alreadyDecided = pending("AUTO_APPROVED");
  await assert.rejects(
    requestEvidenceVerification(LEGACY.teacherId, LEGACY.schoolId, "ev1", alreadyDecided.asDb()),
    (err) => expectAppError(err, 409, "NOT_PENDING_VERIFICATION"),
  );

  const running = pending("PENDING_VERIFICATION", { id: "run-1", status: "RUNNING" });
  await assert.rejects(
    requestEvidenceVerification(LEGACY.teacherId, LEGACY.schoolId, "ev1", running.asDb()),
    (err) => expectAppError(err, 409, "VERIFICATION_IN_PROGRESS"),
  );
});
