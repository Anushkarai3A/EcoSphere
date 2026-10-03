-- CreateTable: StudentAnimation
CREATE TABLE "student_animations" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "topic" TEXT,
    "style" TEXT,
    "duration_seconds" INTEGER NOT NULL,
    "scenes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_animations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ix_student_animations_student" ON "student_animations"("student_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "student_animations" ADD CONSTRAINT "student_animations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
