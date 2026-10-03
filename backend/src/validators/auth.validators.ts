import { z } from "zod";

const emailSchema = z.email().max(255);
const passwordSchema = z.string().min(8).max(72); // 72 = bcrypt's hard input limit
const nameSchema = z.string().trim().min(1).max(100);

export const registerStudentSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  // GDPR-style explicit consent; the literal(true) makes "false"/missing fail validation.
  consent: z.literal(true, { message: "Consent must be accepted" }),
  schoolId: z.string().trim().min(1, "Institution is required"), // REQUIRED for institution isolation
  usn: z.string().trim().min(1).max(50).optional(),
  semester: z.string().trim().min(1).max(50).optional(),
  department: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
});

export const registerTeacherSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  consent: z.literal(true, { message: "Consent must be accepted" }),
  schoolId: z.string().trim().min(1, "Institution is required"), // REQUIRED for institution isolation
  department: z.string().trim().min(1).max(100).optional(),
  employeeId: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const listTeachersQuerySchema = z.object({
  status: z
    .enum(["PENDING_ADMIN_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"])
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listStudentsQuerySchema = z.object({
  status: z
    .enum(["PENDING_TEACHER_APPROVAL", "APPROVED", "REJECTED", "SUSPENDED"])
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Shared decision body for approve/reject flows. Rejections may carry a reason. */
export const approvalDecisionSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const updateTeacherProfileSchema = z.object({
  phone: z.string().trim().max(30).optional(),
  bio: z.string().trim().max(1000).optional(),
  department: z.string().trim().max(100).optional(),
  designation: z.string().trim().max(100).optional(),
  employeeId: z.string().trim().max(50).optional(),
});

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(["TEACHER", "STUDENT"]).default("TEACHER"),
});

export const assignInstitutionSchema = z.object({
  schoolId: z.string().trim().min(1, "Institution is required"),
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;
export type ListTeachersQuery = z.infer<typeof listTeachersQuerySchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;
export type UpdateTeacherProfileInput = z.infer<typeof updateTeacherProfileSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AssignInstitutionInput = z.infer<typeof assignInstitutionSchema>;

