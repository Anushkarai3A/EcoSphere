-- DropIndex
DROP INDEX "gix_evidence_assets_exif_gps";

-- DropIndex
DROP INDEX "gix_quest_submissions_location";

-- DropIndex
DROP INDEX "gix_quests_location";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "school_id" TEXT,
ALTER COLUMN "approved_at" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ix_users_school" ON "users"("school_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
