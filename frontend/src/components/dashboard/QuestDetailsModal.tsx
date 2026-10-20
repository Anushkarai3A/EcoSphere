import { CalendarClock, MapPin, Navigation, Star, Trophy, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { MetaRow, Rule } from "@/components/gallery";
import { categoryMeta, difficultyLabel, formatDistance, proofTypes } from "@/lib/quests";
import type { NearbyQuest, QuestCategory, QuestDifficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface QuestDetailsModalProps {
  quest: NearbyQuest;
  own?: boolean;
  onClose: () => void;
}

/* Presentation-only category badge (emoji + token accent), layered on categoryMeta. */
const categoryBadge: Record<QuestCategory, string> = {
  TREE_PLANTATION: "border-emerald/30 bg-emerald/10 text-emerald",
  WASTE_COLLECTION: "border-blue/30 bg-blue/10 text-blue",
  PARK_CLEANING: "border-cyan/30 bg-cyan/10 text-cyan",
  RECYCLING: "border-orange/30 bg-orange/10 text-orange",
  BIODIVERSITY: "border-coral/30 bg-coral/10 text-coral",
  AWARENESS: "border-purple/30 bg-purple/10 text-purple",
  OTHER: "border-frost/25 bg-white/5 text-bone",
};

const difficultyChip: Record<QuestDifficulty, string> = {
  EASY: "border-emerald/35 bg-emerald/10 text-emerald",
  MEDIUM: "border-cyan/35 bg-cyan/10 text-cyan",
  HARD: "border-gold/35 bg-gold/10 text-gold",
  EXPERT: "border-coral/35 bg-coral/10 text-coral",
};

const categoryEmoji: Record<QuestCategory, string> = {
  TREE_PLANTATION: "🌱",
  WASTE_COLLECTION: "💧",
  PARK_CLEANING: "💧",
  RECYCLING: "♻️",
  BIODIVERSITY: "🐾",
  AWARENESS: "📚",
  OTHER: "⭐",
};

/** Full quest details sheet — opened from the teacher dashboard "View details". */
export function QuestDetailsModal({ quest, own = false, onClose }: QuestDetailsModalProps) {
  const meta = categoryMeta(quest.category);
  const proofLabel = proofTypes.find((p) => p.value === quest.requiredProofType)?.label ?? quest.requiredProofType;
  const badge = categoryBadge[quest.category] ?? categoryBadge.OTHER;
  const emoji = categoryEmoji[quest.category] ?? categoryEmoji.OTHER;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={quest.title}
      onClick={onClose}
    >
      <div
        className="glass-strong relative max-h-[90vh] w-full max-w-lg animate-gallery-rise overflow-y-auto rounded-[10px] border border-frost/25 text-bone"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: meta.color }}
        />
        <div className="flex items-start justify-between gap-3 border-b border-frost/15 px-5 py-4 pt-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase",
                  badge,
                )}
              >
                <span aria-hidden>{emoji}</span>
                {meta.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase",
                  difficultyChip[quest.difficulty],
                )}
              >
                {difficultyLabel(quest.difficulty)}
              </span>
              {own && (
                <span className="inline-flex items-center gap-1 rounded-[2px] border border-gold/35 bg-gold/10 px-2 py-1 font-micro text-[10px] uppercase text-gold">
                  <Star className="h-3 w-3" aria-hidden />
                  Yours
                </span>
              )}
            </div>
            <h2 className="mt-2 font-display text-[24px] font-medium leading-[1.15] text-bone">{quest.title}</h2>
            <MetaRow className="mt-2">
              <span className="font-title text-[15px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                +{quest.xpReward} XP
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                {formatDistance(quest.distanceMeters)} away
              </span>
              <span>until {new Date(quest.endsAt).toLocaleDateString()}</span>
            </MetaRow>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-ash">{quest.description}</p>

          <div className="flex items-center justify-between gap-3 rounded-[10px] border border-gold/30 bg-gold/10 px-4 py-3">
            <span className="inline-flex items-center gap-2 font-micro text-[10px] uppercase text-gold">
              <Trophy className="h-4 w-4" aria-hidden />
              Quest reward
            </span>
            <span className="font-title text-[24px] font-semibold leading-none text-gold text-glow-gold">
              +{quest.xpReward} XP
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DetailStat label="Difficulty" value={difficultyLabel(quest.difficulty)} />
            <DetailStat label="Proof" value={proofLabel} />
            <DetailStat label="Photos" value={String(quest.minPhotoCount)} />
            <DetailStat
              icon={<Navigation className="h-4 w-4" aria-hidden />}
              label="Distance"
              value={formatDistance(quest.distanceMeters)}
            />
            <DetailStat label="Radius" value={formatDistance(quest.radiusMeters)} />
          </div>

          <Rule />

          <div className="flex flex-col gap-2 font-micro text-[11px] uppercase text-ash">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-cyan" aria-hidden />
              {quest.addressText ?? `${quest.lat.toFixed(5)}, ${quest.lng.toFixed(5)}`}
            </span>
            <span className="inline-flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-cyan" aria-hidden />
              {new Date(quest.startsAt).toLocaleDateString()} → {new Date(quest.endsAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailStat({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] border border-frost/15 bg-white/[0.03] px-3 py-2.5">
      <div className="font-micro text-[10px] uppercase text-ash">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 font-display text-[14px] font-medium text-bone">
        {icon}
        {value}
      </div>
    </div>
  );
}
