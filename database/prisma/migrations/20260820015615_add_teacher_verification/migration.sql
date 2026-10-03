-- CreateEnum
CREATE TYPE "teacher_verification_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable: TeacherProfile additions
ALTER TABLE "teacher_profiles" ADD COLUMN "teacher_id" TEXT,
ADD COLUMN "designation" TEXT,
ADD COLUMN "verification_status" "teacher_verification_status" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verified_at" TIMESTAMP(3),
ADD COLUMN "verified_by" TEXT;

-- CreateIndex for unique teacher_id
CREATE UNIQUE INDEX "teacher_profiles_teacher_id_key" ON "teacher_profiles"("teacher_id");

-- AddForeignKey for verified_by
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: InstitutionInvitation
CREATE TABLE "institution_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'TEACHER',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_invitations_token_key" ON "institution_invitations"("token");
CREATE INDEX "ix_invitations_token" ON "institution_invitations"("token");
CREATE INDEX "ix_invitations_school" ON "institution_invitations"("school_id");

-- AddForeignKey
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "institution_invitations" ADD CONSTRAINT "institution_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
