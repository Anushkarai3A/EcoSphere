import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Loader2,
  MapPin,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, Rule, SectionHead, Stat } from "@/components/gallery";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { participationApi } from "@/lib/api";
import {
  acceptanceStatusLabel,
  categoryMeta,
  difficultyLabel,
  formatDate,
  proofTypes,
  submissionStatusLabel,
} from "@/lib/quests";
import type {
  AcceptanceDetail,
  MyAcceptance,
  QuestCategory,
  QuestDifficulty,
  Submission,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface SubmitModalState {
  acceptance: MyAcceptance;
}

type Tone = "success" | "pending" | "danger" | "muted";

const toneClass: Record<Tone, string> = {
  success: "border-emerald/45 bg-emerald/10 text-emerald",
  pending: "border-cyan/35 bg-cyan/10 text-cyan",
  danger: "border-destructive/45 bg-destructive/10 text-destructive",
  muted: "border-frost/20 bg-white/[0.04] text-ash/70",
};

/* Mission-card category marker: emoji + the real questCategories colour. */
const categoryEmoji: Record<QuestCategory, string> = {
  TREE_PLANTATION: "🌱",
  WASTE_COLLECTION: "💧",
  PARK_CLEANING: "💧",
  RECYCLING: "♻️",
  BIODIVERSITY: "🐾",
  AWARENESS: "📚",
  OTHER: "⭐",
};

const difficultyChip: Record<QuestDifficulty, string> = {
  EASY: "border-emerald/35 bg-emerald/10 text-emerald",
  MEDIUM: "border-cyan/35 bg-cyan/10 text-cyan",
  HARD: "border-gold/35 bg-gold/10 text-gold",
  EXPERT: "border-coral/35 bg-coral/10 text-coral",
};

const toneFill: Record<Tone, string> = {
  success: "bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.7)]",
  pending: "bg-cyan shadow-[0_0_10px_rgba(34,211,238,0.6)]",
  danger: "bg-destructive shadow-[0_0_10px_rgba(251,113,133,0.6)]",
  muted: "bg-ash/70",
};

function chipLabel(status: string): string {
  if (status in { PASS: 1, FAIL: 1, WARN: 1, SKIP: 1 }) return status;
  if (status in { ACCEPTED: 1, IN_PROGRESS: 1, SUBMITTED: 1, APPROVED: 1, REJECTED: 1, EXPIRED: 1 }) {
    return acceptanceStatusLabel(status as MyAcceptance["status"]);
  }
  return submissionStatusLabel(status as Submission["status"]);
}

function chipTone(status: string): Tone {
  if (status === "PASS" || status === "APPROVED" || status === "AUTO_APPROVED") return "success";
  if (status === "FAIL" || status === "REJECTED" || status === "AUTO_REJECTED") return "danger";
  if (status === "EXPIRED" || status === "SKIP") return "muted";
  return "pending";
}

function StatusChip({ status }: { status: string }) {
  const tone = chipTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase",
        toneClass[tone],
      )}
    >
      {status === "AUTO_APPROVED" || status === "APPROVED" ? (
        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden />
      ) : null}
      {chipLabel(status)}
    </span>
  );
}

/** Visual-only journey readout derived from the acceptance state (no data change). */
function questProgressPct(item: MyAcceptance): number {
  switch (item.status) {
    case "APPROVED":
      return 100;
    case "EXPIRED":
      return 100;
    case "SUBMITTED":
      return 80;
    case "REJECTED":
      return 70;
    case "IN_PROGRESS":
      return 55;
    case "ACCEPTED":
      return 25;
    default:
      return 20;
  }
}

interface QuestMissionCardProps {
  item: MyAcceptance;
  detailsLoading: boolean;
  canSubmit: boolean;
  onOpenDetail: () => void;
  onSubmitEvidence: () => void;
}

/** Mission-style quest card: category colour, difficulty chip, XP, progress, CTA. */
function QuestMissionCard({
  item,
  detailsLoading,
  canSubmit,
  onOpenDetail,
  onSubmitEvidence,
}: QuestMissionCardProps) {
  const latest = item.latestSubmission;
  const meta = categoryMeta(item.quest.category);
  const emoji = categoryEmoji[item.quest.category] ?? categoryEmoji.OTHER;
  const tone = chipTone(item.status);
  const pct = questProgressPct(item);
  const earned = Number(item.xpAwarded) > 0;
  const xpValue = earned ? Number(item.xpAwarded) : Number(item.quest.xpReward);
  const proofLabel =
    proofTypes.find((p) => p.value === item.quest.requiredProofType)?.label ?? item.quest.requiredProofType;

  return (
    <li className="group">
      <article className="glass-panel relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] opacity-75 transition-opacity duration-300 group-hover:opacity-100"
          style={{ backgroundColor: meta.color }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `radial-gradient(115% 85% at 6% 0%, ${meta.color}24, transparent 58%)` }}
        />

        <div className="relative flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border text-xl transition-transform duration-300 group-hover:-translate-y-0.5"
                style={{ borderColor: `${meta.color}59`, backgroundColor: `${meta.color}1A` }}
              >
                {emoji}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase"
                    style={{
                      borderColor: `${meta.color}59`,
                      backgroundColor: `${meta.color}1A`,
                      color: meta.color,
                    }}
                  >
                    <span aria-hidden>{emoji}</span>
                    {meta.label}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-[2px] border px-2 py-1 font-micro text-[10px] uppercase",
                      difficultyChip[item.quest.difficulty],
                    )}
                  >
                    {difficultyLabel(item.quest.difficulty)}
                  </span>
                  <StatusChip status={item.status} />
                </div>
                <h3 className="mt-2 font-display text-[22px] font-medium leading-tight text-bone transition-colors group-hover:text-white">
                  {item.quest.title}
                </h3>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="inline-flex items-baseline gap-1">
                <span className="font-title text-[22px] font-semibold leading-none text-gold text-glow-gold">
                  +{xpValue}
                </span>
                <span className="font-micro text-[10px] uppercase text-gold/80">XP</span>
                <Trophy className="h-3.5 w-3.5 self-center text-gold/70" aria-hidden />
              </span>
              <span className="font-micro text-[10px] uppercase text-gold/70">
                {earned ? "Earned" : "Reward"}
              </span>
            </div>
          </div>

          <p className="line-clamp-2 max-w-3xl text-sm leading-relaxed text-ash">{item.quest.description}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden />
              {item.quest.addressText ?? "On the map"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden />
              Accepted {formatDate(item.acceptedAt)}
            </span>
            {latest && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Latest <StatusChip status={latest.status} />
                {latest.reviewNote ? <span className="text-destructive">— {latest.reviewNote}</span> : null}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between font-micro text-[10px] uppercase text-ash">
              <span>{acceptanceStatusLabel(item.status)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className={cn("h-full rounded-full transition-[width] duration-500", toneFill[tone])}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-frost/10 pt-4">
            <span className="font-micro text-[10px] uppercase text-ash/80">Proof · {proofLabel}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenDetail}
                disabled={detailsLoading}
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                Details
              </Button>
              <Button
                size="sm"
                onClick={onSubmitEvidence}
                disabled={!canSubmit}
                title={
                  canSubmit
                    ? "Upload evidence"
                    : "A submission is still under review, or this quest is done"
                }
              >
                <Camera className="mr-1 h-3.5 w-3.5" aria-hidden />
                Submit evidence
              </Button>
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}

export function StudentQuestsPage() {
  const [items, setItems] = useState<MyAcceptance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitTarget, setSubmitTarget] = useState<SubmitModalState | null>(null);
  const [detail, setDetail] = useState<AcceptanceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await participationApi.myAcceptances();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your quests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (acceptance: MyAcceptance) => {
    setDetailLoading(true);
    try {
      const res = await participationApi.getAcceptance(acceptance.id);
      setDetail(res.acceptance);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load details");
    } finally {
      setDetailLoading(false);
    }
  };

  const canSubmit = (item: MyAcceptance): boolean => {
    if (item.status === "APPROVED" || item.status === "EXPIRED") return false;
    const latest = item.latestSubmission;
    if (latest && (latest.status === "PENDING_VERIFICATION" || latest.status === "PENDING_MANUAL_REVIEW")) {
      return false;
    }
    return true;
  };

  const xpEarned = items.reduce((sum, item) => sum + Number(item.xpAwarded || 0), 0);
  const completedCount = items.filter((item) => item.status === "APPROVED").length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Mission log</span>
          <span>{items.length} accepted</span>
          <span>{xpEarned} XP earned</span>
        </MetaRow>
        <DisplayTitle lines={["YOUR", "QUESTS"]} />
        <MetaRow>
          <span>Capture evidence at the quest location to earn XP.</span>
        </MetaRow>
        <div className="flex flex-wrap gap-x-16 gap-y-6 pt-2">
          <Stat value={String(items.length)} caption="Accepted" />
          <Stat value={String(xpEarned)} caption="XP earned" accent={xpEarned > 0} />
          <Stat value={String(completedCount)} caption="Completed" />
        </div>
      </section>

      <Rule />

      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="glass-panel flex flex-col items-center gap-3 px-4 py-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-cyan" aria-hidden />
          <span className="font-micro text-[11px] uppercase text-ash">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="glass-panel flex flex-col items-center gap-3 px-4 py-14 text-center">
          <Logo className="h-12 w-12 opacity-80" />
          <p className="font-display text-[20px] font-medium text-bone">No quests accepted yet</p>
          <p className="max-w-md font-micro text-[11px] uppercase leading-[1.7] text-ash">
            You haven&apos;t accepted any quests yet. Head to the map and pick one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          <SectionHead
            kicker="Accepted"
            title="Active quests"
            right={
              <span className="font-micro text-[10px] uppercase text-ash">
                {items.length} quest{items.length === 1 ? "" : "s"} · {xpEarned} XP earned
              </span>
            }
          />
          <ul className="mt-4 grid gap-4">
            {items.map((item) => (
              <QuestMissionCard
                key={item.id}
                item={item}
                detailsLoading={detailLoading}
                canSubmit={canSubmit(item)}
                onOpenDetail={() => void openDetail(item)}
                onSubmitEvidence={() => setSubmitTarget({ acceptance: item })}
              />
            ))}
          </ul>
          <Rule className="mt-6" />
        </div>
      )}

      {submitTarget && (
        <SubmitEvidenceModal
          acceptance={submitTarget.acceptance}
          onClose={() => setSubmitTarget(null)}
          onSubmitted={() => void load()}
        />
      )}

      {detail && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

interface SubmitEvidenceModalProps {
  acceptance: MyAcceptance;
  onClose: () => void;
  onSubmitted: () => void;
}

function SubmitEvidenceModal({ acceptance, onClose, onSubmitted }: SubmitEvidenceModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [locError, setLocError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submission | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const proofLabel = proofTypes.find((p) => p.value === acceptance.quest.requiredProofType)?.label;
  const requiredPhotos = acceptance.quest.requiredProofType !== "VIDEO" ? acceptance.quest.minPhotoCount : 0;

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by this browser — enter coordinates manually.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocating(false);
      },
      () => {
        setLocError("Could not get your location — allow access or enter coordinates manually.");
        setLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    void locate();
  }, [locate]);

  const latitude = loc?.lat ?? (manualLat ? Number(manualLat) : null);
  const longitude = loc?.lng ?? (manualLng ? Number(manualLng) : null);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (files.length === 0) {
      setSubmitError("Add at least one photo or video.");
      return;
    }
    if (latitude === null || longitude === null || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setSubmitError("We need your location — tap “Use my location” or enter coordinates.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await participationApi.submitEvidence(acceptance.id, files, {
        lat: latitude,
        lng: longitude,
        accuracy: loc?.accuracy,
        deviceTimestamp: new Date().toISOString(),
        notes: notes.trim() || undefined,
      });
      setSubmitted(res.submission);
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const meta = categoryMeta(acceptance.quest.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-strong relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[20px] border border-frost/25 text-bone">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: meta.color }}
        />
        <div className="flex items-start justify-between gap-3 border-b border-frost/15 px-5 py-4">
          <div className="min-w-0">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-emerald">Evidence upload</p>
            <h2 className="mt-1.5 font-display text-[20px] font-medium leading-tight text-bone">
              Submit evidence
            </h2>
            <p className="mt-1 truncate font-micro text-[10px] uppercase text-ash">{acceptance.quest.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-5 px-5 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-11 w-11 text-emerald" aria-hidden />
              <p className="font-display text-[20px] font-medium text-bone">Evidence submitted</p>
              <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-ash">
                Status: <StatusChip status={submitted.status} /> — we&apos;re running automated checks.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="evidence-files">Evidence ({proofLabel})</Label>
                <input
                  id="evidence-files"
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
                  className="mt-1 block w-full text-sm text-ash file:mr-3 file:cursor-pointer file:rounded-[2px] file:border file:border-frost/30 file:bg-white/5 file:px-3 file:py-2 file:font-micro file:text-[10px] file:uppercase file:text-bone hover:file:border-emerald/60"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                {requiredPhotos > 0 && (
                  <p className="text-xs text-ash">
                    This quest requires at least {requiredPhotos} photo{requiredPhotos === 1 ? "" : "s"}
                    {acceptance.quest.requiredProofType === "PHOTO_AND_VIDEO" ? " and one video" : ""}.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Your location</Label>
                  <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
                    {locating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Crosshair className="mr-1 h-3.5 w-3.5" aria-hidden />}
                    Use my location
                  </Button>
                </div>
                {loc ? (
                  <div className="flex items-center gap-2 rounded-[10px] border border-frost/25 bg-white/[0.04] px-3 py-2.5 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-cyan" aria-hidden />
                    <span>
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      <span className="text-ash"> (±{loc.accuracy} m)</span>
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manual-lat">Latitude</Label>
                      <Input
                        id="manual-lat"
                        type="number"
                        step="any"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="e.g. 28.6129"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="manual-lng">Longitude</Label>
                      <Input
                        id="manual-lng"
                        type="number"
                        step="any"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder="e.g. 77.2295"
                      />
                    </div>
                  </div>
                )}
                {locError && <p className="text-xs text-ash">{locError}</p>}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  rows={2}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you want your teacher to know…"
                  className="mt-1 w-full resize-none rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35"
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
                  {submitError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-frost/10 pt-4">
                <Button variant="outline" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> Uploading…
                    </>
                  ) : (
                    "Submit evidence"
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailModal({ detail, onClose }: { detail: AcceptanceDetail; onClose: () => void }) {
  const meta = categoryMeta(detail.quest.category);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="glass-strong relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[20px] border border-frost/25 text-bone">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ backgroundColor: meta.color }}
        />
        <div className="flex items-start justify-between gap-3 border-b border-frost/15 px-5 py-4">
          <div className="min-w-0">
            <p className="font-micro text-[10px] uppercase tracking-[0.14em] text-emerald">Quest log</p>
            <h2 className="mt-1.5 font-display text-[20px] font-medium leading-tight text-bone">
              {detail.quest.title}
            </h2>
            <p className="mt-1 font-micro text-[10px] uppercase text-ash">
              {detail.quest.addressText ?? "No address"} · {formatDate(detail.acceptedAt)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          {detail.submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/30 bg-white/[0.03] px-4 py-10 text-center text-sm text-ash">
              <Logo className="h-12 w-12 opacity-80" />
              <p>No submissions yet. Upload evidence from the “Submit evidence” button.</p>
            </div>
          ) : (
            detail.submissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const [open, setOpen] = useState(true);
  const verification = submission.verification;

  return (
    <div className="overflow-hidden rounded-[10px] border border-frost/20 bg-white/[0.03]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 text-sm">
          {open ? <ChevronDown className="h-4 w-4 text-cyan" aria-hidden /> : <ChevronRight className="h-4 w-4 text-cyan" aria-hidden />}
          <span className="font-normal">Submitted {formatDate(submission.submittedAt)}</span>
        </div>
        <StatusChip status={submission.status} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-frost/15 px-4 py-3 text-sm">
          {submission.reviewNote && (
            <p className="rounded-[2px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">
              {submission.reviewNote}
            </p>
          )}
          {submission.assets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {submission.assets.map((asset) => (
                <a
                  key={asset.id}
                  href={asset.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-frost/25 bg-white/[0.04] px-2.5 py-1.5 font-micro text-[10px] uppercase text-ash transition-colors hover:border-frost/60 hover:text-white"
                >
                  {asset.assetType === "IMAGE" ? <Camera className="h-3.5 w-3.5" aria-hidden /> : null}
                  {asset.assetType.toLowerCase()} · {Math.round(Number(asset.sizeBytes) / 1024)} KB
                </a>
              ))}
            </div>
          )}
          {verification ? (
            <div className="flex flex-col gap-2 rounded-[10px] border border-frost/20 bg-white/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-normal uppercase tracking-wide text-ash">
                  AI verification
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <StatusChip status={submission.status} />
                  {verification.overallRecommendation && (
                    <span>
                      {verification.overallRecommendation} · {Number(verification.overallConfidence ?? 0) * 100}%
                    </span>
                  )}
                </span>
              </div>
              {verification.checks.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {verification.checks.map((check) => (
                    <li key={check.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-micro uppercase">{check.checkType}</span>
                      <span className="flex items-center gap-2">
                        {check.message && <span className="text-ash">{check.message}</span>}
                        <StatusChip status={check.status as never} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : submission.status === "PENDING_VERIFICATION" || submission.status === "PENDING_MANUAL_REVIEW" ? (
            <p className="text-xs text-ash">
              {submission.status === "PENDING_VERIFICATION"
                ? "Automated checks are running…"
                : "Waiting for your teacher to review this submission."}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
