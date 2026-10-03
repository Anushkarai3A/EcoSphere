import {
  Archive,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPickerModal, type PickedLocation } from "@/components/map/LocationPickerModal";
import { ApiError, questApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  categoryMeta,
  difficultyLabel,
  formatDate,
  proofTypes,
  questCategories,
  questDifficulties,
} from "@/lib/quests";
import type { CreateQuestInput, ProofType, Quest, QuestCategory, QuestDifficulty } from "@/lib/types";

const statusBadge: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PUBLISHED: "bg-sky-100 text-sky-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface QuestFormState {
  title: string;
  description: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  xpReward: string;
  radiusMeters: string;
  requiredProofType: ProofType;
  minPhotoCount: string;
  startsAt: string;
  endsAt: string;
  addressText: string;
  lat: string;
  lng: string;
}

function emptyForm(): QuestFormState {
  const now = new Date();
  const ends = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    title: "",
    description: "",
    category: "PARK_CLEANING",
    difficulty: "EASY",
    xpReward: "50",
    radiusMeters: "100",
    requiredProofType: "PHOTO",
    minPhotoCount: "1",
    startsAt: toLocalInputValue(now),
    endsAt: toLocalInputValue(ends),
    addressText: "",
    lat: "",
    lng: "",
  };
}

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatCoords(lat: string, lng: string): string {
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function TeacherQuestsPage() {
  const { user } = useAuth();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuestFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await questApi.list();
      setQuests(result.items);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load quests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (user?.role !== "TEACHER") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Teacher workspace</CardTitle>
          <CardDescription>Only verified teachers can create and manage quests.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function set<K extends keyof QuestFormState>(key: K, value: QuestFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setFormError("Couldn't get your location. Please choose a location on the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", pos.coords.latitude.toFixed(6));
        set("lng", pos.coords.longitude.toFixed(6));
        setFormError(null);
      },
      () => {
        setFormError("Couldn't get your location. Please choose a location on the map instead.");
      },
      { timeout: 8000 },
    );
  }

  function handlePickerConfirm(location: PickedLocation) {
    set("lat", location.lat.toFixed(6));
    set("lng", location.lng.toFixed(6));
    if (location.addressText) set("addressText", location.addressText);
    setFormError(null);
    setPickerOpen(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (form.lat.trim() === "" || form.lng.trim() === "" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setFormError("Please choose a location on the map.");
      return;
    }
    if (lat < -90 || lat > 90) {
      setFormError("Latitude must be between -90 and 90.");
      return;
    }
    if (lng < -180 || lng > 180) {
      setFormError("Longitude must be between -180 and 180.");
      return;
    }

    const input: CreateQuestInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      difficulty: form.difficulty,
      xpReward: Number(form.xpReward),
      radiusMeters: Number(form.radiusMeters),
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      requiredProofType: form.requiredProofType,
      minPhotoCount: Number(form.minPhotoCount),
      ...(form.addressText.trim() ? { addressText: form.addressText.trim() } : {}),
      lat,
      lng,
    };

    setSubmitting(true);
    try {
      await questApi.create(input);
      setShowForm(false);
      setForm(emptyForm());
      await refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create quest.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, id: string) {
    setBusyId(id);
    setLoadError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Pencil className="h-6 w-6 text-primary" aria-hidden />
              My quests
            </h1>
            <p className="text-sm text-muted-foreground">
              Draft quests need a location before they can go live.
            </p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" aria-hidden />
            {showForm ? "Close form" : "New quest"}
          </Button>
        </section>

        {loadError && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadError}
          </p>
        )}

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Create a quest</CardTitle>
              <CardDescription>
                Give students a real-world activity. Publish it once it has a location and future end date.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="q-title">Title</Label>
                  <Input id="q-title" required value={form.title} onChange={(e) => set("title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-desc">Description</Label>
                  <textarea
                    id="q-desc"
                    required
                    rows={3}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    className={`${inputClass} h-auto`}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="q-cat">Category</Label>
                    <select id="q-cat" className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value as QuestCategory)}>
                      {questCategories.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="q-diff">Difficulty</Label>
                    <select id="q-diff" className={selectClass} value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as QuestDifficulty)}>
                      {questDifficulties.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="q-xp">XP reward</Label>
                    <Input id="q-xp" type="number" min={0} required value={form.xpReward} onChange={(e) => set("xpReward", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="q-radius">Radius (m, 10–1000)</Label>
                    <Input id="q-radius" type="number" min={10} max={1000} required value={form.radiusMeters} onChange={(e) => set("radiusMeters", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="q-photos">Min photos</Label>
                    <Input id="q-photos" type="number" min={1} required value={form.minPhotoCount} onChange={(e) => set("minPhotoCount", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-proof">Proof type</Label>
                  <select id="q-proof" className={selectClass} value={form.requiredProofType} onChange={(e) => set("requiredProofType", e.target.value as ProofType)}>
                    {proofTypes.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="q-start">Starts</Label>
                    <Input id="q-start" type="datetime-local" required value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="q-end">Ends</Label>
                    <Input id="q-end" type="datetime-local" required value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-3 rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Quest Location (required to publish)</Label>
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
                    <Label htmlFor="q-address">Address (optional)</Label>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        id="q-address"
                        className="pl-9"
                        value={form.addressText}
                        onChange={(e) => set("addressText", e.target.value)}
                        placeholder="e.g. Lodhi Garden, New Delhi"
                      />
                    </div>
                  </div>
                  {form.lat.trim() !== "" && form.lng.trim() !== "" ? (
                    <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      <MapPin className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {form.addressText.trim() || formatCoords(form.lat, form.lng)}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-emerald-600">Location selected successfully</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No location yet. Click “Choose on Map” to drop a marker, or use your current location.
                    </p>
                  )}
                  <details className="group">
                    <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                      Advanced Coordinates
                    </summary>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="q-lat">Latitude</Label>
                        <Input id="q-lat" type="number" step="any" placeholder="e.g. 28.6139" value={form.lat} onChange={(e) => set("lat", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="q-lng">Longitude</Label>
                        <Input id="q-lng" type="number" step="any" placeholder="e.g. 77.2090" value={form.lng} onChange={(e) => set("lng", e.target.value)} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Manually entered coordinates are fine too — they just need to be within the quest radius.
                    </p>
                  </details>
                </div>
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    Create quest
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : quests.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            You haven't created any quests yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {quests.map((quest) => {
              const meta = categoryMeta(quest.category);
              const busy = busyId === quest.id;
              const canPublish = quest.status === "DRAFT";
              const canUnpublish = quest.status === "ACTIVE";
              return (
                <Card key={quest.id}>
                  <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                          {meta.label}
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge[quest.status] ?? "bg-muted text-muted-foreground"}`}>
                          {quest.status}
                        </span>
                        <span className="text-xs font-semibold text-primary">{quest.xpReward} XP</span>
                      </div>
                      <h3 className="mt-1 truncate font-semibold">{quest.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {difficultyLabel(quest.difficulty)} · {formatDate(quest.startsAt)} → {formatDate(quest.endsAt)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" aria-hidden />
                        {quest.addressText ? `${quest.addressText} · ` : ""}
                        {quest._count.acceptances} student{quest._count.acceptances === 1 ? "" : "s"} joined
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {canPublish && (
                        <Button size="sm" disabled={busy} onClick={() => void runAction(() => questApi.publish(quest.id), quest.id)}>
                          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                          <Send className="h-4 w-4" aria-hidden />
                          Publish
                        </Button>
                      )}
                      {canUnpublish && (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void runAction(() => questApi.unpublish(quest.id), quest.id)}>
                          <Archive className="h-4 w-4" aria-hidden />
                          Unpublish
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Delete this quest? This cannot be undone.")) {
                            void runAction(() => questApi.remove(quest.id), quest.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <LocationPickerModal
        open={pickerOpen}
        initial={
          form.lat.trim() !== "" && form.lng.trim() !== ""
            ? {
                lat: Number(form.lat),
                lng: Number(form.lng),
                addressText: form.addressText.trim() || undefined,
              }
            : null
        }
        onClose={() => setPickerOpen(false)}
        onConfirm={handlePickerConfirm}
      />
    </>
  );
}
