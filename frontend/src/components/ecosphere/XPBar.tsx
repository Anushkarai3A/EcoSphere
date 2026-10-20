import { cn } from "@/lib/utils";

/**
 * Game-style experience bar: level chip + gradient fill + shimmer, with
 * proper progressbar semantics for assistive tech.
 */
export function XPBar({
  level,
  progress,
  target,
  totalXp,
  className,
}: {
  level: number;
  progress: number;
  target: number;
  totalXp?: number;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (progress / target) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 items-center rounded-[2px] border border-gold/45 bg-gold/15 px-2.5 font-micro text-[10px] uppercase tracking-[0.14em] text-gold">
            Lvl {level}
          </span>
          {typeof totalXp === "number" && (
            <span className="font-title text-[15px] font-semibold text-bone">
              {totalXp.toLocaleString()} <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-ash">XP</span>
            </span>
          )}
        </div>
        <span className="font-micro text-[10px] uppercase tracking-[0.1em] text-ash">
          {progress.toLocaleString()} / {target.toLocaleString()} to next level
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Experience progress to next level"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={progress}
        aria-valuetext={`${Math.round(pct)}% — ${progress} of ${target} XP`}
        className="relative h-3 w-full overflow-hidden rounded-full border border-frost/20 bg-abyss"
      >
        <div
          className="relative h-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#0c5a46_0%,#2ecf8f_55%,#f2b544_100%)] transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        >
          <span
            aria-hidden
            className="animate-xp-shimmer absolute inset-y-0 -inset-x-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]"
          />
        </div>
        <span
          aria-hidden
          className="absolute inset-y-1.5 right-1.5 font-micro text-[8px] font-semibold uppercase leading-none text-ash"
        >
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}
