import { z } from "zod";
import { questDifficulties } from "./quest.validators.js";

export const quizStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const generateQuizSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  materialId: z.string().uuid().optional(),
  classGroupId: z.string().uuid().nullable().optional(),
  // Free-text subject hint; when absent the ai-service auto-detects it from the
  // study material. The detected subject is what gets persisted as quiz.topic.
  topic: z.string().trim().min(1).max(120).optional(),
  difficulty: z.enum(questDifficulties).default("MEDIUM"),
  count: z.coerce.number().int().min(5).max(50).default(10),
  passThreshold: z.coerce.number().int().min(0).max(100).optional(),
  timeLimitMin: z.coerce.number().int().min(1).max(120).optional(),
  // true → create directly as published; omitted → draft for teacher review.
  publish: z.boolean().optional(),
});

export const quizAttemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        selectedIndex: z.coerce.number().int().min(0),
      }),
    )
    .min(1),
});

export const listQuizzesQuerySchema = z.object({
  status: z.enum(quizStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type GenerateQuizInput = z.infer<typeof generateQuizSchema>;
export type QuizAttemptInput = z.infer<typeof quizAttemptSchema>;
export type ListQuizzesQuery = z.infer<typeof listQuizzesQuerySchema>;
