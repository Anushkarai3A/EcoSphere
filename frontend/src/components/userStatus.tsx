import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock, XCircle, Ban, Hourglass } from "lucide-react";
import type { UserStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const icon: Record<UserStatus, LucideIcon> = {
  PENDING_ADMIN_APPROVAL: Hourglass,
  PENDING_TEACHER_APPROVAL: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  SUSPENDED: Ban,
};

export const statusMeta: Record<UserStatus, { label: string; tone: string }> = {
  PENDING_ADMIN_APPROVAL: { label: "Pending admin approval", tone: "border-frost/30 bg-white/[0.06] text-white" },
  PENDING_TEACHER_APPROVAL: { label: "Pending teacher approval", tone: "border-frost/30 bg-white/[0.06] text-white" },
  APPROVED: { label: "Approved", tone: "border-frost/30 bg-white/[0.06] text-white" },
  REJECTED: { label: "Rejected", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  SUSPENDED: { label: "Suspended", tone: "border-frost/30 bg-white/[0.06] text-ash" },
};

export function StatusChip({ status }: { status: UserStatus }) {
  const meta = statusMeta[status];
  const Icon = icon[status];
  return (
    <span className={cn("inline-flex items-center rounded-[2px] border px-2 py-0.5 text-xs font-normal", meta.tone)}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}