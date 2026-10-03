-- Auth & approval redesign.
-- Account-level approval becomes the single source of truth (User.status),
-- replacing the old teacher-only VerificationStatus. Adds three-role hierarchy
-- statuses and approval metadata columns.

-- Rebuild the user_status enum with the new three-role approval values.
ALTER TYPE "user_status" RENAME TO "_user_status_old";

CREATE TYPE "user_status" AS ENUM (
  'PENDING_ADMIN_APPROVAL',
  'PENDING_TEACHER_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SUSPENDED'
);

ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "users"
  ALTER COLUMN "status" TYPE "user_status"
  USING (
    CASE "status"::text
      WHEN 'ACTIVE' THEN 'APPROVED'
      WHEN 'PENDING_APPROVAL' THEN 'PENDING_ADMIN_APPROVAL'
      WHEN 'APPROVED' THEN 'APPROVED'
      WHEN 'REJECTED' THEN 'REJECTED'
      WHEN 'SUSPENDED' THEN 'SUSPENDED'
      WHEN 'BANNED' THEN 'REJECTED'
      ELSE 'PENDING_ADMIN_APPROVAL'
    END
  )::"user_status";

ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'PENDING_ADMIN_APPROVAL';

DROP TYPE "_user_status_old";

-- Account-level approval metadata on the user.
ALTER TABLE "users"
  ADD COLUMN "approved_by" TEXT,
  ADD COLUMN "approved_at" TIMESTAMPTZ,
  ADD COLUMN "rejection_reason" TEXT;

-- Teacher profile: drop the old verification/approval columns (superseded by
-- the account-level approval state) and add contact fields for the dashboard.
ALTER TABLE "teacher_profiles"
  DROP COLUMN "verification_status",
  DROP COLUMN "approved_by",
  DROP COLUMN "approved_at",
  ADD COLUMN "department" TEXT,
  ADD COLUMN "employee_id" TEXT;

-- Student profile: add dashboard/contact fields.
ALTER TABLE "student_profiles"
  ADD COLUMN "department" TEXT,
  ADD COLUMN "usn" TEXT,
  ADD COLUMN "semester" TEXT,
  ADD COLUMN "phone" TEXT;

-- The VerificationStatus enum is no longer used by any column.
DROP TYPE IF EXISTS "verification_status";

-- Self-referential approval link on users.
ALTER TABLE "users"
  ADD CONSTRAINT "users_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;