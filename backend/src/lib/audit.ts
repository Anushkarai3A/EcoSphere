import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";

/** Per-request metadata attached to every audit entry. */
export interface AuditContext {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Append-only audit trail. The table is never UPDATEd or DELETEd by the
 * application (the deploy-time DB role should not have those privileges).
 * userId is the actor; NULL means a system/context-free event.
 */
export async function writeAudit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
  ctx: AuditContext;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: input.meta as Prisma.InputJsonValue | undefined,
      ipAddress: input.ctx.ipAddress,
    },
  });
}
