import { cn } from "@/lib/utils";

/** Hexagonal-feeling level emblem used on dashboards and profiles. */
export function LevelBadge({
  level,
  className,
  caption = "Level",
}: {
  level: number;
  className?: string;
  caption?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border border-gold/45",
        "bg-[radial-gradient(circle_at_50%_35%,rgba(242,181,68,0.22),rgba(6,24,34,0.95)_70%)]",
        "shadow-[0_0_36px_-10px_rgba(242,181,68,0.75)]",
        className,
      )}
    >
      <span aria-hidden className="absolute inset-1.5 rounded-full border border-gold/25" />
      <span className="font-micro text-[9px] uppercase tracking-[0.22em] text-gold">{caption}</span>
      <span className="font-title text-[34px] font-semibold leading-none text-bone text-glow-gold">
        {level}
      </span>
    </div>
  );
}
