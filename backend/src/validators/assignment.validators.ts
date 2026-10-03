import { z } from "zod";
import { questCategories, questDifficulties } from "./quest.validators.js";

export const assignmentTypes = [
  "INDIVIDUAL",
  "PROJECT",
  "WRITTEN",
  "RESEARCH",
  "ENVIRONMENTAL_ACTIVITY",
  "PRESENTATION",
  "REPORT",
  "FILE_SUBMISSION",
  "OTHER",
] as const;

export const assignmentStatuses = ["DRAFT", "SCHEDULED", "PUBLISHED", "CLOSED", "ARCHIVED"] as const;

export const submissionTypes = [
  "TEXT",
  "PDF",
  "DOCUMENT",
  "PRESENTATION",
  "IMAGE",
  "VIDEO",
  "MULTIPLE_FILES",
  "URL",
  "TEXT_AND_FILE",
] as const;

export const gradingTypes = ["MARKS", "PERCENTAGE", "PASS_FAIL"] as const;

export const materialKinds = [
  "PDF",
  "DOCX",
  "PPT",
  "IMAGE",
  "VIDEO_LINK",
  "TEXT",
  "NOTE",
  "LINK",
] as const;

export const submissionContentTypes = ["DOCUMENT", "IMAGE", "TEXT", "LINK", "VIDEO"] as const;
export const gradeStatuses = ["UNGRADED", "GRADED", "RETURNED"] as const;

const xpRewardSchema = z.coerce.number().int().min(0).max(100_000);

export const rubricCriterionSchema = z.object({
  criterion: z.string().trim().min(1).max(100),
  maxMarks: z.coerce.number().int().positive().max(1000),
  description: z.string().trim().max(500).optional(),
});

export const assignmentUpsertSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().min(1, "Instructions are required").max(10_000),
  subject: z.string().trim().max(100).optional(),
  type: z.enum(assignmentTypes).default("INDIVIDUAL"),
  topic: z.enum(questCategories).default("OTHER"),
  difficulty: z.enum(questDifficulties).default("MEDIUM"),
  xpReward: xpRewardSchema.default(50),
  startAt: z.string().datetime({ offset: true }).optional(),
  dueAt: z.string().datetime({ offset: true }),
  allowLate: z.boolean().default(true),
  lateDeadline: z.string().datetime({ offset: true }).optional(),
  submissionType: z.enum(submissionTypes).default("TEXT_AND_FILE"),
  allowedFormats: z.array(z.string().trim().toLowerCase()).optional(),
  maxFileSizeMb: z.coerce.number().int().min(1).max(500).default(10),
  maxFiles: z.coerce.number().int().min(1).max(20).default(3),
  maxMarks: z.coerce.number().int().min(1).max(10_000).default(100),
  passMarks: z.coerce.number().int().min(0).max(10_000).optional(),
  gradingType: z.enum(gradingTypes).default("MARKS"),
  allowResubmission: z.boolean().default(true),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(1),
  teacherFeedbackEnabled: z.boolean().default(true),
  rubric: z.array(rubricCriterionSchema).optional(),
  badgeId: z.string().uuid().optional(),
  category: z.string().trim().max(100).optional(),
  relatedQuestId: z.string().uuid().optional(),
  classGroupId: z.string().uuid().nullable().optional(),
  targetType: z.enum(["CLASS", "STUDENTS"]).default("CLASS"),
  specificStudentIds: z.array(z.string().uuid()).optional(),
  publish: z.boolean().optional(),
});

export const updateAssignmentSchema = assignmentUpsertSchema.partial();

export const listAssignmentsQuerySchema = z.object({
  status: z.enum(assignmentStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const addMaterialSchema = z.object({
  kind: z.enum(materialKinds).optional(),
  title: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  externalUrl: z.string().url().max(2000).optional(),
});

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().int().min(0).max(10_000),
  gradeNotes: z.string().trim().max(2000).optional(),
  returnForResubmission: z.boolean().optional(),
});

export const submitAssignmentSchema = z.object({
  title: z.string().trim().max(200).optional(),
  text: z.string().trim().max(20_000).optional(),
  externalUrl: z.string().url().max(2000).optional(),
  contentKind: z.enum(submissionContentTypes).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  status: z.enum(gradeStatuses).optional(),
  student: z.string().uuid().optional(),
});

export type AssignmentUpsertInput = z.infer<typeof assignmentUpsertSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type ListAssignmentsQuery = z.infer<typeof listAssignmentsQuerySchema>;
export type AddMaterialInput = z.infer<typeof addMaterialSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
