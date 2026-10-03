import { Camera, CheckCircle2, ChevronDown, ChevronRight, Crosshair, Loader2, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle, MetaRow, SectionHead } from "@/components/gallery";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { participationApi } from "@/lib/api";
import {
  acceptanceStatusLabel,
  formatDate,
  proofTypes,
  submissionStatusLabel,
} from "@/lib/quests";
import type { AcceptanceDetail, MyAcceptance, Submission } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SubmitModalState {
  acceptance: MyAcceptance;
}

type Tone = "success" | "pending" | "danger" | "muted";

const toneClass: Record<Tone, string> = {
  success: "border-frost/50 text-white",
  pending: "border-frost/25 text-ash",
  danger: "border-destructive/50 text-destructive",
  muted: "border-frost/15 text-ash/70",
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-4 pt-12 animate-gallery-rise">
          <MetaRow>
            <span>My quests</span>
            <span>{items.length} accepted</span>
          </MetaRow>
          <DisplayTitle lines={["MY", "QUESTS"]} />
          <MetaRow>
            <span>Capture evidence at the quest location to earn XP.</span>
          </MetaRow>
        </section>

        {error && (
          <p role="alert" className="border border-destructive/40 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-16">
            <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
            <span className="font-micro text-[11px] uppercase text-ash">Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="border border-frost/20 px-4 py-10 text-center">
            <p className="font-micro text-[11px] uppercase text-ash">
              You haven&apos;t accepted any quests yet. Head to the map and pick one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <SectionHead kicker="Accepted" title="Active quests" />
            <ul className="mt-2 flex flex-col">
              {items.map((item) => {
                const latest = item.latestSubmission;
                return (
                  <li key={item.id} className="flex flex-col gap-3 border-t border-frost/15 py-5 last:border-b">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-display text-[24px] font-normal leading-none text-white">{item.quest.title}</p>
                      <div className="flex items-center gap-3">
                        <StatusChip status={item.status} />
                        <span className="font-micro text-[11px] text-white">{Number(item.xpAwarded) > 0 ? `${Number(item.xpAwarded)} XP earned` : `${Number(item.quest.xpReward)} XP`}</span>
                      </div>
                    </div>
                    <p className="line-clamp-2 max-w-3xl text-sm text-ash">{item.quest.description}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-micro text-[10px] uppercase text-ash">
                        <span>Accepted {formatDate(item.acceptedAt)}</span>
                        {latest && (
                          <span className="flex items-center gap-1.5">
                            Latest: <StatusChip status={latest.status} />
                            {latest.reviewNote ? (
                              <span className="text-destructive">— {latest.reviewNote}</span>
                            ) : null}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void openDetail(item)}
                          disabled={detailLoading}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setSubmitTarget({ acceptance: item })}
                          disabled={!canSubmit(item)}
                          title={
                            canSubmit(item)
                              ? "Upload evidence"
                              : "A submission is still under review, or this quest is done"
                          }
                        >
                          <Camera className="mr-1 h-3.5 w-3.5" aria-hidden />
                          Submit evidence
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-frost/25 bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-frost/15 px-5 py-3">
          <div>
            <h2 className="font-semibold">Submit evidence</h2>
            <p className="text-xs text-ash">{acceptance.quest.title}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
              <p className="font-semibold">Evidence submitted</p>
              <p className="text-sm text-ash">
                Status: <StatusChip status={submitted.status} /> — we're running automated checks.
              </p>
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="evidence-files">Evidence ({proofLabel})</Label>
                <input
                  id="evidence-files"
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime"
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
                {requiredPhotos > 0 && (
                  <p className="mt-1 text-xs text-ash">
                    This quest requires at least {requiredPhotos} photo{requiredPhotos === 1 ? "" : "s"}
                    {acceptance.quest.requiredProofType === "PHOTO_AND_VIDEO" ? " and one video" : ""}.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Your location</Label>
                  <Button type="button" variant="outline" size="sm" onClick={locate} disabled={locating}>
                    {locating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Crosshair className="mr-1 h-3.5 w-3.5" aria-hidden />}
                    Use my location
                  </Button>
                </div>
                {loc ? (
                  <div className="flex items-center gap-2 rounded-[2px] border border-frost/25 bg-white/[0.03] px-3 py-2 text-sm">
                    <MapPin className="h-4 w-4 text-white" aria-hidden />
                    <span>
                      {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                      <span className="text-ash"> (±{loc.accuracy} m)</span>
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
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
                    <div>
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
                {locError && <p className="mt-1 text-xs text-ash">{locError}</p>}
              </div>

              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  rows={2}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you want your teacher to know…"
                  className="mt-1 w-full resize-none rounded-[2px] border border-frost/30 bg-void px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-frost"
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-[2px] border border-destructive/40 px-3 py-2 font-micro text-[11px] uppercase text-destructive">
                  {submitError}
                </p>
              )}

              <div className="flex justify-end gap-2">
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[10px] border border-frost/25 bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-frost/15 px-5 py-3">
          <div>
            <h2 className="font-semibold">{detail.quest.title}</h2>
            <p className="text-xs text-ash">
              {detail.quest.addressText ?? "No address"} · {formatDate(detail.acceptedAt)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          {detail.submissions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[2px] border border-frost/25 bg-white/[0.03] px-4 py-8 text-center text-sm text-ash">
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
    <div className="rounded-[10px] border border-frost/25">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 text-sm">
          {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
          <span className="font-medium">Submitted {formatDate(submission.submittedAt)}</span>
        </div>
        <StatusChip status={submission.status} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-frost/15 px-4 py-3 text-sm">
          {submission.reviewNote && (
            <p className="rounded-[2px] border border-destructive/40 px-3 py-2 text-destructive">
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
                  className="inline-flex items-center gap-1.5 rounded-[2px] border border-frost/25 bg-white/[0.03] px-2.5 py-1.5 text-xs text-ash hover:border-frost/60 hover:text-white"
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
                <span className="text-xs font-medium uppercase tracking-wide text-ash">
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
                      <span className="font-mono">{check.checkType}</span>
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
