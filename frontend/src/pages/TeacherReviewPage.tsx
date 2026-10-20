import {
  Camera,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisplayTitle, MetaRow, Rule, SectionHead } from "@/components/gallery";
import { Logo } from "@/components/Logo";
import { reviewApi } from "@/lib/api";
import { formatDate, proofTypes } from "@/lib/quests";
import type { ReviewQueueItem, VerificationCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-micro text-[10px] uppercase tracking-[0.06em]";

const checkTone: Record<string, string> = {
  PASS: "border-emerald/40 bg-emerald/10 text-emerald",
  FAIL: "border-destructive/40 bg-destructive/10 text-destructive",
  WARN: "border-gold/40 bg-gold/10 text-gold",
  SKIP: "border-frost/30 bg-white/[0.06] text-ash",
};

function CheckBadge({ status }: { status: string }) {
  return <span className={cn(chipBase, checkTone[status] ?? "border-frost/30 bg-white/[0.06] text-ash")}>{status}</span>;
}

function Checks({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((check) => (
        <li
          key={check.id}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-frost/10 pb-1.5 font-micro text-[10px] uppercase last:border-0 last:pb-0"
        >
          <span className="text-ash">{check.checkType}</span>
          <span className="flex items-center gap-2">
            {check.message && <span className="text-ash">{check.message}</span>}
            <CheckBadge status={check.status} />
          </span>
        </li>
      ))}
    </ul>
  );
}

type Decision = "APPROVE" | "REJECT";

function ReviewPanel({
  item,
  onDecide,
  busy,
}: {
  item: ReviewQueueItem;
  onDecide: (submissionId: string, decision: Decision, bonusXp: number, note: string) => Promise<void>;
  busy: boolean;
}) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [bonus, setBonus] = useState("0");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!decision) return;
    setSaving(true);
    setError(null);
    try {
      await onDecide(item.id, decision, Number(bonus) || 0, note.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review");
      setSaving(false);
    }
  };

  if (decision === null) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setDecision("APPROVE")} disabled={busy} className="gap-1.5">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDecision("REJECT")}
          disabled={busy}
          className="border-destructive/40 text-destructive hover:border-destructive/70 hover:bg-destructive/10"
        >
          <XCircle className="mr-1 h-4 w-4" aria-hidden />
          Reject
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 font-micro text-[11px] uppercase text-bone">
          <Sparkles className={cn("h-3.5 w-3.5", decision === "APPROVE" ? "text-emerald" : "text-destructive")} aria-hidden />
          {decision === "APPROVE" ? "Approve & award XP" : "Reject submission"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDecision(null)} disabled={saving} aria-label="Close decision">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      {decision === "APPROVE" ? (
        <div className="grid max-w-[200px] gap-1.5">
          <Label htmlFor="bonus">Bonus XP (max 100)</Label>
          <Input id="bonus" type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">{decision === "REJECT" ? "Reason (shown to the student)" : "Note (optional)"}</Label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            decision === "REJECT"
              ? "e.g. Evidence doesn't match the quest location…"
              : "Anything worth recording with this review…"
          }
          className="w-full resize-none rounded-[6px] border border-frost/40 bg-deep px-3.5 py-2.5 text-sm text-bone shadow-[inset_0_1px_2px_rgba(3,18,26,0.6)] placeholder:text-ash/70 transition-colors focus-visible:border-cyan/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/35"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-3 py-2 font-micro text-[11px] uppercase text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setDecision(null)} disabled={saving}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => void submit()}
          disabled={saving || (decision === "REJECT" && !note.trim())}
          className={decision === "REJECT" ? "border-destructive/50 bg-destructive/15 text-destructive hover:bg-destructive/25" : ""}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Confirm"}
        </Button>
      </div>
    </div>
  );
}

export function TeacherReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewApi.queue();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDecide = async (submissionId: string, decision: Decision, bonusXp: number, note: string) => {
    setBusy(true);
    try {
      await reviewApi.decide(submissionId, {
        decision,
        ...(decision === "APPROVE" ? { bonusXp } : {}),
        ...(note ? { note } : {}),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-16 sm:px-10">
      <section className="flex flex-col gap-5 pt-12 animate-gallery-rise">
        <MetaRow>
          <span>Teacher workspace</span>
          <span>Manual review</span>
        </MetaRow>
        <DisplayTitle lines={["REVIEW"]} />
        <p className="max-w-xl font-micro text-[11px] leading-[1.6] uppercase text-ash">
          Submissions the AI couldn&apos;t auto-resolve. You have final authority — approve to award XP.
        </p>
      </section>

      <Rule />

      <section className="flex flex-col gap-5">
        {error && (
          <p
            role="alert"
            className="rounded-[10px] border border-destructive/40 bg-destructive/10 px-4 py-3 font-micro text-[11px] uppercase text-destructive"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden />
            <p className="font-micro text-[11px] uppercase text-ash">Loading review queue…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[10px] border border-dashed border-frost/25 px-4 py-12 text-center">
            <Logo className="h-12 w-12 opacity-80" />
            <p className="font-micro text-[11px] uppercase text-ash">All caught up — nothing waiting for review.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <SectionHead
              kicker={`${items.length} submission${items.length === 1 ? "" : "s"} waiting`}
              title="Submissions"
              right={<span className="font-micro text-[10px] uppercase text-ash">Teacher review</span>}
            />
            <div className="mt-2 flex flex-col">
              {items.map((item) => {
                const v = item.verification;
                const proof = proofTypes.find((p) => p.value === item.quest.requiredProofType);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-4 border-t border-frost/10 py-5 transition-colors last:border-b hover:bg-white/[0.02]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-[22px] font-medium leading-tight text-bone">
                          {item.quest.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-micro text-[10px] uppercase text-ash">
                          <span>
                            {item.student.firstName} {item.student.lastName} · {formatDate(item.submittedAt)}
                          </span>
                          {item.reSubmissionOf && (
                            <span className={cn(chipBase, "border-cyan/40 bg-cyan/10 text-cyan")}>Resubmission</span>
                          )}
                          <span>{proof?.label}</span>
                        </div>
                      </div>
                      <span className="shrink-0 font-title text-[18px] font-semibold leading-none tracking-normal text-gold text-glow-gold">
                        {Number(item.quest.xpReward)} XP
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {v ? (
                        <div className="rounded-[10px] border border-frost/20 bg-white/[0.04] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 font-micro text-[10px] uppercase tracking-[0.08em] text-ash">
                              <Sparkles className="h-3.5 w-3.5 text-cyan" aria-hidden />
                              AI recommendation
                            </span>
                            <span className="flex flex-wrap items-center gap-2 font-micro text-[10px] uppercase">
                              <span className={cn(chipBase, "border-frost/30 bg-white/[0.06] text-bone")}>
                                {v.overallRecommendation}
                              </span>
                              <span className="text-ash">
                                {v.fraudRisk} risk · {Number(v.overallConfidence ?? 0) * 100}% confidence
                              </span>
                            </span>
                          </div>
                          {v.summary && (
                            <p className="mt-2 font-micro text-[11px] uppercase leading-[1.6] text-ash">{v.summary}</p>
                          )}
                          <div className="mt-3 border-t border-frost/10 pt-3">
                            <Checks checks={v.checks} />
                          </div>
                        </div>
                      ) : (
                        <p className="font-micro text-[11px] uppercase text-ash">
                          No AI result recorded for this submission.
                        </p>
                      )}

                      {item.assets.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {item.assets.map((asset) => (
                            <a
                              key={asset.id}
                              href={asset.secureUrl}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(chipBase, "transition-colors hover:border-emerald/60 hover:text-emerald")}
                            >
                              <Camera className="h-3.5 w-3.5" aria-hidden />
                              {asset.assetType.toLowerCase()} · {Math.round(Number(asset.sizeBytes) / 1024)} KB
                            </a>
                          ))}
                        </div>
                      )}

                      <ReviewPanel item={item} onDecide={handleDecide} busy={busy} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
