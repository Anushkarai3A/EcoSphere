import { Link } from "react-router-dom";
import {
  Building2,
  Droplets,
  Flower2,
  Landmark,
  Mountain,
  Trees,
  Waves,
  Wheat,
  Map as MapIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { regionAccent, type WorldRegion } from "@/lib/world";

const icons: Record<WorldRegion["icon"], LucideIcon> = {
  trees: Trees,
  mountain: Mountain,
  waves: Waves,
  droplets: Droplets,
  city: Building2,
  flower: Flower2,
  wheat: Wheat,
  landmark: Landmark,
};

export interface RegionStats {
  count: number;
  xp: number;
  /** false when the visitor is signed out; error when live counts failed to load. */
  live: boolean;
  error?: boolean;
}

/** One explorable region of the world — game-style mission board tile. */
export function RegionCard({
  region,
  stats,
  active = false,
  onHover,
}: {
  region: WorldRegion;
  stats: RegionStats | null;
  active?: boolean;
  onHover?: (id: string | null) => void;
}) {
  const Icon = icons[region.icon];
  const accent = regionAccent[region.accent];
  const target = region.categories[0] ? `/app/map?category=${region.categories[0]}` : "/app/map";

  return (
    <article
      onMouseEnter={() => onHover?.(region.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "glass-panel group relative flex flex-col gap-4 rounded-[10px] p-5 transition-all duration-300",
        "hover:-translate-y-1 hover:border-emerald/45",
        active && "border-emerald/55 shadow-[0_0_34px_-10px_rgba(46,207,143,0.75)] -translate-y-1",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-110",
            accent.bg,
            accent.ring,
            accent.text,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="font-micro text-[10px] uppercase tracking-[0.2em] text-ash">
          {region.categories[0] ? region.categories[0].replaceAll("_", " ") : "New region"}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-display text-[18px] font-medium leading-tight text-bone">{region.name}</h3>
        <p className="text-[13px] leading-relaxed text-ash">{region.description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-frost/10 pt-4">
        {region.categories.length === 0 ? (
          <span className="font-micro text-[10px] uppercase leading-tight text-ash/80">Showcase region</span>
        ) : stats?.live ? (
          <div className="flex items-center gap-3 font-micro text-[11px] uppercase">
            <span className="text-emerald">
              {stats.count} quest{stats.count === 1 ? "" : "s"}
            </span>
            <span className="text-gold">+{stats.xp.toLocaleString()} XP</span>
          </div>
        ) : (
          <span className="font-micro text-[10px] uppercase leading-tight text-ash/80">
            {!stats ? "Loading quests…" : stats.error ? "Counts unavailable" : "Sign in for live counts"}
          </span>
        )}
        <Link
          to={target}
          className="flex items-center gap-1.5 font-micro text-[10px] uppercase tracking-[0.12em] text-bone transition-colors group-hover:text-emerald"
          aria-label={`Open the quest map for ${region.name}`}
        >
          <MapIcon className="h-3.5 w-3.5" aria-hidden />
          Open
        </Link>
      </div>
    </article>
  );
}
