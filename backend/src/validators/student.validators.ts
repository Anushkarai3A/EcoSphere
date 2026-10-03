import { z } from "zod";

export const updateStudentProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(100).optional(),
  semester: z.string().trim().max(50).optional(),
  grade: z.string().trim().max(50).optional(),
  usn: z.string().trim().max(50).optional(),
  privacyMode: z.boolean().optional(),
});

export const generateAnimationSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(10, "Prompt must be at least 10 characters")
    .max(1000, "Prompt cannot exceed 1000 characters"),
  topic: z.string().trim().max(100).optional(),
  durationSeconds: z.coerce
    .number()
    .int()
    .min(15, "Minimum animation duration is 15 seconds")
    .max(90, "Maximum animation duration is 90 seconds")
    .default(45),
  style: z
    .enum(["CARTOON_2D", "MOTION_GRAPHICS", "ECO_DOODLE", "PIXEL_ART", "INFOGRAPHIC"])
    .default("CARTOON_2D"),
  characters: z.array(z.string().trim().max(100)).max(5).optional(),
  scenes: z.array(z.string().trim().max(500)).max(8).optional(),
  educationalContent: z.string().trim().max(500).optional(),
});

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
export type GenerateAnimationInput = z.infer<typeof generateAnimationSchema>;
