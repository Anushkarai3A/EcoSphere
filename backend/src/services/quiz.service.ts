import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { assetUrl, classifyMaterialMime } from "../lib/upload.js";
import { writeAudit } from "../lib/audit.js";
import { logger } from "../lib/logger.js";
import { extractStudyMaterial, generateQuizFromText } from "../lib/aiGateway.js";
import type { GenerateQuizInput, ListQuizzesQuery, QuizAttemptInput } from "../validators/quiz.validators.js";

const quizInclude = {
  teacher: { select: { id: true, firstName: true, lastName: true } },
  material: { select: { id: true, title: true, kind: true } },
  classGroup: { select: { id: true, name: true } },
  _count: { select: { attempts: true } },
} as const;

/** Returns the quiz only if the given teacher owns it AND belongs to the same institution. */
async function assertQuizOwner(teacherId: string, teacherSchoolId: string, quizId: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { teacher: { select: { schoolId: true } } } });
  if (!quiz) {
    throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
  }
  if (quiz.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You don't own this quiz");
  }
  // INSTITUTION ISOLATION: verify teacher belongs to same school
  if (quiz.teacher.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage quizzes from your institution");
  }
  return quiz;
}

// ---------------------------------------------------------------------------
// Study materials (quiz source)
// ---------------------------------------------------------------------------

/** Store an uploaded file as a standalone study material for quiz generation. */
export async function uploadMaterial(teacherId: string, files: Express.Multer.File[]) {
  const file = files[0];
  if (!file) {
    throw new AppError(400, "NO_FILE", "Attach a PDF, DOCX, PPT, TXT or image to upload");
  }
  const material = await prisma.studyMaterial.create({
    data: {
      teacherId,
      assignmentId: null,
      kind: classifyMaterialMime(file.mimetype),
      title: file.originalname,
      filename: file.filename,
      url: assetUrl(file.filename),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    },
  });
  return material;
}

// ---------------------------------------------------------------------------
// AI quiz generation (extract -> generate -> persist)
// ---------------------------------------------------------------------------

/**
 * Read an uploaded study material back from disk. The ai-service extracts text
 * from the raw bytes, so the whole document is shipped as base64 — not the
 * URL — and the AI service never needs access to the uploads volume.
 */
async function readMaterialFile(material: { filename: string | null; mimeType: string | null }) {
  if (!material.filename || !material.mimeType) {
    throw new AppError(400, "MATERIAL_UNREADABLE", "This material has no file to read; upload the document to generate from it");
  }
  const filePath = path.join(env.UPLOAD_DIR, material.filename);
  let content: Buffer;
  try {
    content = await fs.promises.readFile(filePath);
  } catch {
    throw new AppError(422, "MATERIAL_UNREADABLE", `Could not read uploaded file '${material.filename}' from storage`);
  }
  if (content.length === 0) {
    throw new AppError(422, "MATERIAL_EMPTY", "The uploaded file is empty");
  }
  return content;
}

export async function generateQuiz(teacherId: string, _teacherSchoolId: string, input: GenerateQuizInput) {
  if (!input.materialId) {
    throw new AppError(400, "MATERIAL_REQUIRED", "Upload a study material (PDF, DOCX, PPT or TXT) to generate a quiz from");
  }

  const material = await prisma.studyMaterial.findUnique({ where: { id: input.materialId } });
  if (!material || material.teacherId !== teacherId) {
    throw new AppError(404, "MATERIAL_NOT_FOUND", "Study material not found");
  }

  // 1. Extract text from the uploaded document via the ai-service.
  const runId = crypto.randomUUID();
  const content = await readMaterialFile(material);
  let extracted;
  try {
    extracted = await extractStudyMaterial({
      filename: material.title,
      mimeType: material.mimeType ?? "application/octet-stream",
      contentBase64: content.toString("base64"),
    });
  } catch (err) {
    logger.error({ runId, filename: material.title }, "study material extraction failed");
    throw err;
  }

  // 2. Generate MCQs grounded in the extracted text.
  const wantsPublish = input.publish === true;
  let generated;
  try {
    generated = await generateQuizFromText({
      runId,
      text: extracted.text,
      count: input.count,
      difficulty: input.difficulty,
      topic: input.topic,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error(
      { runId, filename: material.title, textLength: extracted.text.length, topicHint: input.topic, error: detail },
      "AI quiz generation failed",
    );
    throw err;
  }

  logger.info(
    {
      runId,
      filename: material.title,
      textLength: extracted.text.length,
      detectedTopic: generated.detectedTopic,
      prompt: generated.prompt,
      questionCount: generated.questions.length,
    },
    "AI quiz generated from study material",
  );

  const quiz = await prisma.$transaction(async (tx) => {
    const created = await tx.quiz.create({
      data: {
        teacherId,
        materialId: input.materialId ?? null,
        classGroupId: input.classGroupId ?? null,
        title: input.title,
        description: input.description ?? null,
        topic: generated.detectedTopic || input.topic || "OTHER",
        difficulty: input.difficulty,
        status: wantsPublish ? "PUBLISHED" : "DRAFT",
        passThreshold: input.passThreshold ?? 60,
        timeLimitMin: input.timeLimitMin ?? null,
        questionCount: generated.questions.length,
        sourceRunId: runId,
        publishedAt: wantsPublish ? new Date() : null,
      },
    });
    for (const [i, q] of generated.questions.entries()) {
      await tx.quizQuestion.create({
        data: {
          quizId: created.id,
          position: i,
          prompt: q.prompt,
          options: q.options.map((text) => ({ text })),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          qType: q.qType,
          difficultyScore: q.difficultyScore,
          aiGenerated: true,
          reviewState: "APPROVED",
          sourceRunId: runId,
        },
      });
    }
    return created;
  });

  await writeAudit({
    userId: teacherId,
    action: "TEACHER.QUIZ_GENERATE",
    entityType: "Quiz",
    entityId: quiz.id,
    meta: { runId, count: generated.questions.length, topic: quiz.topic, textLength: extracted.text.length },
    ctx: { ipAddress: null, userAgent: null },
  });

  return getQuizWithQuestions(quiz.id);
}

export async function listQuizzes(teacherId: string, teacherSchoolId: string, query: ListQuizzesQuery) {
  const where: Prisma.QuizWhereInput = {
    teacherId,
    // INSTITUTION ISOLATION: verify quiz's teacher belongs to same school
    teacher: { schoolId: teacherSchoolId },
    ...(query.status ? { status: query.status } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.quiz.findMany({
      where,
      include: quizInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.quiz.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

async function getQuizWithQuestions(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      ...quizInclude,
      questions: { orderBy: { position: "asc" } },
    },
  });
  if (!quiz) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
  return quiz;
}

export async function getQuiz(teacherId: string, teacherSchoolId: string, quizId: string) {
  await assertQuizOwner(teacherId, teacherSchoolId, quizId);
  return getQuizWithQuestions(quizId);
}

export async function publishQuiz(teacherId: string, teacherSchoolId: string, quizId: string) {
  const quiz = await assertQuizOwner(teacherId, teacherSchoolId, quizId);
  if (quiz.status === "ARCHIVED") {
    throw new AppError(409, "QUIZ_ARCHIVED", "Archived quizzes cannot be published");
  }
  if (quiz.status === "PUBLISHED") {
    return getQuizWithQuestions(quizId);
  }
  await prisma.quiz.update({
    where: { id: quizId },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return getQuizWithQuestions(quizId);
}

export async function unpublishQuiz(teacherId: string, teacherSchoolId: string, quizId: string) {
  await assertQuizOwner(teacherId, teacherSchoolId, quizId);
  await prisma.quiz.update({ where: { id: quizId }, data: { status: "DRAFT", publishedAt: null } });
  return getQuizWithQuestions(quizId);
}

export async function archiveQuiz(teacherId: string, teacherSchoolId: string, quizId: string) {
  await assertQuizOwner(teacherId, teacherSchoolId, quizId);
  await prisma.quiz.update({ where: { id: quizId }, data: { status: "ARCHIVED" } });
}

// ---------------------------------------------------------------------------
// Student: take a published quiz
// ---------------------------------------------------------------------------

export async function studentListQuizzes(studentId: string, studentSchoolId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId },
    select: { classGroupId: true },
  });
  const classIds = enrollments.map((e) => e.classGroupId);

  const items = await prisma.quiz.findMany({
    where: {
      status: "PUBLISHED",
      // INSTITUTION ISOLATION: only quizzes from same school
      teacher: { schoolId: studentSchoolId },
      OR: [{ classGroupId: null }, ...(classIds.length > 0 ? [{ classGroupId: { in: classIds } }] : [])],
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      material: { select: { id: true, title: true } },
      classGroup: { select: { id: true, name: true } },
      attempts: {
        where: { studentId },
        select: { id: true, score: true, maxScore: true, passed: true, submittedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    items: items.map((q) => ({
      id: q.id,
      teacherId: q.teacherId,
      materialId: q.materialId,
      classGroupId: q.classGroupId,
      title: q.title,
      description: q.description,
      topic: q.topic,
      difficulty: q.difficulty,
      questionCount: q.questionCount,
      timeLimitMin: q.timeLimitMin,
      teacher: q.teacher,
      material: q.material,
      classGroup: q.classGroup,
      myAttempt: q.attempts[0] ?? null,
    })),
  };
}

export async function studentGetQuiz(studentId: string, studentSchoolId: string, quizId: string) {
  const quiz = await prisma.quiz.findFirst({
    where: { 
      id: quizId, 
      status: "PUBLISHED",
      // INSTITUTION ISOLATION: only quizzes from same school
      teacher: { schoolId: studentSchoolId },
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      material: { select: { id: true, title: true } },
      questions: { orderBy: { position: "asc" } },
      attempts: { where: { studentId } },
    },
  });
  if (!quiz) {
    throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
  }

  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    topic: quiz.topic,
    difficulty: quiz.difficulty,
    questionCount: quiz.questionCount,
    passThreshold: quiz.passThreshold,
    timeLimitMin: quiz.timeLimitMin,
    teacher: quiz.teacher,
    material: quiz.material,
    // `correctIndex` is never serialized to students.
    questions: quiz.questions.map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: q.options as { text: string }[],
      qType: q.qType,
      explanation: q.explanation,
    })),
    myAttempt: quiz.attempts[0] ?? null,
  };
}

export async function submitQuizAttempt(studentId: string, studentSchoolId: string, quizId: string, input: QuizAttemptInput) {
  const quiz = await prisma.quiz.findFirst({
    where: { 
      id: quizId, 
      status: "PUBLISHED",
      // INSTITUTION ISOLATION: only quizzes from same school
      teacher: { schoolId: studentSchoolId },
    },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!quiz) {
    throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
  }

  const answers = new Map(input.answers.map((a) => [a.questionId, a.selectedIndex]));
  let score = 0;
  const results = quiz.questions.map((q) => {
    const selectedIndex = answers.get(q.id) ?? -1;
    const correct = selectedIndex === q.correctIndex;
    if (correct) score += 1;
    return {
      questionId: q.id,
      prompt: q.prompt,
      selectedIndex,
      correctIndex: q.correctIndex,
      correct,
      explanation: q.explanation,
    };
  });

  const maxScore = quiz.questions.length;
  const passThreshold = quiz.passThreshold ?? 60;
  const passed = maxScore > 0 && score / maxScore >= passThreshold / 100;

  const attempt = await prisma.quizAttempt.upsert({
    where: { quizId_studentId: { quizId, studentId } },
    create: {
      quizId,
      studentId,
      score,
      maxScore,
      passed,
      answers: input.answers as Prisma.InputJsonValue,
    },
    update: {
      score,
      maxScore,
      passed,
      answers: input.answers as Prisma.InputJsonValue,
      submittedAt: new Date(),
    },
  });

  if (passed) {
    const existingXp = await prisma.xpTransaction.findFirst({
      where: {
        userId: studentId,
        sourceType: "QUIZ",
        sourceId: attempt.id,
      },
    });

    if (!existingXp) {
      const last = await prisma.xpTransaction.findFirst({
        where: { userId: studentId },
        orderBy: { createdAt: "desc" },
      });
      const xp = 10;
      await prisma.xpTransaction.create({
        data: {
          userId: studentId,
          sourceType: "QUIZ",
          sourceId: attempt.id,
          amount: xp,
          balanceAfter: Number(last?.balanceAfter ?? 0) + xp,
          note: quiz.title,
        },
      });
    }
  }

  return {
    attempt: { id: attempt.id, score, maxScore, passed, submittedAt: attempt.submittedAt },
    results,
  };
}
