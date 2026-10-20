import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test, { after, before } from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  test("auth endpoint integration tests", { skip: "set TEST_DATABASE_URL to a migrated test database" }, () => undefined);
} else {
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.NODE_ENV = "test";
  process.env.LOG_LEVEL = "silent";

  const { prisma } = await import("../lib/prisma.js");
  const { createApp } = await import("../app.js");
  const { closeVerificationQueue } = await import("../services/verification.service.js");
  const { generateRefreshToken, hashRefreshToken, newRefreshFamilyId } = await import("../services/tokens.js");

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const teacherEmail = `auth-test-teacher-${runId}@example.com`;
  const teacherPassword = "test-password-123";
  const userIds: string[] = [];
  let schoolId = "";
  let baseUrl = "";
  let server: Server | undefined;

  function cookieFrom(res: Response): string {
    const cookies = res.headers.getSetCookie();
    const refresh = cookies.find((value) => value.startsWith("ecosphere_refresh="));
    assert.ok(refresh, "refresh cookie must be set");
    return refresh.split(";")[0]!;
  }

  async function post(path: string, body?: unknown, cookie?: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    return fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  before(async () => {
    const school = await prisma.school.create({
      data: { name: `Auth Test School ${runId}`, country: "IN", status: "ACTIVE" },
    });
    schoolId = school.id;

    const running = createApp().listen(0, "127.0.0.1");
    server = running;
    await new Promise<void>((resolve) => running.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${(running.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { entityId: teacherEmail }] },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (schoolId) await prisma.school.deleteMany({ where: { id: schoolId } });
    await closeVerificationQueue();
    await prisma.$disconnect();
    if (server) {
      const closed = new Promise<void>((resolve, reject) =>
        server!.close((err) => (err ? reject(err) : resolve())),
      );
      // fetch keeps sockets alive; do not let them hold the test process open.
      server.closeAllConnections();
      await closed;
    }
  });

  test("GET /auth/institutions is public and returns active institutions", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/institutions`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { institutions: Array<{ id: string; name: string }> };
    assert.ok(body.institutions.some((institution) => institution.id === schoolId));
  });

  test("POST /auth/login rejects malformed input with 422", async () => {
    const res = await post("/api/v1/auth/login", { email: "not-an-email" });
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "VALIDATION_ERROR");
  });

  test("POST /auth/login rejects unknown credentials with 401", async () => {
    const res = await post("/api/v1/auth/login", {
      email: `missing-${runId}@example.com`,
      password: "wrong-password",
    });
    assert.equal(res.status, 401);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, "INVALID_CREDENTIALS");
  });

  test("valid login, /me, refresh rotation, and reuse detection", async () => {
    const register = await post("/api/v1/auth/register/teacher", {
      email: teacherEmail,
      password: teacherPassword,
      firstName: "Auth",
      lastName: "Tester",
      consent: true,
      schoolId,
    });
    assert.equal(register.status, 201);
    const registered = (await register.json()) as { user: { id: string } };
    userIds.push(registered.user.id);

    const login = await post("/api/v1/auth/login", {
      email: teacherEmail,
      password: teacherPassword,
    });
    assert.equal(login.status, 200);
    const session = (await login.json()) as { accessToken: string; user: { id: string } };
    assert.equal(session.user.id, registered.user.id);
    const oldRefreshCookie = cookieFrom(login);

    const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    assert.equal(me.status, 200);

    const refresh = await post("/api/v1/auth/refresh", undefined, oldRefreshCookie);
    assert.equal(refresh.status, 200);
    const refreshed = (await refresh.json()) as { accessToken: string };
    assert.ok(refreshed.accessToken);
    const newRefreshCookie = cookieFrom(refresh);
    assert.notEqual(newRefreshCookie, oldRefreshCookie);

    const replay = await post("/api/v1/auth/refresh", undefined, oldRefreshCookie);
    assert.equal(replay.status, 401);
    const replayBody = (await replay.json()) as { error: { code: string } };
    assert.equal(replayBody.error.code, "REFRESH_REUSE_DETECTED");

    const rotated = await post("/api/v1/auth/refresh", undefined, newRefreshCookie);
    assert.equal(rotated.status, 401);
  });

  test("refresh without, with invalid, and with expired credentials returns 401", async () => {
    const missing = await post("/api/v1/auth/refresh");
    assert.equal(missing.status, 401);
    assert.equal(((await missing.json()) as { error: { code: string } }).error.code, "MISSING_REFRESH_TOKEN");

    const invalid = await post("/api/v1/auth/refresh", undefined, "ecosphere_refresh=not-a-real-token");
    assert.equal(invalid.status, 401);
    assert.equal(((await invalid.json()) as { error: { code: string } }).error.code, "INVALID_REFRESH_TOKEN");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: teacherEmail } });
    const expiredToken = generateRefreshToken();
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashRefreshToken(expiredToken),
        familyId: newRefreshFamilyId(),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const expired = await post("/api/v1/auth/refresh", undefined, `ecosphere_refresh=${expiredToken}`);
    assert.equal(expired.status, 401);
    assert.equal(((await expired.json()) as { error: { code: string } }).error.code, "REFRESH_EXPIRED");
  });

  test("protected auth routes reject anonymous callers with 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { error: { code: string } }).error.code, "UNAUTHORIZED");
  });
}
