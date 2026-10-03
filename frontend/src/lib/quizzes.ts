import type { QuizQuestionType, QuizStatus } from "./types";

export const questionTypes: ReadonlyArray<{ value: QuizQuestionType; label: string }> = [
  { value: "MCQ", label: "Multiple choice" },
  { value: "TRUE_FALSE", label: "True / false" },
  { value: "MATCH", label: "Match" },
  { value: "SCENARIO", label: "Scenario" },
  { value: "CASE_STUDY", label: "Case study" },
];

export const quizStatusLabels: Record<QuizStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const quizStatusTone: Record<QuizStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-sky-100 text-sky-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
};

export function questionTypeLabel(type: string | null): string {
  if (!type) return "Question";
  return questionTypes.find((t) => t.value === type)?.label ?? type;
}

/** Subject auto-detected from study material (free text), rendered for cards. */
export function quizTopicLabel(topic: string | null | undefined): string {
  if (!topic || topic.trim() === "" || topic === "OTHER") return "General";
  return topic;
}

export function formatMaterialBytes(bytes: string | number | null | undefined): string {
  const size = Number(bytes ?? 0);
  if (size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
