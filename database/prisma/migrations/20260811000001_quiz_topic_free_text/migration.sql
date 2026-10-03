-- Change quizzes.topic from the quest_category enum to a free-text subject so
-- AI-generated quizzes can store the auto-detected subject (e.g. "BDA", "DBMS").

ALTER TABLE "quizzes"
  ALTER COLUMN "topic" DROP DEFAULT,
  ALTER COLUMN "topic" TYPE TEXT USING "topic"::text,
  ALTER COLUMN "topic" SET DEFAULT 'OTHER',
  ALTER COLUMN "topic" SET NOT NULL;
