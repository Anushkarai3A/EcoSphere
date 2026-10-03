import { Router } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher, getSchoolId } from "../middlewares/institution.middleware.js";
import * as teacherService from "../services/teacher.service.js";
import {
  approvalDecisionSchema,
  assignInstitutionSchema,
  listStudentsQuerySchema,
  updateTeacherProfileSchema,
} from "../validators/auth.validators.js";

const router = Router();

// Base guard: All routes under /teacher are TEACHER-only.
router.use(requireAuth, requireRole("TEACHER"));

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

// ---------------------------------------------------------------------------
// Teacher Profile
// ---------------------------------------------------------------------------

/** Get own profile with verification status and Teacher ID. */
router.get("/profile", async (_req, res) => {
  res.json(await teacherService.getTeacherProfile(authenticatedUserId(res)));
});

/** Update own profile fields (bio, phone, department, designation, employeeId). */
router.put("/profile", async (req, res) => {
  const data = updateTeacherProfileSchema.parse(req.body);
  res.json(await teacherService.updateTeacherProfile(authenticatedUserId(res), data));
});

/** Select/assign an institution for the teacher (no approval required). */
router.post("/institution", async (req, res) => {
  const { schoolId } = assignInstitutionSchema.parse(req.body);
  res.json(await teacherService.assignTeacherInstitution(authenticatedUserId(res), schoolId));
});

// ---------------------------------------------------------------------------
// Student management (institution-scoped, any teacher in the institution)
// ---------------------------------------------------------------------------

/** Students awaiting teacher approval (institution-scoped). */
router.get("/students/pending", requireVerifiedTeacher, async (req, res) => {
  const query = listStudentsQuerySchema.parse(req.query);
  res.json(await teacherService.listPendingStudents(getSchoolId(res), query));
});

/** Approved students (teacher's student roster, institution-scoped). */
router.get("/students/approved", requireVerifiedTeacher, async (req, res) => {
  const query = listStudentsQuerySchema.parse(req.query);
  res.json(await teacherService.listApprovedStudents(getSchoolId(res), query));
});

router.patch("/students/:userId/approve", requireVerifiedTeacher, async (req, res) => {
  const targetUserId = req.params.userId as string;
  await teacherService.approveStudent(authenticatedUserId(res), getSchoolId(res), targetUserId);
  res.status(204).end();
});

router.patch("/students/:userId/reject", requireVerifiedTeacher, async (req, res) => {
  const targetUserId = req.params.userId as string;
  const { reason } = approvalDecisionSchema.parse(req.body);
  await teacherService.rejectStudent(authenticatedUserId(res), getSchoolId(res), targetUserId, reason);
  res.status(204).end();
});

export default router;