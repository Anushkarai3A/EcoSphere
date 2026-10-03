import { Prisma, type Quest } from "@prisma/client";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  createQuestWithLocation,
  findActiveQuestsNearFull,
  hasQuestLocation,
  questsLocations,
} from "../lib/postgis.js";
import type {
  CreateQuestInput,
  ListQuestsQuery,
  NearbyQuestsQuery,
  UpdateQuestInput,
} from "../validators/quest.validators.js";

const questInclude = {
  teacher: { select: { id: true, firstName: true, lastName: true } },
  classGroup: { select: { id: true, name: true } },
  _count: { select: { acceptances: true } },
} as const;

async function getQuestOrThrow(questId: string) {
  const quest = await prisma.quest.findUnique({ where: { id: questId }, include: questInclude });
  if (!quest) {
    throw new AppError(404, "QUEST_NOT_FOUND", "Quest not found");
  }
  return quest;
}

/** Returns the quest only if the given teacher owns it AND belongs to the same institution. */
async function assertQuestOwner(teacherId: string, teacherSchoolId: string, questId: string): Promise<Quest> {
  const quest = await prisma.quest.findUnique({ where: { id: questId }, include: { teacher: { select: { schoolId: true } } } });
  if (!quest) {
    throw new AppError(404, "QUEST_NOT_FOUND", "Quest not found");
  }
  if (quest.teacherId !== teacherId) {
    throw new AppError(403, "FORBIDDEN", "You don't own this quest");
  }
  // INSTITUTION ISOLATION: verify teacher belongs to same school
  if (quest.teacher.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage quests from your institution");
  }
  return quest;
}

export async function createQuest(teacherId: string, _teacherSchoolId: string, input: CreateQuestInput) {
  const hasLocation = input.lat !== undefined && input.lng !== undefined;
  const wantsPublish = input.publish === true;

  if (wantsPublish) {
    if (!hasLocation) {
      throw new AppError(400, "QUEST_NO_LOCATION", "Quest needs a location before publishing");
    }
    if (new Date(input.endsAt).getTime() <= Date.now()) {
      throw new AppError(409, "QUEST_EXPIRED", "Cannot publish a quest that has already ended");
    }
  }

  const quest = await prisma.quest.create({
    data: {
      teacherId,
      title: input.title,
      description: input.description,
      category: input.category,
      difficulty: input.difficulty,
      xpReward: input.xpReward,
      radiusMeters: input.radiusMeters,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      addressText: input.addressText ?? null,
      maxParticipants: input.maxParticipants ?? null,
      requiredProofType: input.requiredProofType,
      minPhotoCount: input.minPhotoCount,
      status: wantsPublish ? "ACTIVE" : "DRAFT",
      publishedAt: wantsPublish ? new Date() : null,
    },
  });

  if (hasLocation) {
    await createQuestWithLocation({
      id: quest.id,
      point: { lat: input.lat as number, lng: input.lng as number },
    });
  }

  return getQuestOrThrow(quest.id);
}

export async function listQuests(teacherId: string, teacherSchoolId: string, query: ListQuestsQuery) {
  const where: Prisma.QuestWhereInput = {
    teacherId,
    archivedAt: null,
    // INSTITUTION ISOLATION: verify quest's teacher belongs to same school
    teacher: { schoolId: teacherSchoolId },
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.quest.findMany({
      where,
      include: questInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.quest.count({ where }),
  ]);

  // Geometry lives outside Prisma's type system, so decode coordinates and
  // merge them back in (used by the teacher dashboard map).
  const locations = await questsLocations(items.map((q) => q.id));
  const withLocations = items.map((q) => {
    const point = locations.get(q.id);
    return point ? { ...q, lat: point.lat, lng: point.lng } : q;
  });

  return { items: withLocations, total, page: query.page, pageSize: query.pageSize };
}

export async function getQuest(questId: string, viewerUserId: string) {
  const quest = await getQuestOrThrow(questId);
  if (quest.archivedAt) {
    throw new AppError(404, "QUEST_NOT_FOUND", "Quest not found");
  }
  // Drafts are only visible to their author until published.
  if (quest.status === "DRAFT" && quest.teacherId !== viewerUserId) {
    throw new AppError(403, "FORBIDDEN", "This quest is not published yet");
  }
  return quest;
}

export async function updateQuest(teacherId: string, teacherSchoolId: string, questId: string, input: UpdateQuestInput) {
  const quest = await assertQuestOwner(teacherId, teacherSchoolId, questId);
  if (quest.archivedAt) {
    throw new AppError(409, "QUEST_ARCHIVED", "Archived quests cannot be edited");
  }
  if (quest.status !== "DRAFT") {
    throw new AppError(409, "QUEST_PUBLISHED", "Unpublish the quest before editing it");
  }

  await prisma.quest.update({
    where: { id: questId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.xpReward !== undefined ? { xpReward: input.xpReward } : {}),
      ...(input.radiusMeters !== undefined ? { radiusMeters: input.radiusMeters } : {}),
      ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.addressText !== undefined ? { addressText: input.addressText } : {}),
      ...(input.maxParticipants !== undefined ? { maxParticipants: input.maxParticipants } : {}),
      ...(input.requiredProofType !== undefined ? { requiredProofType: input.requiredProofType } : {}),
      ...(input.minPhotoCount !== undefined ? { minPhotoCount: input.minPhotoCount } : {}),
    },
  });

  if (input.lat !== undefined && input.lng !== undefined) {
    await createQuestWithLocation({ id: questId, point: { lat: input.lat, lng: input.lng } });
  }

  return getQuestOrThrow(questId);
}

export async function archiveQuest(teacherId: string, teacherSchoolId: string, questId: string): Promise<void> {
  const quest = await assertQuestOwner(teacherId, teacherSchoolId, questId);
  if (quest.archivedAt) {
    return; // idempotent
  }
  const acceptances = await prisma.questAcceptance.count({ where: { questId } });
  if (acceptances > 0) {
    throw new AppError(409, "QUEST_HAS_ACCEPTANCES", "Quests with acceptances cannot be deleted");
  }
  await prisma.quest.update({
    where: { id: questId },
    data: { archivedAt: new Date(), status: "ARCHIVED" },
  });
}

export async function publishQuest(teacherId: string, teacherSchoolId: string, questId: string) {
  const quest = await assertQuestOwner(teacherId, teacherSchoolId, questId);
  if (quest.status !== "DRAFT") {
    throw new AppError(409, "QUEST_PUBLISHED", "Quest is already published");
  }
  if (!(await hasQuestLocation(questId))) {
    throw new AppError(400, "QUEST_NO_LOCATION", "Quest needs a location before publishing");
  }
  if (new Date(quest.endsAt) <= new Date()) {
    throw new AppError(409, "QUEST_EXPIRED", "Cannot publish a quest that has already ended");
  }
  await prisma.quest.update({
    where: { id: questId },
    data: { status: "ACTIVE", publishedAt: new Date() },
  });
  return getQuestOrThrow(questId);
}

export async function unpublishQuest(teacherId: string, teacherSchoolId: string, questId: string) {
  const quest = await assertQuestOwner(teacherId, teacherSchoolId, questId);
  if (quest.status === "DRAFT") {
    return getQuestOrThrow(questId); // already draft
  }
  await prisma.quest.update({
    where: { id: questId },
    data: { status: "DRAFT", publishedAt: null },
  });
  return getQuestOrThrow(questId);
}

export async function nearbyQuests(query: NearbyQuestsQuery) {
  return findActiveQuestsNearFull({
    point: { lat: query.lat, lng: query.lng },
    maxRadiusMeters: query.radius,
    category: query.category,
    limit: query.limit,
  });
}
