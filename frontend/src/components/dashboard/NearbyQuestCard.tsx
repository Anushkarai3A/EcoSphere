import { CheckCircle2, Clock3, Loader2, MapPin, Navigation, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categoryMeta, difficultyLabel, formatDistance } from "@/lib/quests";
import type { NearbyQuest } from "@/lib/types";
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
        "group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md",
        selected && "border-primary/60 ring-2 ring-primary/25",
        accepted && "border-emerald-500/40",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-bold shadow-inner"
          style={{ backgroundColor: `${meta.color}26`, color: meta.color }}
          aria-hidden
        >
          {quest.xpReward}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
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
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                Accepted
              </span>
            )}
            <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {difficultyLabel(quest.difficulty)}
            </span>
          </div>
          <h3 className="mt-1 truncate text-[15px] font-semibold leading-tight text-foreground">{quest.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
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
          <span className="hidden items-center gap-1 text-xs font-semibold text-primary sm:inline-flex">
            <Trophy className="h-3.5 w-3.5" aria-hidden />
            {quest.xpReward} XP
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
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
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
