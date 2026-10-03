import { z } from "zod";

export const reviewDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  bonusXp: z.coerce.number().int().min(0).max(1000).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
