import { z } from "zod";

export const reviewDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  bonusXp: z.coerce.number().int().min(0).max(1000).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Shared list query for the review dashboard endpoints. `status`/`result` are
 * loosely typed here; each service function validates them against its own
 * enum domain (GradeStatus vs SubmissionStatus) so an invalid filter fails
 * fast with a 400 instead of a Prisma error.
 */
export const listReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(40).optional(),
  result: z.enum(["passed", "failed"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;
export type ListReviewQuery = z.infer<typeof listReviewQuerySchema>;
