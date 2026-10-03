import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { isPointInQuestRadius, setSubmissionLocation } from "../lib/postgis.js";
import { assetUrl, classifyMime } from "../lib/upload.js";
import { enqueueVerification } from "./verification.service.js";

const questSummary = {
  select: {
    id: true,
    title: true,
    description: true,
    category: true,
    difficulty: true,
    xpReward: true,
    addressText: true,
    radiusMeters: true,
    startsAt: true,
    endsAt: true,
    requiredProofType: true,
    minPhotoCount: true,
  },
} as const;

/** Active quest gating shared by accept + submit; returns the narrowed quest. */
function requireAcceptableQuest<T extends {
  status: string;
  archivedAt: Date | null;
  startsAt: Date;
  endsAt: Date;
}>(quest: T | null): T {
  if (!quest || quest.archivedAt) {
    throw new AppError(404, "QUEST_NOT_FOUND", "Quest not found");
  }
  if (quest.status !== "ACTIVE") {
    throw new AppError(409, "QUEST_NOT_ACTIVE", "Quest is not currently active");
  }
  const now = new Date();
  if (now < quest.startsAt) {
    throw new AppError(409, "QUEST_NOT_STARTED", "Quest hasn't started yet");
  }
  if (now >= quest.endsAt) {
    throw new AppError(409, "QUEST_EXPIRED", "Quest has ended");
  }
  return quest;
}

/** A student commits to an active quest (idempotent resume after archiving). */
export async function acceptQuest(studentId: string, questId: string) {
  const quest = requireAcceptableQuest(
    await prisma.quest.findUnique({ where: { id: questId } }),
  );

  if (quest.maxParticipants !== null) {
    const enrolled = await prisma.questAcceptance.count({
      where: { questId, isArchived: false },
    });
    if (enrolled >= quest.maxParticipants) {
      throw new AppError(409, "QUEST_FULL", "This quest has reached its participant limit");
    }
  }

  const acceptance = await prisma.questAcceptance.upsert({
    where: { questId_studentId: { questId, studentId } },
    create: { questId, studentId, status: "ACCEPTED" },
    update: { status: "ACCEPTED", isArchived: false },
    include: { quest: questSummary },
  });

  return acceptance;
}

/** The signed-in student's quests, newest first, with their latest submission. */
export async function myAcceptances(studentId: string) {
  const items = await prisma.questAcceptance.findMany({
    where: { studentId, isArchived: false },
    include: {
      quest: questSummary,
      submissions: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { id: true, status: true, submittedAt: true, reviewNote: true },
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  return {
    items: items.map((a) => ({
      id: a.id,
      status: a.status,
      acceptedAt: a.acceptedAt,
      completedAt: a.completedAt,
      xpAwarded: a.xpAwarded.toString(),
      quest: a.quest,
      latestSubmission: a.submissions[0] ?? null,
    })),
  };
}

/** Full acceptance detail including every submission + verification result. */
export async function getAcceptance(studentId: string, acceptanceId: string) {
  const acceptance = await prisma.questAcceptance.findFirst({
    where: { id: acceptanceId, studentId, isArchived: false },
    include: {
      quest: questSummary,
      submissions: {
        orderBy: { submittedAt: "desc" },
        include: {
          assets: true,
          verification: { include: { checks: { orderBy: { checkType: "asc" } } } },
        },
      },
    },
  });
  if (!acceptance) {
    throw new AppError(404, "ACCEPTANCE_NOT_FOUND", "Acceptance not found");
  }
  return acceptance;
}

export interface SubmitEvidenceInput {
  lat: number;
  lng: number;
  accuracy?: number;
  deviceTimestamp?: string;
  notes?: string;
}

/** Store uploaded evidence as a submission and kick off AI verification. */
export async function submitEvidence(
  studentId: string,
  acceptanceId: string,
  input: SubmitEvidenceInput,
  files: Express.Multer.File[],
) {
  const acceptance = await prisma.questAcceptance.findFirst({
    where: { id: acceptanceId, studentId, isArchived: false },
    include: { quest: true },
  });
  if (!acceptance) {
    throw new AppError(404, "ACCEPTANCE_NOT_FOUND", "Acceptance not found");
  }
  const quest = requireAcceptableQuest(acceptance.quest);

  const latest = await prisma.questSubmission.findFirst({
    where: { acceptanceId },
    orderBy: { submittedAt: "desc" },
  });
  if (latest) {
    if (latest.status === "APPROVED" || latest.status === "AUTO_APPROVED") {
      throw new AppError(409, "ALREADY_APPROVED", "This quest is already approved");
    }
    if (latest.status === "PENDING_VERIFICATION" || latest.status === "PENDING_MANUAL_REVIEW") {
      throw new AppError(409, "SUBMISSION_PENDING", "Your previous submission is still under review");
    }
  }

  const imageCount = files.filter((f) => classifyMime(f.mimetype) === "IMAGE").length;
  const videoCount = files.length - imageCount;
  if (quest.requiredProofType === "PHOTO" && imageCount < quest.minPhotoCount) {
    throw new AppError(
      400,
      "NOT_ENOUGH_PHOTOS",
      `This quest requires at least ${quest.minPhotoCount} photo${quest.minPhotoCount === 1 ? "" : "s"}`,
    );
  }
  if (quest.requiredProofType === "VIDEO" && videoCount < 1) {
    throw new AppError(400, "NOT_ENOUGH_VIDEO", "This quest requires at least one video");
  }
  if (quest.requiredProofType === "PHOTO_AND_VIDEO" && (imageCount < quest.minPhotoCount || videoCount < 1)) {
    throw new AppError(
      400,
      "INSUFFICIENT_EVIDENCE",
      `This quest requires at least ${quest.minPhotoCount} photo(s) and one video`,
    );
  }

  const inside = await isPointInQuestRadius(quest.id, { lat: input.lat, lng: input.lng });
  if (!inside) {
    throw new AppError(
      400,
      "OUT_OF_RADIUS",
      `Your location is outside the quest area (${quest.radiusMeters}m radius)`,
    );
  }

  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.questSubmission.create({
      data: {
        acceptanceId,
        deviceTimestamp: input.deviceTimestamp ? new Date(input.deviceTimestamp) : null,
        locationAccuracyM: input.accuracy ?? null,
        notes: input.notes ?? null,
        status: "PENDING_VERIFICATION",
        ...(latest ? { reSubmissionOf: latest.id } : {}),
      },
    });
    for (const file of files) {
      await tx.evidenceAsset.create({
        data: {
          submissionId: created.id,
          assetType: classifyMime(file.mimetype),
          cloudinaryPublicId: file.filename,
          secureUrl: assetUrl(file.filename),
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
    }
    return created;
  });

  await setSubmissionLocation(submission.id, { lat: input.lat, lng: input.lng });
  await prisma.questAcceptance.update({
    where: { id: acceptanceId },
    data: { status: "IN_PROGRESS" },
  });
  await enqueueVerification(submission.id);

  const created = await prisma.questSubmission.findUnique({
    where: { id: submission.id },
    include: {
      acceptance: { include: { quest: questSummary } },
      assets: true,
    },
  });
  return created;
}
