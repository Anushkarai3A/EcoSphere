import crypto from "node:crypto";
import { AppError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { writeAudit } from "../lib/audit.js";

const INVITATION_TOKEN_BYTES = 32;
const INVITATION_EXPIRY_HOURS = 72;

/**
 * Generate a cryptographically random invitation token.
 */
function generateToken(): string {
  return crypto.randomBytes(INVITATION_TOKEN_BYTES).toString("hex");
}

/**
 * Create an invitation for a teacher or student to join an institution.
 * Only institution admins can create invitations.
 */
export async function createInvitation(
  adminUserId: string,
  adminSchoolId: string,
  email: string,
  role: "TEACHER" | "STUDENT",
) {
  // Check for existing valid (unused, non-expired) invitation for this email+school
  const existing = await prisma.institutionInvitation.findFirst({
    where: {
      schoolId: adminSchoolId,
      email: email.toLowerCase(),
      role,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) {
    throw new AppError(409, "INVITATION_EXISTS", "An active invitation already exists for this email");
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

  const invitation = await prisma.institutionInvitation.create({
    data: {
      token,
      schoolId: adminSchoolId,
      email: email.toLowerCase(),
      role,
      expiresAt,
      createdBy: adminUserId,
    },
    select: {
      id: true,
      token: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  await writeAudit({
    userId: adminUserId,
    action: "ADMIN.INVITATION_CREATE",
    entityType: "InstitutionInvitation",
    entityId: invitation.id,
    ctx: { ipAddress: null, userAgent: null },
  });

  return invitation;
}

/**
 * Validate an invitation token.
 * Returns the invitation data if valid, throws if expired/used/invalid.
 */
export async function validateInvitation(token: string) {
  const invitation = await prisma.institutionInvitation.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      schoolId: true,
      email: true,
      role: true,
      expiresAt: true,
      usedAt: true,
      usedBy: true,
      school: { select: { id: true, name: true } },
    },
  });

  if (!invitation) {
    throw new AppError(404, "INVITATION_NOT_FOUND", "Invalid invitation token");
  }
  if (invitation.usedAt) {
    throw new AppError(410, "INVITATION_USED", "This invitation has already been used");
  }
  if (invitation.expiresAt < new Date()) {
    throw new AppError(410, "INVITATION_EXPIRED", "This invitation has expired");
  }

  return invitation;
}

/**
 * Mark an invitation as used after successful registration.
 */
export async function consumeInvitation(token: string, userId: string): Promise<void> {
  const invitation = await validateInvitation(token);

  await prisma.institutionInvitation.update({
    where: { id: invitation.id },
    data: { usedAt: new Date(), usedBy: userId },
  });
}

/**
 * List all invitations for an institution (active and expired).
 */
export async function listInvitations(
  adminSchoolId: string,
  query: { page?: number; pageSize?: number; role?: string; status?: string },
) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? 20, 100);

  const where: Record<string, unknown> = { schoolId: adminSchoolId };
  if (query.role) where.role = query.role;
  if (query.status === "active") {
    where.usedAt = null;
    where.expiresAt = { gt: new Date() };
  } else if (query.status === "used") {
    where.usedAt = { not: null };
  } else if (query.status === "expired") {
    where.usedAt = null;
    where.expiresAt = { lte: new Date() };
  }

  const [items, total] = await prisma.$transaction([
    prisma.institutionInvitation.findMany({
      where: where as never,
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
        creator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.institutionInvitation.count({ where: where as never }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Revoke (cancel) an invitation.
 */
export async function revokeInvitation(
  invitationId: string,
  adminUserId: string,
  adminSchoolId: string,
): Promise<void> {
  const invitation = await prisma.institutionInvitation.findUnique({
    where: { id: invitationId },
    select: { id: true, schoolId: true, usedAt: true },
  });

  if (!invitation) {
    throw new AppError(404, "INVITATION_NOT_FOUND", "Invitation not found");
  }
  if (invitation.schoolId !== adminSchoolId) {
    throw new AppError(403, "FORBIDDEN", "You can only manage invitations from your institution");
  }
  if (invitation.usedAt) {
    throw new AppError(409, "INVITATION_USED", "Cannot revoke a used invitation");
  }

  await prisma.institutionInvitation.delete({ where: { id: invitationId } });

  await writeAudit({
    userId: adminUserId,
    action: "ADMIN.INVITATION_REVOKE",
    entityType: "InstitutionInvitation",
    entityId: invitationId,
    ctx: { ipAddress: null, userAgent: null },
  });
}
