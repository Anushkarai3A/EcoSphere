import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

const DEFAULT_EMAIL = "admin@ecosphere.com";
const DEFAULT_NAME = "System Administrator";

/**
 * Idempotent bootstrap: creates the initial ADMIN account and demo institutions.
 * Credentials come from the environment (ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME)
 * — see .env.example. ADMIN_PASSWORD is required so no password ever lives in
 * source control. Safe to re-run — skips if the email already exists. Admins are
 * never self-registerable; this seed is the only way an ADMIN is created.
 */
async function main(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error(
      "ADMIN_PASSWORD must be set (min 8 characters) before running the admin seed. " +
        "Add it to your local .env — see .env.example.",
    );
  }
  const [firstName = "System", ...rest] = (process.env.ADMIN_NAME ?? DEFAULT_NAME).trim().split(/\s+/);
  const lastName = rest.join(" ");

  // Create demo institutions
  const demoSchools = [
    { name: "Greenfield Academy", city: "Bangalore", country: "IN" },
    { name: "Riverside College of Engineering", city: "Mumbai", country: "IN" },
    { name: "Sunrise International School", city: "Delhi", country: "IN" },
  ];

  for (const school of demoSchools) {
    await prisma.school.upsert({
      where: { id: `demo-${school.name.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `demo-${school.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: school.name,
        city: school.city,
        country: school.country,
        status: "ACTIVE",
      },
    });
  }
  logger.info("demo institutions created");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info("admin already exists; nothing to do");
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName,
      lastName,
      role: "ADMIN",
      status: "APPROVED",
      consentGiven: true,
    },
  });
  logger.info(`admin created: ${email}`);
}

main()
  .catch((err) => {
    logger.error({ err }, "seed failed");
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());