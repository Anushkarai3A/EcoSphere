import {
  Archive,
  Loader2,
  MapPin,
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
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
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

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const statusBadge: Record<string, string> = {
  DRAFT: "border-frost/30 bg-white/[0.06] text-ash",
  ACTIVE: "border-emerald/40 bg-emerald/10 text-emerald",
  PUBLISHED: "border-emerald/40 bg-emerald/10 text-emerald",
  EXPIRED: "border-gold/40 bg-gold/10 text-gold",
  ARCHIVED: "border-frost/30 bg-white/[0.06] text-ash",
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

const fieldBase =
  "h-10 w-full rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35";
const inputClass = fieldBase;
const selectClass = fieldBase;

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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 pb-16 pt-12 sm:px-10">
        <SectionHead kicker="Restricted" title="Quest workspace" />
        <MetaRow>
          <span>Only verified teachers can create and manage quests.</span>
        </MetaRow>
      </div>
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
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
        {/* HERO */}
        <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
          <MetaRow>
            <span>Quest workspace</span>
            <span>{quests.length} quests</span>
          </MetaRow>
          <DisplayTitle lines={["MY", "QUESTS"]} />
          <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
            Draft quests need a location before they can go live.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" aria-hidden />
              {showForm ? "Close form" : "New quest"}
            </Button>
          </div>
          {loadError && (
            <p role="alert" className="max-w-xl rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive">
              {loadError}
            </p>
          )}
        </section>

        <Rule />

        {showForm && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-[26px]">Create a quest</CardTitle>
                <CardDescription className="uppercase leading-[1.6]">
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
                  <div className="space-y-3 rounded-[10px] border border-frost/20 bg-deep/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
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
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" aria-hidden />
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
                      <div className="flex items-center gap-2 rounded-[10px] border border-emerald/40 bg-emerald/10 px-3 py-2 text-sm text-bone">
                        <MapPin className="h-4 w-4 shrink-0 text-emerald" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">
                          {form.addressText.trim() || formatCoords(form.lat, form.lng)}
                        </span>
                        <span className="shrink-0 font-micro text-[10px] uppercase text-emerald">Location selected successfully</span>
                      </div>
                    ) : (
                      <p className="font-micro text-[11px] leading-[1.6] text-ash">
                        No location yet. Click “Choose on Map” to drop a marker, or use your current location.
                      </p>
                    )}
                    <details className="group">
                      <summary className="cursor-pointer select-none font-micro text-[11px] uppercase text-ash transition-colors hover:text-bone">
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
                      <p className="mt-2 font-micro text-[11px] leading-[1.6] text-ash">
                        Manually entered coordinates are fine too — they just need to be within the quest radius.
                      </p>
                    </details>
                  </div>
                  {formError && (
                    <p role="alert" className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
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
            <Rule />
          </>
        )}

        {/* QUEST LIST */}
        <section className="flex flex-col gap-5">
          {!loading && quests.length > 0 && (
            <SectionHead
              kicker={`${quests.length} total`}
              title="Your quests"
              right={<span className="font-micro text-[10px] uppercase text-ash">Drafts need a location to publish</span>}
            />
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
              <p className="font-micro text-[11px] uppercase text-ash">Loading…</p>
            </div>
          ) : quests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
              <Logo className="h-12 w-12 opacity-80" />
              <p className="font-micro text-[11px] uppercase text-ash">
                You haven't created any quests yet.
              </p>
            </div>
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
                          <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase tracking-[0.06em] text-ash">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
                              aria-hidden
                            />
                            {meta.label}
                          </span>
                          <span className={`${chipBase} ${statusBadge[quest.status] ?? "border-frost/30 bg-white/[0.06] text-ash"}`}>
                            {quest.status}
                          </span>
                          <span className={`${chipBase} border-gold/40 bg-gold/10 font-title text-[12px] tracking-normal text-gold`}>
                            {quest.xpReward} XP
                          </span>
                        </div>
                        <h3 className="mt-2 truncate font-display text-[22px] font-medium leading-none text-bone">{quest.title}</h3>
                        <p className="mt-1.5 font-micro text-[10px] uppercase tracking-[0.06em] text-ash">
                          {difficultyLabel(quest.difficulty)} · {formatDate(quest.startsAt)} → {formatDate(quest.endsAt)}
                        </p>
                        <p className="mt-1 flex items-center gap-1 font-micro text-[10px] uppercase tracking-[0.06em] text-ash">
                          <MapPin className="h-3 w-3 text-turquoise" aria-hidden />
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
                          className="text-ash hover:text-destructive"
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
        </section>
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
