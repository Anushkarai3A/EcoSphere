import { Prisma, type Assignment } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { assetUrl, classifyMaterialMime } from "../lib/upload.js";
import { writeAudit } from "../lib/audit.js";
import type {
  AddMaterialInput,
  AssignmentUpsertInput,
  GradeSubmissionInput,
  ListAssignmentsQuery,
  ListSubmissionsQuery,
  SubmitAssignmentInput,
  UpdateAssignmentInput,
} from "../validators/assignment.validators.js";

const assignmentInclude = {
  teacher: { select: { id: true, firstName: true, lastName: true } },
  school: { select: { id: true, name: true } },
  classGroup: { select: { id: true, name: true } },
  materials: { orderBy: { uploadedAt: "asc" } },
  recipients: {
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  _count: { select: { submissions: true, recipients: true } },
} as const;

async function getAssignmentOrThrow(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: assignmentInclude,
  });
  if (!assignment || assignment.archivedAt) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  }
  return assignment;
}

/** Returns the assignment only if the given teacher owns it AND belongs to the same institution. */
async function assertAssignmentOwner(teacherId: string, teacherSchoolId: string, assignmentId: string): Promise<Assignment> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { teacher: { select: { schoolId: true } } },
  });
  if (!assignment || assignment.archivedAt) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  }
  if (assignment.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You don't own this assignment");
  }
  // INSTITUTION ISOLATION: verify teacher belongs to same school
  if (assignment.schoolId && assignment.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage assignments from your institution");
  }
  return assignment;
}

function deleteUploadedFile(filename: string | null | undefined): void {
  if (!filename) return;
  const filePath = path.join(env.UPLOAD_DIR, filename);
  fs.unlink(filePath, () => {
    /* best-effort cleanup */
  });
}

// ---------------------------------------------------------------------------
// Teacher: CRUD + materials + grading
// ---------------------------------------------------------------------------

export async function createAssignment(teacherId: string, teacherSchoolId: string, input: AssignmentUpsertInput) {
  const now = new Date();
  const startAt = input.startAt ? new Date(input.startAt) : now;
  const dueAt = new Date(input.dueAt);

  if (dueAt.getTime() <= startAt.getTime()) {
    throw new AppError(400, "INVALID_DATES", "Due date must be after start date");
  }

  if (input.allowLate && input.lateDeadline) {
    const lateDeadline = new Date(input.lateDeadline);
    if (lateDeadline.getTime() <= dueAt.getTime()) {
      throw new AppError(400, "INVALID_LATE_DEADLINE", "Late deadline must be after original due date");
    }
  }

  if (input.passMarks !== undefined && input.passMarks > input.maxMarks) {
    throw new AppError(400, "INVALID_PASS_MARKS", "Passing marks cannot exceed maximum marks");
  }

  // Validate specific students if targetType === "STUDENTS"
  if (input.targetType === "STUDENTS" && input.specificStudentIds && input.specificStudentIds.length > 0) {
    const validStudents = await prisma.user.findMany({
      where: {
        id: { in: input.specificStudentIds },
        role: "STUDENT",
        schoolId: teacherSchoolId, // INSTITUTION ISOLATION
      },
      select: { id: true },
    });

    if (validStudents.length !== input.specificStudentIds.length) {
      throw new AppError(403, "FORBIDDEN_STUDENTS", "Selected students must belong to your institution");
    }
  }

  const wantsPublish = input.publish === true;
  let status: "DRAFT" | "SCHEDULED" | "PUBLISHED" = "DRAFT";
  if (wantsPublish) {
    status = startAt.getTime() > now.getTime() ? "SCHEDULED" : "PUBLISHED";
  }

  const assignment = await prisma.assignment.create({
    data: {
      teacherId,
      schoolId: teacherSchoolId, // INSTITUTION ISOLATION: bound to teacher's institution
      classGroupId: input.classGroupId ?? null,
      targetType: input.targetType,
      title: input.title,
      description: input.description,
      subject: input.subject ?? null,
      type: input.type,
      topic: input.topic,
      difficulty: input.difficulty,
      xpReward: BigInt(input.xpReward),
      startAt,
      dueAt,
      allowLate: input.allowLate,
      lateDeadline: input.lateDeadline ? new Date(input.lateDeadline) : null,
      submissionType: input.submissionType,
      allowedFormats: input.allowedFormats ? (input.allowedFormats as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      maxFileSizeMb: input.maxFileSizeMb,
      maxFiles: input.maxFiles,
      maxMarks: input.maxMarks,
      passMarks: input.passMarks ?? null,
      gradingType: input.gradingType,
      allowResubmission: input.allowResubmission,
      maxAttempts: input.maxAttempts,
      teacherFeedbackEnabled: input.teacherFeedbackEnabled,
      rubric: input.rubric ? (input.rubric as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      badgeId: input.badgeId ?? null,
      category: input.category ?? null,
      relatedQuestId: input.relatedQuestId ?? null,
      status,
      publishedAt: status === "PUBLISHED" ? now : null,
      recipients:
        input.targetType === "STUDENTS" && input.specificStudentIds
          ? {
              create: input.specificStudentIds.map((sid) => ({ studentId: sid })),
            }
          : undefined,
    },
  });

  await writeAudit({
    userId: teacherId,
    action: wantsPublish ? "TEACHER.ASSIGNMENT_PUBLISH" : "TEACHER.ASSIGNMENT_CREATE",
    entityType: "Assignment",
    entityId: assignment.id,
    ctx: { ipAddress: null, userAgent: null },
  });

  return getAssignmentOrThrow(assignment.id);
}

export async function listAssignments(teacherId: string, teacherSchoolId: string, query: ListAssignmentsQuery) {
  const where: Prisma.AssignmentWhereInput = {
    teacherId,
    schoolId: teacherSchoolId, // INSTITUTION ISOLATION
    archivedAt: null,
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.assignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { dueAt: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.assignment.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getAssignment(teacherId: string, teacherSchoolId: string, assignmentId: string) {
  const assignment = await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId: assignment.id },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      assets: true,
    },
    orderBy: [{ studentId: "asc" }, { attempt: "desc" }],
  });

  return { ...assignment, submissions };
}

export async function updateAssignment(teacherId: string, teacherSchoolId: string, assignmentId: string, input: UpdateAssignmentInput) {
  const assignment = await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  if (assignment.status !== "DRAFT") {
    throw new AppError(409, "ASSIGNMENT_PUBLISHED", "Unpublish the assignment before editing it");
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.subject !== undefined && { subject: input.subject }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.topic !== undefined && { topic: input.topic }),
      ...(input.difficulty !== undefined && { difficulty: input.difficulty }),
      ...(input.xpReward !== undefined && { xpReward: BigInt(input.xpReward) }),
      ...(input.startAt !== undefined && { startAt: new Date(input.startAt) }),
      ...(input.dueAt !== undefined && { dueAt: new Date(input.dueAt) }),
      ...(input.allowLate !== undefined && { allowLate: input.allowLate }),
      ...(input.lateDeadline !== undefined && { lateDeadline: input.lateDeadline ? new Date(input.lateDeadline) : null }),
      ...(input.submissionType !== undefined && { submissionType: input.submissionType }),
      ...(input.allowedFormats !== undefined && { allowedFormats: input.allowedFormats }),
      ...(input.maxFileSizeMb !== undefined && { maxFileSizeMb: input.maxFileSizeMb }),
      ...(input.maxFiles !== undefined && { maxFiles: input.maxFiles }),
      ...(input.maxMarks !== undefined && { maxMarks: input.maxMarks }),
      ...(input.passMarks !== undefined && { passMarks: input.passMarks }),
      ...(input.gradingType !== undefined && { gradingType: input.gradingType }),
      ...(input.allowResubmission !== undefined && { allowResubmission: input.allowResubmission }),
      ...(input.maxAttempts !== undefined && { maxAttempts: input.maxAttempts }),
      ...(input.teacherFeedbackEnabled !== undefined && { teacherFeedbackEnabled: input.teacherFeedbackEnabled }),
      ...(input.rubric !== undefined && { rubric: input.rubric ? (input.rubric as unknown as Prisma.InputJsonValue) : Prisma.DbNull }),
      ...(input.badgeId !== undefined && { badgeId: input.badgeId }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.relatedQuestId !== undefined && { relatedQuestId: input.relatedQuestId }),
      ...(input.classGroupId !== undefined && { classGroupId: input.classGroupId ?? null }),
      ...(input.targetType !== undefined && { targetType: input.targetType }),
    },
  });

  return getAssignmentOrThrow(assignmentId);
}

export async function archiveAssignment(teacherId: string, teacherSchoolId: string, assignmentId: string): Promise<void> {
  await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
}

export async function publishAssignment(teacherId: string, teacherSchoolId: string, assignmentId: string) {
  const assignment = await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  if (assignment.status === "ARCHIVED") {
    throw new AppError(409, "ASSIGNMENT_ARCHIVED", "Archived assignments cannot be published");
  }
  if (assignment.status === "PUBLISHED") {
    return getAssignmentOrThrow(assignmentId);
  }

  const now = new Date();
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "PUBLISHED", publishedAt: now },
  });

  await writeAudit({
    userId: teacherId,
    action: "TEACHER.ASSIGNMENT_PUBLISH",
    entityType: "Assignment",
    entityId: assignmentId,
    ctx: { ipAddress: null, userAgent: null },
  });

  return getAssignmentOrThrow(assignmentId);
}

export async function unpublishAssignment(teacherId: string, teacherSchoolId: string, assignmentId: string) {
  await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "DRAFT", publishedAt: null },
  });
  return getAssignmentOrThrow(assignmentId);
}

export async function addMaterial(
  teacherId: string,
  teacherSchoolId: string,
  assignmentId: string,
  input: AddMaterialInput,
  files: Express.Multer.File[],
) {
  await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);

  const file = files[0];
  const kind = input.kind ?? (file ? classifyMaterialMime(file.mimetype) : input.externalUrl ? "LINK" : "TEXT");

  const material = await prisma.studyMaterial.create({
    data: {
      teacherId,
      assignmentId,
      kind,
      title: input.title?.trim() || file?.originalname || "Study material",
      filename: file?.filename ?? null,
      url: file ? assetUrl(file.filename) : (input.externalUrl ?? null),
      mimeType: file?.mimetype ?? null,
      sizeBytes: file?.size ?? null,
      notes: input.notes ?? null,
    },
  });
  return material;
}

export async function removeMaterial(teacherId: string, teacherSchoolId: string, assignmentId: string, materialId: string): Promise<void> {
  await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  const material = await prisma.studyMaterial.findUnique({ where: { id: materialId } });
  if (!material || material.assignmentId !== assignmentId) {
    throw new AppError(404, "MATERIAL_NOT_FOUND", "Material not found on this assignment");
  }
  await prisma.studyMaterial.delete({ where: { id: materialId } });
  deleteUploadedFile(material.filename);
}

export async function listSubmissions(
  teacherId: string,
  teacherSchoolId: string,
  assignmentId: string,
  query: ListSubmissionsQuery,
) {
  await assertAssignmentOwner(teacherId, teacherSchoolId, assignmentId);
  const where: Prisma.AssignmentSubmissionWhereInput = {
    assignmentId,
    ...(query.status ? { gradeStatus: query.status } : {}),
    ...(query.student ? { studentId: query.student } : {}),
  };
  const items = await prisma.assignmentSubmission.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      assets: true,
    },
    orderBy: [{ studentId: "asc" }, { attempt: "desc" }],
  });
  return items;
}

/**
 * Teacher grades a submission. Awards XP idempotently proportional to the score
 * (`xpReward * score/maxMarks`) and notifies the student.
 */
export async function gradeSubmission(teacherId: string, teacherSchoolId: string, submissionId: string, input: GradeSubmissionInput) {
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { assignment: { include: { teacher: { select: { schoolId: true } } } } },
  });
  if (!submission) {
    throw new AppError(404, "SUBMISSION_NOT_FOUND", "Submission not found");
  }
  if (submission.assignment.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You can only grade submissions for your own assignments");
  }
  // INSTITUTION ISOLATION: verify teacher belongs to same school
  if (submission.assignment.schoolId && submission.assignment.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only grade submissions from your institution");
  }

  const now = new Date();
  const maxMarks = submission.assignment.maxMarks || 100;
  const passMarks = submission.assignment.passMarks ?? 0;
  const isPassing = input.score >= passMarks;
  const isReturned = input.returnForResubmission === true;

  // Calculate XP earned proportional to score
  const xpEarned = isPassing ? Math.floor((Number(submission.assignment.xpReward) * input.score) / maxMarks) : 0;

  await prisma.$transaction(async (tx) => {
    // Check if XP has already been awarded to this student for this assignment
    const previousAwarded = await tx.assignmentSubmission.findFirst({
      where: {
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        xpAwarded: { gt: 0 },
      },
      select: { xpAwarded: true },
    });

    const shouldAwardXp = xpEarned > 0 && !previousAwarded;

    await tx.assignmentSubmission.update({
      where: { id: submissionId },
      data: {
        gradeStatus: isReturned ? "RETURNED" : "GRADED",
        score: input.score,
        gradeNotes: input.gradeNotes ?? null,
        gradedBy: teacherId,
        gradedAt: now,
        xpAwarded: shouldAwardXp ? BigInt(xpEarned) : submission.xpAwarded,
      },
    });

    if (shouldAwardXp) {
      const last = await tx.xpTransaction.findFirst({
        where: { userId: submission.studentId },
        orderBy: { createdAt: "desc" },
      });
      await tx.xpTransaction.create({
        data: {
          userId: submission.studentId,
          sourceType: "ASSIGNMENT_GRADE",
          sourceId: submissionId,
          amount: BigInt(xpEarned),
          balanceAfter: BigInt(Number(last?.balanceAfter ?? 0) + xpEarned),
          note: submission.assignment.title,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: submission.studentId,
        type: "XP_EARNED",
        title: isReturned ? "Assignment returned for revision" : "Assignment graded",
        body: isReturned
          ? `Your submission for "${submission.assignment.title}" was returned for resubmission.`
          : `Your submission for "${submission.assignment.title}" scored ${input.score}/${maxMarks}${shouldAwardXp ? ` and earned ${xpEarned} XP` : ""}.`,
      },
    });
  });

  await writeAudit({
    userId: teacherId,
    action: "TEACHER.ASSIGNMENT_GRADE",
    entityType: "AssignmentSubmission",
    entityId: submissionId,
    meta: { score: input.score, isReturned, xpEarned },
    ctx: { ipAddress: null, userAgent: null },
  });

  return prisma.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      assets: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Student: assigned view + submission
// ---------------------------------------------------------------------------

function computeStudentAssignmentStatus(
  assignment: { dueAt: Date; allowLate: boolean; lateDeadline: Date | null },
  submission: { gradeStatus: string; submissionStatus: string; score: number | null } | null,
): "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "LATE" | "GRADED" | "RETURNED" | "RESUBMISSION_REQUIRED" | "OVERDUE" {
  if (!submission) {
    const now = Date.now();
    if (now > assignment.dueAt.getTime()) {
      if (!assignment.allowLate) return "OVERDUE";
      if (assignment.lateDeadline && now > assignment.lateDeadline.getTime()) return "OVERDUE";
      return "OVERDUE";
    }
    return "NOT_STARTED";
  }

  if (submission.gradeStatus === "GRADED") return "GRADED";
  if (submission.gradeStatus === "RETURNED") return "RETURNED";
  if (submission.submissionStatus === "LATE") return "LATE";
  return "SUBMITTED";
}

export async function studentListAssignments(studentId: string, studentSchoolId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classGroupId: true },
  });
  const classIds = enrollments.map((e) => e.classGroupId);

  const recipientAssignments = await prisma.assignmentRecipient.findMany({
    where: { studentId },
    select: { assignmentId: true },
  });
  const recipientAssignmentIds = recipientAssignments.map((r) => r.assignmentId);

  const items = await prisma.assignment.findMany({
    where: {
      status: "PUBLISHED",
      schoolId: studentSchoolId, // INSTITUTION ISOLATION
      archivedAt: null,
      OR: [
        { targetType: "CLASS", OR: [{ classGroupId: null }, ...(classIds.length > 0 ? [{ classGroupId: { in: classIds } }] : [])] },
        ...(recipientAssignmentIds.length > 0 ? [{ id: { in: recipientAssignmentIds } }] : []),
      ],
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      classGroup: { select: { id: true, name: true } },
      materials: { orderBy: { uploadedAt: "asc" } },
    },
    orderBy: { dueAt: "asc" },
  });

  const submissions = await prisma.assignmentSubmission.findMany({
    where: { studentId, assignmentId: { in: items.map((a) => a.id) } },
    include: { assets: true },
    orderBy: { attempt: "desc" },
  });

  // Group latest submission per assignment
  const latestMap = new Map<string, typeof submissions[0]>();
  for (const s of submissions) {
    if (!latestMap.has(s.assignmentId)) {
      latestMap.set(s.assignmentId, s);
    }
  }

  return {
    items: items.map((a) => {
      const mySub = latestMap.get(a.id) ?? null;
      return {
        ...a,
        mySubmission: mySub,
        calculatedStatus: computeStudentAssignmentStatus(a, mySub),
      };
    }),
  };
}

export async function studentGetAssignment(studentId: string, studentSchoolId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      status: "PUBLISHED",
      schoolId: studentSchoolId, // INSTITUTION ISOLATION
      archivedAt: null,
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      classGroup: { select: { id: true, name: true } },
      materials: { orderBy: { uploadedAt: "asc" } },
    },
  });
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  }

  const allSubmissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId, studentId },
    include: { assets: true },
    orderBy: { attempt: "desc" },
  });

  const latestSub = allSubmissions[0] ?? null;

  return {
    ...assignment,
    mySubmission: latestSub,
    allSubmissions,
    calculatedStatus: computeStudentAssignmentStatus(assignment, latestSub),
  };
}

function deriveContentKind(input: SubmitAssignmentInput, files: Express.Multer.File[]): "DOCUMENT" | "IMAGE" | "TEXT" | "LINK" | "VIDEO" {
  if (input.contentKind) return input.contentKind as never;
  if (files.length > 0) {
    const kinds = files.map((f) => classifyMaterialMime(f.mimetype));
    if (kinds.includes("VIDEO_LINK")) return "VIDEO";
    if (kinds.includes("PDF") || kinds.includes("DOCX") || kinds.includes("PPT")) return "DOCUMENT";
    return "IMAGE";
  }
  if (input.externalUrl) return "LINK";
  return "TEXT";
}

export async function studentSubmit(
  studentId: string,
  studentSchoolId: string,
  assignmentId: string,
  input: SubmitAssignmentInput,
  files: Express.Multer.File[],
) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      status: "PUBLISHED",
      schoolId: studentSchoolId, // INSTITUTION ISOLATION
      archivedAt: null,
    },
  });
  if (!assignment) {
    throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Assignment not found");
  }

  const now = Date.now();
  const dueAtTime = assignment.dueAt.getTime();
  let submissionStatus: "ON_TIME" | "LATE" = "ON_TIME";

  if (now > dueAtTime) {
    if (!assignment.allowLate) {
      throw new AppError(400, "SUBMISSION_CLOSED", "Late submissions are not allowed for this assignment");
    }
    if (assignment.lateDeadline && now > assignment.lateDeadline.getTime()) {
      throw new AppError(400, "SUBMISSION_CLOSED", "The late submission deadline has passed");
    }
    submissionStatus = "LATE";
  }

  // Attempt limit check
  const existingSubmissions = await prisma.assignmentSubmission.findMany({
    where: { assignmentId, studentId },
    select: { id: true, attempt: true },
  });

  if (existingSubmissions.length >= assignment.maxAttempts) {
    throw new AppError(400, "MAX_ATTEMPTS_REACHED", `Maximum submission attempts (${assignment.maxAttempts}) reached`);
  }

  const nextAttempt = existingSubmissions.length + 1;
  const contentKind = deriveContentKind(input, files);

  // Backend File Validation
  if (files.length > 0) {
    if (files.length > assignment.maxFiles) {
      throw new AppError(400, "TOO_MANY_FILES", `Maximum allowed files is ${assignment.maxFiles}`);
    }
    const maxSizeBytes = assignment.maxFileSizeMb * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSizeBytes) {
        throw new AppError(400, "FILE_TOO_LARGE", `File "${file.originalname}" exceeds max size of ${assignment.maxFileSizeMb}MB`);
      }
      if (assignment.allowedFormats && Array.isArray(assignment.allowedFormats) && assignment.allowedFormats.length > 0) {
        const ext = path.extname(file.originalname).replace(".", "").toLowerCase();
        const allowed = assignment.allowedFormats.map((f) => String(f).toLowerCase());
        if (!allowed.includes(ext)) {
          throw new AppError(400, "INVALID_FILE_FORMAT", `File format ".${ext}" is not allowed. Allowed formats: ${allowed.join(", ")}`);
        }
      }
    }
  }

  const created = await prisma.$transaction(async (tx) => {
    const sub = await tx.assignmentSubmission.create({
      data: {
        assignmentId,
        studentId,
        attempt: nextAttempt,
        contentKind,
        title: input.title ?? null,
        text: input.text ?? null,
        externalUrl: input.externalUrl ?? null,
        submissionStatus,
        gradeStatus: "UNGRADED",
        resubmissionOf: existingSubmissions[existingSubmissions.length - 1]?.id ?? null,
      },
    });

    for (const file of files) {
      await tx.assignmentAsset.create({
        data: {
          submissionId: sub.id,
          kind: classifyMaterialMime(file.mimetype),
          url: assetUrl(file.filename),
          filename: file.filename,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
    }

    return sub;
  });

  await writeAudit({
    userId: studentId,
    action: "STUDENT.ASSIGNMENT_SUBMIT",
    entityType: "AssignmentSubmission",
    entityId: created.id,
    meta: { attempt: nextAttempt, submissionStatus },
    ctx: { ipAddress: null, userAgent: null },
  });

  return prisma.assignmentSubmission.findUnique({
    where: { id: created.id },
    include: {
      assignment: { select: { id: true, title: true, dueAt: true, xpReward: true, maxMarks: true } },
      assets: true,
    },
  });
}

export async function studentMySubmission(studentId: string, studentSchoolId: string, assignmentId: string) {
  const submission = await prisma.assignmentSubmission.findFirst({
    where: {
      assignmentId,
      studentId,
      // INSTITUTION ISOLATION: verify assignment belongs to same school
      assignment: { schoolId: studentSchoolId },
    },
    include: {
      assets: true,
      assignment: { select: { id: true, title: true, dueAt: true, xpReward: true, maxMarks: true } },
    },
    orderBy: { attempt: "desc" },
  });
  if (!submission) {
    throw new AppError(404, "SUBMISSION_NOT_FOUND", "No submission yet for this assignment");
  }
  return submission;
}
