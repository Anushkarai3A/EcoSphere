import { Loader2, LocateFixed, Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SectionHead } from "@/components/gallery";
import { NearbyQuestCard } from "@/components/dashboard/NearbyQuestCard";
import { QuestDetailsModal } from "@/components/dashboard/QuestDetailsModal";
import { QuestMap, type QuestMapHandle } from "@/components/map/QuestMap";
import {
  acceptedQuestIds,
  activeAcceptances,
  toNearbyQuest,
  useAcceptQuest,
  useNearbyQuests,
  useStudentAcceptances,
  useTeacherQuests,
  type LatLng,
} from "@/hooks/useQuests";
import { useGeolocation } from "@/lib/useGeolocation";
import type { NearbyQuest } from "@/lib/types";

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

const radiusOptions = [
  { value: 1000, label: "1 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 25000, label: "25 km" },
];

const selectClass =
  "h-9 rounded-[2px] border border-frost/30 bg-void px-2.5 font-micro text-[10px] uppercase text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan";

export interface DashboardQuestSectionProps {
  /** "student" offers Accept quest actions; "teacher" offers View details + Create. */
  mode: "student" | "teacher";
  onGoToMyQuests: () => void;
  onCreateQuest?: () => void;
}

/**
 * First-class Quest Map experience for the dashboards: live map + geolocation,
 * an auto-fetching Nearby Quests panel, role-aware markers, and fly-to/select
 * interaction between the list and the map.
 */
export function DashboardQuestSection({ mode, onGoToMyQuests, onCreateQuest }: DashboardQuestSectionProps) {
  const mapHandleRef = useRef<QuestMapHandle | null>(null);
  const usedGeolocRef = useRef(false);

  const geo = useGeolocation();
  const [center, setCenter] = useState<LatLng>(DEFAULT_CENTER);
  const [radius, setRadius] = useState(10000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<NearbyQuest | null>(null);

  const nearby = useNearbyQuests(center, radius);
  const teacherQuests = useTeacherQuests(mode === "teacher");
  const acceptances = useStudentAcceptances(mode === "student");
  const acceptMutation = useAcceptQuest();

  // Granting location: center the map + avatar on the first real fix.
  useEffect(() => {
    if (!usedGeolocRef.current && geo.permission === "granted" && geo.position) {
      usedGeolocRef.current = true;
      setCenter({ lat: geo.position.lat, lng: geo.position.lng });
    }
  }, [geo.permission, geo.position]);

  const acceptedIds = useMemo(() => acceptedQuestIds(acceptances.data ?? []), [acceptances.data]);
  const activeProgress = useMemo(() => activeAcceptances(acceptances.data ?? []), [acceptances.data]);

  // Teacher layer: their own quests (drafts + live) merge into the map so newly
  // created quests appear instantly, highlighted as "yours".
  const ownQuests = useMemo(() => {
    if (mode !== "teacher") return { quests: [] as NearbyQuest[], ids: [] as string[] };
    const converted = (teacherQuests.data ?? [])
      .map((q) => toNearbyQuest(q, center))
      .filter((q): q is NearbyQuest => q !== null);
    return { quests: converted, ids: teacherQuests.data?.map((q) => q.id) ?? [] };
  }, [mode, teacherQuests.data, center]);

  const mapQuests = useMemo(() => {
    const ids = new Set(ownQuests.quests.map((q) => q.id));
    return [...ownQuests.quests, ...nearby.quests.filter((q) => !ids.has(q.id))];
  }, [ownQuests.quests, nearby.quests]);

  const handleCenterChange = useCallback((c: LatLng) => setCenter(c), []);

  const handleSelectFromCard = useCallback((quest: NearbyQuest) => {
    setSelectedId(quest.id);
    mapHandleRef.current?.flyToQuest(quest.id);
  }, []);

  const handleAccept = useCallback(async (quest: NearbyQuest) => {
    acceptMutation.mutate(quest.id);
  }, [acceptMutation]);

  const permissionBlocked = geo.permission === "denied" || geo.permission === "unavailable";
  const maxRadiusOption = radiusOptions[radiusOptions.length - 1];

  return (
    <section className="flex flex-col gap-4" aria-label="Quest map">
      <div className="flex flex-col gap-3">
        <SectionHead
          kicker="Live quest map"
          title="Discover quests near you"
          right={
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 font-micro text-[10px] uppercase text-ash">
                Radius
                <select className={selectClass} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Search radius">
                  {radiusOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "teacher" && onCreateQuest ? (
                <Button onClick={onCreateQuest}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Create quest
                </Button>
              ) : null}
            </div>
          }
        />
        <p className="max-w-xl text-sm text-ash">
          {mode === "student"
            ? "Travel to real-world quests, capture evidence, and earn XP."
            : "See live quests around you — your own quests are marked with a gold star."}
        </p>
      </div>

      {permissionBlocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-frost/30 bg-white/[0.05] px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 text-bone">
            <LocateFixed className="h-4 w-4 shrink-0 text-cyan" aria-hidden />
            Enable location access to discover quests near you.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              usedGeolocRef.current = false;
              geo.request();
            }}
          >
            {geo.locating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <LocateFixed className="mr-1 h-4 w-4" aria-hidden />}
            Enable location
          </Button>
        </div>
      )}

      <div
        id="quest-map"
        className="relative h-[24rem] w-full overflow-hidden rounded-[20px] border border-frost/25 shadow-[0_28px_60px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/5 sm:h-[28rem]"
      >
        <QuestMap
          ref={mapHandleRef}
          quests={mapQuests}
          center={center}
          autoLocate={geo.position}
          onCenterChange={handleCenterChange}
          acceptQuest={handleAccept}
          acceptingId={acceptMutation.isPending ? (acceptMutation.variables ?? null) : null}
          accepted={acceptedIds}
          onGoToMyQuests={onGoToMyQuests}
          mode={mode}
          onViewDetails={setDetails}
          ownQuestIds={mode === "teacher" ? ownQuests.ids : undefined}
          selectedQuestId={selectedId}
          onQuestSelect={(q) => setSelectedId(q?.id ?? null)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <SectionHead
          kicker="Mission board"
          title="Nearby quests"
          right={
            <span className="font-micro text-[10px] uppercase text-ash">
              {nearby.isLoading
                ? "Loading…"
                : `${mapQuests.length} quest${mapQuests.length === 1 ? "" : "s"}`}
              {mode === "teacher" && ownQuests.ids.length > 0 ? ` · ${ownQuests.ids.length} yours` : ""}
            </span>
          }
        />

        {nearby.error && (
          <p role="alert" className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
            {nearby.error}
          </p>
        )}
        {acceptMutation.error && (
          <p role="alert" className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
            {acceptMutation.error instanceof Error ? acceptMutation.error.message : "Could not accept this quest."}
          </p>
        )}

        {nearby.isLoading && mapQuests.length === 0 ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-[10px] border border-frost/15 bg-white/[0.04] shadow-[0_16px_36px_-30px_rgba(0,0,0,0.9)]"
              />
            ))}
          </div>
        ) : mapQuests.length === 0 && !nearby.isLoading ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-frost/20 bg-white/[0.03] px-4 py-8 text-center">
            <Search className="h-6 w-6 text-ash opacity-70" aria-hidden />
            <p className="font-micro text-[11px] leading-[1.6] uppercase text-ash">
              No quests available in this area yet. Try expanding your search radius.
            </p>
            {maxRadiusOption && radius < maxRadiusOption.value && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = radiusOptions.find((o) => o.value > radius)?.value ?? radius * 2;
                  setRadius(next);
                }}
              >
                Expand search radius
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {mapQuests.map((quest) => (
              <NearbyQuestCard
                key={quest.id}
                quest={quest}
                selected={selectedId === quest.id}
                accepted={mode === "student" && acceptedIds.includes(quest.id)}
                own={mode === "teacher" && ownQuests.ids.includes(quest.id)}
                action={mode === "teacher" ? "details" : "accept"}
                accepting={acceptMutation.isPending && acceptMutation.variables === quest.id}
                onSelect={handleSelectFromCard}
                onAccept={handleAccept}
                onViewDetails={setDetails}
              />
            ))}
          </div>
        )}

        {mode === "student" && activeProgress.length > 0 && (
          <p className="font-micro text-[10px] uppercase leading-[1.6] text-ash">
            {activeProgress.length} active quest{activeProgress.length === 1 ? "" : "s"} accepted — open a marker on the
            map to jump back to your quest log.
          </p>
        )}
      </div>

      {details && <QuestDetailsModal quest={details} own={mode === "teacher" && ownQuests.ids.includes(details.id)} onClose={() => setDetails(null)} />}
    </section>
  );
}
