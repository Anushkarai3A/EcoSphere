import { PrismaClient } from "@prisma/client";

// Prisma caches a connection pool; reuse it across hot-reloads in dev to avoid
// exhausting Postgres connections when tsx watch restarts the process.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
