import { Loader2, MapPin, Search, X } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { LocationPickerModal, type PickedLocation } from "@/components/map/LocationPickerModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateQuest } from "@/hooks/useQuests";
import {
  categoryMeta,
  difficultyLabel,
  proofTypes,
  questCategories,
  questDifficulties,
} from "@/lib/quests";
import type { CreateQuestInput, ProofType, QuestCategory, QuestDifficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface CreateQuestModalProps {
  open: boolean;
  /** Default map location so a new quest drops right where the teacher is looking. */
  defaultLocation?: { lat: number; lng: number } | null;
  onClose: () => void;
}

const inputClass =
  "h-10 w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35";
const selectClass = `${inputClass} cursor-pointer`;

const difficultyChip: Record<QuestDifficulty, string> = {
  EASY: "border-emerald/35 bg-emerald/10 text-emerald",
  MEDIUM: "border-cyan/35 bg-cyan/10 text-cyan",
  HARD: "border-gold/35 bg-gold/10 text-gold",
  EXPERT: "border-coral/35 bg-coral/10 text-coral",
};

/** Numbered form section — mono index, hairline rule, optional hint. */
function FormSection({
  index,
  title,
  hint,
  children,
}: {
  index: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="font-micro text-[10px] uppercase text-emerald">{index}</span>
        <h3 className="font-display text-[13px] font-medium uppercase tracking-[0.12em] text-bone">{title}</h3>
        <span aria-hidden className="h-px flex-1 bg-frost/15" />
      </div>
      {hint ? <p className="-mt-2 font-micro text-[10px] uppercase leading-[1.6] text-ash/80">{hint}</p> : null}
      {children}
    </section>
  );
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CreateQuestModal({ open, defaultLocation, onClose }: CreateQuestModalProps) {
  const createQuest = useCreateQuest();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<QuestCategory>("PARK_CLEANING");
  const [difficulty, setDifficulty] = useState<QuestDifficulty>("EASY");
  const [xpReward, setXpReward] = useState("50");
  const [radiusMeters, setRadiusMeters] = useState("100");
  const [minPhotoCount, setMinPhotoCount] = useState("1");
  const [requiredProofType, setRequiredProofType] = useState<ProofType>("PHOTO");
  const [startsAt, setStartsAt] = useState(() => toLocalInputValue(new Date()));
  const [endsAt, setEndsAt] = useState(() => toLocalInputValue(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
  const [addressText, setAddressText] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const publishIntentRef = useRef(false);

  if (!open) return null;

  const seedFromDefault = () => {
    if (defaultLocation && (lat.trim() === "" || lng.trim() === "")) {
      setLat(defaultLocation.lat.toFixed(6));
      setLng(defaultLocation.lng.toFixed(6));
    }
  };
  seedFromDefault();

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormError("Couldn't get your location. Please choose a location on the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setFormError(null);
      },
      () => setFormError("Couldn't get your location. Please choose a location on the map instead."),
      { timeout: 8000 },
    );
  }

  function handlePickerConfirm(location: PickedLocation) {
    setLat(location.lat.toFixed(6));
    setLng(location.lng.toFixed(6));
    if (location.addressText) setAddressText(location.addressText);
    setFormError(null);
    setPickerOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const hasLocation = lat.trim() !== "" && lng.trim() !== "";
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const wantPublish = publishIntentRef.current === true;

    if (wantPublish && (!Number.isFinite(latNum) || !Number.isFinite(lngNum))) {
      setFormError("The chosen location looks invalid. Pick it again on the map.");
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setFormError("End date must be after the start date.");
      return;
    }
    if (wantPublish && new Date(endsAt).getTime() <= Date.now()) {
      setFormError("A published quest must end in the future.");
      return;
    }

    const input: CreateQuestInput = {
      title: title.trim(),
      description: description.trim(),
      category,
      difficulty,
      xpReward: Number(xpReward),
      radiusMeters: Number(radiusMeters),
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      requiredProofType,
      minPhotoCount: Number(minPhotoCount),
      ...(addressText.trim() ? { addressText: addressText.trim() } : {}),
      ...(hasLocation ? { lat: latNum, lng: lngNum } : {}),
      ...(wantPublish ? { publish: true } : {}),
    };

    publishIntentRef.current = false;

    createQuest.mutate(input, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        setAddressText("");
        setLat("");
        setLng("");
        onClose();
      },
      onError: (err) => setFormError(err instanceof Error ? err.message : "Failed to create quest."),
    });
  }

  const activeCategory = categoryMeta(category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Create a quest"
      onClick={onClose}
    >
      <div
        className="glass-strong max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[20px] border border-frost/25 text-bone"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-frost/15 px-5 py-4">
          <div className="min-w-0">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-emerald">Mission control</p>
            <h2 className="mt-1.5 font-display text-[22px] font-medium leading-tight text-bone">Create a quest</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-ash">
              The new quest appears on the map right away. Publish it once it has a location and future end date.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={createQuest.isPending} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-5 py-5">
          <FormSection index="01" title="Quest brief">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="cq-title">Title</Label>
                <Input id="cq-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-desc">Description</Label>
                <textarea
                  id="cq-desc"
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`${inputClass} h-auto resize-none`}
                />
              </div>
            </div>
          </FormSection>

          <FormSection index="02" title="Challenge">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cq-cat">Category</Label>
                  <select id="cq-cat" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as QuestCategory)}>
                    {questCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cq-diff">Difficulty</Label>
                  <select id="cq-diff" className={selectClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestDifficulty)}>
                    {questDifficulties.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase"
                  style={{
                    borderColor: `${activeCategory.color}59`,
                    backgroundColor: `${activeCategory.color}1A`,
                    color: activeCategory.color,
                  }}
                >
                  {activeCategory.label}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase",
                    difficultyChip[difficulty],
                  )}
                >
                  {difficultyLabel(difficulty)}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="cq-xp">XP reward</Label>
                  <Input id="cq-xp" type="number" min={0} required value={xpReward} onChange={(e) => setXpReward(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cq-radius">Radius (m, 10–1000)</Label>
                  <Input id="cq-radius" type="number" min={10} max={1000} required value={radiusMeters} onChange={(e) => setRadiusMeters(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cq-photos">Min photos</Label>
                  <Input id="cq-photos" type="number" min={1} required value={minPhotoCount} onChange={(e) => setMinPhotoCount(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-proof">Proof type</Label>
                <select id="cq-proof" className={selectClass} value={requiredProofType} onChange={(e) => setRequiredProofType(e.target.value as ProofType)}>
                  {proofTypes.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </FormSection>

          <FormSection index="03" title="Schedule">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cq-start">Starts</Label>
                <Input id="cq-start" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-end">Ends</Label>
                <Input id="cq-end" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>
          </FormSection>

          <FormSection index="04" title="Quest location">
            <div className="space-y-3 rounded-[10px] border border-frost/25 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Quest location (required to publish)</Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
                    <MapPin className="h-4 w-4" aria-hidden />
                    Use my location
                  </Button>
                  <Button type="button" size="sm" onClick={() => setPickerOpen(true)}>
                    <MapPin className="h-4 w-4" aria-hidden />
                    Choose on Map
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cq-address">Address (optional)</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
                  <Input
                    id="cq-address"
                    className="pl-9"
                    value={addressText}
                    onChange={(e) => setAddressText(e.target.value)}
                    placeholder="e.g. Lodhi Garden, New Delhi"
                  />
                </div>
              </div>
              {lat.trim() !== "" && lng.trim() !== "" ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-emerald/30 bg-emerald/10 px-3 py-2.5 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-bone">
                    {addressText.trim() || `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`}
                  </span>
                  <span className="shrink-0 font-micro text-[10px] uppercase text-emerald">Location selected</span>
                </div>
              ) : (
                <p className="text-xs text-ash">
                  No location yet. Click “Choose on Map” to drop a marker, or use your current location.
                </p>
              )}
              <details className="group">
                <summary className="cursor-pointer select-none font-micro text-[10px] uppercase text-ash transition-colors hover:text-bone">
                  Advanced coordinates
                </summary>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cq-lat">Latitude</Label>
                    <Input id="cq-lat" type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 28.6139" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cq-lng">Longitude</Label>
                    <Input id="cq-lng" type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="e.g. 77.2090" />
                  </div>
                </div>
              </details>
            </div>
          </FormSection>

          {formError && (
            <p role="alert" className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-frost/15 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={createQuest.isPending}>
              Cancel
            </Button>
            {lat.trim() !== "" && lng.trim() !== "" ? (
              <>
                <Button type="submit" variant="outline" disabled={createQuest.isPending} onClick={() => (publishIntentRef.current = false)}>
                  {createQuest.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Save draft
                </Button>
                <Button type="submit" disabled={createQuest.isPending} onClick={() => (publishIntentRef.current = true)}>
                  {createQuest.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
                  Publish quest
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={createQuest.isPending} onClick={() => (publishIntentRef.current = false)}>
                {createQuest.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null}
                Save draft
              </Button>
            )}
          </div>
        </form>
      </div>

      <LocationPickerModal
        open={pickerOpen}
        initial={
          lat.trim() !== "" && lng.trim() !== ""
            ? { lat: Number(lat), lng: Number(lng), addressText: addressText.trim() || undefined }
            : null
        }
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />
    </div>
  );
}
