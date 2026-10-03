import { CheckCircle2, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuestMap } from "@/components/map/QuestMap";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MapPage() {
  const navigate = useNavigate();
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [radius, setRadius] = useState(10000);
  const [category, setCategory] = useState<QuestCategory | "">("");
  const [quests, setQuests] = useState<NearbyQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [autoLocate, setAutoLocate] = useState<{ lat: number; lng: number } | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);

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
    <div className="flex h-[calc(100dvh-4rem)] flex-col overflow-hidden">
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
          onGoToMyQuests={() => navigate("/app/student")}
        />
      </div>

      <div className="z-20 shrink-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-semibold"
            onClick={() => setListOpen((v) => !v)}
          >
            {listOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronUp className="h-4 w-4" aria-hidden />}
            {loading ? "Loading quests…" : `${visible.length} quest${visible.length === 1 ? "" : "s"} near you`}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <select
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value as QuestCategory | "")}
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

        {geoError && (
          <p role="alert" className="px-4 pb-2 text-sm text-destructive">
            {geoError}
          </p>
        )}
        {error && (
          <p role="alert" className="px-4 pb-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {acceptError && (
          <p role="alert" className="px-4 pb-2 text-sm text-destructive">
            {acceptError}
          </p>
        )}

        {listOpen && (
          <div className="max-h-56 overflow-y-auto px-4 pb-3">
            {!loading && !error && visible.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
                <Logo className="h-12 w-12 opacity-80" />
                <p>
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
                  <Card key={quest.id} className={cn("transition-colors", isAccepted && "border-emerald-500/40")}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                          {meta.label}
                        </span>
                        <span className="text-xs font-semibold text-primary">{quest.xpReward} XP</span>
                      </div>
                      <CardTitle className="text-base">{quest.title}</CardTitle>
                      <CardDescription className="line-clamp-2">{quest.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <div className="flex items-center justify-between">
                        <span>{formatDistance(quest.distanceMeters)} away</span>
                        <span>until {new Date(quest.endsAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      {isAccepted ? (
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
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