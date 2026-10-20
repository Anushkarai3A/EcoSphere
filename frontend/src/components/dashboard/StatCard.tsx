import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "primary" | "emerald" | "sky" | "amber";
}

const toneClass: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "border-emerald/40 bg-emerald/10 text-emerald",
  emerald: "border-emerald/40 bg-emerald/10 text-emerald",
  sky: "border-cyan/40 bg-cyan/10 text-cyan",
  amber: "border-gold/40 bg-gold/10 text-gold",
};

/** Glass statistic tile: big mono-serif figure, micro caption, tone-mapped icon. */
export function StatCard({ icon: Icon, label, value, sub, tone = "primary" }: StatCardProps) {
  return (
    <div className="glass-panel group relative flex items-center justify-between gap-4 overflow-hidden rounded-[10px] p-5 transition-colors duration-300 hover:border-white/20">
      <div className="min-w-0 flex-1">
        <p className="font-title text-[34px] font-semibold leading-none text-bone">{value}</p>
        <p className="mt-2.5 font-micro text-[10px] uppercase tracking-[0.1em] text-ash">{label}</p>
        {sub ? <p className="mt-1 truncate font-micro text-[10px] uppercase text-ash/70">{sub}</p> : null}
      </div>
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-transform duration-300 group-hover:scale-105",
          toneClass[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
    </div>
  );
}
