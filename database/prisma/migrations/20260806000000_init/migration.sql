-- PostGIS must exist before any geometry(Point,4326) column is created.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "school_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "quest_category" AS ENUM ('TREE_PLANTATION', 'WASTE_COLLECTION', 'PARK_CLEANING', 'RECYCLING', 'BIODIVERSITY', 'AWARENESS', 'OTHER');

-- CreateEnum
CREATE TYPE "quest_difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');

-- CreateEnum
CREATE TYPE "proof_type" AS ENUM ('PHOTO', 'VIDEO', 'PHOTO_AND_VIDEO');

-- CreateEnum
CREATE TYPE "quest_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "side_quest_type" AS ENUM ('QUIZ', 'ESSAY', 'POSTER', 'PRESENTATION', 'VIDEO', 'ANIMATION', 'RESEARCH');

-- CreateEnum
CREATE TYPE "acceptance_status" AS ENUM ('ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('PENDING_VERIFICATION', 'PENDING_MANUAL_REVIEW', 'AUTO_APPROVED', 'AUTO_REJECTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "recommendation" AS ENUM ('APPROVE', 'REJECT', 'NEEDS_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "fraud_risk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "verification_check_type" AS ENUM ('GPS_PROXIMITY', 'TIMESTAMP_FRESHNESS', 'EXIF_METADATA', 'EXIF_GPS_CONSISTENCY', 'IMAGE_SIMILARITY', 'OBJECT_DETECTION', 'SCENE_CLASSIFICATION', 'DUPLICATE_DETECTION', 'IMAGE_QUALITY', 'DEVICE_SPOOFING');

-- CreateEnum
CREATE TYPE "check_status" AS ENUM ('PASS', 'FAIL', 'WARN', 'SKIP');

-- CreateEnum
CREATE TYPE "xp_source" AS ENUM ('QUEST_COMPLETION', 'SIDE_QUEST_COMPLETION', 'QUIZ', 'BONUS', 'BADGE', 'STREAK', 'ADMIN_ADJUSTMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "badge_category" AS ENUM ('XP', 'QUEST_COUNT', 'CATEGORY', 'STREAK', 'CONSISTENCY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "badge_criteria" AS ENUM ('XP_THRESHOLD', 'QUEST_COUNT', 'CATEGORY_COUNT', 'STREAK_LENGTH', 'ACTIVITY_WEEKS', 'MANUAL');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('QUEST_NEW', 'QUEST_EXPIRING', 'SUBMISSION_VERIFIED', 'SUBMISSION_REVIEWED', 'BADGE_EARNED', 'LEVEL_UP', 'XP_EARNED', 'SYSTEM', 'MANUAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "consent_given" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" TEXT,
    "userAgent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "school_id" TEXT,
    "grade" TEXT,
    "streak_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_date" TIMESTAMP(3),
    "privacy_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "address" TEXT,
    "contact_email" TEXT,
    "status" "school_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_groups" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "join_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "class_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "class_group_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quests" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_group_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "quest_category" NOT NULL,
    "difficulty" "quest_difficulty" NOT NULL DEFAULT 'EASY',
    "xp_reward" BIGINT NOT NULL,
    "location" geometry(Point,4326),
    "address_text" TEXT,
    "radius_meters" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "max_participants" INTEGER,
    "required_proof_type" "proof_type" NOT NULL DEFAULT 'PHOTO',
    "min_photo_count" INTEGER NOT NULL DEFAULT 1,
    "policy_id" TEXT,
    "status" "quest_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "side_quests" (
    "id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "class_group_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "side_quest_type" NOT NULL,
    "content" JSONB NOT NULL,
    "xp_reward" BIGINT NOT NULL,
    "pass_threshold" INTEGER,
    "due_at" TIMESTAMP(3),
    "status" "quest_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "side_quests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "side_quest_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_verification_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled_checks" "verification_check_type"[],
    "thresholds" JSONB NOT NULL,
    "auto_approve_enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_min_confidence" DECIMAL(65,30) NOT NULL DEFAULT 0.95,
    "auto_reject_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reject_min_confidence" DECIMAL(65,30) NOT NULL DEFAULT 0.99,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_verification_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_acceptances" (
    "id" TEXT NOT NULL,
    "quest_id" TEXT,
    "side_quest_id" TEXT,
    "student_id" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "acceptance_status" NOT NULL DEFAULT 'ACCEPTED',
    "completed_at" TIMESTAMP(3),
    "xp_awarded" BIGINT NOT NULL DEFAULT 0,
    "bonus_xp" BIGINT NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quest_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quest_submissions" (
    "id" TEXT NOT NULL,
    "acceptance_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_timestamp" TIMESTAMP(3),
    "location" geometry(Point,4326),
    "location_accuracy_m" INTEGER,
    "notes" TEXT,
    "status" "submission_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "bonus_xp" BIGINT NOT NULL DEFAULT 0,
    "re_submission_of" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quest_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_assets" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "asset_type" "asset_type" NOT NULL,
    "cloudinary_public_id" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "exifGps" geometry(Point,4326),
    "exif_taken_at" TIMESTAMP(3),
    "exif_raw" JSONB,
    "perceptual_hash" BIGINT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_runs" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "status" "run_status" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "overall_recommendation" "recommendation",
    "overall_confidence" DECIMAL(65,30),
    "fraud_risk" "fraud_risk",
    "summary" TEXT,
    "ai_service_version" TEXT,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_checks" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "check_type" "verification_check_type" NOT NULL,
    "status" "check_status" NOT NULL,
    "score" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "message" TEXT,
    "details" JSONB,

    CONSTRAINT "verification_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "xp_source" NOT NULL,
    "source_id" TEXT,
    "amount" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badges" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "category" "badge_category" NOT NULL,
    "criteria_type" "badge_criteria" NOT NULL,
    "criteria_value" JSONB NOT NULL,
    "xp_bonus" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "badge_id" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" TEXT NOT NULL,
    "side_quest_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "meta" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ix_users_status_role" ON "users"("status", "role");

-- CreateIndex
CREATE INDEX "ix_users_archived" ON "users"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "ix_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "ix_refresh_tokens_family" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "ix_refresh_tokens_expires" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_user_id_key" ON "teacher_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_groups_join_code_key" ON "class_groups"("join_code");

-- CreateIndex
CREATE INDEX "ix_class_groups_teacher" ON "class_groups"("teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_enrollments_class_student" ON "enrollments"("class_group_id", "student_id");

-- CreateIndex
CREATE INDEX "ix_quests_status_dates" ON "quests"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "ix_quests_class" ON "quests"("class_group_id", "status");

-- CreateIndex
CREATE INDEX "ix_quests_teacher" ON "quests"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "ix_side_quests_teacher" ON "side_quests"("teacher_id", "status");

-- CreateIndex
CREATE INDEX "ix_side_quests_class" ON "side_quests"("class_group_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_quiz_questions_position" ON "quiz_questions"("side_quest_id", "position");

-- CreateIndex
CREATE INDEX "ix_acceptances_student" ON "quest_acceptances"("student_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ux_acceptances_quest_student" ON "quest_acceptances"("quest_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_acceptances_side_student" ON "quest_acceptances"("side_quest_id", "student_id");

-- CreateIndex
CREATE INDEX "ix_quest_submissions_status" ON "quest_submissions"("status", "reviewed_by");

-- CreateIndex
CREATE INDEX "ix_quest_submissions_acceptance" ON "quest_submissions"("acceptance_id");

-- CreateIndex
CREATE INDEX "ix_evidence_assets_hash" ON "evidence_assets"("perceptual_hash");

-- CreateIndex
CREATE INDEX "ix_evidence_assets_submission" ON "evidence_assets"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_runs_submission_id_key" ON "verification_runs"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "ux_verification_checks_run_type" ON "verification_checks"("run_id", "check_type");

-- CreateIndex
CREATE INDEX "ix_xp_transactions_user_created" ON "xp_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ix_xp_transactions_source" ON "xp_transactions"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "badges_key_key" ON "badges"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ux_user_badges_user_badge" ON "user_badges"("user_id", "badge_id");

-- CreateIndex
CREATE UNIQUE INDEX "xp_settings_key_key" ON "xp_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ux_quiz_attempts_user_quest" ON "quiz_attempts"("student_id", "side_quest_id");

-- CreateIndex
CREATE INDEX "ix_notifications_user_created" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ix_notifications_unread" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "ix_audit_logs_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "ix_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quests" ADD CONSTRAINT "quests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "ai_verification_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_quests" ADD CONSTRAINT "side_quests_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "side_quests" ADD CONSTRAINT "side_quests_class_group_id_fkey" FOREIGN KEY ("class_group_id") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_side_quest_id_fkey" FOREIGN KEY ("side_quest_id") REFERENCES "side_quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_acceptances" ADD CONSTRAINT "quest_acceptances_quest_id_fkey" FOREIGN KEY ("quest_id") REFERENCES "quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_acceptances" ADD CONSTRAINT "quest_acceptances_side_quest_id_fkey" FOREIGN KEY ("side_quest_id") REFERENCES "side_quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_acceptances" ADD CONSTRAINT "quest_acceptances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_acceptance_id_fkey" FOREIGN KEY ("acceptance_id") REFERENCES "quest_acceptances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quest_submissions" ADD CONSTRAINT "quest_submissions_re_submission_of_fkey" FOREIGN KEY ("re_submission_of") REFERENCES "quest_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_assets" ADD CONSTRAINT "evidence_assets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "quest_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "quest_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_checks" ADD CONSTRAINT "verification_checks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "verification_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_settings" ADD CONSTRAINT "xp_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_side_quest_id_fkey" FOREIGN KEY ("side_quest_id") REFERENCES "side_quests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Spatial indexes (GIST) for the geometry columns. Prisma cannot express these;
-- they make ST_DWithin / ST_Distance lookups in the map & verification paths fast.
CREATE INDEX "gix_quests_location" ON "quests" USING GIST ("location");
CREATE INDEX "gix_quest_submissions_location" ON "quest_submissions" USING GIST ("location");
CREATE INDEX "gix_evidence_assets_exif_gps" ON "evidence_assets" USING GIST ("exifGps");

-- Domain CHECK constraints (documented in schema.prisma; not expressible there).
ALTER TABLE "quests" ADD CONSTRAINT "ck_quests_dates" CHECK ("ends_at" > "starts_at");
ALTER TABLE "quests" ADD CONSTRAINT "ck_quests_radius" CHECK ("radius_meters" BETWEEN 10 AND 1000);
ALTER TABLE "quest_acceptances" ADD CONSTRAINT "ck_acceptances_source" CHECK (("quest_id" IS NULL) <> ("side_quest_id" IS NULL));

-- audit_logs is append-only: revoke UPDATE/DELETE from the application role in
-- deployment (not here, to keep migrations portable across environments).

