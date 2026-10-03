-- Phase 0/1: Assignments, study materials & standalone AI-generated quizzes.
-- Additive schema change per docs/v2 (01_architecture_and_schema.md §3.1–3.4).
-- NOTE: pre-existing raw-SQL spatial indexes (gix_quests_location,
-- gix_quest_submissions_location, gix_evidence_assets_exif_gps) are untouched.

-- CreateEnum
CREATE TYPE "assignment_type" AS ENUM ('INDIVIDUAL', 'PROJECT');

-- CreateEnum
CREATE TYPE "assignment_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('PDF', 'DOCX', 'PPT', 'IMAGE', 'VIDEO_LINK', 'TEXT', 'NOTE', 'LINK');

-- CreateEnum
CREATE TYPE "submission_content_type" AS ENUM ('DOCUMENT', 'IMAGE', 'TEXT', 'LINK', 'VIDEO');

-- CreateEnum
CREATE TYPE "grade_status" AS ENUM ('UNGRADED', 'GRADED', 'RETURNED');

-- CreateEnum
CREATE TYPE "quiz_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum (new XP source for graded assignments)
ALTER TYPE "xp_source" ADD VALUE 'ASSIGNMENT_GRADE';

-- Quiz questions may now belong to a standalone Quiz (quiz_id) in addition to a SideQuest.
ALTER TABLE "quiz_questions"
  ADD COLUMN "ai_generated" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "difficulty_score" DECIMAL(65,30),
  ADD COLUMN "q_type" TEXT,
  ADD COLUMN "quiz_id" TEXT,
  ADD COLUMN "review_state" TEXT,
  ADD COLUMN "source_run_id" TEXT,
  ALTER COLUMN "side_quest_id" DROP NOT NULL;

-- Quiz attempts may now target a standalone Quiz.
ALTER TABLE "quiz_attempts"
  ADD COLUMN "quiz_id" TEXT,
  ALTER COLUMN "side_quest_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_group_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "assignment_type" NOT NULL DEFAULT 'INDIVIDUAL',
    "topic" "quest_category" NOT NULL,
    "difficulty" "quest_difficulty" NOT NULL DEFAULT 'MEDIUM',
    "xp_reward" BIGINT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_materials" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "kind" "material_kind" NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT,
    "url" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "notes" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "content_kind" "submission_content_type" NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "external_url" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grade_status" "grade_status" NOT NULL DEFAULT 'UNGRADED',
    "score" INTEGER,
    "grade_notes" TEXT,
    "ai_feedback" TEXT,
    "graded_by" TEXT,
    "graded_at" TIMESTAMP(3),
    "resubmission_of" TEXT,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_assets" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "kind" "material_kind" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "material_id" TEXT,
    "class_group_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "topic" "quest_category" NOT NULL,
    "difficulty" "quest_difficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "quiz_status" NOT NULL DEFAULT 'DRAFT',
    "pass_threshold" INTEGER,
    "time_limit_min" INTEGER,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "source_run_id" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_assignments_teacher" ON "assignments"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "ix_assignments_class" ON "assignments"("class_group_id", "status");

-- CreateIndex
CREATE INDEX "ix_study_materials_teacher" ON "study_materials"("teacher_id");

-- CreateIndex
CREATE INDEX "ix_study_materials_assignment" ON "study_materials"("assignment_id");

-- CreateIndex
CREATE INDEX "ix_assignment_submissions_student" ON "assignment_submissions"("student_id", "grade_status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_assignment_submissions_one_per_student" ON "assignment_submissions"("assignment_id", "student_id");

-- CreateIndex
CREATE INDEX "ix_quizzes_teacher" ON "quizzes"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "ix_quizzes_class" ON "quizzes"("class_group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_quiz_attempts_quiz_student" ON "quiz_attempts"("quiz_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_quiz_questions_quiz_position" ON "quiz_questions"("quiz_id", "position");

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_materials" ADD CONSTRAINT "study_materials_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_graded_by_fkey" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_assets" ADD CONSTRAINT "assignment_assets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "assignment_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "study_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
