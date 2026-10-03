-- AlterTable: StudentAnimation status tracking fields
ALTER TABLE "student_animations" ADD COLUMN "provider" TEXT,
ADD COLUMN "error_message" TEXT;
