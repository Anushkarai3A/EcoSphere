import { CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QuestMap } from "@/components/map/QuestMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DisplayTitle, MetaRow, Rule } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { participationApi, questApi } from "@/lib/api";
import { categoryMeta, formatDistance, questCategories } from "@/lib/quests";
import type { NearbyQuest, QuestCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

const radiusOptions = [
  { value: 1000, label: "1 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 25000, label: "25 km" },
];

const selectClass =
  "h-10 rounded-[2px] border border-frost/40 bg-void px-3 font-micro text-[10px] uppercase text-white";

export function MapPage() {
  const navigate = useNavigate();
  // Deep links: /app/map?category=TREE_PLANTATION (used by landing region cards).
  const [searchParams, setSearchParams] = useSearchParams();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(10000);
  const [category, setCategory] = useState<QuestCategory | "">(() => {
    const raw = searchParams.get("category");
    return questCategories.some((c) => c.value === raw) ? (raw as QuestCategory) : "";
  });
  const [quests, setQuests] = useState<NearbyQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [autoLocate, setAutoLocate] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);

  // Completed quests → muted marker + checkmark (real data from the API).
  useEffect(() => {
    participationApi
      .myAcceptances()
      .then(({ items }) => {
        setCompletedIds(
          items
            .filter((a) => a.status === "APPROVED" && a.completedAt != null)
            .map((a) => a.quest.id),
        );
      })
      .catch(() => setCompletedIds([]));
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const msg = "Geolocation is not supported by this browser";
      console.error(msg);
      setGeoError(msg);
      return;
    }
    // watchPosition keeps the avatar glued to the real-world position: every
    // new fix flows through autoLocate → QuestMap glides the player marker.
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log("Geolocation success:", pos.coords);
        setAutoLocate({ lat: latitude, lng: longitude });
      },
      (err) => {
        const msg = `Geolocation failed (code ${err.code}): ${err.message}`;
        console.error(msg);
        setGeoError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    questApi
      .nearby({ lat: center.lat, lng: center.lng, radius, category: category || undefined })
      .then(({ quests: results }) => {
        if (!cancelled) setQuests(results);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load quests");
          setQuests([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [center.lat, center.lng, radius, category]);

  const visible = quests.filter((q) => (category ? q.category === category : true));

  const applyCategory = (value: QuestCategory | "") => {
    setCategory(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("category", value);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  const handleAccept = async (quest: NearbyQuest) => {
    setAcceptingId(quest.id);
    setAcceptError(null);
    try {
      await participationApi.accept(quest.id);
      setAccepted((prev) => [...prev, quest.id]);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Could not accept this quest");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {/* Map fills the viewport; quest filters/list live in a collapsible drawer. */}
      <div className="relative min-h-0 flex-1">
        <QuestMap
          quests={visible}
          center={center}
          autoLocate={autoLocate}
          onCenterChange={setCenter}
          acceptQuest={handleAccept}
          acceptingId={acceptingId}
          accepted={accepted}
          completedIds={completedIds}
          onGoToMyQuests={() => navigate("/app/student")}
        />

        {/* Gallery hero floating over the live map (the map is the artwork). */}
        <div className="glass-panel pointer-events-none absolute left-4 top-20 z-[5] max-w-[min(20rem,70vw)] animate-gallery-rise rounded-[10px] px-4 py-4">
          <MetaRow>
            <span>Live quest map</span>
            <span>{radius / 1000} km radius</span>
          </MetaRow>
          <DisplayTitle lines={["QUEST", "MAP"]} className="mt-3" />
        </div>
      </div>

      <div className="z-20 shrink-0 border-t border-frost/15 bg-void/95 backdrop-blur supports-[backdrop-filter]:bg-void/70">
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase text-white"
            onClick={() => setListOpen((v) => !v)}
          >
            {listOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
            {loading ? "Loading quests…" : `${visible.length} quest${visible.length === 1 ? "" : "s"} near you`}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <select
              className={selectClass}
              value={category}
              onChange={(e) => applyCategory(e.target.value as QuestCategory | "")}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {questCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <select
              className={selectClass}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label="Search radius"
            >
              {radiusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Rule />

        {geoError && (
          <p role="alert" className="px-4 pb-2 pt-2 font-micro text-[11px] uppercase text-destructive">
            {geoError}
          </p>
        )}
        {error && (
          <p role="alert" className="px-4 pb-2 pt-2 font-micro text-[11px] uppercase text-destructive">
            {error}
          </p>
        )}
        {acceptError && (
          <p role="alert" className="px-4 pb-2 pt-2 font-micro text-[11px] uppercase text-destructive">
            {acceptError}
          </p>
        )}

        {listOpen && (
          <div className="max-h-56 overflow-y-auto px-4 pb-3 pt-3">
            {!loading && !error && visible.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-[2px] border border-frost/25 px-4 py-8 text-center">
                <Logo className="h-12 w-12 opacity-80" />
                <p className="font-micro text-[11px] leading-[1.6] uppercase text-ash">
                  No active quests within {radius / 1000} km of this area. Try widening the radius or removing the
                  category filter.
                </p>
              </div>
            )}
            <div className="grid gap-3 pb-1 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((quest) => {
                const meta = categoryMeta(quest.category);
                const isAccepted = accepted.includes(quest.id);
                return (
                  <Card key={quest.id} className={cn("transition-colors", isAccepted && "border-frost/40")}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase text-ash">
                          <span className="h-2 w-2 rounded-[2px] bg-white/70" aria-hidden />
                          {meta.label}
                        </span>
                        <span className="font-micro text-[10px] uppercase text-white">{quest.xpReward} XP</span>
                      </div>
                      <CardTitle className="text-[22px] leading-none text-white">{quest.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{quest.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between font-micro text-[10px] uppercase text-ash">
                        <span>{formatDistance(quest.distanceMeters)} away</span>
                        <span>until {new Date(quest.endsAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      {isAccepted ? (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase text-white">
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                            Accepted
                          </span>
                          <Button size="sm" variant="outline" onClick={() => navigate("/app/student")}>
                            My quests
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => void handleAccept(quest)}
                          disabled={acceptingId === quest.id}
                        >
                          {acceptingId === quest.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            "Accept quest"
                          )}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}