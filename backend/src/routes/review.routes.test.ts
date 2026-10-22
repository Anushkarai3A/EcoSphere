import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  test("review queue integration tests", { skip: "set TEST_DATABASE_URL to a migrated test database" }, () => undefined);
} else {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";

  const { prisma } = await import("../lib/prisma.js");
  const { createApp } = await import("../app.js");
  const { closeVerificationQueue } = await import("../services/verification.service.js");
  const { signAccessToken } = await import("../services/tokens.js");

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let baseUrl = "";
  let server: Server | undefined;
  let schoolId = "";
  let legacyTeacherId = "";
  let legacyToken = "";

  before(async () => {
    const school = await prisma.school.create({
      data: { name: `Review Test School ${runId}`, country: "IN", status: "ACTIVE" },
    });
    schoolId = school.id;

    const teacher = await prisma.user.create({
      data: {
        email: `review-test-teacher-${runId}@example.com`,
        passwordHash: "not-used-by-these-tests",
        firstName: "Review",
        lastName: "Test",
        role: "TEACHER",
        status: "APPROVED",
        consentGiven: true,
        schoolId: null, // the legacy shape under test
        approvedAt: new Date(),
        teacherProfile: {
          create: {
            schoolId: school.id,
            verificationStatus: "VERIFIED",
            verifiedAt: new Date(),
            teacherId: `TCH-TEST-${runId}`,
          },
        },
      },
    });
    legacyTeacherId = teacher.id;
    legacyToken = signAccessToken(legacyTeacherId, "TEACHER", null);

    const running = createApp().listen(0, "127.0.0.1");
    server = running;
    await new Promise<void>((resolve) => running.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(running.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (legacyTeacherId) await prisma.user.deleteMany({ where: { id: legacyTeacherId } });
    if (schoolId) await prisma.school.deleteMany({ where: { id: schoolId } });
    await closeVerificationQueue();
    await prisma.$disconnect();
    if (server) {
      const closed = new Promise<void>((resolve, reject) =>
        server!.close((err) => (err ? reject(err) : resolve())),
      );
      server.closeAllConnections();
      await closed;
    }
  });

  test("legacy teacher (null schoolId claim) reaches the queue instead of 403 NO_INSTITUTION", async () => {
    const res = await fetch(`${baseUrl}/api/v1/review/queue`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { items: unknown[]; count: number };
    assert.ok(Array.isArray(body.items));
    assert.equal(typeof body.count, "number");
  });

  test("decide derives the institution from the verified profile (404, not 403 NO_INSTITUTION)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/submissions/${randomUUID()}/review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${legacyToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "APPROVE" }),
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "SUBMISSION_NOT_FOUND");
  });

  test("a teacher without a profile is still rejected by the middleware", async () => {
    const orphanToken = signAccessToken(randomUUID(), "TEACHER", null);
    const res = await fetch(`${baseUrl}/api/v1/review/queue`, {
      headers: { Authorization: `Bearer ${orphanToken}` },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "NO_TEACHER_PROFILE");
  });

  // Lazy: legacyToken is only minted inside before(), so this must be a
  // function — a module-load const would freeze an empty token into the header.
  const authHeader = () => ({ Authorization: `Bearer ${legacyToken}` });

  test("review dashboard summary returns real enum buckets for a legacy-scoped teacher", async () => {
    const res = await fetch(`${baseUrl}/api/v1/review/summary`, { headers: authHeader() });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      headline: Record<string, number>;
      assignments: Record<string, number>;
      quizzes: Record<string, number>;
      evidence: { byStatus: Record<string, number>; runs: Record<string, number> };
    };
    assert.equal(typeof body.headline.pendingReview, "number");
    assert.equal(typeof body.headline.awaitingAi, "number");
    assert.equal(typeof body.assignments.total, "number");
    assert.equal(typeof body.quizzes.attempts, "number");
    assert.equal(typeof body.evidence.byStatus.PENDING_MANUAL_REVIEW, "number");
    assert.equal(typeof body.evidence.runs.FAILED, "number");
  });

  test("assignment, attempt and evidence lists respond with the shared page envelope", async () => {
    for (const path of ["/review/assignments", "/review/quizzes/attempts", "/review/evidence"]) {
      const res = await fetch(`${baseUrl}/api/v1${path}`, { headers: authHeader() });
      assert.equal(res.status, 200, path);
      const body = (await res.json()) as { items: unknown[]; total: number; page: number; pageSize: number };
      assert.ok(Array.isArray(body.items), path);
      assert.equal(body.page, 1, path);
      assert.equal(typeof body.total, "number", path);
    }
  });

  test("unknown attempt ids 404 and never expose other teachers' questions", async () => {
    const res = await fetch(`${baseUrl}/api/v1/review/quizzes/attempts/${randomUUID()}`, {
      headers: authHeader(),
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "ATTEMPT_NOT_FOUND");
  });

  test("verify action 404s for unknown ids without queueing anything", async () => {
    const res = await fetch(`${baseUrl}/api/v1/review/evidence/${randomUUID()}/verify`, {
      method: "POST",
      headers: authHeader(),
    });
    assert.equal(res.status, 404);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "SUBMISSION_NOT_FOUND");
  });

  test("an invalid status filter is rejected with 400 before any query", async () => {
    const res = await fetch(`${baseUrl}/api/v1/review/assignments?status=BOGUS`, { headers: authHeader() });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "INVALID_FILTER");
  });

  test("students are rejected from the teacher review endpoints", async () => {
    const studentToken = signAccessToken(randomUUID(), "STUDENT", schoolId);
    const res = await fetch(`${baseUrl}/api/v1/review/summary`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(res.status, 403);
    const body = (await res.json()) as { error?: { code?: string } };
    assert.equal(body.error?.code, "FORBIDDEN");
  });
}
