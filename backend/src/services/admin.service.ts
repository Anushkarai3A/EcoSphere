import { Prisma } from "@prisma/client";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";
import { verifyTeacher } from "./teacher.service.js";
import type { ListStudentsQuery, ListTeachersQuery } from "../validators/auth.validators.js";

/**
 * Get the schoolId filter for admin queries.
 * If adminSchoolId is provided, filter by that school (institution admin).
 * If null, return no filter (system admin sees all).
 */
function schoolFilter(adminSchoolId: string | null): Prisma.UserWhereInput | undefined {
  return adminSchoolId ? { schoolId: adminSchoolId } : undefined;
}

export const userListItemSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  createdAt: true,
  approvedAt: true,
  rejectionReason: true,
  archivedAt: true,
  approvedByUser: { select: { id: true, email: true, firstName: true, lastName: true } },
  teacherProfile: {
    select: {
      id: true,
      schoolId: true,
      department: true,
      employeeId: true,
      teacherId: true,
      designation: true,
      verificationStatus: true,
      phone: true,
      school: { select: { id: true, name: true, country: true } },
    },
  },
  studentProfile: {
    select: {
      id: true,
      schoolId: true,
      department: true,
      usn: true,
      semester: true,
      phone: true,
      school: { select: { id: true, name: true, country: true } },
    },
  },
} satisfies Prisma.UserSelect;

type UserListItem = Prisma.UserGetPayload<{ select: typeof userListItemSelect }>;

function buildSearch(search: string | undefined): Prisma.UserWhereInput | undefined {
  if (!search) return undefined;
  return {
    OR: [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { studentProfile: { usn: { contains: search, mode: "insensitive" } } },
    ],
  };
}

async function listUsers(role: "TEACHER" | "STUDENT", adminSchoolId: string | null, query: { status?: string; search?: string; page: number; pageSize: number }) {
  const where: Prisma.UserWhereInput = {
    role,
    ...schoolFilter(adminSchoolId),
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.search ? buildSearch(query.search) : {}),
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

export async function listTeachers(adminSchoolId: string | null, query: ListTeachersQuery) {
  return listUsers("TEACHER", adminSchoolId, query);
}

export async function listStudents(adminSchoolId: string | null, query: ListStudentsQuery) {
  return listUsers("STUDENT", adminSchoolId, query);
}

async function assertTargetRole(userId: string, expected: "TEACHER" | "STUDENT", adminSchoolId: string | null): Promise<UserListItem> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { ...userListItemSelect, schoolId: true } });
  if (!target) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }
  if (target.role !== expected) {
    throw new AppError(403, "FORBIDDEN", `Only ${expected} accounts can be managed through this endpoint`);
  }
  // INSTITUTION ISOLATION: if admin has a schoolId, verify target belongs to same school
  if (adminSchoolId && target.schoolId !== adminSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage users from your institution");
  }
  return target;
}

export async function approveTeacher(adminId: string, adminSchoolId: string | null, userId: string): Promise<void> {
  await verifyTeacher(userId, adminId, adminSchoolId);
}

export async function rejectTeacher(adminId: string, adminSchoolId: string | null, userId: string, reason?: string): Promise<void> {
  const target = await assertTargetRole(userId, "TEACHER", adminSchoolId);
  if (target.status === "REJECTED") {
    throw new AppError(409, "ALREADY_REJECTED", "Teacher is already rejected");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: "REJECTED", approvedBy: adminId, approvedAt: new Date(), rejectionReason: reason ?? null },
    }),
    prisma.notification.create({
      data: {
        userId,
        type: "SYSTEM",
        title: "Teacher account not approved",
        body: reason ?? "Your teacher account was not approved. Please contact the institution.",
      },
    }),
  ]);

  await writeAudit({
    userId: adminId,
    action: "ADMIN.TEACHER_REJECT",
    entityType: "User",
    entityId: userId,
    ctx: { ipAddress: null, userAgent: null },
  });
}

export async function suspendUser(adminId: string, adminSchoolId: string | null, userId: string): Promise<void> {
  const target = await assertTargetRole(userId, "TEACHER", adminSchoolId);
  if (target.status === "SUSPENDED") {
    throw new AppError(409, "ALREADY_SUSPENDED", "Teacher is already suspended");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });

  await writeAudit({
    userId: adminId,
    action: "ADMIN.TEACHER_SUSPEND",
    entityType: "User",
    entityId: userId,
    ctx: { ipAddress: null, userAgent: null },
  });
}

/** Soft delete: archives the account so it can no longer log in while data stays intact. */
export async function deleteUser(adminId: string, adminSchoolId: string | null, userId: string): Promise<void> {
  const target = await assertTargetRole(userId, "TEACHER", adminSchoolId);
  if (target.archivedAt) {
    throw new AppError(409, "ALREADY_DELETED", "Teacher is already deleted");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { archivedAt: new Date(), status: "REJECTED" },
  });

  await writeAudit({
    userId: adminId,
    action: "ADMIN.TEACHER_DELETE",
    entityType: "User",
    entityId: userId,
    ctx: { ipAddress: null, userAgent: null },
  });
}
