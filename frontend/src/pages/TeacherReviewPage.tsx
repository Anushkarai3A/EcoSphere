import {
  Camera,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { reviewApi } from "@/lib/api";
import { categoryMeta, formatDate, proofTypes } from "@/lib/quests";
import type { ReviewQueueItem, VerificationCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

const checkTone: Record<string, string> = {
  PASS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  FAIL: "border-destructive/30 bg-destructive/10 text-destructive",
  WARN: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  SKIP: "border-border bg-muted/50 text-muted-foreground",
};

function CheckBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", checkTone[status] ?? "")}>
      {status}
    </span>
  );
}

function Checks({ checks }: { checks: VerificationCheck[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {checks.map((check) => (
        <li key={check.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="font-mono">{check.checkType}</span>
          <span className="flex items-center gap-2">
            {check.message && <span className="text-muted-foreground">{check.message}</span>}
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
        <Button
          size="sm"
          onClick={() => setDecision("APPROVE")}
          disabled={busy}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden />
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setDecision("REJECT")} disabled={busy} className="text-destructive">
          <XCircle className="mr-1 h-4 w-4" aria-hidden />
          Reject
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {decision === "APPROVE" ? "Approve & award XP" : "Reject submission"}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDecision(null)} disabled={saving}>
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
        <Label htmlFor="note">
          {decision === "REJECT" ? "Reason (shown to the student)" : "Note (optional)"}
        </Label>
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
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
          className={decision === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
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
    <div className="flex flex-col gap-4">
      <section>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
            Review queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Submissions the AI couldn't auto-resolve. You have final authority — approve to award XP.
          </p>
        </section>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border bg-muted/40 px-4 py-12 text-center text-sm text-muted-foreground">
            <Logo className="h-12 w-12 opacity-80" />
            All caught up — nothing waiting for review.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {items.length} submission{items.length === 1 ? "" : "s"} waiting
            </p>
            {items.map((item) => {
              const meta = categoryMeta(item.quest.category);
              const v = item.verification;
              const proof = proofTypes.find((p) => p.value === item.quest.requiredProofType);
              return (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
                        <CardTitle className="text-base">{item.quest.title}</CardTitle>
                      </div>
                      <span className="text-sm font-semibold text-primary">{Number(item.quest.xpReward)} XP</span>
                    </div>
                    <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span>
                        {item.student.firstName} {item.student.lastName} · {formatDate(item.submittedAt)}
                      </span>
                      {item.reSubmissionOf && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-600">
                          Resubmission
                        </span>
                      )}
                      <span>{proof?.label}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {v ? (
                      <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            AI recommendation
                          </span>
                          <span className="flex items-center gap-2 text-xs">
                            <span className="font-semibold">{v.overallRecommendation}</span>
                            <span className="text-muted-foreground">
                              {v.fraudRisk} risk · {Number(v.overallConfidence ?? 0) * 100}% confidence
                            </span>
                          </span>
                        </div>
                        {v.summary && <p className="text-xs text-muted-foreground">{v.summary}</p>}
                        <Checks checks={v.checks} />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No AI result recorded for this submission.</p>
                    )}

                    {item.assets.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.assets.map((asset) => (
                          <a
                            key={asset.id}
                            href={asset.secureUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          >
                            <Camera className="h-3.5 w-3.5" aria-hidden />
                            {asset.assetType.toLowerCase()} · {Math.round(Number(asset.sizeBytes) / 1024)} KB
                          </a>
                        ))}
                      </div>
                    )}

                    <ReviewPanel item={item} onDecide={handleDecide} busy={busy} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
  );
}
