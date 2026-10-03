import { Router } from "express";
import { AppError } from "../lib/http.js";
import { documentUpload } from "../lib/upload.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { requireVerifiedTeacher, requireInstitution, getSchoolId } from "../middlewares/institution.middleware.js";
import * as assignmentService from "../services/assignment.service.js";
import {
  addMaterialSchema,
  assignmentUpsertSchema,
  gradeSubmissionSchema,
  listAssignmentsQuerySchema,
  listSubmissionsQuerySchema,
  submitAssignmentSchema,
  updateAssignmentSchema,
} from "../validators/assignment.validators.js";

const router = Router();

function authenticatedUserId(res: { locals: { auth?: { userId: string } } }): string {
  const auth = res.locals.auth;
  if (!auth) throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  return auth.userId;
}

function paramId(req: { params: { id?: string | string[] } }): string {
  const raw = req.params.id;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError(400, "INVALID_ID", "Invalid id");
  }
  return raw;
}

function materialParamId(req: { params: { mid?: string | string[] } }): string {
  const raw = req.params.mid;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError(400, "INVALID_ID", "Invalid material id");
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Teacher — /assignments (institution-scoped & VERIFIED teachers)
// ---------------------------------------------------------------------------

router.get("/assignments", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const query = listAssignmentsQuerySchema.parse(req.query);
  res.json(await assignmentService.listAssignments(authenticatedUserId(res), getSchoolId(res), query));
});

router.post("/assignments", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = assignmentUpsertSchema.parse(req.body);
  const assignment = await assignmentService.createAssignment(authenticatedUserId(res), getSchoolId(res), input);
  res.status(201).json({ assignment });
});

function submissionParamId(req: { params: { sid?: string | string[] } }): string {
  const raw = req.params.sid;
  if (typeof raw !== "string" || raw.length === 0) {
    throw new AppError(400, "INVALID_ID", "Invalid submission id");
  }
  return raw;
}

// Grade route must be declared before /assignments/:id handlers that could shadow it.
router.post(
  "/assignments/submissions/:sid/grade",
  requireAuth,
  requireRole("TEACHER"),
  requireVerifiedTeacher,
  async (req, res) => {
    const input = gradeSubmissionSchema.parse(req.body);
    const submission = await assignmentService.gradeSubmission(
      authenticatedUserId(res),
      getSchoolId(res),
      submissionParamId(req),
      input,
    );
    res.json({ submission });
  },
);

router.get("/assignments/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const assignment = await assignmentService.getAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ assignment });
});

router.patch("/assignments/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const input = updateAssignmentSchema.parse(req.body);
  const assignment = await assignmentService.updateAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req), input);
  res.json({ assignment });
});

router.delete("/assignments/:id", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  await assignmentService.archiveAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.status(204).end();
});

router.post("/assignments/:id/publish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const assignment = await assignmentService.publishAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ assignment });
});

router.post("/assignments/:id/unpublish", requireAuth, requireRole("TEACHER"), requireVerifiedTeacher, async (req, res) => {
  const assignment = await assignmentService.unpublishAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ assignment });
});

router.post(
  "/assignments/:id/materials",
  requireAuth,
  requireRole("TEACHER"),
  requireVerifiedTeacher,
  documentUpload.array("files"),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const input = addMaterialSchema.parse(req.body);
    const material = await assignmentService.addMaterial(
      authenticatedUserId(res),
      getSchoolId(res),
      paramId(req),
      input,
      files,
    );
    res.status(201).json({ material });
  },
);

router.delete(
  "/assignments/:id/materials/:mid",
  requireAuth,
  requireRole("TEACHER"),
  requireVerifiedTeacher,
  async (req, res) => {
    await assignmentService.removeMaterial(authenticatedUserId(res), getSchoolId(res), paramId(req), materialParamId(req));
    res.status(204).end();
  },
);

router.get(
  "/assignments/:id/submissions",
  requireAuth,
  requireRole("TEACHER"),
  requireVerifiedTeacher,
  async (req, res) => {
    const query = listSubmissionsQuerySchema.parse(req.query);
    const items = await assignmentService.listSubmissions(authenticatedUserId(res), getSchoolId(res), paramId(req), query);
    res.json({ items });
  },
);

// ---------------------------------------------------------------------------
// Student — /student/assignments (institution-scoped)
// ---------------------------------------------------------------------------

router.get("/student/assignments", requireAuth, requireRole("STUDENT"), requireInstitution, async (_req, res) => {
  res.json(await assignmentService.studentListAssignments(authenticatedUserId(res), getSchoolId(res)));
});

router.get("/student/assignments/:id", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const assignment = await assignmentService.studentGetAssignment(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ assignment });
});

router.post(
  "/student/assignments/:id/submit",
  requireAuth,
  requireRole("STUDENT"),
  requireInstitution,
  documentUpload.array("files"),
  async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const input = submitAssignmentSchema.parse(req.body);
    const submission = await assignmentService.studentSubmit(
      authenticatedUserId(res),
      getSchoolId(res),
      paramId(req),
      input,
      files,
    );
    res.status(201).json({ submission });
  },
);

router.get("/student/assignments/:id/my", requireAuth, requireRole("STUDENT"), requireInstitution, async (req, res) => {
  const submission = await assignmentService.studentMySubmission(authenticatedUserId(res), getSchoolId(res), paramId(req));
  res.json({ submission });
});

export default router;
