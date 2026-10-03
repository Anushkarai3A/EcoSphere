import { Prisma } from "@prisma/client";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { userListItemSelect } from "./admin.service.js";
import type { ListStudentsQuery } from "../validators/auth.validators.js";

// ---------------------------------------------------------------------------
// Teacher Profile
// ---------------------------------------------------------------------------

export async function getTeacherProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      schoolId: true,
      createdAt: true,
      approvedAt: true,
      rejectionReason: true,
      school: { select: { id: true, name: true } },
      teacherProfile: {
        select: {
          id: true,
          schoolId: true,
          phone: true,
          bio: true,
          department: true,
          employeeId: true,
          teacherId: true,
          designation: true,
          verificationStatus: true,
          verifiedAt: true,
          verifiedBy: true,
          createdAt: true,
          updatedAt: true,
          school: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (user.role !== "TEACHER") {
    throw new AppError(403, "FORBIDDEN", "Only teachers can access this endpoint");
  }
  return user;
}

export async function updateTeacherProfile(userId: string, data: {
  phone?: string;
  bio?: string;
  department?: string;
  designation?: string;
  employeeId?: string;
}) {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true, verificationStatus: true },
  });
  if (!profile) {
    throw new AppError(404, "NO_PROFILE", "Teacher profile not found");
  }

  const updated = await prisma.teacherProfile.update({
    where: { userId },
    data: {
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.bio !== undefined && { bio: data.bio || null }),
      ...(data.department !== undefined && { department: data.department || null }),
      ...(data.designation !== undefined && { designation: data.designation || null }),
      ...(data.employeeId !== undefined && { employeeId: data.employeeId || null }),
    },
    select: {
      id: true,
      schoolId: true,
      phone: true,
      bio: true,
      department: true,
      employeeId: true,
      teacherId: true,
      designation: true,
      verificationStatus: true,
      verifiedAt: true,
      createdAt: true,
      updatedAt: true,
      school: { select: { id: true, name: true } },
    },
  });

  await writeAudit({
    userId,
    action: "TEACHER.PROFILE_UPDATE",
    entityType: "TeacherProfile",
    entityId: updated.id,
    ctx: { ipAddress: null, userAgent: null },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Teacher ID generation (TCH-XXX-NNNNNN)
// ---------------------------------------------------------------------------

function getInstitutionPrefix(schoolName: string): string {
  const stopWords = new Set(["OF", "AND", "THE", "FOR", "IN", "AT", "DE"]);
  const words = schoolName
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, "").toUpperCase())
    .filter((w) => w.length > 0 && !stopWords.has(w));

  const w0 = words[0] ?? "";
  const w1 = words[1] ?? "";

  if (words.length >= 3) {
    const initials = words.map((w) => w[0] ?? "").join("");
    return initials.slice(0, 3).padEnd(3, "X");
  } else if (words.length === 2 && w0 && w1) {
    const prefix = (w0.slice(0, 2) + w1.slice(0, 1)).toUpperCase();
    return prefix.padEnd(3, "X");
  } else if (words.length === 1 && w0) {
    return w0.slice(0, 3).padEnd(3, "X");
  }
  const fallback = schoolName.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (fallback.slice(0, 3) || "SCH").padEnd(3, "X");
}

async function generateNextTeacherNumber(): Promise<string> {
  const profiles = await prisma.teacherProfile.findMany({
    where: { teacherId: { not: null } },
    select: { teacherId: true },
  });

  let maxNum = 0;
  for (const p of profiles) {
    if (!p.teacherId) continue;
    const match = p.teacherId.match(/-(\d{6})$/);
    if (match?.[1]) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return String(maxNum + 1).padStart(6, "0");
}

export async function generateTeacherId(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true },
  });
  if (!school) throw new AppError(404, "SCHOOL_NOT_FOUND", "Institution not found");

  const prefix = getInstitutionPrefix(school.name);
  const nextNum = await generateNextTeacherNumber();
  return `TCH-${prefix}-${nextNum}`;
}

export async function assignTeacherInstitution(userId: string, schoolId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "TEACHER") {
    throw new AppError(403, "FORBIDDEN", "Only teachers can select an institution");
  }

  // No admin approval gate: teachers may freely select/change their institution.
  // Membership stays auto-verified.
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new AppError(404, "SCHOOL_NOT_FOUND", "Selected institution not found");
  }

  const existingProfile = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true, teacherId: true },
  });

  const teacherId = existingProfile?.teacherId ?? (await generateTeacherId(schoolId));
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { schoolId, status: "APPROVED", approvedAt: now },
    }),
    prisma.teacherProfile.upsert({
      where: { userId },
      create: { userId, schoolId, verificationStatus: "VERIFIED", verifiedAt: now, teacherId },
      update: { schoolId, verificationStatus: "VERIFIED", verifiedAt: now, teacherId },
    }),
  ]);

  return getTeacherProfile(userId);
}

/**
 * Verify a teacher and assign a unique Teacher ID.
 * Kept for moderation/display — teachers are auto-verified on registration,
 * so this is idempotent and never required for access.
 */
export async function verifyTeacher(teacherUserId: string, adminUserId: string, adminSchoolId: string | null): Promise<void> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    select: { id: true, schoolId: true, verificationStatus: true, teacherId: true },
  });
  if (!profile) throw new AppError(404, "NO_PROFILE", "Teacher profile not found");

  if (!profile.schoolId) {
    throw new AppError(400, "NO_INSTITUTION", "Teacher does not belong to an institution yet");
  }

  if (adminSchoolId && profile.schoolId !== adminSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only verify teachers from your institution");
  }

  const teacherId = profile.teacherId || (await generateTeacherId(profile.schoolId));

  if (profile.verificationStatus === "VERIFIED") {
    // Idempotent: ensure the account is APPROVED and has a Teacher ID.
    await prisma.$transaction([
      prisma.teacherProfile.update({
        where: { id: profile.id },
        data: { teacherId },
      }),
      prisma.user.update({
        where: { id: teacherUserId },
        data: { status: "APPROVED" },
      }),
    ]);
    return;
  }

  await prisma.$transaction([
    prisma.teacherProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: "VERIFIED",
        teacherId,
        verifiedAt: new Date(),
        verifiedBy: adminUserId,
      },
    }),
    prisma.user.update({
      where: { id: teacherUserId },
      data: { status: "APPROVED", approvedBy: adminUserId, approvedAt: new Date() },
    }),
    prisma.notification.create({
      data: {
        userId: teacherUserId,
        type: "SYSTEM",
        title: "Teacher account verified",
        body: `Your teacher account has been verified. Your Teacher ID is ${teacherId}.`,
      },
    }),
  ]);

  await writeAudit({
    userId: adminUserId,
    action: "ADMIN.TEACHER_VERIFY",
    entityType: "TeacherProfile",
    entityId: profile.id,
    ctx: { ipAddress: null, userAgent: null },
  });
}

/**
 * Reject a teacher verification request.
 */
export async function rejectTeacherVerification(teacherUserId: string, adminUserId: string, adminSchoolId: string | null, reason?: string): Promise<void> {
  const profile = await prisma.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    select: { id: true, schoolId: true, verificationStatus: true },
  });
  if (!profile) throw new AppError(404, "NO_PROFILE", "Teacher profile not found");

  if (adminSchoolId && profile.schoolId !== adminSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage teachers from your institution");
  }
  if (profile.verificationStatus === "REJECTED") {
    throw new AppError(409, "ALREADY_REJECTED", "Teacher verification is already rejected");
  }

  await prisma.$transaction([
    prisma.teacherProfile.update({
      where: { id: profile.id },
      data: { verificationStatus: "REJECTED" },
    }),
    prisma.user.update({
      where: { id: teacherUserId },
      data: { status: "REJECTED", rejectionReason: reason ?? null },
    }),
    prisma.notification.create({
      data: {
        userId: teacherUserId,
        type: "SYSTEM",
        title: "Teacher verification rejected",
        body: reason ?? "Your teacher verification request has been rejected. Please contact your institution administrator.",
      },
    }),
  ]);

  await writeAudit({
    userId: adminUserId,
    action: "ADMIN.TEACHER_REJECT",
    entityType: "TeacherProfile",
    entityId: profile.id,
    ctx: { ipAddress: null, userAgent: null },
  });
}

async function listStudentsByStatus(teacherSchoolId: string, query: ListStudentsQuery, status: "PENDING_TEACHER_APPROVAL" | "APPROVED") {
  const where: Prisma.UserWhereInput = {
    role: "STUDENT",
    status,
    schoolId: teacherSchoolId, // INSTITUTION ISOLATION: only same-school students
    ...(query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: "insensitive" } },
            { firstName: { contains: query.search, mode: "insensitive" } },
            { lastName: { contains: query.search, mode: "insensitive" } },
            { studentProfile: { usn: { contains: query.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: userListItemSelect,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function listPendingStudents(teacherSchoolId: string, query: ListStudentsQuery) {
  return listStudentsByStatus(teacherSchoolId, query, "PENDING_TEACHER_APPROVAL");
}

export async function listApprovedStudents(teacherSchoolId: string, query: ListStudentsQuery) {
  return listStudentsByStatus(teacherSchoolId, query, "APPROVED");
}

async function assertStudentTarget(userId: string, teacherSchoolId: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, schoolId: true },
  });
  if (!target) {
    throw new AppError(404, "USER_NOT_FOUND", "Student not found");
  }
  if (target.role !== "STUDENT") {
    throw new AppError(403, "FORBIDDEN", "Teachers may only manage student accounts");
  }
  // INSTITUTION ISOLATION: verify student belongs to same school as teacher
  if (target.schoolId !== teacherSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage students from your institution");
  }
  return target;
}

async function decideStudent(teacherId: string, teacherSchoolId: string, userId: string, action: "APPROVE" | "REJECT", reason?: string): Promise<void> {
  const target = await assertStudentTarget(userId, teacherSchoolId);
  if ((action === "APPROVE" && target.status === "APPROVED") || (action === "REJECT" && target.status === "REJECTED")) {
    throw new AppError(409, "ALREADY_DECIDED", `Student is already ${action === "APPROVE" ? "approved" : "rejected"}`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : "REJECTED",
        approvedBy: teacherId,
        approvedAt: new Date(),
        rejectionReason: action === "REJECT" ? (reason ?? null) : null,
      },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: action === "APPROVE" ? "Student account approved" : "Student account not approved",
        body:
          action === "APPROVE"
            ? "Your student account was approved by a teacher. You can now sign in."
            : (reason ?? "Your student account was not approved. Please contact a teacher."),
      },
    }),
  ]);

  await writeAudit({
    userId: teacherId,
    action: action === "APPROVE" ? "TEACHER.STUDENT_APPROVE" : "TEACHER.STUDENT_REJECT",
    entityType: "User",
    entityId: userId,
    ctx: { ipAddress: null, userAgent: null },
  });
}

export async function approveStudent(teacherId: string, teacherSchoolId: string, userId: string): Promise<void> {
  return decideStudent(teacherId, teacherSchoolId, userId, "APPROVE");
}

export async function rejectStudent(teacherId: string, teacherSchoolId: string, userId: string, reason?: string): Promise<void> {
  return decideStudent(teacherId, teacherSchoolId, userId, "REJECT", reason);
}