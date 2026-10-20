import type { AcceptanceStatus, QuestCategory, QuestDifficulty, SubmissionStatus } from "./types";

/**
 * Category display colors — EcoSphere quest-marker palette:
 * conservation=green, cleanup/water=cyan/blue, learning=purple,
 * challenge=gold, wildlife=coral, recycling=orange, other=white.
 */
export const questCategories: ReadonlyArray<{ value: QuestCategory; label: string; color: string }> = [
  { value: "TREE_PLANTATION", label: "Tree plantation", color: "#10B981" },
  { value: "WASTE_COLLECTION", label: "Waste collection", color: "#38BDF8" },
  { value: "PARK_CLEANING", label: "Park cleaning", color: "#22D3EE" },
  { value: "RECYCLING", label: "Recycling", color: "#FB923C" },
  { value: "BIODIVERSITY", label: "Biodiversity", color: "#FB7185" },
  { value: "AWARENESS", label: "Awareness", color: "#A78BFA" },
  { value: "OTHER", label: "Other", color: "#F2FBF8" },
];

export const questDifficulties: ReadonlyArray<{ value: QuestDifficulty; label: string }> = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
  { value: "EXPERT", label: "Expert" },
];

export const proofTypes: ReadonlyArray<{ value: "PHOTO" | "VIDEO" | "PHOTO_AND_VIDEO"; label: string }> = [
  { value: "PHOTO", label: "Photo" },
  { value: "VIDEO", label: "Video" },
  { value: "PHOTO_AND_VIDEO", label: "Photo + video" },
];

export function categoryMeta(category: QuestCategory): { label: string; color: string } {
  return questCategories.find((c) => c.value === category) ?? { label: category, color: "#F2FBF8" };
}

export function difficultyLabel(difficulty: QuestDifficulty): string {
  return questDifficulties.find((d) => d.value === difficulty)?.label ?? difficulty;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const acceptanceStatusLabels: Record<AcceptanceStatus, string> = {
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  APPROVED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
};

const submissionStatusLabels: Record<SubmissionStatus, string> = {
  PENDING_VERIFICATION: "Checking…",
  PENDING_MANUAL_REVIEW: "Teacher review",
  AUTO_APPROVED: "Auto-approved",
  AUTO_REJECTED: "Auto-rejected",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function acceptanceStatusLabel(status: AcceptanceStatus): string {
  return acceptanceStatusLabels[status] ?? status;
}

export function submissionStatusLabel(status: SubmissionStatus): string {
  return submissionStatusLabels[status] ?? status;
}

export function statusTone(
  status: AcceptanceStatus | SubmissionStatus,
): "success" | "pending" | "danger" | "muted" {
  if (status === "APPROVED" || status === "AUTO_APPROVED") return "success";
  if (status === "REJECTED" || status === "AUTO_REJECTED") return "danger";
  if (status === "EXPIRED") return "muted";
  return "pending";
}
