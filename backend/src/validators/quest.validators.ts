import { z } from "zod";

export const questCategories = [
  "TREE_PLANTATION",
  "WASTE_COLLECTION",
  "PARK_CLEANING",
  "RECYCLING",
  "BIODIVERSITY",
  "AWARENESS",
  "OTHER",
] as const;

export const questDifficulties = ["EASY", "MEDIUM", "HARD", "EXPERT"] as const;

export const questProofTypes = ["PHOTO", "VIDEO", "PHOTO_AND_VIDEO"] as const;

export const questStatuses = [
  "DRAFT",
  "PUBLISHED",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
  "ARCHIVED",
] as const;

const xpRewardSchema = z.coerce.number().int().positive().max(100_000);
const nameSchema = z.string().trim().min(1).max(120);

const pointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const baseQuestSchema = z.object({
  title: nameSchema,
  description: z.string().trim().min(1).max(5000),
  category: z.enum(questCategories),
  difficulty: z.enum(questDifficulties).default("EASY"),
  xpReward: xpRewardSchema,
  ...pointSchema.shape,
  addressText: z.string().trim().max(300).optional(),
  radiusMeters: z.coerce.number().int().min(10).max(1000).default(100),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  maxParticipants: z.coerce.number().int().positive().max(10_000).optional(),
  requiredProofType: z.enum(questProofTypes).default("PHOTO"),
  minPhotoCount: z.coerce.number().int().min(1).max(20).default(1),
});

export const createQuestSchema = baseQuestSchema
  // Drafts can be saved without a map location; publishing requires one.
  .extend({ publish: z.boolean().optional() })
  .partial({ lat: true, lng: true })
  .refine((data) => new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime(), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const updateQuestSchema = baseQuestSchema
  .partial()
  .refine((data) => {
    if (!data.startsAt || !data.endsAt) return true;
    return new Date(data.endsAt).getTime() > new Date(data.startsAt).getTime();
  }, {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const listQuestsQuerySchema = z.object({
  status: z.enum(questStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const nearbyQuestsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(50_000).default(10_000),
  category: z.enum(questCategories).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(250),
});

export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;
export type ListQuestsQuery = z.infer<typeof listQuestsQuerySchema>;
export type NearbyQuestsQuery = z.infer<typeof nearbyQuestsQuerySchema>;
