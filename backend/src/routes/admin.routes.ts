import { Router } from "express";
import { AppError } from "../lib/http.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireInstitutionAdmin, getSchoolId } from "../middlewares/institution.middleware.js";
import * as adminService from "../services/admin.service.js";
import * as teacherService from "../services/teacher.service.js";
import * as invitationService from "../services/invitation.service.js";
import {
  approvalDecisionSchema,
  createInvitationSchema,
  listStudentsQuerySchema,
  listTeachersQuerySchema,
} from "../validators/auth.validators.js";

const router = Router();

// Everything under /admin is ADMIN-only; the two guards short-circuit cleanly.
router.use(requireAuth, requireRole("ADMIN"));

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

function getAdminSchoolId(res: { locals: { auth?: { userId: string; schoolId: string | null } } }): string | null {
  return res.locals.auth?.schoolId ?? null;
}

// ---------------------------------------------------------------------------
// Teacher / Student management (institution-scoped for institution admins)
// ---------------------------------------------------------------------------

/** All teachers, with optional status filter + search + pagination (institution-scoped for institution admins). */
router.get("/teachers", async (req, res) => {
  const query = listTeachersQuerySchema.parse(req.query);
  res.json(await adminService.listTeachers(getAdminSchoolId(res), query));
});

/** All students, with optional status filter + search + pagination (institution-scoped for institution admins). */
router.get("/students", async (req, res) => {
  const query = listStudentsQuerySchema.parse(req.query);
  res.json(await adminService.listStudents(getAdminSchoolId(res), query));
});

router.patch("/teachers/:userId/approve", async (req, res) => {
  await adminService.approveTeacher(authenticatedUserId(res), getAdminSchoolId(res), req.params.userId);
  res.status(204).end();
});

router.patch("/teachers/:userId/reject", async (req, res) => {
  const { reason } = approvalDecisionSchema.parse(req.body);
  await adminService.rejectTeacher(authenticatedUserId(res), getAdminSchoolId(res), req.params.userId, reason);
  res.status(204).end();
});

router.patch("/teachers/:userId/suspend", async (req, res) => {
  await adminService.suspendUser(authenticatedUserId(res), getAdminSchoolId(res), req.params.userId);
  res.status(204).end();
});

router.delete("/teachers/:userId", async (req, res) => {
  await adminService.deleteUser(authenticatedUserId(res), getAdminSchoolId(res), req.params.userId);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Teacher Verification (institution admin only)
// ---------------------------------------------------------------------------

/** Verify a teacher → ensure Teacher ID + APPROVED status (moderation only; auto-approved on registration). */
router.post("/teachers/:userId/verify", requireInstitutionAdmin, async (req, res) => {
  const userId = req.params.userId as string;
  await teacherService.verifyTeacher(userId, authenticatedUserId(res), getSchoolId(res));
  res.status(204).end();
});

/** Reject a teacher verification request. */
router.post("/teachers/:userId/reject-verification", requireInstitutionAdmin, async (req, res) => {
  const userId = req.params.userId as string;
  const { reason } = approvalDecisionSchema.parse(req.body);
  await teacherService.rejectTeacherVerification(userId, authenticatedUserId(res), getSchoolId(res), reason);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Institution Invitations (institution admin only)
// ---------------------------------------------------------------------------

/** Create an invitation for a teacher/student to join this institution. */
router.post("/invitations", requireInstitutionAdmin, async (req, res) => {
  const data = createInvitationSchema.parse(req.body);
  const invitation = await invitationService.createInvitation(
    authenticatedUserId(res),
    getSchoolId(res),
    data.email,
    data.role,
  );
  res.status(201).json(invitation);
});

/** List all invitations for this institution. */
router.get("/invitations", requireInstitutionAdmin, async (req, res) => {
  const { page, pageSize, role, status } = req.query as Record<string, string | undefined>;
  res.json(await invitationService.listInvitations(getSchoolId(res), {
    page: page ? parseInt(page, 10) : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    role,
    status,
  }));
});

/** Revoke a pending invitation. */
router.delete("/invitations/:invitationId", requireInstitutionAdmin, async (req, res) => {
  const invitationId = req.params.invitationId as string;
  await invitationService.revokeInvitation(invitationId, authenticatedUserId(res), getSchoolId(res));
  res.status(204).end();
});

export default router;