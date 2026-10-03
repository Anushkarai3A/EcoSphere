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
  PENDING_ADMIN_APPROVAL: { label: "Pending admin approval", tone: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
  PENDING_TEACHER_APPROVAL: { label: "Pending teacher approval", tone: "border-amber-500/30 bg-amber-500/10 text-amber-600" },
  APPROVED: { label: "Approved", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" },
  REJECTED: { label: "Rejected", tone: "border-destructive/30 bg-destructive/10 text-destructive" },
  SUSPENDED: { label: "Suspended", tone: "border-slate-500/30 bg-slate-500/10 text-slate-600" },
};

export function StatusChip({ status }: { status: UserStatus }) {
  const meta = statusMeta[status];
  const Icon = icon[status];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", meta.tone)}>
      <Icon className="mr-1 h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  );
}