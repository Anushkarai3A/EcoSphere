import { Router } from "express";
import adminRoutes from "./admin.routes.js";
import assignmentRoutes from "./assignment.routes.js";
import authRoutes from "./auth.routes.js";
import healthRoutes from "./health.routes.js";
import participationRoutes from "./participation.routes.js";
import questRoutes from "./quest.routes.js";
import quizRoutes from "./quiz.routes.js";
import reviewRoutes from "./review.routes.js";
import studentRoutes from "./student.routes.js";
import teacherRoutes from "./teacher.routes.js";

const router = Router();

// participation owns /quests/:id/accept and must win over questRoutes' /:id.
router.use(participationRoutes);
router.use(reviewRoutes);
router.use(assignmentRoutes);
router.use(quizRoutes);
router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/teacher", teacherRoutes);
router.use("/student", studentRoutes);
router.use("/quests", questRoutes);
router.use(healthRoutes);

export default router;
