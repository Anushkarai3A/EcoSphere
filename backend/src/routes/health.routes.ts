import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/** Liveness — the process is up. */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "ecosphere-api", uptime: process.uptime() });
});

/** Readiness — dependencies (DB) reachable. Used by Docker healthchecks. */
router.get("/health/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ready" });
  } catch (err) {
    _req.log.error({ err }, "readiness check failed");
    res.status(503).json({ status: "not-ready" });
  }
});

export default router;
