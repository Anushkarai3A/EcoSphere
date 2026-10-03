import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "primary" | "emerald" | "sky" | "amber";
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/12 text-primary",
  emerald: "bg-emerald-500/12 text-emerald-600",
  sky: "bg-sky-500/12 text-sky-600",
  amber: "bg-amber-500/12 text-amber-600",
};

/** Compact dashboard statistic card. */
export function StatCard({ icon: Icon, label, value, sub, tone = "primary" }: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", toneClass[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight tracking-tight">{value}</div>
          <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
          {sub ? <div className="truncate text-[11px] text-muted-foreground/80">{sub}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
