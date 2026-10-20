import {
  CheckCircle2,
  Compass,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Search as SearchIcon,
  X,
} from "lucide-react";
import type { Map as MLMap, Marker as MLMarker, Popup as MLPopup } from "maplibre-gl";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, forwardRef, useImperativeHandle } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { categoryMeta, difficultyLabel, formatDistance } from "@/lib/quests";
import type { NearbyQuest, QuestCategory } from "@/lib/types";
import { Logo } from "@/components/Logo";

/* -------------------------------------------------- quest marker badges */
/*
 * Presentation-only metadata layered on top of `categoryMeta` (shared module
 * stays untouched): an emoji badge + the EcoSphere category accent.
 *
 * Category → marker color (spec):
 *   conservation = green, cleanup/water = blue/cyan, learning = purple,
 *   wildlife = coral, recycling = orange, community = turquoise,
 *   challenge (EXPERT difficulty) = gold, other = white.
 */
const MARKER_EMOJI: Record<QuestCategory, string> = {
  TREE_PLANTATION: "🌱",
  WASTE_COLLECTION: "💧",
  PARK_CLEANING: "💧",
  RECYCLING: "♻️",
  BIODIVERSITY: "🐾",
  AWARENESS: "📚",
  OTHER: "⭐",
};

interface MarkerAccent {
  color: string;
  glow: string;
}

const MARKER_ACCENT: Record<QuestCategory, MarkerAccent> = {
  TREE_PLANTATION: { color: "#10B981", glow: "rgba(16, 185, 129, 0.6)" },
  WASTE_COLLECTION: { color: "#38BDF8", glow: "rgba(56, 189, 248, 0.6)" },
  PARK_CLEANING: { color: "#22D3EE", glow: "rgba(34, 211, 238, 0.6)" },
  RECYCLING: { color: "#FB923C", glow: "rgba(251, 146, 60, 0.6)" },
  BIODIVERSITY: { color: "#FB7185", glow: "rgba(251, 113, 133, 0.6)" },
  AWARENESS: { color: "#A78BFA", glow: "rgba(167, 139, 250, 0.6)" },
  OTHER: { color: "#F2FBF8", glow: "rgba(242, 251, 248, 0.45)" },
};

function markerEmoji(category: QuestCategory): string {
  return MARKER_EMOJI[category] ?? MARKER_EMOJI.OTHER;
}

/** Gold = challenge/rewards: the rarest difficulty reads as a trophy tier. */
function markerAccent(quest: NearbyQuest): MarkerAccent {
  if (quest.difficulty === "EXPERT") {
    return { color: "#FBBF24", glow: "rgba(251, 191, 36, 0.65)" };
  }
  return MARKER_ACCENT[quest.category] ?? MARKER_ACCENT.OTHER;
}

/** True once the student has completed this quest (muted + checkmark marker). */
function isQuestDone(questId: string, props: QuestMapProps): boolean {
  return props.completedIds?.includes(questId) ?? false;
}

/* ------------------------------------------------------------------ free map */
/*
 * No API keys, no billing. Everything below is free:
 *  - Basemap: OpenStreetMap raster tiles (inline style, no network style file).
 *  - Search: OpenStreetMap Nominatim.
 *  - The "3D" camera comes from a tilted pitch (up to 60°), no terrain mesh.
 */
const FREE_OSM_STYLE: Record<string, unknown> = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#000000" } },
    { id: "osm", type: "raster", source: "osm" },
  ],
};

export { FREE_OSM_STYLE };

const DEFAULT_ZOOM = 16;
const DEFAULT_PITCH = 55;
const DEFAULT_BEARING = 0;
const PLAYER_RADIUS_METERS = 40;
/** Don't refetch quests / nudge the camera until the player moved past this. */
const PLAYER_MOVE_THRESHOLD_M = 40;

/** Runtime namespace, installed the moment the maplibre-gl chunk is imported. */
type MapLibreGL = typeof import("maplibre-gl");
let mlEnv: MapLibreGL | null = null;
let playerAnimFrame: number | null = null;
/** Live map + marker refs so the avatar's onload can re-size itself. */
let playerAvatarMap: MLMap | null = null;
let playerAvatarMarker: MLMarker | null = null;
/** Height/width ratio of the avatar's opaque content; measured once from the PNG. */
let playerAvatarAspect: number | null = null;
/** On-screen avatar sprite width in px (Pokémon GO trainer vibe): scales with zoom. */
const AVATAR_ZOOM_SCALE = 14;
const AVATAR_MIN_PX = 180;
const AVATAR_MAX_PX = 260;

interface LatLng {
  lat: number;
  lng: number;
}

export interface QuestMapProps {
  quests: NearbyQuest[];
  center: LatLng;
  /** Where the browser located the user; drives a flyTo + user marker. */
  autoLocate?: LatLng | null;
  onCenterChange: (center: LatLng) => void;
  acceptQuest: (quest: NearbyQuest) => Promise<void>;
  acceptingId: string | null;
  accepted: string[];
  /** Quest ids the student has already completed → muted marker + checkmark. */
  completedIds?: string[];
  onGoToMyQuests: () => void;
  /** Role-aware popup actions: "teacher" shows a View details action instead of accept. */
  mode?: "student" | "teacher";
  /** Called by the popup's "View details" action (teacher mode). */
  onViewDetails?: (quest: NearbyQuest) => void;
  /** Quest ids authored by the current teacher → distinct "own quest" marker. */
  ownQuestIds?: string[];
  /** Quest id highlighted from the quest list (kept in sync with card clicks). */
  selectedQuestId?: string | null;
  /** Notifies the parent when a marker is clicked (for card highlight sync). */
  onQuestSelect?: (quest: NearbyQuest | null) => void;
}

/** Imperative API for the dashboard: fly to + highlight a quest from a card. */
export interface QuestMapHandle {
  flyToQuest: (questId: string) => void;
}

/* ===================================================== component */

export const QuestMap = forwardRef<QuestMapHandle, QuestMapProps>(function QuestMap(props, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const userMarkerRef = useRef<MLMarker | null>(null);
  const lastPushedCenterRef = useRef<LatLng | null>(null);
  const searchMarkerRef = useRef<MLMarker | null>(null);
  const questMarkersRef = useRef<Map<string, MLMarker>>(new Map());
  const questsRef = useRef<NearbyQuest[]>(props.quests);
  const propsRef = useRef(props);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [bearing, setBearing] = useState(0);
  const [userAt, setUserAt] = useState<LatLng | null>(null);
  const [selected, setSelected] = useState<NearbyQuest | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Keep refs current on every render so event handlers see latest props.
  questsRef.current = props.quests;
  propsRef.current = props;

  const pushCenter = useCallback((c: LatLng) => props.onCenterChange(c), [props.onCenterChange]);

  // -------------------------------------------------------------- boot map
  useEffect(() => {
    let cancelled = false;
    const el = containerRef.current;
    if (!el) return;
    let map: MLMap | null = null;

    void (async () => {
      try {
        const mb = await import("maplibre-gl");
        void import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;
        mlEnv = mb;

        const instance = new mb.Map({
          container: el,
          style: FREE_OSM_STYLE as never,
          center: [props.center.lng, props.center.lat],
          zoom: DEFAULT_ZOOM,
          pitch: DEFAULT_PITCH,
          bearing: DEFAULT_BEARING,
          maxPitch: 60,
          attributionControl: false,
          fadeDuration: 200,
        });
        instance.addControl(new mb.AttributionControl({ compact: true }));

        // Request geolocation immediately and center the map on user's GPS.
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const { latitude: lat, longitude: lng } = pos.coords;
              instance.flyTo({ center: [lng, lat], zoom: 15, essential: true });
              setUserAt({ lat, lng });
              pushCenter({ lat, lng });
              setLocateError(null);
            },
            () => {
              if (!cancelled) setLocateError("Location permission is required to center the map on you.");
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
          );
        }

        instance.on("load", () => {
          if (cancelled) return;
          try {
            instance.resize();
          } catch {
            /* ignore */
          }

          instance.on("click", () => {
            activePopup?.remove();
            activePopup = null;
            setSelected(null);
            propsRef.current.onQuestSelect?.(null);
          });

          setReady(true);
          setZoom(instance.getZoom());
        });

        const ro = new ResizeObserver(() => {
          try {
            instance.resize();
          } catch {
            /* ignore */
          }
        });
        ro.observe(el);
        resizeObserverRef.current = ro;
        instance.on("error", (e) => {
          if (cancelled || !instance.loaded()) return;
          const msg = (e?.error?.message ?? "").toString() + (e?.message ?? "");
          if (/tile|fetch|network|ECONN/i.test(msg) && !/404/i.test(msg)) setOffline(true);
        });
        instance.on("move", () => {
          if (!instance.loaded()) return;
          setZoom(instance.getZoom());
          setBearing(instance.getBearing());
        });
        instance.on("drag", () => {
          setSelected(null);
          props.onQuestSelect?.(null);
        });
        map = instance;
        mapRef.current = instance;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      questMarkersRef.current.forEach((m) => m.remove());
      questMarkersRef.current.clear();
      map?.remove();
      map = null;
      mapRef.current = null;
      searchMarkerRef.current = null;
      if (el) el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------- watchdog: never spin forever
  useEffect(() => {
    if (ready || failed) return;
    const id = window.setTimeout(() => {
      const map = mapRef.current;
      if (map && !map.loaded()) setFailed(true);
    }, 9000);
    return () => window.clearTimeout(id);
  }, [ready, failed]);

  // --------------------- locate user from geolocation (flyTo + player marker)
  useEffect(() => {
    const map = mapRef.current;
    const loc = props.autoLocate;
    if (!map || !ready || !loc) return;
    if (!userMarkerRef.current) {
      map.flyTo({ center: [loc.lng, loc.lat], zoom: 15, essential: true });
    }
    setUserAt({ lat: loc.lat, lng: loc.lng });
    const last = lastPushedCenterRef.current;
    if (!last || haversineMeters(last, loc) > PLAYER_MOVE_THRESHOLD_M) {
      lastPushedCenterRef.current = { lat: loc.lat, lng: loc.lng };
      pushCenter({ lat: loc.lat, lng: loc.lng });
    }
  }, [props.autoLocate?.lat, props.autoLocate?.lng, ready, pushCenter]);

  // -------------------------------------------------------- player marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !userAt) return;
    if (!userMarkerRef.current) {
      const marker = createPlayerMarker().setLngLat([userAt.lng, userAt.lat]).addTo(map);
      userMarkerRef.current = marker;
      playerAvatarMap = map;
      playerAvatarMarker = marker;
      applyPlayerAvatarSize(map, marker);
      updatePlayerRadius(map, marker);
      return;
    }
    movePlayerTo(userMarkerRef.current, userAt.lat, userAt.lng);
  }, [userAt?.lat, userAt?.lng, ready]);

  // --------- radius ring + avatar scale track zoom (range in metres → pixels)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const onZoom = () => {
      const marker = userMarkerRef.current;
      if (marker) {
        applyPlayerAvatarSize(map, marker);
        updatePlayerRadius(map, marker);
      }
    };
    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [ready]);

  // Cancel any in-flight avatar glide on unmount.
  useEffect(
    () => () => {
      if (playerAnimFrame != null) cancelAnimationFrame(playerAnimFrame);
      playerAnimFrame = null;
    },
    [],
  );

  // ------------------------------------------- sync quest markers (MapLibre Markers)
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set<string>();
    const markers = questMarkersRef.current;

    for (const quest of props.quests) {
      const lng = Number(quest.lng);
      const lat = Number(quest.lat);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

      currentIds.add(quest.id);
      const done = isQuestDone(quest.id, props);

      const applyState = (el: HTMLElement) => {
        const badge = el.querySelector(".eq-qm-badge");
        if (badge) badge.textContent = done ? "✓" : markerEmoji(quest.category);
        el.classList.toggle("eq-qm-done", done);
        // Nearby quests (≤1 km) get a larger, faster attention pulse.
        el.classList.toggle("eq-qm-near", Number(quest.distanceMeters) <= 1000);
      };

      const existing = markers.get(quest.id);
      if (existing) {
        existing.setLngLat([lng, lat]);
        applyState(existing.getElement());
      } else {
        const meta = categoryMeta(quest.category);
        const emoji = markerEmoji(quest.category);
        const accent = markerAccent(quest);
        const el = document.createElement("button");
        el.type = "button";
        el.className = "eq-qm";
        el.style.setProperty("--marker-color", accent.color);
        el.style.setProperty("--marker-glow", accent.glow);
        el.setAttribute(
          "aria-label",
          `${quest.title} — ${meta.label} quest, ${quest.xpReward} XP, ${difficultyLabel(quest.difficulty)}`,
        );
        el.innerHTML = `
        <span class="eq-qm-tip" aria-hidden="true">
          <span class="eq-qm-tip-title">${escapeHtml(quest.title)}</span>
          <span class="eq-qm-tip-meta">${emoji} ${escapeHtml(meta.label)} · <b class="eq-qm-tip-xp">${quest.xpReward} XP</b> · ${difficultyLabel(quest.difficulty)}</span>
        </span>
        <span class="eq-qm-bob" aria-hidden="true">
          <span class="eq-qm-face">
            <span class="eq-qm-ring"></span>
            <span class="eq-qm-badge">${emoji}</span>
          </span>
        </span>`;
        applyState(el);

        const marker = new mlEnv!.Marker({ element: el, anchor: "center" })
          .setLngLat([lng, lat])
          .addTo(map);

        console.log("QUEST MARKER CREATED", {
          id: quest.id,
          title: quest.title,
          category: quest.category,
          latitude: lat,
          longitude: lng,
          mapLngLat: marker.getLngLat(),
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          activePopup?.remove();
          const p = propsRef.current;
          setSelected(quest);
          p.onQuestSelect?.(quest);
          const popup = popupFor(quest, p);
          if (popup) {
            popup.setLngLat([lng, lat]).addTo(map);
            activePopup = popup;
          }
        });

        marker.getElement().addEventListener("mouseenter", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        marker.getElement().addEventListener("mouseleave", () => {
          map.getCanvas().style.cursor = "";
        });

        markers.set(quest.id, marker);
      }
    }

    for (const [id, marker] of markers) {
      if (!currentIds.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    }
  }, [props.quests, props.completedIds, ready]);

  const goTo = useCallback(
    (lat: number, lng: number, zoom?: number) => {
      const map = mapRef.current;
      if (!map) return;
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? Math.max(map.getZoom(), DEFAULT_ZOOM),
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        essential: true,
      });
      setUserAt({ lat, lng });
      pushCenter({ lat, lng });
    },
    [pushCenter],
  );

  const placeSearchMarker = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    if (!searchMarkerRef.current) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "eq-marker eq-search";
      el.setAttribute("aria-label", "Search result");
      el.innerHTML = `
        <span class="eq-pin-ring"></span>
        <span class="eq-pin-tip"></span>
        <span class="eq-pin-dot"></span>
        <span class="eq-pin-label">Search</span>`;
      searchMarkerRef.current = new mlEnv!.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    } else {
      searchMarkerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  const handleSearchGoTo = useCallback(
    (lat: number, lng: number) => {
      placeSearchMarker(lat, lng);
      goTo(lat, lng, 16);
    },
    [goTo, placeSearchMarker],
  );

  const handleLocate = useCallback(
    (loc: LatLng) => {
      setUserAt(loc);
      goTo(loc.lat, loc.lng);
      pushCenter(loc);
    },
    [goTo, pushCenter],
  );

  // ------------------------------------------- external fly-to (from a card)
  const flyToQuest = useCallback(
    (questId: string) => {
      const map = mapRef.current;
      const quest = props.quests.find((q) => q.id === questId);
      if (!map || !quest) return;
      setSelected(quest);
      props.onQuestSelect?.(quest);
      map.flyTo({
        center: [quest.lng, quest.lat],
        zoom: Math.max(map.getZoom(), DEFAULT_ZOOM),
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        essential: true,
      });
      activePopup?.remove();
      const popup = popupFor(quest, props);
      if (popup) {
        popup.setLngLat([quest.lng, quest.lat]).addTo(map);
        activePopup = popup;
      }
    },
    [props.quests, props.onQuestSelect],
  );

  useImperativeHandle(ref, () => ({ flyToQuest }), [flyToQuest]);

  const zoomIn = useCallback(() => mapRef.current?.zoomIn?.({ duration: 350 } as never), []);
  const zoomOut = useCallback(() => mapRef.current?.zoomOut?.({ duration: 350 } as never), []);
  const resetNorth = useCallback(() => mapRef.current?.easeTo?.({ bearing: 0, duration: 500 } as never), []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <MapStyles />
      <div ref={containerRef} className="absolute! inset-0" />

      {!ready && !failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-3 border border-frost/25 bg-void px-8 py-6 backdrop-blur">
            <Logo className="h-10 w-10 animate-bounce" />
            <p className="font-micro text-[11px] uppercase text-ash">Loading live map…</p>
          </div>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-6">
          <div className="w-full max-w-md rounded-[10px] border border-frost/25 bg-void p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center border border-frost/25">
              <MapPin className="h-6 w-6 text-white" aria-hidden />
            </div>
            <h2 className="font-display text-[22px] font-normal text-white">Map unavailable</h2>
            <p className="mt-1 font-micro text-[11px] uppercase text-ash">
              The map library couldn&apos;t load. Check your connection and retry.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-[2px] border border-frost bg-charcoal px-6 py-2.5 font-micro text-[11px] uppercase text-white transition-opacity hover:opacity-85"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {ready && (
        <Overlay
          zoom={zoom}
          bearing={bearing}
          selected={selected}
          onClearSelected={() => setSelected(null)}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onResetNorth={resetNorth}
          onLocate={() => {
            setLocateError(null);
            locateUser(handleLocate, setLocateError);
          }}
          onSearch={handleSearchGoTo}
          quests={props.quests}
          acceptQuest={props.acceptQuest}
          acceptingId={props.acceptingId}
          accepted={props.accepted}
          onGoToMyQuests={props.onGoToMyQuests}
          mode={props.mode}
          onViewDetails={props.onViewDetails}
        />
      )}

      {ready && offline && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-[2px] border border-frost/40 bg-black/90 px-4 py-1.5 font-micro text-[10px] uppercase text-ash">
          Some map tiles didn&apos;t load — check your connection.
        </div>
      )}

      {locateError && (
        <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-[2px] border border-destructive/50 bg-black/90 px-4 py-1.5 font-micro text-[10px] uppercase text-destructive">
          {locateError}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ helpers */

let activePopup: MLPopup | null = null;

function popupFor(quest: NearbyQuest, props: QuestMapProps): MLPopup | null {
  const { label, color } = categoryMeta(quest.category);
  const own = props.ownQuestIds?.includes(quest.id) ?? false;
  const root = document.createElement("div");
  root.className = "eq-pop";
  root.innerHTML = `
    <div class="eq-pop-cat"><i style="background:${color}"></i>${escapeHtml(label)}${own ? '<span class="eq-pop-own">★ Yours</span>' : ""}</div>
    <div class="eq-pop-title">${escapeHtml(quest.title)}</div>
    <div class="eq-pop-meta">${quest.xpReward} XP · ${formatDistance(quest.distanceMeters)} · ${difficultyLabel(quest.difficulty)}</div>
    <div class="eq-pop-meta">${escapeHtml(new Date(quest.endsAt).toLocaleDateString())} deadline</div>`;
  const btn = document.createElement("button");
  btn.type = "button";
  if (props.mode === "teacher") {
    btn.className = "eq-pop-btn eq-pop-btn-view";
    btn.innerHTML = "View details";
    btn.addEventListener("click", () => props.onViewDetails?.(quest));
  } else if (props.accepted.includes(quest.id)) {
    btn.className = "eq-pop-btn eq-pop-btn-done";
    btn.innerHTML = "In progress — open my quests";
    btn.addEventListener("click", () => props.onGoToMyQuests());
  } else {
    btn.className = "eq-pop-btn";
    btn.innerHTML = "Accept quest";
    btn.addEventListener("click", () => void props.acceptQuest(quest));
  }
  root.appendChild(btn);
  const popup = new mlEnv!.Popup({ offset: 24, closeButton: true, maxWidth: "250px", closeOnClick: false })
    .setDOMContent(root);
  return popup;
}

/** Player marker: the avatar stands on the map, feet anchored at the location. */
function createPlayerMarker(): MLMarker {
  const wrap = document.createElement("div");
  wrap.className = "player-avatar-wrap";
  wrap.innerHTML = `
    <span class="player-radius" aria-hidden="true"></span>
    <span class="player-avatar-glow" aria-hidden="true"></span>
    <img class="player-avatar" src="/assets/player-avatar.png" alt="Your location" draggable="false" />
  `;
  const img = wrap.querySelector<HTMLImageElement>("img.player-avatar");
  img?.addEventListener("load", () => {
    measurePlayerAvatar(img);
    if (playerAvatarMap && playerAvatarMarker) {
      applyPlayerAvatarSize(playerAvatarMap, playerAvatarMarker);
    }
  });
  return new mlEnv!.Marker({ element: wrap, anchor: "bottom" });
}

/** Measures the avatar's opaque bounding box once so its feet land exactly on the GPS point. */
function measurePlayerAvatar(img: HTMLImageElement): void {
  if (playerAvatarAspect != null) return;
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if ((data[(y * w + x) * 4 + 3] ?? 0) > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return;
    playerAvatarAspect = (maxY - minY + 1) / (maxX - minX + 1);
  } catch {
    playerAvatarAspect = null;
  }
}

/**
 * Sizes the avatar sprite so it's the big visual focus (like a Pokémon GO
 * trainer) while staying feet-anchored: box width = size, box height follows
 * the sprite's aspect, so `object-fit: contain` fills it exactly and the
 * character's feet stay glued to the marker point.
 */
function applyPlayerAvatarSize(map: MLMap, marker: MLMarker): void {
  const el = marker.getElement();
  const img = el.querySelector<HTMLImageElement>("img.player-avatar");
  const glow = el.querySelector<HTMLElement>(".player-avatar-glow");
  if (!img) return;
  const size = Math.max(AVATAR_MIN_PX, Math.min(AVATAR_MAX_PX, Math.round(map.getZoom() * AVATAR_ZOOM_SCALE)));
  const aspect = playerAvatarAspect ?? (img.naturalHeight > 0 && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1);
  img.style.width = `${size}px`;
  img.style.height = `${Math.max(1, Math.round(size * aspect))}px`;
  if (glow) {
    glow.style.width = `${Math.round(size * 0.7)}px`;
  }
}

/** Keeps the interaction-range ring sized to a fixed number of metres on screen. */
function updatePlayerRadius(map: MLMap, marker: MLMarker): void {
  const ring = marker.getElement().querySelector<HTMLElement>(".player-radius");
  if (!ring) return;
  const metresPerPixel =
    (156543.03392 * Math.cos((marker.getLngLat().lat * Math.PI) / 180)) / Math.pow(2, map.getZoom());
  const px = Math.round((PLAYER_RADIUS_METERS * 2) / metresPerPixel);
  ring.style.width = `${px}px`;
  ring.style.height = `${px}px`;
}

/** Glides the avatar between coordinates so position updates look smooth. */
function movePlayerTo(marker: MLMarker, lat: number, lng: number): void {
  if (playerAnimFrame != null) cancelAnimationFrame(playerAnimFrame);
  const from = marker.getLngLat();
  const startLat = from.lat;
  const startLng = from.lng;
  const startTime = performance.now();
  const duration = 900;
  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    marker.setLngLat([startLng + (lng - startLng) * eased, startLat + (lat - startLat) * eased]);
    if (t < 1) {
      playerAnimFrame = requestAnimationFrame(step);
    } else {
      playerAnimFrame = null;
      marker.setLngLat([lng, lat]);
    }
  };
  playerAnimFrame = requestAnimationFrame(step);
}

/** Great-circle distance in metres; used to throttle quest re-fetches. */
function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Small wrapper: resolves the user's GPS location and hands it to the map. */
function locateUser(onLocated: (loc: LatLng) => void, onError?: (msg: string) => void): void {
  if (!("geolocation" in navigator)) {
    const msg = "Geolocation is not supported by this browser";
    console.error(msg);
    onError?.(msg);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      onLocated({ lat: latitude, lng: longitude });
    },
    (err) => {
      const msg = `Geolocation failed (code ${err.code}): ${err.message}`;
      console.error(msg);
      onError?.(msg);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
  );
}

/* ------------------------------------------------------------------ overlay */

interface OverlayProps {
  zoom: number;
  bearing: number;
  selected: NearbyQuest | null;
  onClearSelected: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onLocate: () => void;
  onSearch: (lat: number, lng: number) => void;
  quests: NearbyQuest[];
  acceptQuest: (q: NearbyQuest) => Promise<void>;
  acceptingId: string | null;
  accepted: string[];
  onGoToMyQuests: () => void;
  mode?: QuestMapProps["mode"];
  onViewDetails?: (quest: NearbyQuest) => void;
}

function Overlay(props: OverlayProps) {
  return (
    <>
      {/* top-right: zoom + compass */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <div className="eq-glass overflow-hidden rounded-[2px]">
          <CtrlBtn label="Zoom in" onClick={props.onZoomIn}>
            <Plus className="h-4 w-4" aria-hidden />
          </CtrlBtn>
          <div className="mx-2 border-t border-frost/20" />
          <CtrlBtn label="Zoom out" onClick={props.onZoomOut}>
            <Minus className="h-4 w-4" aria-hidden />
          </CtrlBtn>
        </div>
        <div className="eq-glass grid place-items-center overflow-hidden rounded-[2px]">
          <CtrlBtn label="Reset north" onClick={props.onResetNorth}>
            <Compass
              className="h-4 w-4 transition-transform duration-500"
              style={{ transform: `rotate(${-props.bearing}deg)` }}
              aria-hidden
            />
          </CtrlBtn>
        </div>
      </div>

      {/* bottom-right: my location */}
      <div className="absolute bottom-6 right-3 z-10">
        <div className="eq-glass grid place-items-center overflow-hidden rounded-[2px]">
          <CtrlBtn label="My location" onClick={props.onLocate}>
            <LocateFixed className="h-4 w-4" aria-hidden />
          </CtrlBtn>
        </div>
      </div>

      {/* top-left: search */}
      <div className="absolute left-3 top-3 z-10 w-[min(20rem,calc(100vw-6rem))]">
        <SeachBox onSearch={props.onSearch} />
      </div>

      {/* bottom: floating quest card (Pokémon GO-style encounter sheet) */}
      <QuestCard
        selected={props.selected}
        onClear={props.onClearSelected}
        acceptQuest={props.acceptQuest}
        accepting={props.acceptingId === props.selected?.id}
        accepted={props.selected ? props.accepted.includes(props.selected.id) : false}
        onGoToMyQuests={props.onGoToMyQuests}
        mode={props.mode}
        onViewDetails={props.onViewDetails}
      />
    </>
  );
}

interface SeachResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

function SeachBox({ onSearch }: { onSearch: (lat: number, lng: number) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SeachResult[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  const clear = () => {
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const runGeocode = (query: string) =>
    fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=${encodeURIComponent(
        query.trim(),
      )}`,
    )
      .then((r) => r.json())
      .then(
        (
          data: Array<{
            place_id: number;
            display_name: string;
            lat: string;
            lon: string;
          }>,
        ) =>
          (data ?? []).map(
            (f): SeachResult => ({
              id: String(f.place_id),
              name: f.display_name,
              lat: Number(f.lat),
              lng: Number(f.lon),
            }),
          ),
      );

  const applyResults = (items: SeachResult[]) => {
    setResults(items);
    setBusy(false);
  };

  const selectResult = (r: SeachResult) => {
    onSearch(r.lat, r.lng);
    clear();
  };

  const onChange = (value: string) => {
    setQ(value);
    setOpen(true);
    window.clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      setBusy(true);
      runGeocode(value)
        .then(applyResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 350);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !q.trim()) return;
    e.preventDefault();
    if (results.length > 0) {
      const first = results[0];
      if (first) selectResult(first);
      return;
    }
    window.clearTimeout(debounceRef.current);
    setBusy(true);
    runGeocode(q)
      .then((items) => {
        applyResults(items);
        const first = items[0];
        if (first) selectResult(first);
      })
      .catch(() => setResults([]))
      .finally(() => setBusy(false));
  };

  return (
    <div className="eq-glass rounded-[20px]">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 shrink-0 text-ash" aria-hidden />
        <input
          className="w-full bg-transparent text-sm text-ash outline-none placeholder:text-ash"
          placeholder="Search a place"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ash" aria-hidden />}
        {q && (
          <button type="button" aria-label="Clear" onClick={clear} className="shrink-0 text-ash hover:text-white">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="border-t border-frost/10 py-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ash transition-colors hover:bg-white/[0.06]"
                onClick={() => selectResult(r)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-ash" aria-hidden />
                <span className="line-clamp-1">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface QuestCardProps {
  selected: NearbyQuest | null;
  onClear: () => void;
  acceptQuest: (q: NearbyQuest) => Promise<void>;
  accepting: boolean;
  accepted: boolean;
  onGoToMyQuests: () => void;
  mode?: QuestMapProps["mode"];
  onViewDetails?: (quest: NearbyQuest) => void;
}

function QuestCard(props: QuestCardProps) {
  if (!props.selected) return null;
  const quest = props.selected;
  const { label, color } = categoryMeta(quest.category);
  const teacherMode = props.mode === "teacher";
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[26rem]">
      <div className="eq-sheet flex items-center gap-3 rounded-[20px] p-3.5 ">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-[20px] text-lg font-normal "
          style={{ backgroundColor: `${color}26`, color }}
          aria-hidden
        >
          {quest.xpReward}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-normal uppercase tracking-wider" style={{ color }}>
              {label}
            </span>
            <span className="rounded-[2px] bg-white/[0.06] px-2 py-0.5 text-[10px] font-normal text-ash">
              {quest.difficulty}
            </span>
            <button
              type="button"
              onClick={props.onClear}
              className="ml-auto -mr-1 rounded-[2px] p-1.5 text-ash transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-0.5 truncate text-[15px] font-normal leading-tight text-ash">{quest.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ash">
            <MapPin className="h-3 w-3" aria-hidden />
            {formatDistance(quest.distanceMeters)} away
          </div>
        </div>
        {teacherMode ? (
          <button
            type="button"
            onClick={() => props.onViewDetails?.(quest)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] px-4 py-2.5 text-sm font-normal text-white transition "
          >
            <MapPin className="h-4 w-4" aria-hidden />
            View details
          </button>
        ) : props.accepted ? (
          <button
            type="button"
            onClick={props.onGoToMyQuests}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] bg-charcoal px-4 py-2.5 text-sm font-normal text-white transition hover:bg-white/[0.06] "
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            My quests
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void props.acceptQuest(quest)}
            disabled={props.accepting}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[2px] px-4 py-2.5 text-sm font-normal text-white transition disabled:opacity-60"
          >
            {props.accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <>
                <MapPin className="h-4 w-4" aria-hidden />
                Accept quest
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center font-micro text-[11px] uppercase text-ash/60 transition-colors hover:text-white "
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

function MapStyles() {
  return (
    <style>{`
 /* EcoSphere glass over the live map */
 .eq-glass {
 background: rgb(5 25 30 / .78);
 backdrop-filter: blur(16px);
 -webkit-backdrop-filter: blur(16px);
 border: 1px solid rgba(255,255,255,.1);
 border-radius: 12px;
 }

 /* ---- search marker pin (kept for search results) ---- */
 .eq-marker { position: absolute; top: 0; left: 0; background: transparent; border: 0; padding: 0; cursor: pointer;
 width: 40px; height: 46px; }
 .eq-marker .eq-pin-ring { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%);
 width: 30px; height: 30px; border-radius: 9999px; background: var(--pin-color); opacity: .4;
 animation: eqRing 2.4s ease-out infinite; z-index: 0; }
 .eq-marker .eq-pin-dot { position: absolute; left: 50%; bottom: 5px; transform: translateX(-50%) rotate(-45deg);
 width: 24px; height: 24px; border-radius: 50% 50% 50% 0; background: var(--pin-color);
 border: 2px solid rgba(255,255,255,.9); z-index: 1; }
 .eq-marker .eq-pin-tip { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
 width: 7px; height: 7px; border-radius: 9999px; background: #fff; z-index: 2; }
 .eq-marker .eq-pin-pulse { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
 width: 20px; height: 20px; border-radius: 9999px; background: var(--pin-color); opacity: .3; z-index: -1; }
 .eq-marker .eq-pin-label { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%);
 white-space: nowrap; font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: .04em;
 color: #fff; background: var(--pin-color);
 padding: 2px 8px; border-radius: 2px; opacity: 0; transform: translateX(-50%) translateY(4px);
 transition: opacity .18s ease, transform .18s ease; z-index: 3; pointer-events: none; }
 .eq-search { --pin-color: #000000; animation: none; }

 @keyframes eqRing { 0% { transform: translateX(-50%) scale(.6); opacity: .5; }
 70% { transform: translateX(-50%) scale(1.9); opacity: 0; } 100% { opacity: 0; } }

 /* ---- quest markers: emoji badge + glowing ring + soft pulse + subtle bob ----
    The root (.eq-qm) carries MapLibre's positioning transform, so every
    animation lives on inner wrappers and never fights the marker anchor. */
 .eq-qm { position: absolute; top: 0; left: 0; width: 44px; height: 44px; padding: 0; margin: 0; border: 0;
  background: transparent; font: inherit; color: inherit; display: grid; place-items: center;
  overflow: visible; cursor: pointer; -webkit-tap-highlight-color: transparent; }
 .eq-qm .eq-qm-bob { position: relative; display: grid; place-items: center;
  width: 38px; height: 38px; animation: eqQmBob 2.6s ease-in-out infinite; }
 .eq-qm .eq-qm-face { position: relative; display: grid; place-items: center; width: 38px; height: 38px;
  transition: transform .18s cubic-bezier(.22,1,.36,1); }
 .eq-qm .eq-qm-ring { position: absolute; inset: 0; border-radius: 9999px;
  border: 2px solid var(--marker-color, #f2fbf8);
  background: rgba(3, 18, 26, .8);
  box-shadow: 0 0 16px 0 var(--marker-glow, rgba(242, 251, 248, .4)); }
 .eq-qm .eq-qm-ring::after { content: ""; position: absolute; inset: -5px; border-radius: 9999px;
  border: 1px solid var(--marker-color, #f2fbf8); opacity: .4;
  animation: eqQmPulse 2.4s ease-out infinite; }
 .eq-qm .eq-qm-badge { position: relative; z-index: 1; font-size: 17px; line-height: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .65)); }
 .eq-qm:hover .eq-qm-face, .eq-qm:focus-visible .eq-qm-face { transform: scale(1.14); }
 .eq-qm:hover .eq-qm-ring::after, .eq-qm:focus-visible .eq-qm-ring::after { opacity: .8; }
 .eq-qm:focus-visible { outline: none; z-index: 7; }
 .eq-qm:focus-visible .eq-qm-ring { border-color: #22d3ee;
  box-shadow: 0 0 0 2px rgba(34, 211, 238, .85), 0 0 18px 0 var(--marker-glow, rgba(242, 251, 248, .4)); }

 /* completed quest — muted marker, checkmark, reduced glow */
 .eq-qm.eq-qm-done .eq-qm-ring { border-color: rgba(242, 251, 248, .38);
  background: rgba(3, 21, 29, .72); box-shadow: 0 0 8px 0 rgba(242, 251, 248, .16); }
 .eq-qm.eq-qm-done .eq-qm-ring::after { animation: none; opacity: .18; }
 .eq-qm.eq-qm-done .eq-qm-badge { font-size: 15px; filter: none; }
 .eq-qm.eq-qm-done .eq-qm-bob { animation: none; }
 .eq-qm.eq-qm-done { opacity: .78; }

 /* nearby (≤1 km) / high-priority — larger, livelier pulse */
 .eq-qm.eq-qm-near .eq-qm-ring::after { animation: eqQmPulseNear 1.8s ease-out infinite; }

 @keyframes eqQmBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
 @keyframes eqQmPulse { 0% { transform: scale(.72); opacity: .55; }
  70% { transform: scale(1.35); opacity: 0; } 100% { opacity: 0; } }
 @keyframes eqQmPulseNear { 0% { transform: scale(.72); opacity: .7; }
  70% { transform: scale(1.65); opacity: 0; } 100% { opacity: 0; } }

 /* hover / focus tooltip — never intercepts the click/accept flow. */
 .eq-qm .eq-qm-tip { position: absolute; left: 50%; bottom: calc(100% + 6px);
  transform: translateX(-50%) translateY(4px);
  min-width: 150px; max-width: 210px; padding: 7px 9px; border-radius: 10px;
  background: rgb(3 21 29 / .95); border: 1px solid rgba(255, 255, 255, .14);
  box-shadow: 0 16px 34px -20px rgba(0, 0, 0, .95);
  text-align: left; pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity .16s ease, transform .16s ease, visibility .16s ease; z-index: 6; }
 .eq-qm:hover .eq-qm-tip, .eq-qm:focus-visible .eq-qm-tip {
  opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
 .eq-qm .eq-qm-tip-title { display: block; font-family: var(--font-display); font-size: 12px;
  font-weight: 500; line-height: 1.3; color: #f2fbf8; overflow-wrap: anywhere; }
 .eq-qm .eq-qm-tip-meta { display: block; margin-top: 3px; font-family: var(--font-micro);
  font-size: 10px; line-height: 1.4; letter-spacing: -.02em; text-transform: uppercase;
  color: #8fb2b8; overflow-wrap: anywhere; }
 .eq-qm .eq-qm-tip-xp { font-family: var(--font-title); font-weight: 600; color: #fbbf24; }

 /* ---- you are here (avatar player character) ---- */
 .player-avatar-wrap { position: absolute; top: 0; left: 0; width: 260px; height: 260px; pointer-events: none; z-index: 5; }
 .player-avatar {
 position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
 width: 220px; height: 220px; object-fit: contain; object-position: center bottom;
 pointer-events: none; image-rendering: auto;
 }
 .player-avatar-glow {
 position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
 width: 154px; height: 26px; border-radius: 50%; pointer-events: none; z-index: -1;
 background: radial-gradient(ellipse at center, rgba(255,255,255,.22), rgba(255,255,255,0) 70%);
 filter: blur(3px);
 }
 .player-radius {
 position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 50%); pointer-events: none;
 z-index: -2; border-radius: 50%;
 border: 2px dashed rgba(255,255,255,.55);
 background: radial-gradient(circle, rgba(255,255,255,.12), rgba(255,255,255,.04) 60%, rgba(255,255,255,0) 100%);
 }

 /* ---- popup ---- */
 .eq-pop { font-family: inherit; }
 .eq-pop .eq-pop-cat { display:flex; align-items:center; gap:6px; font-size:11px; text-transform:uppercase;
 letter-spacing:.05em; color:#8fb2b8; }
 .eq-pop .eq-pop-cat i { width:8px; height:8px; border-radius:9999px; display:inline-block;
 box-shadow: 0 0 8px 0 currentColor; }
 .eq-pop-own { margin-left:auto; font-size:10px; font-weight:400; text-transform:uppercase; letter-spacing:.04em;
 color:#03151d; background:#fbbf24; padding:1px 7px; border-radius:9999px; }
 .eq-pop .eq-pop-title { font-size:14px; font-weight:500; color:#f2fbf8; margin-top:4px;
 font-family: var(--font-display); }
 .eq-pop .eq-pop-meta { font-size:12px; color:#8fb2b8; margin-top:3px; }
 .eq-pop-btn { margin-top:12px; width:100%; border:0; border-radius:8px; padding:9px 12px; cursor:pointer;
 font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#fff; background:#0c5a46;
 transition: background-color .15s ease, transform .1s ease, box-shadow .15s ease; }
 .eq-pop-btn:hover { background:#10b981; box-shadow: 0 0 18px -6px rgba(16, 185, 129, .8); }
 .eq-pop-btn:active { transform: scale(.97); }
 .eq-pop-btn-done { background: rgb(255 255 255 / .08); border: 1px solid rgba(255,255,255,.14); color:#f2fbf8; }
 .eq-pop-btn-done:hover { background: rgb(255 255 255 / .14); box-shadow: none; }
 .eq-pop-btn-view { background:#0c5a46; }
 .eq-pop-btn-view:hover { background:#10b981; }

 /* ---- quest card sheet ---- */
 .eq-sheet { background: rgb(5 25 30 / .92); border: 1px solid rgba(255,255,255,.1);
 backdrop-filter: blur(16px);
 -webkit-backdrop-filter: blur(16px); animation: eqSheetUp .28s cubic-bezier(.2,.9,.3,1.2); }
 @keyframes eqSheetUp { 0% { transform: translateY(24px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }

 /* maplibre tweaks */
 .maplibregl-map { font-family: inherit; font-size: 14px; line-height: 20px; }
 .maplibregl-popup-content { background: rgb(5 25 30 / .94); color:#f2fbf8; border: 1px solid rgba(255,255,255,.12);
 border-radius: 12px;
 backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
 box-shadow: 0 18px 40px -24px rgba(0,0,0,.95); padding: 12px 14px; }
 .maplibregl-popup-tip { display: none; }
 .maplibregl-popup-anchor-top .maplibregl-popup-content { margin-top: 8px; }
 .maplibregl-popup-anchor-bottom .maplibregl-popup-content { margin-bottom: 8px; }
 .maplibregl-popup-close-button { color:#8fb2b8; background:transparent; border:0; font-size:18px; line-height:1;
 top:4px; right:4px; }
 .maplibregl-popup-close-button:hover { color:#f2fbf8; background:transparent; }
 .maplibregl-ctrl-group { background: rgb(5 25 30 / .85); border: 1px solid rgba(255,255,255,.12); border-radius: 10px;
 box-shadow: none; overflow:hidden; }
 .maplibregl-ctrl-group button { background-color: transparent; width:30px; height:30px; }
 .maplibregl-ctrl-group button + button { border-top: 1px solid rgba(255,255,255,.1); }
 .maplibregl-ctrl-group button:hover { background-color: rgb(16 185 129 / .25); }
 .maplibregl-ctrl-group button span { filter: invert(1) brightness(1.6); }
 .maplibregl-ctrl-attrib { border-radius: 8px 0 0 0; font-size: 11px; background: rgb(3 21 29 / .8); color:#8fb2b8; }
 .maplibregl-ctrl-attrib a { color:#a5ddd2; }
 `}</style>
  );
}
