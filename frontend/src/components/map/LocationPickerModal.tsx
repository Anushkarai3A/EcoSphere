import { Search as SearchIcon, X, Loader2, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Map as MLMap, Marker as MLMarker } from "maplibre-gl";
import { Button } from "@/components/ui/button";
import { FREE_OSM_STYLE } from "./QuestMap";

export interface PickedLocation {
  lat: number;
  lng: number;
  addressText?: string;
}

interface LocationPickerModalProps {
  open: boolean;
  initial?: PickedLocation | null;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
}

interface SearchResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

const PICKER_DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

const MARKER_CSS = `
.picker-marker { position: relative; width: 30px; height: 30px; cursor: move; }
.picker-pin-ring { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 9999px; background: rgba(16,185,129,0.25); }
.picker-pin { position: absolute; left: 50%; bottom: 1px; transform: translateX(-50%); width: 18px; height: 18px; border-radius: 9999px; background: #10b981; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
`;

export function LocationPickerModal({ open, initial, onClose, onConfirm }: LocationPickerModalProps) {
  const [picked, setPicked] = useState<PickedLocation | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [labelBusy, setLabelBusy] = useState(false);
  const labelTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setPicked(initial ?? null);
      setLabel(initial?.addressText ?? null);
    }
  }, [open, initial]);

  useEffect(() => () => window.clearTimeout(labelTimerRef.current), []);

  const handlePick = useCallback((lat: number, lng: number) => {
    setPicked({ lat, lng });
    setLabelBusy(true);
    window.clearTimeout(labelTimerRef.current);
    labelTimerRef.current = window.setTimeout(() => {
      void fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${lat}&lon=${lng}`,
      )
        .then((r) => r.json())
        .then((d: { display_name?: string; error?: string }) => {
          setLabel(d && !d.error && d.display_name ? d.display_name : null);
        })
        .catch(() => setLabel(null))
        .finally(() => setLabelBusy(false));
    }, 350);
  }, []);

  const pickerInitial = useMemo(() => initial ?? null, [open, initial]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPin className="h-5 w-5 text-primary" aria-hidden />
            Select Quest Location
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="relative h-[44vh] min-h-[280px] overflow-hidden rounded-lg border border-border">
            <PickerMap initialLat={pickerInitial?.lat} initialLng={pickerInitial?.lng} onPick={handlePick} />
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {picked ? (
              <>
                <span className="min-w-0 flex-1 truncate">{label ?? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}`}</span>
                {labelBusy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
                <span className="shrink-0 text-xs text-muted-foreground">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Click the map or search to drop the quest location.</span>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              onConfirm({ ...picked, ...(label ? { addressText: label } : {}) });
            }}
          >
            Confirm Location
          </Button>
        </div>
      </div>
    </div>
  );
}

function PickerMap({
  initialLat,
  initialLng,
  onPick,
}: {
  initialLat?: number;
  initialLng?: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<MLMarker | null>(null);
  const mbRef = useRef<typeof import("maplibre-gl") | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const place = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    const mb = mbRef.current;
    if (!map || !mb) return;
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.className = "picker-marker";
      el.innerHTML = `<span class="picker-pin-ring"></span><span class="picker-pin"></span>`;
      markerRef.current = new mb.Marker({ element: el, anchor: "bottom", draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const ll = markerRef.current?.getLngLat();
        if (ll) onPickRef.current(ll.lat, ll.lng);
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let map: MLMap | null = null;

    void (async () => {
      try {
        const mb = await import("maplibre-gl");
        void import("maplibre-gl/dist/maplibre-gl.css");
        if (cancelled) return;
        mbRef.current = mb;
        const hasInitial = typeof initialLat === "number" && typeof initialLng === "number";
        const start = hasInitial ? { lat: initialLat as number, lng: initialLng as number } : PICKER_DEFAULT_CENTER;
        const instance = new mb.Map({
          container: el,
          style: FREE_OSM_STYLE as never,
          center: [start.lng, start.lat],
          zoom: hasInitial ? 16 : 12,
          attributionControl: false,
        });
        map = instance;
        mapRef.current = instance;

        instance.on("load", () => {
          if (cancelled) return;
          try {
            instance.resize();
          } catch {
            /* noop */
          }
          if (hasInitial) {
            place(initialLat as number, initialLng as number);
            onPickRef.current(initialLat as number, initialLng as number);
          }
        });
        instance.on("click", (e) => {
          place(e.lngLat.lat, e.lngLat.lng);
          onPickRef.current(e.lngLat.lat, e.lngLat.lng);
        });
      } catch {
        /* map failed to initialise – leave the empty container */
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
      mapRef.current = null;
      markerRef.current = null;
      mbRef.current = null;
    };
  }, [initialLat, initialLng, place]);

  const pickResult = (lat: number, lng: number) => {
    const map = mapRef.current;
    map?.flyTo({ center: [lng, lat], zoom: 16, essential: true });
    place(lat, lng);
    onPickRef.current(lat, lng);
  };

  return (
    <>
      <style>{MARKER_CSS}</style>
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-10 w-[min(19rem,calc(100%-6rem))]">
        <PickerSearch onPick={pickResult} />
      </div>
    </>
  );
}

function PickerSearch({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<number | undefined>(undefined);

  const clear = () => {
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const runGeocode = (query: string) =>
    fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=en&q=${encodeURIComponent(query.trim())}`,
    )
      .then((r) => r.json())
      .then((data: Array<{ place_id: number; display_name: string; lat: string; lon: string }>) =>
        (data ?? []).map((f): SearchResult => ({ id: String(f.place_id), name: f.display_name, lat: Number(f.lat), lng: Number(f.lon) })),
      );

  const select = (r: SearchResult) => {
    onPick(r.lat, r.lng);
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
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setBusy(false));
    }, 350);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !q.trim()) return;
    e.preventDefault();
    window.clearTimeout(debounceRef.current);
    setBusy(true);
    runGeocode(q)
      .then((items) => {
        setResults(items);
        const first = items[0];
        if (first) select(first);
      })
      .catch(() => setResults([]))
      .finally(() => setBusy(false));
  };

  useEffect(() => () => window.clearTimeout(debounceRef.current), []);

  return (
    <div className="rounded-xl border border-border bg-background shadow-lg">
      <div className="flex items-center gap-2 px-3 py-2">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Search location..."
          value={q}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />}
        {q && (
          <button
            type="button"
            aria-label="Clear"
            onClick={clear}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto border-t border-border py-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                onClick={() => select(r)}
              >
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="line-clamp-1">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
