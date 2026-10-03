import { Prisma, type UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit, type AuditContext } from "../lib/audit.js";
import type { RegisterStudentInput, RegisterTeacherInput } from "../validators/auth.validators.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  newRefreshFamilyId,
  refreshTokenExpiry,
  signAccessToken,
  type UserRole,
} from "./tokens.js";

const BCRYPT_ROUNDS = 12;

/** Full shape needed to build a safe public representation. */
type UserWithProfiles = Prisma.UserGetPayload<{
  include: { school: true; teacherProfile: { include: { school: true } }; studentProfile: { include: { school: true } } };
}>;

export interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  schoolId: string | null;
  school: { id: string; name: string } | null;
  createdAt: Date;
  approvedAt: Date | null;
  rejectionReason: string | null;
  teacherProfile: {
    id: string;
    schoolId: string | null;
    department: string | null;
    employeeId: string | null;
    teacherId: string | null;
    designation: string | null;
    verificationStatus: string | null;
    verifiedAt: Date | null;
    school: { id: string; name: string } | null;
  } | null;
  studentProfile: {
    id: string;
    streakCount: number;
    usn: string | null;
    semester: string | null;
    department: string | null;
    school: { id: string; name: string } | null;
  } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function toSafeUser(user: UserWithProfiles): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    status: user.status,
    schoolId: user.schoolId,
    school: user.school
      ? { id: user.school.id, name: user.school.name }
      : null,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    rejectionReason: user.rejectionReason,
    teacherProfile: user.teacherProfile
      ? {
          id: user.teacherProfile.id,
          schoolId: user.teacherProfile.schoolId,
          department: user.teacherProfile.department,
          employeeId: user.teacherProfile.employeeId,
          teacherId: user.teacherProfile.teacherId,
          designation: user.teacherProfile.designation,
          verificationStatus: user.teacherProfile.verificationStatus,
          verifiedAt: user.teacherProfile.verifiedAt,
          school: user.teacherProfile.school
            ? { id: user.teacherProfile.school.id, name: user.teacherProfile.school.name }
            : null,
        }
      : null,
    studentProfile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          streakCount: user.studentProfile.streakCount,
          usn: user.studentProfile.usn,
          semester: user.studentProfile.semester,
          department: user.studentProfile.department,
          school: user.studentProfile.school
            ? { id: user.studentProfile.school.id, name: user.studentProfile.school.name }
            : null,
        }
      : null,
  };
}

const userWithProfiles = {
  include: {
    school: true,
    teacherProfile: { include: { school: true } },
    studentProfile: { include: { school: true } },
  },
} satisfies Prisma.UserDefaultArgs;

async function findUserWithProfiles(where: Prisma.UserWhereUniqueInput) {
  return prisma.user.findUnique({ where, include: userWithProfiles.include });
}

/** Normalize + persist the email once, at the edge, so writes are always consistent. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function assertEmailFree(email: string): Promise<void> {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }
}

/**
 * Account state gate used on login and token refresh. Each non-active state maps
 * to a distinct message the frontend surfaces on the login form.
 *
 * NOTE: institution admin approval was removed — teachers are auto-approved on
 * registration. PENDING_ADMIN_APPROVAL is no longer a blocking state (legacy
 * rows are treated as active so pre-existing pending teachers can sign in).
 */
function assertAccountActive(user: { status: UserStatus; archivedAt: Date | null }): void {
  if (user.archivedAt) {
    throw new AppError(410, "ACCOUNT_ARCHIVED", "This account no longer exists");
  }
  if (user.status === "PENDING_TEACHER_APPROVAL") {
    throw new AppError(
      403,
      "ACCOUNT_PENDING_TEACHER_APPROVAL",
      "Your account is awaiting approval from a teacher.",
    );
  }
  if (user.status === "REJECTED") {
    throw new AppError(
      403,
      "ACCOUNT_REJECTED",
      "Your registration request has been rejected. Please contact the institution.",
    );
  }
  if (user.status === "SUSPENDED") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "Your account is suspended.");
  }
}

async function issueTokens(userId: string, role: UserRole, ctx: AuditContext): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { schoolId: true } });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      familyId: newRefreshFamilyId(),
      expiresAt: refreshTokenExpiry(),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    },
  });
  return { accessToken: signAccessToken(userId, role, user?.schoolId ?? null), refreshToken };
}

export async function registerStudent(input: RegisterStudentInput, ctx: AuditContext): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  await assertEmailFree(email);

  // Require schoolId for students
  if (!input.schoolId) {
    throw new AppError(400, "SCHOOL_REQUIRED", "Institution is required for student registration");
  }

  // Verify the school exists
  const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
  if (!school) {
    throw new AppError(404, "SCHOOL_NOT_FOUND", "Institution not found");
  }

  const user = await prisma.user
    .create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        firstName: input.firstName,
        lastName: input.lastName,
        role: "STUDENT",
        status: "PENDING_TEACHER_APPROVAL",
        consentGiven: true,
        schoolId: input.schoolId,
        studentProfile: {
          create: {
            schoolId: input.schoolId,
            usn: input.usn,
            semester: input.semester,
            department: input.department,
            phone: input.phone,
          },
        },
      },
      ...userWithProfiles,
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
      }
      throw err;
    });

  await writeAudit({
    userId: user.id,
    action: "AUTH.STUDENT_REGISTER",
    entityType: "User",
    entityId: user.id,
    meta: { role: "STUDENT", schoolId: input.schoolId },
    ctx,
  });

  return toSafeUser(user);
}

export async function registerTeacher(input: RegisterTeacherInput, ctx: AuditContext): Promise<SafeUser> {
  const email = normalizeEmail(input.email);
  await assertEmailFree(email);

  // Require schoolId for teachers
  if (!input.schoolId) {
    throw new AppError(400, "SCHOOL_REQUIRED", "Institution is required for teacher registration");
  }

  // Verify the school exists
  const school = await prisma.school.findUnique({ where: { id: input.schoolId } });
  if (!school) {
    throw new AppError(404, "SCHOOL_NOT_FOUND", "Institution not found");
  }

  // Teachers self-register and are auto-approved — no institution admin step.
  // The account is immediately ACTIVE (status APPROVED + VERIFIED profile) so
  // the teacher can sign in and use the platform straight away. Admin
  // approve/reject/suspend endpoints remain for moderation only.
  // Dynamic import avoids a top-level cycle with teacher.service.
  const { generateTeacherId } = await import("./teacher.service.js");
  const teacherId = await generateTeacherId(input.schoolId);
  const now = new Date();
  const user = await prisma.user
    .create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        firstName: input.firstName,
        lastName: input.lastName,
        role: "TEACHER",
        status: "APPROVED",
        consentGiven: true,
        schoolId: input.schoolId,
        approvedAt: now,
        teacherProfile: {
          create: {
            schoolId: input.schoolId,
            department: input.department,
            employeeId: input.employeeId,
            verificationStatus: "VERIFIED",
            verifiedAt: now,
            teacherId,
          },
        },
      },
      ...userWithProfiles,
    })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
      }
      throw err;
    });

  await writeAudit({
    userId: user.id,
    action: "AUTH.TEACHER_REGISTER",
    entityType: "User",
    entityId: user.id,
    meta: { schoolId: input.schoolId, autoApproved: true },
    ctx,
  });

  return toSafeUser(user);
}

export async function login(emailInput: string, password: string, ctx: AuditContext): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const email = normalizeEmail(emailInput);
  const user = await findUserWithProfiles({ email });

  // Deliberately identical error for "no such user" vs "wrong password" to prevent
  // account enumeration through the login endpoint.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await writeAudit({
      userId: user?.id ?? null,
      action: "AUTH.LOGIN_FAILED",
      entityType: "User",
      entityId: user?.id ?? email,
      ctx,
    });
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  assertAccountActive(user);

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({
    userId: user.id,
    action: "AUTH.LOGIN",
    entityType: "User",
    entityId: user.id,
    ctx,
  });

  return { user: toSafeUser(user), tokens: await issueTokens(user.id, user.role, ctx) };
}

/**
 * Rotating refresh: a presented token is either the live one (rotated forward) or
 * a replayed one. Replay means the token was stolen, so the entire family dies.
 */
export async function refreshSession(rawToken: string | undefined, ctx: AuditContext): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  if (!rawToken) {
    throw new AppError(401, "MISSING_REFRESH_TOKEN", "No refresh token provided");
  }

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: { include: userWithProfiles.include } },
  });

  if (!record) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token not recognized");
  }

  if (record.revokedAt !== null || record.replacedByTokenId !== null) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId },
      data: { revokedAt: new Date() },
    });
    await writeAudit({
      userId: record.userId,
      action: "AUTH.REFRESH_REUSE_DETECTED",
      entityType: "RefreshToken",
      entityId: record.id,
      ctx,
    });
    throw new AppError(401, "REFRESH_REUSE_DETECTED", "Refresh token reuse detected; session revoked");
  }

  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
    throw new AppError(401, "REFRESH_EXPIRED", "Session expired, please sign in again");
  }

  assertAccountActive(record.user);

  const nextToken = generateRefreshToken();
  const nextRecord = await prisma.refreshToken.create({
    data: {
      userId: record.userId,
      tokenHash: hashRefreshToken(nextToken),
      familyId: record.familyId,
      expiresAt: refreshTokenExpiry(),
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    },
  });
  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date(), replacedByTokenId: nextRecord.id },
  });

  await writeAudit({
    userId: record.userId,
    action: "AUTH.REFRESH",
    entityType: "RefreshToken",
    entityId: record.id,
    meta: { nextTokenId: nextRecord.id },
    ctx,
  });

  return {
    user: toSafeUser(record.user),
    tokens: { accessToken: signAccessToken(record.user.id, record.user.role, record.user.schoolId), refreshToken: nextToken },
  };
}

/** Idempotent: revoking an already-absent/invalid token is still a successful logout. */
export async function logout(rawToken: string | undefined, ctx: AuditContext): Promise<void> {
  if (!rawToken) return;

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!record || record.revokedAt !== null) return;

  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  await writeAudit({
    userId: record.userId,
    action: "AUTH.LOGOUT",
    entityType: "RefreshToken",
    entityId: record.id,
    ctx,
  });
}

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await findUserWithProfiles({ id: userId });
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
  return toSafeUser(user);
}