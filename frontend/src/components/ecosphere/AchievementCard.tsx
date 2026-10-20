import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import type { StudentBadge } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Badge / achievement tile: gold treatment when earned, dimmed glass when
 * locked. Falls back to an emoji when the badge has no icon image.
 */
export function AchievementCard({ badge, className }: { badge: StudentBadge; className?: string }) {
  const [iconFailed, setIconFailed] = useState(false);
  const earned = Boolean(badge.isEarned);
  const showIcon = Boolean(badge.iconUrl) && !iconFailed;

  return (
    <article
      className={cn(
        "glass-panel group relative flex flex-col gap-3 rounded-[10px] p-5 transition-all duration-300",
        earned
          ? "border-gold/35 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_0_34px_-12px_rgba(242,181,68,0.8)]"
          : "opacity-70 saturate-50 hover:opacity-90",
        className,
      )}
      aria-label={`${badge.name} — ${earned ? "earned" : "locked"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border text-[22px] transition-transform duration-300 group-hover:scale-110",
            earned ? "border-gold/45 bg-gold/15" : "border-frost/25 bg-white/5",
          )}
        >
          {showIcon ? (
            <img
              src={badge.iconUrl}
              alt=""
              aria-hidden
              onError={() => setIconFailed(true)}
              className="h-7 w-7 object-contain"
            />
          ) : earned ? (
            <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          ) : (
            <Lock className="h-5 w-5 text-ash" aria-hidden />
          )}
        </span>
        <span
          className={cn(
            "font-micro text-[10px] uppercase tracking-[0.16em]",
            earned ? "text-gold" : "text-ash",
          )}
        >
          {earned ? "Earned" : "Locked"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-display text-[17px] font-medium leading-tight text-bone">{badge.name}</h3>
        <p className="line-clamp-2 text-[13px] leading-relaxed text-ash">{badge.description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-frost/10 pt-3 font-micro text-[10px] uppercase tracking-[0.1em]">
        <span className="text-ash">
          {earned && badge.earnedAt ? new Date(badge.earnedAt).toLocaleDateString() : "Keep exploring"}
        </span>
        {typeof badge.xpBonus === "number" && badge.xpBonus > 0 && (
          <span className={earned ? "text-gold" : "text-ash"}>+{badge.xpBonus} XP</span>
        )}
      </div>
    </article>
  );
}
