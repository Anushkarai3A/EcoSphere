import { CheckCircle2, Clock3, Loader2, MapPin, Navigation, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryMeta, difficultyLabel, formatDistance } from "@/lib/quests";
import type { NearbyQuest, QuestCategory, QuestDifficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NearbyQuestCardProps {
  quest: NearbyQuest;
  selected: boolean;
  /** Whether the signed-in student already accepted this quest. */
  accepted?: boolean;
  /** Whether this quest was authored by the signed-in teacher. */
  own?: boolean;
  /** Student cards offer Accept, teacher cards offer View details. */
  action: "accept" | "details";
  accepting?: boolean;
  onSelect: (quest: NearbyQuest) => void;
  onAccept?: (quest: NearbyQuest) => void;
  onViewDetails?: (quest: NearbyQuest) => void;
}

/* Presentation-only category badge (emoji + token accent), layered on categoryMeta. */
const categoryBadge: Record<QuestCategory, { emoji: string; chip: string; tile: string }> = {
  TREE_PLANTATION: { emoji: "🌱", chip: "border-emerald/30 bg-emerald/10 text-emerald", tile: "border-emerald/35 bg-emerald/10" },
  WASTE_COLLECTION: { emoji: "💧", chip: "border-blue/30 bg-blue/10 text-blue", tile: "border-blue/35 bg-blue/10" },
  PARK_CLEANING: { emoji: "💧", chip: "border-cyan/30 bg-cyan/10 text-cyan", tile: "border-cyan/35 bg-cyan/10" },
  RECYCLING: { emoji: "♻️", chip: "border-orange/30 bg-orange/10 text-orange", tile: "border-orange/35 bg-orange/10" },
  BIODIVERSITY: { emoji: "🐾", chip: "border-coral/30 bg-coral/10 text-coral", tile: "border-coral/35 bg-coral/10" },
  AWARENESS: { emoji: "📚", chip: "border-purple/30 bg-purple/10 text-purple", tile: "border-purple/35 bg-purple/10" },
  OTHER: { emoji: "⭐", chip: "border-frost/25 bg-white/5 text-bone", tile: "border-frost/25 bg-white/[0.05]" },
};

const difficultyChip: Record<QuestDifficulty, string> = {
  EASY: "border-emerald/30 bg-emerald/10 text-emerald",
  MEDIUM: "border-cyan/30 bg-cyan/10 text-cyan",
  HARD: "border-gold/30 bg-gold/10 text-gold",
  EXPERT: "border-coral/35 bg-coral/10 text-coral",
};

const difficultyDot: Record<QuestDifficulty, string> = {
  EASY: "bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.85)]",
  MEDIUM: "bg-cyan shadow-[0_0_8px_rgba(34,211,238,0.85)]",
  HARD: "bg-gold shadow-[0_0_8px_rgba(251,191,36,0.85)]",
  EXPERT: "bg-coral shadow-[0_0_8px_rgba(251,113,133,0.9)]",
};

/** One row of the Nearby Quests panel below the dashboard map. */
export function NearbyQuestCard({
  quest,
  selected,
  accepted = false,
  own = false,
  action,
  accepting = false,
  onSelect,
  onAccept,
  onViewDetails,
}: NearbyQuestCardProps) {
  const meta = categoryMeta(quest.category);
  const badge = categoryBadge[quest.category] ?? categoryBadge.OTHER;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => onSelect(quest)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(quest);
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[10px] p-0 transition-all duration-200 hover:-translate-y-0.5",
        selected && "border-emerald/60 ring-1 ring-cyan/40 shadow-[0_0_36px_-16px_rgba(95,224,232,0.75)]",
        accepted && "border-emerald/40",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 z-10 w-[3px] transition-opacity duration-200 group-hover:opacity-100"
        style={{ backgroundColor: meta.color, opacity: selected ? 1 : 0.75 }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(120% 100% at 4% 0%, ${meta.color}22, transparent 62%)` }}
      />
      <CardContent className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center">
        <div
          className={cn(
            "grid h-14 w-14 shrink-0 place-items-center rounded-[20px] border text-xl",
            badge.tile,
          )}
          aria-hidden
        >
          <span className="transition-transform duration-200 group-hover:-translate-y-0.5">{badge.emoji}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-micro text-[10px] uppercase",
                badge.chip,
              )}
            >
              <span aria-hidden>{badge.emoji}</span>
              {meta.label}
            </span>
            {own && (
              <span className="inline-flex items-center gap-1 rounded-[2px] border border-gold/35 bg-gold/10 px-2 py-0.5 font-micro text-[10px] uppercase text-gold">
                <Star className="h-3 w-3" aria-hidden />
                Yours
              </span>
            )}
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-[2px] border border-emerald/35 bg-emerald/10 px-2 py-0.5 font-micro text-[10px] uppercase text-emerald">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Accepted
              </span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 font-micro text-[10px] uppercase",
                difficultyChip[quest.difficulty],
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", difficultyDot[quest.difficulty])} aria-hidden />
              {difficultyLabel(quest.difficulty)}
            </span>
          </div>
          <h3 className="mt-1.5 truncate font-display text-[17px] font-medium leading-tight text-bone transition-colors group-hover:text-white">
            {quest.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-micro text-[10px] uppercase text-ash">
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3" aria-hidden />
              {formatDistance(quest.distanceMeters)} away
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3 w-3" aria-hidden />
              until {new Date(quest.endsAt).toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden />
              {quest.addressText ?? "On the map"}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-baseline gap-1">
            <span className="font-title text-[17px] font-semibold leading-none text-gold text-glow-gold sm:text-[19px]">
              +{quest.xpReward} XP
            </span>
            <Trophy className="h-3.5 w-3.5 self-center text-gold/70" aria-hidden />
          </span>
          {action === "details" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(quest);
              }}
            >
              View details
            </Button>
          ) : accepted ? (
            <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase text-emerald">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Accepted
            </span>
          ) : (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onAccept?.(quest);
              }}
              disabled={accepting}
            >
              {accepting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
              Accept quest
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
