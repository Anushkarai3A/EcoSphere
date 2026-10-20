import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { questApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { QuestCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WORLD_CENTER, WORLD_REGIONS, regionAccent, type WorldRegion } from "@/lib/world";
import { DisplayTitle, MetaRow } from "@/components/gallery";
import { RegionCard, type RegionStats } from "./RegionCard";
import { Button } from "@/components/ui/button";

type CategoryTotals = Record<string, { count: number; xp: number }>;

/**
 * "Explore EcoSphere" — the world map visual with interactive region hotspots
 * and mission-style region cards. Quest counts/XP come from the live nearby
 * quests endpoint when the visitor is signed in; nothing is hardcoded.
 */
export function ExploreSection() {
  const { status } = useAuth();
  const [totals, setTotals] = useState<CategoryTotals | null>(null);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setTotals(null);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setFailed(false);
    void questApi
      .nearby({ lat: WORLD_CENTER.lat, lng: WORLD_CENTER.lng, radius: 50_000, limit: 500 })
      .then(({ quests }) => {
        if (cancelled) return;
        const map: CategoryTotals = {};
        for (const q of quests) {
          const entry = (map[q.category] ??= { count: 0, xp: 0 });
          entry.count += 1;
          entry.xp += Number(q.xpReward) || 0;
        }
        setTotals(map);
      })
      .catch(() => {
        if (!cancelled) {
          setTotals(null);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const statsByRegion = useMemo(() => {
    const result: Record<string, RegionStats | null> = {};
    const signedOut = status !== "authenticated";
    for (const region of WORLD_REGIONS) {
      if (region.categories.length === 0) {
        result[region.id] = null;
        continue;
      }
      if (!totals) {
        result[region.id] = signedOut || failed ? { count: 0, xp: 0, live: false, error: failed && !signedOut } : null;
        continue;
      }
      const agg = region.categories.reduce(
        (sum, cat: QuestCategory) => {
          const t = totals[cat];
          return { count: sum.count + (t?.count ?? 0), xp: sum.xp + (t?.xp ?? 0) };
        },
        { count: 0, xp: 0 },
      );
      result[region.id] = { ...agg, live: true };
    }
    return result;
  }, [totals, status, failed]);

  return (
    <section id="explore" className="relative mx-auto w-full max-w-7xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-24">
      <div className="flex flex-col gap-4">
        <MetaRow>
          <span>World map</span>
          <span>{WORLD_REGIONS.length} regions</span>
          <span>{status === "authenticated" ? "Live quest data" : "Sign in for live quest data"}</span>
        </MetaRow>
        <DisplayTitle lines={["Explore", "EcoSphere"]} />
        <p className="max-w-2xl text-[15px] leading-relaxed text-ash">
          Eight biomes hang above the clouds — forests, coastlines, an eco-city and ancient ruins. Pick a region,
          take a quest and leave the world a little better than you found it.
        </p>
      </div>

      {/* World map visual with hotspots */}
      <div className="relative mt-10 overflow-hidden rounded-[20px] border border-frost/15 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.95)]">
        <img
          src="/assets/world-map.jpg"
          srcSet="/assets/world-map-sm.jpg 900w, /assets/world-map.jpg 1672w"
          sizes="(max-width: 1024px) 100vw, 1152px"
          alt="Illustrated world map of EcoSphere: a floating island with a crystal city, forests, waterfalls and turquoise seas"
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,18,26,0.35)_0%,rgba(3,18,26,0.05)_45%,rgba(3,18,26,0.75)_100%)]"
        />

        {/* Hotspots */}
        {WORLD_REGIONS.map((region) => (
          <WorldPin
            key={region.id}
            region={region}
            active={hovered === region.id}
            onHover={setHovered}
          />
        ))}
      </div>

      {/* Region cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WORLD_REGIONS.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            stats={statsByRegion[region.id] ?? null}
            active={hovered === region.id}
            onHover={setHovered}
          />
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link to="/app/map">
          <Button size="lg">
            Open the quest map
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </Link>
        <Link to="/register" className="font-micro text-[11px] uppercase tracking-[0.12em] text-ash transition-colors hover:text-bone">
          Create a free explorer account →
        </Link>
      </div>
    </section>
  );
}

/** Glowing hotspot over the artwork; highlights its card on hover/focus. */
function WorldPin({
  region,
  active,
  onHover,
}: {
  region: WorldRegion;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  const accent = regionAccent[region.accent];
  return (
    <button
      type="button"
      className={cn(
        "group absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-void",
        active ? "z-20 scale-110" : "z-10 hover:scale-105",
      )}
      style={{ left: `${region.pin.x}%`, top: `${region.pin.y}%` }}
      onMouseEnter={() => onHover(region.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(region.id)}
      onBlur={() => onHover(null)}
      aria-label={`${region.name} — view region details`}
    >
      <span
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border bg-abyss/80 backdrop-blur-sm transition-all",
          accent.bg,
          active ? cn(accent.ring, accent.shadow) : "border-frost/40",
        )}
      >
        <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", accent.text.replace("text-", "bg-"))} />
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 animate-ping rounded-full border opacity-60",
            active ? accent.ring : "border-frost/30",
          )}
          style={{ animationDuration: "2.8s" }}
        />
      </span>
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-[2px] border border-frost/25 bg-abyss/95 px-2 py-1 font-micro text-[10px] uppercase tracking-[0.08em] text-bone opacity-0 transition-opacity duration-200",
          active && "opacity-100",
        )}
      >
        {region.name}
      </span>
    </button>
  );
}
