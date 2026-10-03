import { CalendarClock, MapPin, Navigation, Star, Trophy, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { categoryMeta, difficultyLabel, formatDistance, proofTypes } from "@/lib/quests";
import type { NearbyQuest } from "@/lib/types";

export interface QuestDetailsModalProps {
  quest: NearbyQuest;
  own?: boolean;
  onClose: () => void;
}

/** Full quest details sheet — opened from the teacher dashboard "View details". */
export function QuestDetailsModal({ quest, own = false, onClose }: QuestDetailsModalProps) {
  const meta = categoryMeta(quest.category);
  const proofLabel = proofTypes.find((p) => p.value === quest.requiredProofType)?.label ?? quest.requiredProofType;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={quest.title}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                {meta.label}
              </span>
              {own && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  <Star className="h-3 w-3" aria-hidden />
                  Yours
                </span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{quest.title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <p className="text-sm text-muted-foreground">{quest.description}</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DetailStat icon={<Trophy className="h-4 w-4" aria-hidden />} label="Reward" value={`${quest.xpReward} XP`} />
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

          <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              {quest.addressText ?? `${quest.lat.toFixed(5)}, ${quest.lng.toFixed(5)}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden />
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
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
        {icon}
        {value}
      </div>
    </div>
  );
}
